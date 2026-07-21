# Security Policy

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Report privately to **gitayg@gmail.com** with:

- A description of the issue and its impact.
- Steps to reproduce (proof-of-concept if possible).
- Affected version(s) and component (native app, server, CLI guard).

You'll get an acknowledgement, and we'll work with you on a fix and coordinated disclosure. Please
give a reasonable window to remediate before any public disclosure.

## Scope

In scope: the MoorAI native host, the management server, the CLI guard, and the detection engine.

Out of scope: third-party agents MoorAI launches (Claude Code, Codex, Copilot CLI) — report those
to their respective vendors. Note that MoorAI's on-device policy is **governance, not a sandbox**:
a user in control of their own machine can run an agent outside MoorAI entirely. That's a known
limitation, not a vulnerability.

## Handling of secrets

MoorAI keeps all credentials in environment variables, never in source. Prompt/response content is
reviewed on-device and never transmitted or stored server-side — only redacted metadata is. Reports
of either invariant being broken are treated as high severity.
