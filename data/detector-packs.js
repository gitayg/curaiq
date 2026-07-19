// #22 — org-defined detector packs. An admin ships extra patterns (internal project codenames,
// customer-ID formats, etc.) as DATA — pattern strings, never code — distributed via the policy
// server. They're compiled here into the same detector shape the built-ins use, so they flow through
// the exact same policy resolution (threatAction / redact). Each pack detector maps to an EXISTING
// threat id so severity + response + data-tier all resolve unchanged; an unknown id simply yields no
// finding.
//
// Untrusted input, so two guards: a length cap and a rejection of nested/adjacent unbounded
// quantifiers (the classic catastrophic-backtracking / ReDoS shapes). Patterns are compiled as
// RegExp, never eval'd.

const MAX_PATTERN_LEN = 400;

// Reject the obvious ReDoS shapes: `(a+)+`, `(a*)*`, `(a+)*`, and two adjacent unbounded quantifiers.
function redosProne(src) {
  if (/\([^)]*[+*][^)]*\)\s*[+*]/.test(src)) return true;      // (…+…)+ / (…*…)*
  if (/[+*}]\s*[+*]/.test(src)) return true;                    // a+* / a*+ / }{,}* adjacency
  return false;
}

function safePattern(src, flags) {
  if (typeof src !== "string" || !src.length || src.length > MAX_PATTERN_LEN) return null;
  if (redosProne(src)) return null;
  try { return new RegExp(src, String(flags || "").replace(/[^gimsuy]/g, "")); } catch { return null; }
}

const slug = (s, fallback) => String(s || fallback).replace(/[^\w-]/g, "").slice(0, 40) || fallback;

// Compile a list of packs ({ packId, detectors: [{ detectorId, threatId, stage, mode, hint, patterns,
// flags }] }) into detector objects. Anything malformed is skipped, never thrown.
export function compilePacks(packs) {
  const out = [];
  for (const pack of Array.isArray(packs) ? packs : []) {
    const pid = slug(pack?.packId, "pack");
    for (const d of Array.isArray(pack?.detectors) ? pack.detectors : []) {
      const threatId = Number(d?.threatId);
      if (!Number.isInteger(threatId)) continue;
      const patterns = (Array.isArray(d?.patterns) ? d.patterns : []).map((p) => safePattern(p, d?.flags)).filter(Boolean);
      if (!patterns.length) continue;
      out.push({
        detectorId: `pack:${pid}:${slug(d?.detectorId, "rule")}`,
        threatId,
        stage: d?.stage === "output" ? "output" : "prompt",
        mode: d?.mode === "coach" ? "coach" : "warn",
        hint: String(d?.hint || "Custom (org policy) pattern matched").slice(0, 160),
        patterns
      });
    }
  }
  return out;
}
