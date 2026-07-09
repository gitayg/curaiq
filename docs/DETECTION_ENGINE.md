# CuraIQ — Detection Engine Design

**Version:** 0.1 · Companion to [CAPABILITY_SPEC.md](CAPABILITY_SPEC.md) (v0.6)

The engine turns host **events** into **findings** (matched threats with a confidence and risk
tier), then into **interventions** (warn + override). It runs the 3-tier brain: deterministic
rules → local LLM → policy-gated cloud SDK. Everything except an explicit, redacted Tier-3 call
stays on-device.

---

## 1. Events (engine input)

The host emits an event at each inspection point. Raw payloads never leave the device.

| Event | Inspection point | Payload (local only) |
|---|---|---|
| `prompt.submit` | before the prompt is sent to the AI tool | text, tool id, context tag |
| `content.paste` | paste into the prompt box | text, source (if known) |
| `file.upload` | file selected / dragged into the webview | filename, mime, size, extracted text/preview |
| `ai.response` | AI output rendered in the webview | text, extracted links, code blocks |
| `tool.open` | opening / navigating to an AI tool | url / tool id |
| `session.context` | customer / project / topic switch | prior tag, new tag |

```jsonc
// Event envelope
{ "id": "evt_…", "type": "prompt.submit", "ts": "<ISO>", "tool": "chatgpt",
  "context": "customer:acme", "payload": { "text": "…" }, "features": { /* derived */ } }
```

---

## 2. Detector model (Tier-1, deterministic)

Detection rules live in **`data/detectors.json`**, kept *separate* from the catalog
(`data/threats.json`) so the catalog stays clean and translatable. Each detector binds **one
threat** to the events it applies to and a set of weighted **signals**.

```jsonc
{
  "id": "dlp.pii.national_id",
  "threatId": 1,                                  // → threats.json
  "appliesTo": ["prompt.submit", "content.paste", "file.upload"],
  "signals": [
    { "type": "entity",  "kind": "NATIONAL_ID",        "weight": 0.7 },
    { "type": "keyword", "any": ["id number","ת\"ז","passport"], "weight": 0.3 }
  ],
  "combine": "weighted_sum",                       // weighted_sum | any | all
  "thresholds": { "fire": 0.75, "escalate": 0.40 } // see §3
}
```

### Signal types

| Type | Detects | Examples |
|---|---|---|
| `regex` | structured tokens | IBAN, credit card, API key/token, national id, IP |
| `keyword` | term lists (multi-language) | "bank details", "salary", "roadmap", "confidential" |
| `entity` | lightweight format/NER | `EMAIL`, `PHONE`, `IBAN`, `CREDIT_CARD`, `NATIONAL_ID` |
| `url` | link analysis | shortener, display≠href mismatch, non-allowlisted domain, nonexistent-looking source |
| `code` | code / macro patterns | PowerShell, VBA macro, shell pipe-to-bash, `eval`, download-and-run |
| `allowlist` | tool/domain vs approved list | `tool.open` to a non-approved AI tool |
| `phrase` | injection / social-eng templates | "ignore previous instructions", "urgent wire transfer", "changed our bank account" |
| `heuristic` | composite | bank-detail-change = (IBAN\|account regex) + change verb |

Each signal returns a partial score in `[0,1]`; `combine` aggregates to a **detector confidence**.

---

## 3. Confidence bands → escalation

Per detector, two thresholds define three bands:

```
confidence ≥ fire (e.g. 0.75)         → Tier-1 CONFIRMED finding (no LLM)
escalate ≤ confidence < fire          → escalate to Tier-2 local LLM
confidence < escalate (e.g. 0.40)     → suppressed (no finding)
```

- **Critical-severity threats** use a lower `escalate` floor (be cautious — escalate rather than drop).
- Thresholds are tunable from server policy without shipping a new client.

---

## 4. Tier-2 — local LLM adjudication

Runs only on the ambiguous band. Input is structured; raw on-device text is fine here (local).

**Input:** the event excerpt + the candidate threat (`id`, `threat`, `example`, `response`,
`severity`) + the Tier-1 signals that fired + their confidence.

**Forced output schema:**
```jsonc
{ "threatId": 1, "verdict": "confirmed" | "rejected" | "uncertain",
  "confidence": 0.0, "rationale": "short",
  "redactedEvidence": "…snippet with sensitive tokens masked…" }
```

Resolution:
- `confirmed` → finding stands.
- `rejected` → suppress.
- `uncertain` → fall back: if threat is **Critical/High** → warn anyway (fail-safe); else suppress.
  If policy allows Tier-3, escalate instead of falling back.

---

## 5. Tier-3 — cloud SDK (policy-gated)

Reached **only** when: `policy.tier3 == enabled` **and** Tier-2 returned `uncertain` **and**
threat is High/Critical. Input is the Tier-2 `redactedEvidence` — **never raw content**. Same
output schema. This is the only tier where data leaves the device; it is redacted and logged.

---

## 6. Findings → interventions

A finding = `{ threatId, detectorId, confidence, tier, riskScore, riskLevel, redactedEvidence }`.
Multiple detectors firing for one event are merged by `threatId` (keep highest confidence; keep
all distinct threats).

| Risk level | Intervention |
|---|---|
| **Critical / High** | blocking inline warning + the threat's `response` text + source link + explicit "proceed anyway" acknowledgement (logged + reported) |
| **Medium** | passive toast nudge (no acknowledgement) |

Intervention copy is always the matrix `response` field — single source of truth.

---

## 7. Pipeline & latency

```
event → select detectors (appliesTo) → Tier-1 signals → confidence
  ├─ ≥ fire        → confirmed finding
  ├─ ambiguous     → Tier-2 (local LLM)  → confirmed | rejected | uncertain
  │                     └─ uncertain + policy + High/Crit → Tier-3 (redacted)
  └─ < escalate    → drop
→ merge findings → interventions → present + log + report (redacted)
```

**Latency budget (pre-submit must feel instant):**
- **Tier-1 synchronous**, target < 20 ms — gates Critical cases before send.
- **Tier-2** runs with a short timeout (≈800 ms) behind a non-blocking "checking…" indicator;
  on timeout, fall back to the Tier-1 decision.
- Because the posture is warn-and-override (never hard-block), a late Tier-2 confirmation can warn
  retroactively if the prompt already went out — but pre-submit DLP aims to catch *before* send.

---

## 8. Detectability map — honest scope

Not every matrix threat is detectable from in-band host signals. Three classes:

- **Detect** — real in-band signals (text/file/url/code/allowlist). Engine targets these for MVP.
- **Coach** — host can't truly detect, but can surface a contextual reminder when the relevant
  tool/topic appears. Awareness only.
- **Deferred** — needs the later SDK/MCP agentic layer or external (audio/identity/network) signals.

| Class | Threats | Notes |
|---|---|---|
| **Detect** | 1, 2, 3, 9, 15, 17, 18, 27, 29, 30, 32, 33, 36, 37, 39, 40 | DLP, injection phrases, code/macros, URL/source checks, upload guard, context mixing, prompt leakage |
| **Detect (allowlist)** | 7, 19 | non-approved tool / transcription tool reached through the host |
| **Coach** | 8, 10, 11, 16, 20, 26, 34, 35 | flag/nudge: unverified claims, pasted phishing/BEC text, bias on screening, translation, MFA reminder |
| **Deferred** | 4, 5, 6, 12, 13, 14, 21, 22, 23, 24, 25, 28, 31 | OS installs, deepfake A/V, vishing, agent tool-calls, RAG/memory poisoning, MCP poisoning, synthetic identity, other-browser extensions |

This makes the MVP engine scope explicit: build the **Detect** set first; **Coach** is cheap
contextual copy; **Deferred** waits for the SDK/MCP layer (capability spec v3).

---

## 9. Supporting modules

- **Redaction** — masks detected entities (id/IBAN/email/token) to produce `redactedEvidence`;
  shared by the local log, server alerts, and Tier-3 input.
- **Versioning** — `detectors.json` and `threats.json` are versioned; the engine pins a schema
  version; server can push updated rules/thresholds.
- **Fixtures** — every detector ships positive/negative test cases; the matrix `example` column
  seeds the positives. Enables regression testing of precision/recall as rules evolve.
- **False-positive controls** — per-detector exceptions; in-session "this is fine" suppression;
  Tier-2 exists precisely to cut Tier-1 false positives on Critical-but-ambiguous events.
```
