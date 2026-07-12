# CuraIQ

**On-device guardrails for AI coding agents.** CuraIQ is a thin managed layer between your
people and the AI agents they run (Claude Code, Codex, GitHub Copilot CLI). Every prompt is
reviewed **locally, before it reaches the agent** — coach, alert, or block by policy — and your
security team gets **redacted, content-free** signals, never the actual conversations.

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)
![Platform: macOS | Windows](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-lightgrey.svg)

> This repo is the **community agent** — it runs standalone with **local policy control**, no
> account required. Centralized fleet management (multi-tenant console, SSO, compliance reporting)
> is provided by a **separate, proprietary** CuraIQ management server; register to use it.

## How it works

1. **Review on the device.** Each prompt is checked locally against your policy (a 40+ threat
   matrix + content rules) in the moment — content never leaves the machine.
2. **Coach · alert · block.** Let it through, nudge the user, or stop it — per the policy you set
   centrally, per tenant and per device.
3. **Central visibility.** A web console shows posture, device inventory, alerts and compliance —
   from **redacted metadata only** (category, risk, a one-way hash), never prompt content.

## Repository layout

| Path | What |
|------|------|
| `data/threats.json` | The threat rule-base (source of truth) |
| `data/detectors.js`, `data/content-rules.js` | Deterministic detection patterns (EN + HE) |
| `src/engine.js` | Detection engine — scans prompts/output, risk-ranked findings |
| `src/app.js`, `index.html`, `src/styles.css` | The guarded host UI (webview) |
| `src-tauri/` | Native host (Rust + Tauri) — the on-device PTY that runs the agent |
| `src-tauri/src/platform.rs`, `src-tauri/src/winsec.rs` | Per-OS shims (macOS/Windows) + native Windows security posture |
| `cli/curaiq-guard.mjs` | Standalone CLI guard that wraps an agent |
| `docs/` | Architecture, capability spec, release & signing |

## Develop

The webview detection core runs over plain HTTP (ES modules + `fetch`):

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

Wrap an agent from the CLI with the standalone guard:

```bash
npm run guard -- "summarize this for john@acme.com, api_key=sk-..."   # interactive
npm run guard -- --decide redact "..."                                # non-interactive
```

Build the native macOS app (DMG, signed + notarized): see [docs/RELEASE.md](docs/RELEASE.md) and
[docs/SIGNING.md](docs/SIGNING.md). The **Windows** installer (NSIS) is built in CI on a
`windows-latest` runner — push a version tag to trigger
[`.github/workflows/release-windows.yml`](.github/workflows/release-windows.yml). Architecture:
[docs/CAPABILITY_SPEC.md](docs/CAPABILITY_SPEC.md).

## Privacy posture

Review happens **on the device**; prompt/response content is never stored or sent to the server.
Only redacted metadata (category, risk level, a content hash, device/user label) reaches the
console. Secrets are encrypted at rest (AES-256-GCM); sessions are HMAC-signed. See a running
instance's `/privacy` page.

## Security

Found a vulnerability? Please follow [SECURITY.md](SECURITY.md) — **do not** open a public issue
for security reports.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). By contributing you agree your contributions are licensed
under the project license.

## License

CuraIQ is licensed under the **GNU Affero General Public License v3.0** ([LICENSE](LICENSE)). The
AGPL's network-use clause means that if you run a modified CuraIQ server as a network service, you
must make your modified source available to its users. Copyright © 2026 Itay Glick and CuraIQ
contributors.
