// Image inspection (#9) — bring-your-own vision/OCR key, configured per tenant in the web console.
// The key is encrypted at rest and never leaves the server: the host posts an image to /api/ocr,
// the server extracts its text via the org's own vision provider, and the host then runs the same
// content + DLP policy on that text. Image content goes only to the org's chosen AI provider.
import { encrypt, decrypt } from "./sso.js";

const OCR_PROMPT = "Transcribe ALL text visible in this image verbatim, preserving order. If there is no text, briefly describe the image instead. Output only the transcription/description, no preamble.";

export function visionConfig(store, tenant) {
  const g = (k, d) => store.getSetting(`${k}:${tenant}`, d);
  const keyEnc = g("vision_key_enc", "");
  return {
    enabled: g("vision_enabled", "0") === "1",
    provider: g("vision_provider", "anthropic") || "anthropic",
    model: g("vision_model", "") || "",
    key: keyEnc ? (() => { try { return decrypt(keyEnc); } catch { return ""; } })() : "",
    key_set: !!keyEnc
  };
}

export function saveVisionConfig(store, tenant, b) {
  const s = (k, v) => store.setSetting(`${k}:${tenant}`, v);
  s("vision_enabled", b.enabled ? "1" : "0");
  s("vision_provider", String(b.provider || "anthropic"));
  s("vision_model", String(b.model || ""));
  if (b.key) s("vision_key_enc", encrypt(String(b.key).trim()));
}

const DEFAULT_MODEL = { anthropic: "claude-sonnet-4-6", openai: "gpt-4o" };

// Extract text from a base64 image using the tenant's BYO key. Returns the transcription string.
export async function ocrImage(cfg, base64, mime = "image/png") {
  if (!cfg.key) throw new Error("no API key configured");
  const model = cfg.model || DEFAULT_MODEL[cfg.provider] || DEFAULT_MODEL.anthropic;
  const data = String(base64).replace(/^data:[^;]+;base64,/, "");

  if (cfg.provider === "openai") {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.key}` },
      body: JSON.stringify({ model, max_tokens: 1500, messages: [{ role: "user", content: [{ type: "text", text: OCR_PROMPT }, { type: "image_url", image_url: { url: `data:${mime};base64,${data}` } }] }] }),
      signal: AbortSignal.timeout(30000)
    });
    if (!r.ok) throw new Error(`OpenAI vision ${r.status}: ${(await r.text()).slice(0, 160)}`);
    const j = await r.json();
    return (j.choices?.[0]?.message?.content || "").trim();
  }

  // default: Anthropic (Claude vision)
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": cfg.key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: 1500, messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: mime, data } }, { type: "text", text: OCR_PROMPT }] }] }),
    signal: AbortSignal.timeout(30000)
  });
  if (!r.ok) throw new Error(`Anthropic vision ${r.status}: ${(await r.text()).slice(0, 160)}`);
  const j = await r.json();
  return (j.content || []).map((b) => b.text || "").join("").trim();
}
