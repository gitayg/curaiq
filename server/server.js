import http from "node:http";
import { randomUUID, randomBytes } from "node:crypto";
import { readFileSync, existsSync, mkdirSync, createReadStream, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Store } from "./db.js";
import { DEFAULT_POLICY } from "./policy.js";
import { CONTENT_RULES } from "../data/content-rules.js";
import { dashboardHtml } from "./dashboard.js";
import { landingHtml, signupHtml, loginHtml, operatorHtml, welcomeHtml } from "./landing.js";
import { aboutHtml } from "./about.js";
import { privacyHtml } from "./privacy.js";
import { ogSvg, ogFamilySvg } from "./og.js";
import { faviconSvg } from "./favicon.js";
import { getSession, sessionCookie, clearCookie, passwordOK } from "./auth.js";
import { attachTerminal } from "./terminal.js";
import { sendVerification, sendLoginLink, sendAlertEmail, sendSignupAlert, emailConfigured } from "./email.js";
import { oidcConfig, getDiscovery, verifyIdToken, makeState, parseState, emailAllowed, encrypt, samlConfig, buildSaml, isSsoOnly, ssoProviderConfigured } from "./sso.js";
import { visionConfig, saveVisionConfig, ocrImage } from "./vision.js";
import { buildReport, renderReportHtml, FRAMEWORK_LIST } from "./compliance.js";
import { VERSION } from "./version.js";

const slug = (s) => (String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "tenant");

const CONTENT = CONTENT_RULES.map((r) => ({ id: r.id, label: r.label, severity: r.severity, description: r.description }));
const CONTENT_IDS = new Set(CONTENT.map((c) => c.id));

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const THREATS = JSON.parse(readFileSync(join(ROOT, "data/threats.json"), "utf8"))
  .threats.map((t) => ({ id: t.id, category: t.category, threat: t.threat, riskLevel: t.riskLevel, example: t.example, response: t.response }));
const ACTIONS = ["disabled", "alert", "notify", "block"];

// The downloadable app archive. In production you'd upload a notarized .dmg to dist/;
// for local use we lazily zip the built .app (macOS) and cache it.
const APP_PATH = join(ROOT, "src-tauri/target/release/bundle/macos/RAISEME.app");
// In production the DMG is uploaded to the persistent /data volume (see APP_DMG_PATH);
// locally we fall back to dist/ or lazily zip the built .app.
const APP_DATA_DMG = process.env.APP_DMG_PATH || "/data/RAISEME.dmg";
const APP_DMG = join(ROOT, "dist/RAISEME.dmg");
const APP_ZIP = join(ROOT, "dist/RAISEME.zip");
// Tauri updater artifact (.app.tar.gz + minisign .sig), for in-app auto-update.
const APP_TARGZ = process.env.APP_TARGZ_PATH || "/data/RAISEME.app.tar.gz";
const APP_TARGZ_LOCAL = join(ROOT, "dist/RAISEME.app.tar.gz");
const tarGzPath = () => (existsSync(APP_TARGZ) ? APP_TARGZ : (existsSync(APP_TARGZ_LOCAL) ? APP_TARGZ_LOCAL : null));
let appArchive = null;
function ensureAppArchive() {
  if (appArchive && existsSync(appArchive)) return appArchive;
  if (existsSync(APP_DATA_DMG)) return (appArchive = APP_DATA_DMG);
  if (existsSync(APP_DMG)) return (appArchive = APP_DMG);
  if (existsSync(APP_ZIP)) return (appArchive = APP_ZIP);
  if (!existsSync(APP_PATH)) return null;
  try {
    mkdirSync(join(ROOT, "dist"), { recursive: true });
    execFileSync("ditto", ["-c", "-k", "--keepParent", APP_PATH, APP_ZIP]);
    return (appArchive = APP_ZIP);
  } catch {
    return null;
  }
}

const PORT = process.env.PORT || 8787;
const DB_PATH = process.env.DB_PATH || "data.db";
const store = new Store(DB_PATH);

// Brute-force guard for /api/login: max 10 failures per IP per 15 min.
const loginAttempts = new Map();
const loginBlocked = (ip) => { const e = loginAttempts.get(ip); return !!(e && e.until > Date.now() && e.count >= 10); };
const loginFail = (ip) => { const e = loginAttempts.get(ip) || { count: 0, until: 0 }; e.count++; e.until = Date.now() + 15 * 60 * 1000; loginAttempts.set(ip, e); };
const loginReset = (ip) => loginAttempts.delete(ip);

// #7 — evict expired rate-limit / brute-force entries so the maps don't grow unbounded under
// IP churn. unref() so this timer never keeps the process alive.
setInterval(() => {
  const now = Date.now();
  for (const [k, e] of loginAttempts) if (!e || e.until <= now) loginAttempts.delete(k);
  for (const [k, e] of _rlMap) if (!e || now > e.resetAt) _rlMap.delete(k);
}, 10 * 60 * 1000).unref();

const json = (res, code, body) => {
  // CORS origin (if any) is set once per request via setHeader in the handler; don't override here.
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};

// Generic fixed-window rate limiter (used for signup; login has its own lockout above/below).
const _rlMap = new Map();
function rateLimited(key, max, windowMs) {
  const now = Date.now();
  const e = _rlMap.get(key);
  if (!e || now > e.resetAt) { _rlMap.set(key, { count: 1, resetAt: now + windowMs }); return false; }
  e.count++;
  return e.count > max;
}

// #10 — CAPTCHA: verify a Cloudflare Turnstile token. Skipped (returns true) until TURNSTILE_SECRET
// is configured, so it's a no-op now and activates the moment keys are added.
async function verifyTurnstile(token, ip) {
  if (!process.env.TURNSTILE_SECRET) return true;
  if (!token) return false;
  try {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: process.env.TURNSTILE_SECRET, response: token, remoteip: ip || "" }),
      signal: AbortSignal.timeout(8000)
    });
    return !!(await r.json()).success;
  } catch { return false; }
}
const clientIp = (req) => String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket.remoteAddress || "?";

// #6 — CORS: reflect the request Origin only for the native app (tauri://…), localhost/dev, and
// same-origin — instead of a blanket "*". No credentials are ever allowed, so cross-site JS still
// can't read cookie-authed responses; this just stops advertising the API to every origin.
const corsOrigin = (req) => {
  const o = req.headers.origin;
  if (!o) return null;
  if (/^tauri:\/\//i.test(o)) return o;
  if (/^https?:\/\/(tauri\.localhost|localhost|127\.0\.0\.1)(:\d+)?$/i.test(o)) return o;
  try { if (new URL(o).host === req.headers.host) return o; } catch {}
  return null;
};

const readBody = (req) =>
  new Promise((resolve) => {
    let data = "", done = false;
    // #5 — always settle exactly once. On oversize/abort/error we destroy the socket AND resolve,
    // so the awaiting handler never dangles waiting for an 'end' that will never fire.
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    req.on("data", (c) => { data += c; if (data.length > 1e5) { req.destroy(); finish(null); } });
    req.on("end", () => { try { finish(JSON.parse(data || "{}")); } catch { finish(null); } });
    req.on("close", () => finish(null));
    req.on("error", () => finish(null));
  });

// Raw body reader (SAML ACS posts a form-urlencoded SAMLResponse, which can exceed the JSON cap).
const readRawBody = (req) =>
  new Promise((resolve) => {
    let data = "", done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    req.on("data", (c) => { data += c; if (data.length > 2e6) { req.destroy(); finish(""); } });
    req.on("end", () => finish(data));
    req.on("close", () => finish(""));
    req.on("error", () => finish(""));
  });

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  // #4 — baseline security headers on every response (set before routing; merged into writeHead).
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  // #4 — per-request nonce lets us drop 'unsafe-inline' from script-src: inline <script> blocks in
  // server-rendered pages must carry nonce="${NONCE}" to execute. Inline styles keep 'unsafe-inline'.
  const NONCE = randomBytes(16).toString("base64");
  res.setHeader("Content-Security-Policy", `default-src 'self'; script-src 'self' 'nonce-${NONCE}' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'`);

  // #4 — centrally stamp the nonce onto every inline <script> in HTML responses, so no page
  // function has to thread it and none can be missed. Gated on a recorded text/html Content-Type
  // so JSON bodies that happen to contain "<script" as data are never rewritten.
  let _ctype = "";
  const _writeHead = res.writeHead.bind(res);
  res.writeHead = (code, headers) => {
    if (headers) { const ct = headers["Content-Type"] || headers["content-type"]; if (ct) _ctype = ct; }
    return _writeHead(code, headers);
  };
  const _end = res.end.bind(res);
  res.end = (chunk, ...rest) => {
    if (typeof chunk === "string" && /text\/html/i.test(_ctype) && chunk.includes("<script")) {
      chunk = chunk.replace(/<script\b/gi, `<script nonce="${NONCE}"`);
    }
    return _end(chunk, ...rest);
  };

  // #6 — reflect an allow-listed Origin (never "*"); Vary so caches don't cross origins.
  const ao = corsOrigin(req);
  if (ao) { res.setHeader("Access-Control-Allow-Origin", ao); res.setHeader("Vary", "Origin"); }

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Client-Id, X-Install-Token"
    });
    return res.end();
  }

  const baseUrl = `${req.headers["x-forwarded-proto"] || "http"}://${req.headers.host}`;

  // ---- Auth gate ----
  // The dashboard + admin APIs require a signed session. Client telemetry, signup, provision,
  // policy resolution and public pages stay open (enrolled hosts have no session cookie).
  const session = getSession(req.headers.cookie);
  const authed = !!session;
  // A client (no cookie) authenticates with its install token. We derive the tenant from the token,
  // so a client can only read/report its own tenant — the token is for policy + events only.
  const tokenTenant = () => {
    const t = req.headers["x-install-token"];
    if (!t) return null;
    const inst = store.getInstallation(String(t));
    return inst ? inst.tenant : null;
  };
  const ADMIN_API = new Set([
    "/api/stats", "/api/inventory", "/api/tenants", "/api/threats", "/api/content",
    "/api/policies", "/api/policies/rename", "/api/policies/delete",
    "/api/policy/threats", "/api/policy/content", "/api/policy/tools", "/api/device-policy", "/api/installations",
    "/api/notify", "/api/policy/email", "/api/weekly",
    "/api/sso/admin-config", "/api/sso/test", "/api/vision", "/api/compliance"
  ]);
  if (!authed) {
    if (path === "/dashboard") { res.writeHead(302, { Location: "/login" }); return res.end(); }
    if (ADMIN_API.has(path)) return json(res, 401, { error: "auth required" });
    if (path === "/api/alerts" && req.method === "GET") return json(res, 401, { error: "auth required" });
  }

  if (path === "/login") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(loginHtml(baseUrl));
  }
  // Operator (instance owner) sign-in — unadvertised; password + SSO live here, not on /login.
  if (path === "/operator") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(operatorHtml(baseUrl));
  }
  // Login: admin password only — the web console is admin-only.
  if (path === "/api/login" && req.method === "POST") {
    const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket.remoteAddress || "?";
    if (loginBlocked(ip)) return json(res, 429, { error: "too many attempts — try again later" });
    if (isSsoOnly(store) && process.env.ADMIN_BREAK_GLASS !== "1") return json(res, 403, { error: "Password sign-in is disabled — use SSO. (Break-glass: set ADMIN_BREAK_GLASS=1 on the server.)" });
    const body = (await readBody(req)) || {};
    if (!passwordOK(body.password)) { loginFail(ip); return json(res, 401, { error: "incorrect password" }); }
    loginReset(ip);
    res.writeHead(200, { "Content-Type": "application/json", "Set-Cookie": sessionCookie({ admin: true }) });
    return res.end(JSON.stringify({ ok: true }));
  }

  // ---- Per-tenant admin login via emailed magic link ----
  // Request a link. Always responds ok so we never reveal which emails have an account.
  if (path === "/api/login-link" && req.method === "POST") {
    const ip = clientIp(req);
    if (rateLimited("loginlink:" + ip, 5, 15 * 60 * 1000)) return json(res, 429, { error: "Too many requests — try again in a bit." });
    const body = (await readBody(req)) || {};
    const email = String(body.email || "").trim().toLowerCase();
    if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      const token = randomUUID().replace(/-/g, "");
      // Fire-and-forget: awaiting the email only for real accounts would leak account existence
      // via response timing. Constant-time response regardless of whether the account exists.
      if (store.setLoginToken(email, token)) sendLoginLink(email, `${baseUrl}/login-link?token=${token}`).catch(() => {});
    }
    return json(res, 200, { ok: true });
  }
  // Consume a link: verify the token, mint a tenant-scoped session, land on the dashboard.
  if (path === "/login-link") {
    const acc = store.accountByLoginToken(url.searchParams.get("token") || "");
    if (!acc) { res.writeHead(302, { Location: "/login?err=" + encodeURIComponent("That login link is invalid or has expired.") }); return res.end(); }
    store.clearLoginToken(acc.email);
    res.writeHead(302, { Location: "/dashboard", "Set-Cookie": sessionCookie({ tenant: acc.tenant, email: acc.email }) });
    return res.end();
  }

  // ---- SSO admin login (#42, OIDC + SAML) ----
  // Public: tells the login page which SSO buttons to show + whether password is disabled.
  if (path === "/api/sso/config") {
    const o = oidcConfig(store), s = samlConfig(store);
    return json(res, 200, { oidc: { enabled: o.enabled, provider_name: o.provider_name }, saml: { enabled: s.enabled, provider_name: s.provider_name }, sso_only: isSsoOnly(store) });
  }
  // Public: kick off the IdP round-trip.
  if (path === "/sso/oidc/start") {
    const o = oidcConfig(store);
    if (!o.enabled || !o.discovery_url || !o.client_id) return json(res, 400, { error: "OIDC not configured" });
    try {
      const disc = await getDiscovery(o.discovery_url);
      const params = new URLSearchParams({ response_type: "code", client_id: o.client_id, redirect_uri: `${baseUrl}/sso/oidc/callback`, scope: "openid email profile", state: makeState("") });
      res.writeHead(302, { Location: disc.authorization_endpoint + "?" + params.toString() }); return res.end();
    } catch (e) { res.writeHead(302, { Location: "/operator?sso_error=" + encodeURIComponent(e.message) }); return res.end(); }
  }
  // Public: IdP returns here with ?code=&state=. Verify, allowlist-check, then issue an admin session.
  if (path === "/sso/oidc/callback") {
    try {
      const code = url.searchParams.get("code"), state = url.searchParams.get("state");
      if (url.searchParams.get("error")) throw new Error(url.searchParams.get("error_description") || url.searchParams.get("error"));
      if (!code || !state) throw new Error("missing code/state");
      parseState(state);
      const o = oidcConfig(store);
      if (!o.enabled) throw new Error("OIDC disabled");
      const disc = await getDiscovery(o.discovery_url);
      const tr = await fetch(disc.token_endpoint, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: `${baseUrl}/sso/oidc/callback`, client_id: o.client_id, client_secret: o.client_secret }), signal: AbortSignal.timeout(15000) });
      if (!tr.ok) throw new Error("token exchange failed: " + (await tr.text()).slice(0, 120));
      const tok = await tr.json();
      if (!tok.id_token) throw new Error("no id_token in response");
      const claims = await verifyIdToken(tok.id_token, disc.jwks_uri, o.client_id, disc.issuer);
      const email = String(claims.email || "").toLowerCase();
      if (!emailAllowed(o.admin_emails, email)) {
        res.writeHead(302, { Location: "/operator?sso_error=" + encodeURIComponent("not an authorized admin: " + (email || "no email claim")) }); return res.end();
      }
      res.writeHead(302, { Location: "/dashboard", "Set-Cookie": sessionCookie({ admin: true, email }) }); return res.end();
    } catch (e) { res.writeHead(302, { Location: "/operator?sso_error=" + encodeURIComponent(e.message) }); return res.end(); }
  }
  // SAML — SP metadata (import this URL into the IdP).
  if (path === "/sso/saml/metadata") {
    const s = samlConfig(store);
    try {
      const saml = buildSaml({ ...s, idp_cert: s.idp_cert || "placeholder", idp_sso_url: s.idp_sso_url || "https://placeholder" }, baseUrl);
      res.writeHead(200, { "Content-Type": "application/xml" });
      return res.end(saml.generateServiceProviderMetadata(null, null));
    } catch (e) { return json(res, 500, { error: "SAML metadata: " + e.message }); }
  }
  if (path === "/sso/saml/start") {
    const s = samlConfig(store);
    if (!s.enabled || !s.idp_sso_url || !s.idp_cert) return json(res, 400, { error: "SAML not configured" });
    try {
      const target = await buildSaml(s, baseUrl).getAuthorizeUrlAsync("", req.headers.host, {});
      res.writeHead(302, { Location: target }); return res.end();
    } catch (e) { res.writeHead(302, { Location: "/operator?sso_error=" + encodeURIComponent(e.message) }); return res.end(); }
  }
  if (path === "/sso/saml/callback" && req.method === "POST") {
    try {
      const s = samlConfig(store);
      if (!s.enabled) throw new Error("SAML disabled");
      const form = new URLSearchParams(await readRawBody(req));
      const { profile } = await buildSaml(s, baseUrl).validatePostResponseAsync({ SAMLResponse: form.get("SAMLResponse"), RelayState: form.get("RelayState") || "" });
      const nameId = profile.nameID;
      const email = String(profile.email || profile["urn:oid:1.2.840.113549.1.9.1"] || (nameId && String(nameId).includes("@") ? nameId : "")).toLowerCase();
      if (!emailAllowed(oidcConfig(store).admin_emails, email)) {
        res.writeHead(302, { Location: "/operator?sso_error=" + encodeURIComponent("not an authorized admin: " + (email || nameId || "no email")) }); return res.end();
      }
      res.writeHead(302, { Location: "/dashboard", "Set-Cookie": sessionCookie({ admin: true, email }) }); return res.end();
    } catch (e) { res.writeHead(302, { Location: "/operator?sso_error=" + encodeURIComponent(e.message) }); return res.end(); }
  }
  // Admin: read full SSO config for the settings form (OIDC + SAML + policy).
  if (path === "/api/sso/admin-config" && req.method === "GET") {
    const o = oidcConfig(store), s = samlConfig(store);
    return json(res, 200, {
      oidc: { enabled: o.enabled, discovery_url: o.discovery_url, client_id: o.client_id, client_secret_set: o.client_secret_set, provider_name: o.provider_name },
      saml: { enabled: s.enabled, idp_sso_url: s.idp_sso_url, idp_cert_set: s.idp_cert_set, provider_name: s.provider_name },
      admin_emails: o.admin_emails.join(", "),
      sso_only: isSsoOnly(store),
      sso_provider_configured: ssoProviderConfigured(store),
      redirect_uri: `${baseUrl}/sso/oidc/callback`,
      acs_url: `${baseUrl}/sso/saml/callback`,
      metadata_url: `${baseUrl}/sso/saml/metadata`
    });
  }
  // Admin: save SSO config (OIDC + SAML + policy).
  if (path === "/api/sso/admin-config" && req.method === "PUT") {
    const b = (await readBody(req)) || {};
    if (b.oidc) {
      const o = b.oidc;
      store.setSetting("oidc_enabled", o.enabled ? "1" : "0");
      store.setSetting("oidc_discovery_url", String(o.discovery_url || ""));
      store.setSetting("oidc_client_id", String(o.client_id || ""));
      store.setSetting("oidc_provider_name", String(o.provider_name || "SSO"));
      if (o.client_secret) store.setSetting("oidc_client_secret_enc", encrypt(o.client_secret));
    }
    if (b.saml) {
      const s = b.saml;
      store.setSetting("saml_enabled", s.enabled ? "1" : "0");
      store.setSetting("saml_idp_sso_url", String(s.idp_sso_url || ""));
      store.setSetting("saml_provider_name", String(s.provider_name || "SAML"));
      if (s.idp_cert) store.setSetting("saml_idp_cert_enc", encrypt(String(s.idp_cert).trim()));
    }
    if (b.admin_emails !== undefined) store.setSetting("sso_admin_emails", String(b.admin_emails || ""));
    if (b.sso_only !== undefined) {
      if (b.sso_only && !ssoProviderConfigured(store)) return json(res, 400, { error: "Enable an SSO provider before turning on SSO-only." });
      store.setSetting("auth_sso_only", b.sso_only ? "1" : "0");
    }
    return json(res, 200, { ok: true });
  }
  // Admin: verify the OIDC discovery URL is reachable.
  if (path === "/api/sso/test" && req.method === "POST") {
    const b = (await readBody(req)) || {};
    try { const d = await getDiscovery(String(b.discovery_url || "")); return json(res, 200, { ok: true, issuer: d.issuer }); }
    catch (e) { return json(res, 400, { ok: false, error: e.message }); }
  }

  if (path === "/api/me") {
    if (!authed) return json(res, 401, { error: "auth required" });
    return json(res, 200, { admin: !!session.admin, tenant: session.tenant || null });
  }

  if (path === "/logout") {
    res.writeHead(302, { Location: "/login", "Set-Cookie": clearCookie() });
    return res.end();
  }

  // Admin: create a unique installation. The token carries only the tenant/server binding;
  // the agent extracts user/device itself on first run.
  if (path === "/api/installations" && req.method === "POST") {
    const body = await readBody(req);
    const tenant = (session && !session.admin) ? session.tenant : ((body && body.tenant && String(body.tenant).trim()) || "default");
    const token = randomUUID().replace(/-/g, "");
    store.createInstallation(token, tenant, baseUrl);
    return json(res, 201, {
      token, tenant,
      url: `${baseUrl}/d/${token}`,
      filename: `RAISEME-${tenant}-${token.slice(0, 8)}.dmg`,
      provision: { serverUrl: baseUrl, tenant }
    });
  }

  if (path === "/api/installations" && req.method === "GET") {
    const all = store.listInstallations();
    return json(res, 200, (session && !session.admin) ? all.filter((i) => i.tenant === session.tenant) : all);
  }

  // Download the app archive from the portal.
  if (path === "/download/app") {
    // In production the installer is hosted off-box (e.g. a GitHub release asset);
    // redirect there if configured. Otherwise serve a local/volume copy.
    if (process.env.DOWNLOAD_URL) { res.writeHead(302, { Location: process.env.DOWNLOAD_URL }); return res.end(); }
    const archive = ensureAppArchive();
    if (!archive) return json(res, 404, { error: "app not built yet — run `npm run tauri build`, or upload dist/RAISEME.dmg" });
    const name = archive.endsWith(".dmg") ? "RAISEME.dmg" : "RAISEME.zip";
    res.writeHead(200, {
      "Content-Type": archive.endsWith(".dmg") ? "application/x-apple-diskimage" : "application/zip",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Content-Length": statSync(archive).size
    });
    return createReadStream(archive).pipe(res);
  }

  // Updater artifact (the in-app auto-updater downloads this, not the DMG).
  if (path === "/download/app.tar.gz") {
    const f = tarGzPath();
    if (!f) return json(res, 404, { error: "no updater artifact" });
    res.writeHead(200, { "Content-Type": "application/gzip", "Content-Length": statSync(f).size });
    return createReadStream(f).pipe(res);
  }

  // Tauri updater manifest. 204 = up to date / no artifact; else the client compares `version`
  // to its own and installs if newer.
  if (path === "/api/update") {
    const tgz = tarGzPath();
    const sig = tgz ? `${tgz}.sig` : null;
    if (!tgz || !existsSync(sig)) { res.writeHead(204); return res.end(); }
    return json(res, 200, {
      version: VERSION,
      notes: "RAISEME update",
      pub_date: new Date().toISOString(),
      platforms: { "darwin-aarch64": { signature: readFileSync(sig, "utf8").trim(), url: `${baseUrl}/download/app.tar.gz` } }
    });
  }

  // The unique download: serves the provision.json the installer embeds. Tenant binding only.
  if (path.startsWith("/d/")) {
    const token = path.slice(3);
    const inst = store.getInstallation(token);
    if (!inst) return json(res, 404, { error: "unknown installation" });
    store.bumpDownload(token);
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Content-Disposition": `attachment; filename="provision.json"`
    });
    return res.end(JSON.stringify({ serverUrl: inst.server_url, tenant: inst.tenant }, null, 2));
  }

  if (path === "/og.svg") {
    res.writeHead(200, { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "public, max-age=86400" });
    return res.end(ogSvg());
  }

  if (path === "/og-family.svg") {
    res.writeHead(200, { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "public, max-age=86400" });
    return res.end(ogFamilySvg());
  }

  // SEO: rasterized PNG OG cards (social platforms don't render SVG og:image). Served from the
  // /data volume where the release uploads them; falls back to the SVG source if the PNG is absent.
  if (path === "/og.png" || path === "/og-family.png") {
    const isFam = path === "/og-family.png";
    const f = isFam ? (process.env.OG_FAMILY_PNG_PATH || "/data/og-family.png") : (process.env.OG_PNG_PATH || "/data/og.png");
    if (existsSync(f)) {
      res.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" });
      return res.end(readFileSync(f));
    }
    res.writeHead(200, { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "public, max-age=3600" });
    return res.end(isFam ? ogFamilySvg() : ogSvg());
  }

  if (path === "/robots.txt") {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end(`User-agent: *\nDisallow: /dashboard\nDisallow: /operator\nDisallow: /api/\nDisallow: /d/\nDisallow: /verify\nDisallow: /login-link\nSitemap: ${baseUrl}/sitemap.xml\n`);
  }

  if (path === "/sitemap.xml") {
    const urls = ["/", "/about", "/privacy", "/signup"].map((p) => `  <url><loc>${baseUrl}${p}</loc></url>`).join("\n");
    res.writeHead(200, { "Content-Type": "application/xml; charset=utf-8" });
    return res.end(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
  }

  if (path === "/favicon.svg" || path === "/favicon.ico") {
    res.writeHead(200, { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "public, max-age=604800" });
    return res.end(faviconSvg());
  }

  if (path === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(landingHtml(baseUrl));
  }

  if (path === "/about") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(aboutHtml(baseUrl));
  }

  if (path === "/privacy") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(privacyHtml(baseUrl));
  }

  if (path === "/signup" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(signupHtml(baseUrl));
  }

  // Self-signup → creates a pending tenant account + emails (or dev-links) a verification URL.
  if (path === "/api/signup" && req.method === "POST") {
    const ip = clientIp(req);
    if (rateLimited("signup:" + ip, 5, 60 * 60 * 1000)) return json(res, 429, { error: "Too many signups from this network — try again later." });
    const body = (await readBody(req)) || {};
    if (!(await verifyTurnstile(body.turnstileToken, ip))) return json(res, 400, { error: "Bot check failed — please retry." });
    const email = String(body.email || "").trim().toLowerCase();
    const name = String(body.name || "").trim();
    if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(res, 400, { error: "Name and a valid email are required." });
    const tenant = slug(name);
    const verifyToken = randomUUID().replace(/-/g, "");
    store.createAccount({ email, name, tenant, verifyToken });
    sendSignupAlert({ name, email, tenant, ip, base: baseUrl }).catch(() => {});
    const link = `${baseUrl}/verify?token=${verifyToken}`;
    const emailed = await sendVerification(email, link);
    return json(res, 201, { ok: true, tenant, emailed, devLink: emailed ? undefined : link });
  }

  // Verification link → activates the account, provisions an installation token, shows download.
  // Links expire 30 minutes after signup. Idempotent within that window: prefetches by email
  // scanners and repeat clicks both succeed and return the same installation token.
  if (path === "/verify") {
    const acc = store.accountByVerify(url.searchParams.get("token") || "");
    const expired = acc && Date.now() - Date.parse(acc.created_at) > 30 * 60 * 1000;
    res.writeHead(acc && !expired ? 200 : 400, { "Content-Type": "text/html; charset=utf-8" });
    if (!acc || expired) return res.end(welcomeHtml(null));
    let installToken = acc.install_token;
    if (!installToken) {
      installToken = randomUUID().replace(/-/g, "");
      store.createInstallation(installToken, acc.tenant, baseUrl);
      store.verifyAccount(acc.email, installToken);
    }
    return res.end(welcomeHtml({ name: acc.name, tenant: acc.tenant, token: installToken, base: baseUrl }));
  }

  if (path === "/api/health") return json(res, 200, { status: "ok", version: VERSION });
  // Multitenant: policy is keyed per tenant.
  const tenantOf = (v) => (v && String(v).trim()) || "default";
  // Account sessions are locked to their own tenant; the global admin may request any tenant.
  const scopeT = (requested) => (session && !session.admin) ? session.tenant : requested;

  if (path === "/api/policy") {
    // Admin (cookie) may read any tenant for editing; a client must present a valid install token,
    // which fixes the tenant — no cross-tenant reads from the body.
    let t;
    if (session && session.admin) t = tenantOf(url.searchParams.get("tenant"));
    else { const tt = tokenTenant(); if (!tt) return json(res, 401, { error: "enrollment required" }); t = tt; }
    const policyId = url.searchParams.get("policyId");
    // policyId → return that specific policy (dashboard editing).
    // else → resolve the effective policy for the device (client enforcement); falls back to default.
    const resolved = policyId
      ? { policyId, emailNotify: store.getPolicyEmail(t, policyId), ...store.policyData(t, policyId) }
      : store.resolvePolicy(t, url.searchParams.get("user"), url.searchParams.get("device"));
    const vc = visionConfig(store, t);
    return json(res, 200, { ...DEFAULT_POLICY, tenant: t, imageInspection: { enabled: vc.enabled && vc.key_set }, ...resolved });
  }

  // List / create / delete named policies for a tenant.
  if (path === "/api/policies" && req.method === "GET") return json(res, 200, store.listPolicies(tenantOf(scopeT(url.searchParams.get("tenant")))));
  if (path === "/api/policies" && req.method === "POST") {
    const b = (await readBody(req)) || {};
    const name = String(b.name || "").trim();
    if (!name) return json(res, 400, { error: "name required" });
    return json(res, 201, store.createPolicy(tenantOf(scopeT(b.tenant)), name));
  }
  if (path === "/api/policies/rename" && req.method === "POST") {
    const b = (await readBody(req)) || {};
    const name = String(b.name || "").trim();
    if (!name) return json(res, 400, { error: "name required" });
    return json(res, 200, { ok: store.renamePolicy(tenantOf(scopeT(b.tenant)), String(b.policyId || ""), name) });
  }
  if (path === "/api/policies/delete" && req.method === "POST") {
    const b = (await readBody(req)) || {};
    return json(res, 200, { ok: store.deletePolicy(tenantOf(scopeT(b.tenant)), String(b.policyId || "")) });
  }

  // Assign a policy to a specific device.
  if (path === "/api/device-policy" && req.method === "POST") {
    const b = (await readBody(req)) || {};
    if (!b.user || !b.device) return json(res, 400, { error: "user and device required" });
    store.assignDevicePolicy(tenantOf(scopeT(b.tenant)), String(b.user), String(b.device), String(b.policyId || "default"));
    return json(res, 200, { ok: true });
  }

  if (path === "/api/threats") return json(res, 200, THREATS);
  if (path === "/api/content") return json(res, 200, CONTENT);
  if (path === "/api/tenants") return json(res, 200, (session && !session.admin) ? [session.tenant] : store.tenants());
  if (path === "/api/inventory") return json(res, 200, store.inventory(scopeT(url.searchParams.get("tenant")) || undefined));

  // Client device report — other AI tools on the device + OS. Metadata only.
  // #9 — host posts a base64 image; server extracts text via the tenant's BYO vision key.
  // The key stays server-side; the host runs its own policy on the returned text.
  if (path === "/api/ocr" && req.method === "POST") {
    const tt = tokenTenant();
    if (!tt) return json(res, 401, { error: "enrollment required" });
    const c = visionConfig(store, tt);
    if (!c.enabled || !c.key) return json(res, 400, { error: "image inspection not configured for this tenant" });
    const body = (await readBody(req)) || {};
    if (!body.image) return json(res, 400, { error: "image required" });
    try {
      const text = await ocrImage(c, body.image, body.mime || "image/png");
      return json(res, 200, { text });
    } catch (e) { return json(res, 502, { error: String(e.message || e) }); }
  }

  if (path === "/api/device-report" && req.method === "POST") {
    const tt = tokenTenant();
    if (!tt) return json(res, 401, { error: "enrollment required" });
    const body = (await readBody(req)) || {};
    store.upsertDevice({
      tenant: tt, user: body.user, device: body.device, appVersion: body.appVersion,
      os: body.os, osVersion: body.osVersion, tools: Array.isArray(body.tools) ? body.tools : [],
      patches: body.patches && typeof body.patches === "object" ? body.patches : undefined,
      browsers: Array.isArray(body.browsers) ? body.browsers : undefined
    });
    return json(res, 201, { ok: true });
  }

  // Admin: set the per-threat action (disabled | alert | block) for a tenant's policy.
  if (path === "/api/policy/threats" && req.method === "POST") {
    const body = (await readBody(req)) || {};
    const t = tenantOf(scopeT(body.tenant));
    const pid = body.policyId || "default";
    if (body.id != null && ACTIONS.includes(body.action)) store.setPolicyThreat(t, pid, body.id, body.action);
    return json(res, 200, store.policyData(t, pid).threatPolicy);
  }

  // Admin: set the per-content-category action (disabled | alert | block) for a tenant's policy.
  if (path === "/api/policy/content" && req.method === "POST") {
    const body = (await readBody(req)) || {};
    const t = tenantOf(scopeT(body.tenant));
    const pid = body.policyId || "default";
    if (CONTENT_IDS.has(body.id) && ACTIONS.includes(body.action)) store.setPolicyContent(t, pid, body.id, body.action);
    return json(res, 200, store.policyData(t, pid).contentPolicy);
  }

  // #66 — email-notification settings: per-tenant recipient + per-policy on/off toggle.
  if (path === "/api/notify" && req.method === "GET") {
    const t = tenantOf(scopeT(url.searchParams.get("tenant")));
    return json(res, 200, { email: store.getNotifyEmail(t), configured: emailConfigured() });
  }
  if (path === "/api/notify" && req.method === "POST") {
    const b = (await readBody(req)) || {};
    const email = String(b.email || "").trim();
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(res, 400, { error: "invalid email" });
    store.setNotifyEmail(tenantOf(scopeT(b.tenant)), email);
    return json(res, 200, { ok: true });
  }
  if (path === "/api/policy/email" && req.method === "POST") {
    const b = (await readBody(req)) || {};
    store.setPolicyEmail(tenantOf(scopeT(b.tenant)), String(b.policyId || "default"), !!b.on);
    return json(res, 200, { ok: true });
  }
  // Admin allow-list: which agent CLIs (claude/codex/copilot) devices on this policy may launch.
  if (path === "/api/policy/tools" && req.method === "POST") {
    const b = (await readBody(req)) || {};
    const saved = store.setPolicyTools(tenantOf(scopeT(b.tenant)), String(b.policyId || "default"), b.tools);
    return json(res, 200, { ok: true, allowedTools: saved });
  }

  // #67 — weekly-report settings (per-tenant enable + recipient).
  if (path === "/api/weekly" && req.method === "GET") {
    const t = tenantOf(scopeT(url.searchParams.get("tenant")));
    return json(res, 200, { ...store.getWeekly(t), configured: emailConfigured() });
  }
  if (path === "/api/weekly" && req.method === "POST") {
    const b = (await readBody(req)) || {};
    const email = String(b.email || "").trim();
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(res, 400, { error: "invalid email" });
    store.setWeekly(tenantOf(scopeT(b.tenant)), { enabled: !!b.enabled, email });
    return json(res, 200, { ok: true });
  }

  // #9 — image-inspection BYO-key settings (per tenant). The key is write-only (never returned).
  if (path === "/api/vision" && req.method === "GET") {
    const c = visionConfig(store, tenantOf(scopeT(url.searchParams.get("tenant"))));
    return json(res, 200, { enabled: c.enabled, provider: c.provider, model: c.model, key_set: c.key_set });
  }
  if (path === "/api/vision" && req.method === "POST") {
    const b = (await readBody(req)) || {};
    saveVisionConfig(store, tenantOf(scopeT(b.tenant)), b);
    return json(res, 200, { ok: true });
  }

  // #45 — compliance mapping (live report) + downloadable export.
  if (path === "/api/compliance" && req.method === "GET") {
    const t = tenantOf(scopeT(url.searchParams.get("tenant")));
    const rep = buildReport(store, t, url.searchParams.get("framework") || "soc2", { threats: THREATS.length, content: CONTENT.length });
    if (!rep) return json(res, 400, { error: "unknown framework" });
    return json(res, 200, { frameworks: FRAMEWORK_LIST, report: rep });
  }
  if (path === "/compliance/export") {
    if (!session || !session.admin) return json(res, 401, { error: "auth required" });
    const t = tenantOf(url.searchParams.get("tenant"));
    const fw = url.searchParams.get("framework") || "soc2";
    const rep = buildReport(store, t, fw, { threats: THREATS.length, content: CONTENT.length });
    if (!rep) return json(res, 400, { error: "unknown framework" });
    if (url.searchParams.get("format") === "json") {
      res.writeHead(200, { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="RAISEME-${fw}-${t}.json"` });
      return res.end(JSON.stringify(rep, null, 2));
    }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Content-Disposition": `attachment; filename="RAISEME-${fw}-${t}.html"` });
    return res.end(renderReportHtml(rep));
  }

  if (path === "/api/stats") return json(res, 200, store.stats(scopeT(url.searchParams.get("tenant")) || undefined));

  if (path === "/api/alerts" && req.method === "GET") {
    const limit = Number(url.searchParams.get("limit")) || 50;
    return json(res, 200, store.recent(limit, scopeT(url.searchParams.get("tenant")) || undefined));
  }

  if (path === "/api/alerts" && req.method === "POST") {
    const tt = tokenTenant();
    if (!tt) return json(res, 401, { error: "enrollment required" });
    const body = (await readBody(req)) || {};
    body.tenant = tt;
    const result = store.insertAlert(body, req.headers["x-client-id"]);
    // #66: email the tenant recipient if email notifications are on for this device's policy.
    if (result.ok) {
      try {
        const rp = store.resolvePolicy(tt, body.user, body.device);
        const to = store.getPolicyEmail(tt, rp.policyId) ? store.getNotifyEmail(tt) : "";
        if (to) sendAlertEmail(to, { tenant: tt, alert: body, user: body.user, device: body.device, base: baseUrl }).catch(() => {});
      } catch {}
    }
    return result.ok ? json(res, 201, { ok: true }) : json(res, 400, result);
  }

  // Prompt counter — one event per prompt pushed to the agent (metadata only, no content).
  if (path === "/api/prompt-event" && req.method === "POST") {
    const tt = tokenTenant();
    if (!tt) return json(res, 401, { error: "enrollment required" });
    const body = (await readBody(req)) || {};
    body.tenant = tt;
    const result = store.insertPrompt(body, req.headers["x-client-id"]);
    return result.ok ? json(res, 201, { ok: true }) : json(res, 400, result);
  }

  if (path === "/dashboard") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(dashboardHtml(VERSION));
  }

  json(res, 404, { error: "not found" });
});

attachTerminal(server);
server.listen(PORT, () => console.log(`RAISEME server v${VERSION} on http://localhost:${PORT}`));
