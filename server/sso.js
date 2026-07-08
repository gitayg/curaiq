// OIDC SSO for admin login (#42), modeled on AppCrane's dependency-free implementation.
// The console stays admin-only — SSO is just a better admin login: whoever signs in through the
// configured IdP and whose email is on the sso_admin_emails allowlist gets an admin session.
// Config lives in the settings table (oidc_*); the client secret is encrypted at rest.
import { createHmac, createHash, randomBytes, timingSafeEqual, createCipheriv, createDecipheriv, createPublicKey, verify as cryptoVerify, constants } from "node:crypto";
import { SAML } from "@node-saml/node-saml";

const SECRET = process.env.SESSION_SECRET || randomBytes(32).toString("hex");
const ENC_KEY = createHash("sha256").update("raiseme-sso:" + SECRET).digest(); // 32 bytes

export function encrypt(plain) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", ENC_KEY, iv);
  const ct = Buffer.concat([c.update(String(plain), "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64");
}
export function decrypt(enc) {
  const b = Buffer.from(enc, "base64");
  const d = createDecipheriv("aes-256-gcm", ENC_KEY, b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString("utf8");
}

// HMAC-signed, time-boxed state — prevents CSRF on the callback. { r: redirect, n: nonce, t: time }
export function makeState(redirect) {
  const payload = Buffer.from(JSON.stringify({ r: redirect || "", n: randomBytes(8).toString("hex"), t: Date.now() })).toString("base64url");
  return payload + "." + createHmac("sha256", SECRET).update(payload).digest("base64url");
}
export function parseState(state) {
  const dot = String(state || "").lastIndexOf(".");
  if (dot < 0) throw new Error("invalid state");
  const payload = state.slice(0, dot), sig = state.slice(dot + 1);
  const expected = createHmac("sha256", SECRET).update(payload).digest("base64url");
  if (!timingSafeEqual(Buffer.from(sig, "base64url"), Buffer.from(expected, "base64url"))) throw new Error("state CSRF mismatch");
  const data = JSON.parse(Buffer.from(payload, "base64url").toString());
  if (Date.now() - data.t > 10 * 60 * 1000) throw new Error("state expired");
  return data;
}

const _disc = new Map(), _jwks = new Map();
export async function getDiscovery(baseUrl) {
  const c = _disc.get(baseUrl);
  if (c && Date.now() - c.ts < 3e5) return c.doc;
  const url = baseUrl.endsWith("/.well-known/openid-configuration") ? baseUrl : baseUrl.replace(/\/$/, "") + "/.well-known/openid-configuration";
  const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`OIDC discovery failed (${r.status})`);
  const doc = await r.json();
  _disc.set(baseUrl, { doc, ts: Date.now() });
  return doc;
}
async function getJwks(uri) {
  const c = _jwks.get(uri);
  if (c && Date.now() - c.ts < 6e5) return c.keys;
  const r = await fetch(uri, { signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`JWKS fetch failed (${r.status})`);
  const { keys } = await r.json();
  _jwks.set(uri, { keys, ts: Date.now() });
  return keys;
}
export async function verifyIdToken(idToken, jwksUri, clientId, issuer) {
  const p = String(idToken).split(".");
  if (p.length !== 3) throw new Error("malformed id_token");
  const header = JSON.parse(Buffer.from(p[0], "base64url").toString());
  const payload = JSON.parse(Buffer.from(p[1], "base64url").toString());
  if (payload.iss !== issuer) throw new Error("issuer mismatch");
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(clientId)) throw new Error("audience mismatch");
  if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error("id_token expired");
  const keys = await getJwks(jwksUri);
  const jwk = keys.find((k) => k.kid === header.kid) || keys.find((k) => k.alg === header.alg) || keys[0];
  if (!jwk) throw new Error("no matching JWK");
  const alg = header.alg || "RS256";
  const hashAlg = alg.includes("384") ? "SHA384" : alg.includes("512") ? "SHA512" : "SHA256";
  const pub = createPublicKey({ key: jwk, format: "jwk" });
  const data = Buffer.from(p[0] + "." + p[1]), sig = Buffer.from(p[2], "base64url");
  const ok = alg.startsWith("PS")
    ? cryptoVerify({ name: "RSA-PSS", saltLength: constants.RSA_PSS_SALTLEN_DIGEST }, data, { key: pub, padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: constants.RSA_PSS_SALTLEN_DIGEST }, sig)
    : cryptoVerify(hashAlg, data, pub, sig);
  if (!ok) throw new Error("id_token signature invalid");
  return payload;
}

export function oidcConfig(store) {
  const g = (k, d) => store.getSetting(k, d);
  const secEnc = g("oidc_client_secret_enc", "");
  return {
    enabled: g("oidc_enabled", "0") === "1",
    discovery_url: g("oidc_discovery_url", "") || "",
    client_id: g("oidc_client_id", "") || "",
    client_secret: secEnc ? (() => { try { return decrypt(secEnc); } catch { return ""; } })() : "",
    client_secret_set: !!secEnc,
    provider_name: g("oidc_provider_name", "SSO") || "SSO",
    admin_emails: String(g("sso_admin_emails", "") || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
  };
}

// An IdP email is allowed if it matches an allowlist entry exactly, or a domain rule (@acme.com).
export function emailAllowed(adminEmails, email) {
  if (!email || !adminEmails.length) return false;
  email = String(email).toLowerCase();
  return adminEmails.some((a) => a === email || (a.startsWith("@") && email.endsWith(a)) || (a.startsWith("*@") && email.endsWith(a.slice(1))));
}

// ---- SAML (#42) — uses @node-saml/node-saml for XML-signature validation ----
export function samlConfig(store) {
  const g = (k, d) => store.getSetting(k, d);
  const certEnc = g("saml_idp_cert_enc", "");
  return {
    enabled: g("saml_enabled", "0") === "1",
    idp_sso_url: g("saml_idp_sso_url", "") || "",
    idp_cert: certEnc ? (() => { try { return decrypt(certEnc); } catch { return ""; } })() : "",
    idp_cert_set: !!certEnc,
    provider_name: g("saml_provider_name", "SAML") || "SAML"
  };
}
export function buildSaml(cfg, baseUrl) {
  return new SAML({
    callbackUrl: baseUrl + "/sso/saml/callback",
    entryPoint: cfg.idp_sso_url,
    issuer: baseUrl + "/sso/saml/metadata",
    idpCert: cfg.idp_cert,
    wantAuthnResponseSigned: true,
    wantAssertionsSigned: true,
    signatureAlgorithm: "sha256",
    digestAlgorithm: "sha256"
  });
}

// ---- SSO-only login policy ----
export function isSsoOnly(store) { return store.getSetting("auth_sso_only", "0") === "1"; }
export function ssoProviderConfigured(store) { return oidcConfig(store).enabled || samlConfig(store).enabled; }
