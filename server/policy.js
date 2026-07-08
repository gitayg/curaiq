import { VERSION } from "./version.js";

// Policy the server distributes to clients. Visibility-only posture: thresholds are
// coaching modes, never "block". Tier-3 cloud egress is off by default.
export const DEFAULT_POLICY = {
  version: VERSION,
  ruleBaseVersion: "0.4.0",
  posture: "voluntary-warn-override",
  approvedTools: ["Approved Assistant"],
  // Agent CLIs a device may launch. Per-policy admin allow-list overrides this default.
  allowedTools: ["claude", "codex", "copilot"],
  thresholds: { Critical: "warn", High: "warn", Medium: "nudge" },
  tier3Egress: false,
  // How often (seconds) the host re-fetches policy. Centrally configurable via the POLL_SECONDS
  // env var; the host clamps to a 15s minimum. Bigger = fewer requests at fleet scale.
  pollSeconds: Math.max(15, Number(process.env.POLL_SECONDS) || 60)
};
