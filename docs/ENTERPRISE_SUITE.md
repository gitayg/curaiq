# RAISEME — Enterprise Managed AI Security Suite

**Version:** 0.1 · Supersedes the single-surface framing in [CAPABILITY_SPEC.md](CAPABILITY_SPEC.md)
for enterprise scope. Threat IDs reference [data/threats.json](../data/threats.json).

---

## 0. The Protection Harness is the alerting core

Everything below hangs off the **Protection Harness** — the PDP / detection brain already defined
in [CAPABILITY_SPEC.md](CAPABILITY_SPEC.md). Per the established posture (**"alerted, not
enforced"**), the harness's native action on *every detectable issue* is to **ALERT**: inline to
the user (warn + override) and, redacted, to the central dashboard.

**Alert is the universal baseline.** Block / Warn / Coach below are not alternatives to alerting —
they are the **ceiling of action available above the alert** at each surface. A hard **block is an
opt-in policy escalation**, available *only* where a surface can deterministically intercept
(MCP gateway, API proxy, network, identity). The browser can only warn; signal-less threats can
only coach. But all 40 detectable items **alert** regardless.

## 1. Can one agent protect against all 40? — the honest answer

**No single agent or surface can.** The 40 threats live on *different boundaries*, and some have
no in-band technical signal at all. What *can* cover all 40 is **one Protection Harness fed by a
layered suite** of enforcement points. Every detectable item alerts; the *ceiling* above that
baseline differs honestly by surface:

| Ceiling | Meaning (above the universal alert baseline) | Where it's possible | # of items |
|---|---|---|---|
| 🔴 **Block** | alert **+ opt-in** deterministic prevention before harm | MCP gateway, API proxy, network, identity | ~13 |
| 🟡 **Warn** | alert **+** inline override; user can proceed | managed browser workspace (DLP/output) | ~13 |
| 🔵 **Coach** | alert is not possible (no signal) — awareness/process only | UX nudges, training, verification policy | ~10 |
| ⚙️ **Integrate** | alert/handled by an existing enterprise control | IdP, MDM, email security, data governance | ~5 |

The takeaway for stakeholders: the harness **alerts on** every detectable item, **can prevent**
about a third deterministically (if policy opts in), and is honest that ~10 (deepfakes, vishing,
bias, overconfidence…) are human-judgment risks software can only coach — not even alert on.

---

## 2. MCP vs Browser — two different boundaries, not competitors

This is the central architectural question. They intercept **different traffic** and cover
**different threats**. Neither subsumes the other.

| Dimension | **Browser surface** (managed host / extension) | **MCP surface** (gateway / proxy) |
|---|---|---|
| Boundary it sits on | **human ↔ AI** chat UI | **AI ↔ tools/connectors** |
| What it sees | prompts, pastes, uploads, AI responses | tool definitions, tool calls + params, tool results |
| AI usage type | conversational / chat | agentic / tool-using |
| Enforcement power | **coach / warn** (can't reliably stop a human in a rendered web app) | **deterministic block** (deny a tool call before it executes) |
| Determinism | semi — DOM & rendering variance | high — structured JSON-RPC protocol |
| Native/desktop AI apps | no (browser-bound) unless it's the managed host | yes, if the client speaks MCP |
| Bypass | trivial (open another browser) unless network-enforced | only by bypassing the gateway |
| Maturity | mature (extensions, webviews) | emerging (MCP, 2024+) but standardized |
| Threats it owns | DLP (1,9,15,33,39), injection-in (2,3), output safety (8,17,29,32,34,35), shadow tools (7,28), context mixing (36), sharing (20,37) | excessive agency (14,23), tool misuse (24), connector/MCP poisoning (25), second-order injection→action (40), memory writes (22), cost/loops (38) |

**The key distinction:** the **browser is an observation/coaching point**; the **MCP layer is an
enforcement point.** At MCP you can deterministically intercept and *deny* an action — true
prevention. At the browser you're mostly *warning* a human who can click "proceed anyway." An
enterprise suite needs **both**, because chat-DLP and agent-action-control are disjoint problems.

---

## 3. The general-purpose harness — yes, build it as the core

The **general-purpose harness is the Protection Harness from §0**, generalized across surfaces: a
single AI-aware mediation layer that *all* AI traffic flows through, regardless of modality — chat,
agent, IDE, CLI. The surfaces become thin **collectors**; the harness is the **alerting brain +
policy decision point**. This is the correct enterprise architecture, and it maps cleanly to the
classic security control model:

- **PEPs (Policy Enforcement Points)** = the surfaces: managed workspace, MCP gateway, API proxy,
  network/endpoint sensors, identity.
- **PDP (Policy Decision Point)** = the harness: the shared 3-tier detection brain
  (rules → local LLM → policy-gated cloud SDK). One verdict logic, one rule-base, one audit trail.
- **PAP (Policy Administration Point)** = the control plane on **crane.glick.run**: policy authoring,
  rule-base distribution, alert ingestion, dashboard.

Why a harness rather than N independent agents:
- **One brain, many eyes.** A new AI modality = a new adapter, *same* engine, policy, and dashboard.
- **Correlation.** Second-order injection (40) is only visible if the harness links a *browser*
  paste to a later *MCP* tool call. Independent agents can't correlate; the harness can.
- **Consistency.** One policy and one audit log instead of five tools drifting apart.

```
   ┌─────────────────────────── Control Plane (crane.glick.run) ──────────────────────────┐
   │   policy authoring · rule-base · allowlist · alert ingestion · security dashboard      │
   └───────────────▲───────────────────────────────────────────────────────▲──────────────┘
                   │ policy ↓ / alerts ↑ (redacted)                          │
   ┌───────────────┴───────────────────── Harness (PDP) ────────────────────┴──────────────┐
   │   detection brain: Tier-1 rules → Tier-2 local LLM → Tier-3 cloud SDK · correlation     │
   └──▲──────────────▲──────────────────▲──────────────────▲──────────────────▲─────────────┘
      │ events       │                  │                  │                  │
 ┌────┴────┐  ┌──────┴──────┐   ┌───────┴───────┐  ┌────────┴───────┐  ┌───────┴────────┐
 │ Managed │  │ MCP Gateway │   │  AI API /     │  │ Network /      │  │ Identity (IdP) │
 │Workspace│  │  (agentic)  │   │ Egress Proxy  │  │ Endpoint (EDR) │  │  SSO / MFA     │
 │ (chat)  │  │             │   │ (apps/IDE/CLI)│  │                │  │                │
 └─────────┘  └─────────────┘   └───────────────┘  └────────────────┘  └────────────────┘
   🟡 coach      🔴 block            🔴 block            🔴 block            ⚙️ config
```

---

## 4. The five enforcement points (PEPs)

1. **Managed AI Workspace** — the native host with the managed webview. PEP for *conversational*
   AI. Coaching + DLP + output safety. (The earlier "Managed AI Host".)
2. **MCP Gateway** — proxy between AI clients and MCP servers/tools. PEP for *agentic* AI. The
   strongest enforcement layer: deterministic allow/deny on tool calls, human-in-the-loop for
   high-risk actions, tool-manifest pinning.
3. **AI API / Egress Proxy** — forward/reverse proxy for direct model-API traffic from apps, IDEs,
   and CLIs. DLP, data-residency routing, token/cost quotas, model allowlist.
4. **Network / Endpoint sensors** — detect shadow-AI domains, enforce browser-extension allowlists
   (MDM), and EDR-block execution of AI-generated code.
5. **Identity (IdP integration)** — SSO + MFA, no shared accounts, session governance.

---

## 5. Per-item protection plan (all 40)

Legend — **Surface:** MW = Managed Workspace · GW = MCP Gateway · AP = API/Egress Proxy ·
NE = Network/Endpoint · ID = Identity · CP = Control Plane/governance · UX = UX design.
**Ceiling** (every detectable item **alerts** by default — this is the action *above* that alert):
🔴 Block (opt-in policy) · 🟡 Warn+override · 🔵 Coach (no alert signal) · ⚙️ Integrate.

| # | Threat | Surface | Mechanism | Mode |
|---|---|---|---|---|
| 1 | Sensitive data leak | MW, AP | Pre-submit DLP (entities/regex); proxy blocks egress to unapproved endpoints | 🟡 / 🔴 |
| 2 | Direct prompt injection | MW, AP | Phrase detection on prompt + on output; harness never auto-executes AI instructions | 🟡 |
| 3 | Indirect prompt injection | MW, GW, AP | Scan external content before it's fed; mark untrusted; spotlight/delimit | 🟡 |
| 4 | Malicious skills/plugins | NE, GW, CP | Approved-connector allowlist; block unapproved MCP servers; MDM blocks installs | 🔴 / ⚙️ |
| 5 | Plugins excessive permissions | GW, CP | Least-privilege scope review; deny over-broad connector scopes at gateway | 🔴 |
| 6 | Permissions over-exposure | CP, ID | Sensitivity-label / access governance on the enterprise AI platform | ⚙️ |
| 7 | Shadow AI | NE, MW | Network detection of AI domains; redirect to managed workspace; allowlist | 🔴 / 🟡 |
| 8 | Hallucinations | MW | Output scan for unverified claims/citations; Tier-2 check; verify nudge | 🔵 |
| 9 | IP exposure | MW, AP | DLP for code/strategy markers (roadmap, architecture, proprietary) | 🟡 / 🔴 |
| 10 | AI phishing | CP, UX | Integrate email security; coach "polish ≠ authentic" | ⚙️ / 🔵 |
| 11 | BEC | UX, MW | Coach; surface second-channel-verify reminder when payment/bank context appears | 🔵 |
| 12 | Deepfake voice/video | UX | No in-band signal — verification policy + training | 🔵 |
| 13 | Vishing / Smishing | UX, NE | Coach; MDM/mobile link protection | 🔵 |
| 14 | Auto-action on user's behalf | GW | Human-in-the-loop approval for write/sensitive tool calls | 🔴 |
| 15 | Privacy (PII) violation | MW, AP | DLP entities (id/medical/salary) pre-submit + on upload | 🟡 |
| 16 | Bias / discrimination | CP, UX | Flag HR/screening use-cases; require human review; model eval | 🔵 |
| 17 | Dangerous links/scripts (output) | MW, NE | Scan output for code/links; EDR blocks execution; CDR on files | 🟡 / 🔴 |
| 18 | Sensitive data retained in chat | MW | Detect sensitive upload; offer delete; ephemeral sessions; retention policy | 🟡 |
| 19 | Meeting-assistant transcription | CP, MW | Approved-bot allowlist; consent prompts; block unapproved transcription tools | 🔴 / 🔵 |
| 20 | Summary leak (email/Teams) | MW, AP | DLP on generated summary before share; recipient check | 🟡 |
| 21 | RAG poisoning | CP | Source provenance/signing; content validation in the RAG pipeline | ⚙️ |
| 22 | Memory poisoning | GW | Validate/approve memory writes; scope & review agent memory | 🔴 |
| 23 | Excessive agency | GW | Capability allowlist; least privilege; per-tool risk policy; HITL for high-risk | 🔴 |
| 24 | Tool misuse | GW | Read-only default; parameter validation; constrain destructive tools | 🔴 |
| 25 | MCP/connector poisoning | GW | Pin/sign tool manifests; detect description "rug-pull"; server allowlist | 🔴 |
| 26 | AI account takeover | ID | Enforce SSO+MFA; no shared accounts; session governance | ⚙️ |
| 27 | Leakage via history/uploads | MW | Ephemeral sessions; no-train accounts; upload guard | 🟡 |
| 28 | Browser extensions w/ access | NE | Extension allowlist via enterprise-browser MDM policy | 🔴 / 🔵 |
| 29 | Fabricated links/sources | MW | Resolve/verify citations & URLs in output | 🟡 |
| 30 | AI invoice fraud | UX, MW | Bank-detail-change detection; pre-known-channel verify policy | 🔵 |
| 31 | Synthetic identity | CP, UX | HR/vendor onboarding verification; coach | 🔵 |
| 32 | AI-assisted malware code | MW, NE | Scan generated code; EDR blocks execution on corporate machine | 🟡 / 🔴 |
| 33 | Data residency | AP, CP | Route only to approved regional endpoints; block others at proxy | 🔴 |
| 34 | Misleading translation | MW, UX | Coach: human review required for binding documents | 🔵 |
| 35 | Overconfidence | UX | Frame AI output as draft; confidence cues; verification prompts | 🔵 |
| 36 | Cross-context leakage | MW | Per-context (customer/project) session isolation | 🟡 |
| 37 | Unauthorized output sharing | MW | DLP scan of screenshot/output before share (names, tokens, links) | 🟡 |
| 38 | Cost abuse | AP, GW | Rate limits, token budgets, loop detection; throttle | 🔴 |
| 39 | Prompt leakage | MW, AP | DLP for internal-prompt/template markers | 🟡 |
| 40 | Second-order injection | GW, AP | Treat tool-result-derived tasks as untrusted; HITL; provenance tagging; harness correlation | 🔴 |

---

## 6. Coverage summary by surface

- **MCP Gateway** is the deterministic-prevention engine: items **4, 5, 14, 22, 23, 24, 25, 38, 40**.
- **API/Egress Proxy** adds hard blocks for **1, 33, 38** and DLP backstop for **9, 15, 39**.
- **Managed Workspace** owns the warn/coach DLP + output set: **1, 2, 3, 9, 15, 17, 18, 20, 27, 29,
  36, 37, 39** (+ shadow-AI redirect 7).
- **Network/Endpoint** enforces **7, 17, 28, 32**.
- **Identity** prevents **26**; **governance/integration** carries **6, 19, 21, 31**.
- **Coach-only (no in-band signal):** **8, 10, 11, 12, 13, 16, 30, 34, 35** — software's ceiling here
  is awareness, not prevention. State this plainly.

---

## 7. Build phasing (suite)

- **Phase 1 — Managed Workspace** (the v0.6 MVP): chat DLP + output safety + warn-and-override,
  driven by `threats.json` / `detectors.json`. Covers the 🟡 set.
- **Phase 2 — MCP Gateway**: the deterministic enforcement layer for agentic AI. Highest security
  value per effort; unlocks the 🔴 agent-action set (14/22/23/24/25/40/38).
- **Phase 3 — API/Egress Proxy + Network sensors**: DLP backstop, data residency, shadow-AI,
  cost control, endpoint execution blocks.
- **Phase 4 — Control plane maturity**: correlation across surfaces, identity integration,
  governance hooks, full dashboard.

The harness (PDP) + control plane (PAP) are built **once** in Phase 1 and every later phase just
adds a PEP adapter — that's the payoff of the general-purpose harness.
```
