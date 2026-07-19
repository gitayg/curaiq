import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// Resolves the agent's management binding: the provision file dropped by the unique
// installer (~/.curaiq/config.json), with env overrides and a localhost fallback.
export function loadConfig() {
  const fallback = {
    serverUrl: process.env.CuraIQ_SERVER || "http://localhost:8787",
    tenant: process.env.CuraIQ_TENANT || "unprovisioned"
  };
  // The Rust host writes ~/.curaiq/config.json; older installs used ~/.raiseme. Prefer the former,
  // fall back to the latter, then to env/localhost.
  for (const dir of [".curaiq", ".raiseme"]) {
    try {
      const c = JSON.parse(readFileSync(join(homedir(), dir, "config.json"), "utf8"));
      return { serverUrl: c.serverUrl || fallback.serverUrl, tenant: c.tenant || fallback.tenant, installToken: c.installToken || "" };
    } catch { /* try next */ }
  }
  return fallback;
}
