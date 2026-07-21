#!/usr/bin/env node
// MoorAI — standalone AI Bill of Materials (AIBOM). Generates a content-free inventory of the AI
// assets configured on THIS machine — providers, models (cloud + local), agent CLIs, and MCP servers
// with capability scope (network / filesystem / credential) — for GRC, audits, and EU AI Act
// record-keeping. Runs the local collectors only; no server, no account, nothing leaves the machine.
//
// Content-free by construction: it reports asset NAMES and COUNTS and infers MCP capability from
// launch config + env var KEYS only — never token values, never the contents of any credential file.
//
//   node cli/moorai-aibom.mjs                 # JSON (default)
//   node cli/moorai-aibom.mjs --format md     # Markdown for a report
//   node cli/moorai-aibom.mjs --format csv    # CSV (components)
//   npm run aibom -- --format md

import { readFileSync, readdirSync } from "node:fs";
import { homedir, hostname } from "node:os";
import { join } from "node:path";

const HOME = homedir();
const read = (p) => { try { return readFileSync(p, "utf8"); } catch { return null; } };
const readJson = (p) => { const t = read(p); if (!t) return null; try { return JSON.parse(t); } catch { return null; } };
const listDir = (p) => { try { return readdirSync(p, { withFileTypes: true }); } catch { return []; } };
// Minimal `key = "value"` (TOML) / `key: value` (YAML) scan — tolerant, no dependency.
const cfgVal = (txt, key, sep) => {
  for (const line of (txt || "").split("\n")) {
    const l = line.trim();
    if (l.startsWith(key)) {
      const rest = l.slice(key.length).trimStart();
      if (rest.startsWith(sep)) { const v = rest.slice(1).trim().replace(/^["']|["']$/g, "").trim(); if (v) return v; }
    }
  }
  return null;
};

// ---- providers / models / agents ----
function providers() {
  const out = [];
  const claude = readJson(join(HOME, ".claude", "settings.json"));
  if (claude) out.push({ provider: "Anthropic", agent: "claude", model: claude.model || null, source: "settings.json" });
  const codex = read(join(HOME, ".codex", "config.toml"));
  if (codex) out.push({ provider: cfgVal(codex, "model_provider", "=") || "OpenAI", agent: "codex", model: cfgVal(codex, "model", "="), source: "config.toml" });
  const aider = read(join(HOME, ".aider.conf.yml"));
  if (aider) out.push({ provider: "Aider", agent: "aider", model: cfgVal(aider, "model", ":"), source: "aider.conf.yml" });
  return out;
}

function localModels() {
  const out = [];
  for (const e of listDir(join(HOME, ".ollama/models/manifests/registry.ollama.ai/library"))) out.push({ runtime: "ollama", name: e.name });
  for (const dir of [join(HOME, ".lmstudio/models"), join(HOME, ".cache/lm-studio/models")])
    for (const e of listDir(dir)) if (e.isDirectory()) out.push({ runtime: "lmstudio", name: e.name });
  return out;
}

// ---- MCP servers + capability scope (env KEYS only, never values) ----
function mcpCaps(cfg) {
  const parts = [cfg.command || "", ...(Array.isArray(cfg.args) ? cfg.args : [])].join(" ").toLowerCase();
  const remote = !!cfg.url || cfg.type === "sse" || cfg.transport === "sse";
  const net = remote || ["fetch", "brave-search", "puppeteer", "playwright", "firecrawl", "http"].some((k) => parts.includes(k));
  const fs = parts.includes("filesystem") || parts.includes("server-files") || parts.includes(" files ");
  let cred = ["github", "gitlab", "slack", "aws", "gdrive", "google-drive", "notion", "stripe", "jira"].some((k) => parts.includes(k));
  if (cfg.env && typeof cfg.env === "object")
    for (const k of Object.keys(cfg.env)) if (["TOKEN", "KEY", "SECRET", "PASSWORD", "CREDENTIAL"].some((s) => k.toUpperCase().includes(s))) { cred = true; break; }
  return { net, fs, cred };
}
function mcpLevel(caps) { let s = 0; if (caps.net) s += 25; if (caps.fs) s += 25; if (caps.cred) s += 35; if (caps.net && caps.cred) s += 15; return s >= 60 ? "high" : s >= 30 ? "med" : "low"; }
function mcpServers() {
  const seen = new Set(), out = [];
  const add = (map, scope) => { if (!map) return; for (const [name, cfg] of Object.entries(map)) { const k = `${scope}:${name}`; if (!name || seen.has(k)) continue; seen.add(k); const caps = mcpCaps(cfg || {}); out.push({ name, scope, transport: (cfg.url || cfg.type === "sse" || cfg.transport === "sse") ? "remote" : "stdio", caps, level: mcpLevel(caps) }); } };
  const claude = readJson(join(HOME, ".claude.json"));
  if (claude) { add(claude.mcpServers, "claude"); if (claude.projects) for (const p of Object.values(claude.projects)) add(p.mcpServers, "claude"); }
  add(readJson(join(HOME, ".cursor", "mcp.json"))?.mcpServers, "cursor");
  return out;
}

function buildAibom() {
  const prov = providers(), local = localModels(), mcp = mcpServers();
  const models = [...prov.filter((p) => p.model).map((p) => ({ name: p.model, provider: p.provider, local: false })),
    ...local.map((m) => ({ name: m.name, provider: m.runtime, local: true }))];
  const components = [
    ...models.map((m) => ({ type: "model", name: m.name, provider: m.provider, local: m.local })),
    ...[...new Set(prov.map((p) => p.agent))].map((a) => ({ type: "agent", name: a })),
    ...mcp.map((s) => ({ type: "mcp-server", name: s.name, riskLevel: s.level, capabilities: s.caps, transport: s.transport }))
  ];
  return {
    bomFormat: "MoorAI-AIBOM", specVersion: "1.0", scope: "device", device: hostname(), generatedAt: new Date().toISOString(),
    summary: { providers: new Set(prov.map((p) => p.provider)).size, models: models.length, localModels: local.length, agents: new Set(prov.map((p) => p.agent)).size, mcpServers: mcp.length, mcpHighRisk: mcp.filter((s) => s.level === "high").length },
    providers: prov, localModels: local, mcpServers: mcp, components
  };
}

// ---- renderers ----
function toMarkdown(d) {
  const cap = (c) => [c.net && "net", c.fs && "fs", c.cred && "cred"].filter(Boolean).join(" · ") || "—";
  const s = d.summary;
  return `# MoorAI — AI Bill of Materials\n\n`
    + `**Device:** ${d.device}  ·  **Generated:** ${d.generatedAt}  ·  **Scope:** this device only\n\n`
    + `Content-free inventory — asset names and counts only. No tokens, prompts, or file contents.\n\n`
    + `| Providers | Models | Local models | Agent CLIs | MCP servers | High-risk MCP |\n|---|---|---|---|---|---|\n`
    + `| ${s.providers} | ${s.models} | ${s.localModels} | ${s.agents} | ${s.mcpServers} | ${s.mcpHighRisk} |\n\n`
    + `## AI providers & models\n\n| Provider | Agent | Model | Source |\n|---|---|---|---|\n`
    + (d.providers.map((p) => `| ${p.provider} | ${p.agent} | ${p.model || "—"} | ${p.source} |`).join("\n") || "| — | — | — | — |")
    + (d.localModels.length ? `\n\n## Local models\n\n| Runtime | Model |\n|---|---|\n` + d.localModels.map((m) => `| ${m.runtime} | ${m.name} |`).join("\n") : "")
    + `\n\n## MCP servers\n\n| Server | Scope | Transport | Capabilities | Risk |\n|---|---|---|---|---|\n`
    + (d.mcpServers.map((m) => `| ${m.name} | ${m.scope} | ${m.transport} | ${cap(m.caps)} | ${m.level} |`).join("\n") || "| — | — | — | — | — |")
    + `\n\n---\nGenerated on-device by MoorAI. This is a content-free inventory to support GRC and EU AI Act record-keeping — not a certification.\n`;
}
function toCsv(d) {
  const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return ["type,name,detail", ...d.components.map((c) => {
    const detail = c.type === "model" ? `${c.provider || ""}${c.local ? " (local)" : ""}`
      : c.type === "mcp-server" ? `risk=${c.riskLevel}; caps=${["net", "fs", "cred"].filter((k) => c.capabilities?.[k]).join("|") || "none"}` : "";
    return [c.type, c.name, detail].map(q).join(",");
  })].join("\n") + "\n";
}

const HELP = `MoorAI AIBOM — content-free AI Bill of Materials for this machine.

Usage:
  moorai-aibom [--format json|md|csv]   (default: json)
  moorai-aibom --help

What it reads (configuration metadata ONLY — never a token value, never a prompt,
never the contents of any credential file):
  ~/.claude/settings.json                          default model for Claude Code
  ~/.codex/config.toml                             model + provider for Codex
  ~/.aider.conf.yml                                model for Aider
  ~/.claude.json                                   configured MCP servers (global + per-project)
  ~/.cursor/mcp.json                               configured MCP servers for Cursor
  ~/.ollama/models/manifests/.../library/          local Ollama model names (directory listing)
  ~/.lmstudio/models, ~/.cache/lm-studio/models    local LM Studio model names (directory listing)

For each MCP server it infers capability scope (network / filesystem / credential)
from the launch command, its args, and environment-variable NAMES only — it never
reads an environment-variable VALUE and never opens a secret. Output is asset
names, counts, and risk levels. Nothing leaves the machine.
`;

if (process.argv.includes("--help") || process.argv.includes("-h")) { process.stdout.write(HELP); process.exit(0); }

const fmt = (process.argv.includes("--format") ? process.argv[process.argv.indexOf("--format") + 1] : "json");
const bom = buildAibom();
process.stdout.write(fmt === "md" ? toMarkdown(bom) : fmt === "csv" ? toCsv(bom) : JSON.stringify(bom, null, 2) + "\n");
