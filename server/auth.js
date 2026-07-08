// Dashboard auth: an admin password gate with a stateless, HMAC-signed session cookie.
// No DB needed — the cookie carries an expiry and is signed with SESSION_SECRET.
import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";

// SESSION_SECRET must be set in any real deployment. If missing we fall back to an ephemeral
// random secret (sessions drop on restart) and warn loudly so it's never silently weak.
const SECRET = process.env.SESSION_SECRET || (() => {
  console.warn("[RAISEME] WARNING: SESSION_SECRET is not set — using an ephemeral secret. Sessions will not survive a restart. Set SESSION_SECRET in production.");
  return randomBytes(32).toString("hex");
})();
const TTL_MS = 8 * 60 * 60 * 1000; // 8h
const COOKIE = "raiseme_sess";

function sign(payload) {
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

// Returns the Set-Cookie header for a fresh session. `claims` carries identity:
//   { admin: true }      → global admin (all tenants)
//   { tenant, email }    → a single-tenant account
export function sessionCookie(claims = {}) {
  const payload = Buffer.from(JSON.stringify({ ...claims, exp: Date.now() + TTL_MS })).toString("base64url");
  const token = `${payload}.${sign(payload)}`;
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${TTL_MS / 1000}`;
}

export function clearCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

// Returns the verified session claims object, or null. Never trust unsigned data.
export function getSession(cookieHeader) {
  const m = new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`).exec(cookieHeader || "");
  if (!m) return null;
  const [payload, sig] = m[1].split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof claims.exp !== "number" || claims.exp <= Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}

// Constant-time password check against ADMIN_PASSWORD (no auth possible if unset).
export function passwordOK(pw) {
  const expected = process.env.ADMIN_PASSWORD || "";
  if (!expected || typeof pw !== "string") return false;
  const a = Buffer.from(pw), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
