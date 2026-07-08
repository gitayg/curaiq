#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline/promises";
import os from "node:os";
import { DETECTORS } from "../data/detectors.js";
import { CONTENT_RULES } from "../data/content-rules.js";
import { DetectionEngine } from "../src/engine.js";
import { loadConfig } from "./config.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG = loadConfig();
const SERVER = CONFIG.serverUrl;
const threatData = JSON.parse(readFileSync(join(ROOT, "data/threats.json"), "utf8"));
const engine = new DetectionEngine(threatData, DETECTORS, CONTENT_RULES);

async function getPolicy() {
  try { return await fetch(`${SERVER}/api/policy?tenant=${encodeURIComponent(CONFIG.tenant)}`, { signal: AbortSignal.timeout(2000) }).then((r) => r.json()); }
  catch { return null; }
}

const C = { red: "\x1b[31m", org: "\x1b[33m", blue: "\x1b[34m", green: "\x1b[32m", dim: "\x1b[2m", bold: "\x1b[1m", off: "\x1b[0m" };
const color = (lvl) => (lvl === "Critical" ? C.red : lvl === "High" ? C.org : C.blue);

function parseArgs(argv) {
  const out = { decide: null, prompt: "" };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--decide") out.decide = argv[++i];
    else rest.push(argv[i]);
  }
  out.prompt = rest.join(" ").trim();
  return out;
}

function djb2(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return "h" + h.toString(16); }

const IDENTITY = { user: os.userInfo().username, device: os.hostname(), platform: os.platform(), tenant: CONFIG.tenant };

function post(alert) {
  return fetch(`${SERVER}/api/alerts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(alert) }).catch(() => {});
}

function reportAlert(finding, content, blocked = false) {
  return post({
    threatId: finding.threat.id, category: finding.threat.category, riskLevel: blocked ? "Blocked" : finding.threat.riskLevel,
    stage: "egress", tool: "claude -p", ts: new Date().toISOString(), contentHash: djb2(content), ...IDENTITY
  });
}

function reportContent(c, enforce) {
  return post({
    threatId: 0, category: `Content: ${c.label}`, riskLevel: enforce ? "Blocked" : "High",
    stage: "shared", tool: "claude -p", ts: new Date().toISOString(), contentHash: djb2(c.match), ...IDENTITY
  });
}

function printContent(content, enforce) {
  const tag = enforce ? `${C.red}BLOCKED (policy)` : `${C.org}CONTENT`;
  for (const c of content) {
    console.error(`  ${tag}${C.off}  ${c.label}  ${C.dim}matched:${C.off} ${c.match}`);
  }
}

function printFindings(findings) {
  console.error(`\n${C.bold}RAISEME pre-flight review${C.off} ${C.dim}— ${findings.length} issue(s) before sending to claude -p${C.off}\n`);
  for (const f of findings) {
    const c = color(f.threat.riskLevel);
    console.error(`  ${c}● ${f.mode === "coach" ? "COACH" : f.threat.riskLevel}${C.off}  #${f.threat.id} ${f.threat.threat}  ${C.dim}[${f.threat.category}]${C.off}`);
    console.error(`     ${C.dim}matched:${C.off} ${f.match}`);
    console.error(`     ${f.threat.response}\n`);
  }
}

async function decide(decideFlag) {
  if (decideFlag) return decideFlag;
  if (!process.stdin.isTTY) return "abort";
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  const ans = (await rl.question(`${C.bold}Proceed?${C.off} [p]roceed as-is / [r]edact then send / [a]bort: `)).trim().toLowerCase();
  rl.close();
  return ans.startsWith("p") ? "proceed" : ans.startsWith("r") ? "redact" : "abort";
}

function runClaude(prompt) {
  return new Promise((resolve) => {
    const child = spawn("claude", ["-p", prompt], { stdio: ["ignore", "inherit", "inherit"] });
    child.on("error", (e) => { console.error(`${C.red}failed to run claude:${C.off} ${e.message}`); resolve(1); });
    child.on("close", (code) => resolve(code ?? 0));
  });
}

async function main() {
  const { decide: decideFlag, prompt } = parseArgs(process.argv.slice(2));
  if (!prompt) { console.error("usage: raiseme-guard [--decide proceed|redact|abort] <prompt>"); process.exit(2); }

  const policy = await getPolicy();
  const tp = policy?.threatPolicy || {};
  const cp = policy?.contentPolicy || {};
  const action = (f) => tp[f.threat.id] || "notify";
  const allFindings = engine.scan(prompt, "prompt").filter((f) => action(f) !== "disabled");
  const contentOn = Object.keys(cp).filter((id) => cp[id] && cp[id] !== "disabled");
  const allContent = contentOn.length ? engine.scanContent(prompt, contentOn) : [];

  // Report every active detection to the dashboard (incl. silent "alert").
  if (allFindings.length || allContent.length) {
    await Promise.allSettled([
      ...allFindings.map((f) => reportAlert(f, f.match, action(f) === "block")),
      ...allContent.map((c) => reportContent(c, cp[c.ruleId] === "block"))
    ]);
  }

  // Visible to the user = notify/block only; silent "alert" never prompts or prints.
  const findings = allFindings.filter((f) => action(f) !== "alert");
  const content = allContent.filter((c) => cp[c.ruleId] !== "alert");
  const blockedFindings = allFindings.filter((f) => action(f) === "block");
  const blockedContent = allContent.filter((c) => cp[c.ruleId] === "block");

  if (!findings.length && !content.length) {
    console.error(`${C.green}✓ RAISEME: clean — forwarding to claude -p${C.off}\n`);
    process.exit(await runClaude(prompt));
  }

  if (findings.length) printFindings(findings);
  if (content.length) { console.error(`\n${C.bold}Parental-control review${C.off}`); for (const c of content) printContent([c], cp[c.ruleId] === "block"); console.error(""); }

  // Hard block: any threat or content category set to "block". The user cannot override.
  const hardBlock = blockedFindings.length > 0 || blockedContent.length > 0;
  if (hardBlock) {
    const parts = [];
    if (blockedFindings.length) parts.push(`threat policy (#${blockedFindings.map((f) => f.threat.id).join(", #")})`);
    if (blockedContent.length) parts.push(`content policy (${blockedContent.map((c) => c.label).join(", ")})`);
    console.error(`${C.red}✗ blocked by ${parts.join(" + ")} — nothing sent to claude -p${C.off}`);
    process.exit(3);
  }

  const choice = await decide(decideFlag);
  if (choice === "abort") { console.error(`${C.red}✗ aborted — nothing sent to claude -p${C.off}`); process.exit(1); }

  let final = prompt;
  if (choice === "redact") {
    final = engine.redact(prompt, "prompt");
    console.error(`${C.org}↻ redacted before sending:${C.off} ${final}\n`);
  } else {
    console.error(`${C.org}⚠ proceeding as-is (override logged)${C.off}\n`);
  }
  process.exit(await runClaude(final));
}

main();
