import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// Resolves the agent's management binding: the provision file dropped by the unique
// installer (~/.raiseme/config.json), with env overrides and a localhost fallback.
export function loadConfig() {
  const fallback = {
    serverUrl: process.env.RAISEME_SERVER || "http://localhost:8787",
    tenant: process.env.RAISEME_TENANT || "unprovisioned"
  };
  try {
    const c = JSON.parse(readFileSync(join(homedir(), ".raiseme", "config.json"), "utf8"));
    return { serverUrl: c.serverUrl || fallback.serverUrl, tenant: c.tenant || fallback.tenant };
  } catch {
    return fallback;
  }
}
