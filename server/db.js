import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";

// #8 — hash single-use tokens (email verification + magic-link login) at rest, so a DB/backup
// leak yields no usable tokens. The email carries the plaintext; we store only its SHA-256.
// Install tokens are deliberately NOT hashed: they're shareable bearer links the admin re-copies
// from the console, so they must stay retrievable.
const hashTok = (t) => createHash("sha256").update(String(t)).digest("hex");
const isHashed = (v) => typeof v === "string" && /^[0-9a-f]{64}$/.test(v);

// Fields a redacted alert may contain. Anything else (raw content) is rejected on ingest.
export const ALERT_FIELDS = ["threatId", "category", "riskLevel", "stage", "tool", "ts", "contentHash", "user", "device", "platform", "tenant"];
const FORBIDDEN = ["content", "text", "prompt", "snippet", "match", "raw", "body"];

// #31 — browser extensions that pipe page content to a third-party AI (data-exfiltration risk).
const RISKY_EXT = /(chatgpt|gpt-?[34]|copilot|sider|monica|merlin|harpa|maxai|compose ?ai|wiseone|writesonic|jasper|perplexity|gemini|bard|ai ?(assistant|chat|writer|copilot)|chatbot)/i;
const extCounts = (browsersJson) => {
  let risky = 0, broad = 0;
  try {
    for (const b of (JSON.parse(browsersJson || "[]") || []))
      for (const e of (b.extensions || [])) {
        if (e.broad) broad++;
        if (RISKY_EXT.test(e.name || e.id || "")) risky++;
      }
  } catch {}
  return { risky, broad };
};
// #33 — a 0–100 device posture score from the signals RAISEME already collects.
const devicePosture = ({ critical, alerts, lastReport, riskyExt, broadExt }) => {
  let s = 100;
  s -= Math.min(45, (critical || 0) * 12);
  s -= Math.min(24, Math.max(0, (alerts || 0) - (critical || 0)) * 3);
  s -= Math.min(20, (riskyExt || 0) * 8);
  s -= Math.min(10, (broadExt || 0) * 3);
  if (lastReport && Date.now() - Date.parse(lastReport) > 7 * 86400000) s -= 12;
  return Math.max(0, Math.round(s));
};

export class Store {
  constructor(path = "data.db") {
    this.db = new DatabaseSync(path);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        threat_id INTEGER,
        category TEXT,
        risk_level TEXT,
        stage TEXT,
        tool TEXT,
        content_hash TEXT,
        client_id TEXT,
        ts TEXT,
        received_at TEXT,
        user TEXT,
        device TEXT,
        platform TEXT,
        tenant TEXT
      );
    `);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS installations (
        token TEXT PRIMARY KEY,
        tenant TEXT,
        server_url TEXT,
        created_at TEXT,
        downloads INTEGER DEFAULT 0
      );
    `);
    this.db.exec(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);`);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS prompts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant TEXT, user TEXT, device TEXT, platform TEXT,
        outcome TEXT, findings INTEGER,
        ts TEXT, received_at TEXT
      );
    `);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS devices (
        tenant TEXT, user TEXT, device TEXT,
        os TEXT, os_version TEXT, ai_tools TEXT,
        last_report TEXT,
        PRIMARY KEY (tenant, user, device)
      );
    `);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS accounts (
        email TEXT PRIMARY KEY,
        name TEXT,
        tenant TEXT,
        verify_token TEXT,
        verified INTEGER DEFAULT 0,
        install_token TEXT,
        created_at TEXT
      );
    `);
    this._migrate("alerts", ["user", "device", "platform", "tenant"]);
    this._migrate("devices", ["os_patches", "browsers", "policy_id", "app_version"]);
    this._migrate("accounts", ["login_token", "login_expires"]);
    this._migrateAlertNotify();
    this._migrateTokenHashes();
  }

  // #8 — one-time: hash any legacy plaintext verify/login tokens so lookups (which hash the
  // incoming token) keep matching. Plaintext tokens are 32 hex chars; hashes are 64 — so a value
  // that isn't already 64-hex is legacy plaintext to convert. Idempotent.
  _migrateTokenHashes() {
    try {
      const rows = this.db.prepare(`SELECT email, verify_token, login_token FROM accounts WHERE verify_token IS NOT NULL OR login_token IS NOT NULL`).all();
      for (const r of rows) {
        const vt = r.verify_token && !isHashed(r.verify_token) ? hashTok(r.verify_token) : r.verify_token;
        const lt = r.login_token && !isHashed(r.login_token) ? hashTok(r.login_token) : r.login_token;
        if (vt !== r.verify_token || lt !== r.login_token)
          this.db.prepare(`UPDATE accounts SET verify_token = ?, login_token = ? WHERE email = ?`).run(vt, lt, r.email);
      }
    } catch {}
  }

  // One-time: the action "alert" used to mean "warn the user". It now means "silent, dashboard-only",
  // and the user-facing warning is the new "notify". Convert existing stored "alert" → "notify" so
  // current policies keep warning users as before.
  _migrateAlertNotify() {
    if (this.getSetting("migrated:alert-notify", false)) return;
    const rows = this.db.prepare(`SELECT key, value FROM settings WHERE key LIKE 'threatPolicy:%' OR key LIKE 'contentPolicy:%'`).all();
    for (const r of rows) {
      try {
        const m = JSON.parse(r.value);
        let changed = false;
        for (const k of Object.keys(m)) if (m[k] === "alert") { m[k] = "notify"; changed = true; }
        if (changed) this.setSetting(r.key, m);
      } catch {}
    }
    this.setSetting("migrated:alert-notify", true);
  }

  // ---- Named policies (multiple per tenant) + per-device assignment ----
  // Each tenant has a "default" policy; named policies live alongside it. Policy action maps are
  // stored per policy: threatPolicy:<tenant>:<policyId> and contentPolicy:<tenant>:<policyId>.
  ensureDefaultPolicy(tenant) {
    const key = `policies:${tenant}`;
    let list = this.getSetting(key, null);
    if (!list) {
      list = [{ id: "default", name: "Default" }];
      this.setSetting(key, list);
      // Migrate any pre-existing single per-tenant policy into the default policy.
      const oldT = this.getSetting(`threatPolicy:${tenant}`, null);
      const oldC = this.getSetting(`contentPolicy:${tenant}`, null);
      if (oldT) this.setSetting(`threatPolicy:${tenant}:default`, oldT);
      if (oldC) this.setSetting(`contentPolicy:${tenant}:default`, oldC);
    }
    return list;
  }

  listPolicies(tenant) { return this.ensureDefaultPolicy(tenant); }

  createPolicy(tenant, name) {
    const list = this.ensureDefaultPolicy(tenant);
    const base = (String(name || "policy").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")) || "policy";
    let id = base, n = 2;
    while (list.some((p) => p.id === id)) id = `${base}-${n++}`;
    list.push({ id, name: String(name || id) });
    this.setSetting(`policies:${tenant}`, list);
    this.setSetting(`threatPolicy:${tenant}:${id}`, {});
    this.setSetting(`contentPolicy:${tenant}:${id}`, {});
    return { id, name: String(name || id) };
  }

  deletePolicy(tenant, policyId) {
    if (policyId === "default" || !policyId) return false;
    const list = this.ensureDefaultPolicy(tenant).filter((p) => p.id !== policyId);
    this.setSetting(`policies:${tenant}`, list);
    this.db.prepare(`UPDATE devices SET policy_id=NULL WHERE tenant=? AND policy_id=?`).run(tenant, policyId);
    return true;
  }

  // Rename keeps the policy id (so device assignments and action maps stay valid) — only the label changes.
  renamePolicy(tenant, policyId, name) {
    const list = this.ensureDefaultPolicy(tenant);
    const p = list.find((x) => x.id === policyId);
    if (!p || !name) return false;
    p.name = String(name);
    this.setSetting(`policies:${tenant}`, list);
    return true;
  }

  policyData(tenant, policyId = "default") {
    this.ensureDefaultPolicy(tenant);
    return {
      threatPolicy: this.getSetting(`threatPolicy:${tenant}:${policyId}`, {}),
      contentPolicy: this.getSetting(`contentPolicy:${tenant}:${policyId}`, {}),
      // Which agent CLIs the admin permits for this policy. Default: all supported.
      allowedTools: this.getSetting(`policyTools:${tenant}:${policyId}`, ["claude", "codex", "copilot"])
    };
  }

  // Admin allow-list of agent CLIs per policy. Filtered to known tools; never empty (falls back to claude).
  setPolicyTools(tenant, policyId, tools) {
    const KNOWN = ["claude", "codex", "copilot"];
    let list = Array.isArray(tools) ? [...new Set(tools.filter((t) => KNOWN.includes(t)))] : [];
    if (!list.length) list = ["claude"];
    return this.setSetting(`policyTools:${tenant}:${policyId || "default"}`, list);
  }

  setPolicyThreat(tenant, policyId, id, action) {
    const k = `threatPolicy:${tenant}:${policyId || "default"}`;
    const tp = this.getSetting(k, {});
    tp[String(id)] = action;
    return this.setSetting(k, tp);
  }

  setPolicyContent(tenant, policyId, id, action) {
    const k = `contentPolicy:${tenant}:${policyId || "default"}`;
    const cp = this.getSetting(k, {});
    cp[id] = action;
    return this.setSetting(k, cp);
  }

  assignDevicePolicy(tenant, user, device, policyId) {
    this.db.prepare(`UPDATE devices SET policy_id=? WHERE tenant=? AND user=? AND device=?`)
      .run(policyId && policyId !== "default" ? policyId : null, tenant, user, device);
  }

  // Resolves the effective policy for a device: its assigned policy, else the tenant default.
  resolvePolicy(tenant, user, device) {
    const list = this.ensureDefaultPolicy(tenant);
    let pid = "default";
    if (user && device) {
      const row = this.db.prepare(`SELECT policy_id FROM devices WHERE tenant=? AND user=? AND device=?`).get(tenant, user, device);
      if (row && row.policy_id) pid = row.policy_id;
    }
    const p = list.find((x) => x.id === pid);
    return { policyId: pid, policyName: p ? p.name : "Default", ...this.policyData(tenant, pid) };
  }

  // Email-notification settings: a per-tenant recipient + a per-policy on/off toggle (#66).
  getNotifyEmail(tenant) { return this.getSetting(`notifyEmail:${tenant}`, ""); }
  setNotifyEmail(tenant, email) { this.setSetting(`notifyEmail:${tenant}`, String(email || "").trim()); }
  getPolicyEmail(tenant, policyId = "default") { return !!this.getSetting(`policyEmail:${tenant}:${policyId}`, false); }
  setPolicyEmail(tenant, policyId = "default", on) { this.setSetting(`policyEmail:${tenant}:${policyId}`, !!on); }

  // Weekly-report settings (#67): per-tenant enable + recipient.
  getWeekly(tenant) { return this.getSetting(`weekly:${tenant}`, { enabled: false, email: "" }); }
  setWeekly(tenant, cfg) { this.setSetting(`weekly:${tenant}`, { enabled: !!(cfg && cfg.enabled), email: String((cfg && cfg.email) || "").trim() }); }

  // Last-7-day digest for the weekly report. Uses recent alerts + all-time stats for context.
  weeklyDigest(tenant) {
    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
    const recent = this.recent(2000, tenant).filter((r) => Date.parse(r.received_at) >= weekAgo);
    const byCat = {};
    for (const r of recent) byCat[r.category || "Other"] = (byCat[r.category || "Other"] || 0) + 1;
    const blocked = recent.filter((r) => r.risk_level === "Blocked" || r.stage === "blocked").length;
    return {
      alerts: recent.length,
      blocked,
      topCategories: Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 6),
      devices: this.inventory(tenant).length,
      allTime: this.stats(tenant).total
    };
  }

  createAccount({ email, name, tenant, verifyToken }) {
    this.db.prepare(`
      INSERT INTO accounts (email, name, tenant, verify_token, verified, created_at)
      VALUES (?, ?, ?, ?, 0, ?)
      ON CONFLICT(email) DO UPDATE SET name=excluded.name, tenant=excluded.tenant,
        verify_token=excluded.verify_token, created_at=excluded.created_at, verified=0, install_token=NULL
    `).run(email, name, tenant, hashTok(verifyToken), new Date().toISOString());
  }

  accountByVerify(token) {
    if (!token) return null;
    return this.db.prepare(`SELECT * FROM accounts WHERE verify_token = ?`).get(hashTok(token));
  }

  // Magic-link login: store a short-lived token on a verified account. Returns false if no
  // verified account for that email (so the caller can avoid leaking which emails exist).
  setLoginToken(email, token, ttlMs = 15 * 60 * 1000) {
    const acc = this.db.prepare(`SELECT verified FROM accounts WHERE email = ?`).get(email);
    if (!acc || !acc.verified) return false;
    this.db.prepare(`UPDATE accounts SET login_token = ?, login_expires = ? WHERE email = ?`)
      .run(hashTok(token), Date.now() + ttlMs, email);
    return true;
  }

  accountByLoginToken(token) {
    if (!token) return null;
    const acc = this.db.prepare(`SELECT * FROM accounts WHERE login_token = ?`).get(hashTok(token));
    if (!acc || !acc.login_expires || Number(acc.login_expires) < Date.now()) return null;
    return acc;
  }

  // Single-use: consume the login token so a magic link can't be replayed.
  clearLoginToken(email) {
    this.db.prepare(`UPDATE accounts SET login_token = NULL, login_expires = NULL WHERE email = ?`).run(email);
  }

  verifyAccount(email, installToken) {
    // Idempotent: keep the verify token valid until it expires (30 min) so email-scanner
    // prefetches and repeat clicks both succeed. Expiry (created_at) bounds reuse.
    this.db.prepare(`UPDATE accounts SET verified = 1, install_token = ? WHERE email = ?`).run(installToken, email);
  }

  getSetting(key, fallback = null) {
    const row = this.db.prepare(`SELECT value FROM settings WHERE key = ?`).get(key);
    if (!row) return fallback;
    try { return JSON.parse(row.value); } catch { return fallback; }
  }

  setSetting(key, value) {
    this.db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`)
      .run(key, JSON.stringify(value));
    return value;
  }

  createInstallation(token, tenant, serverUrl) {
    this.db.prepare(`INSERT INTO installations (token, tenant, server_url, created_at) VALUES (?, ?, ?, ?)`)
      .run(token, tenant, serverUrl, new Date().toISOString());
    return this.getInstallation(token);
  }

  getInstallation(token) {
    return this.db.prepare(`SELECT * FROM installations WHERE token = ?`).get(token);
  }

  bumpDownload(token) {
    this.db.prepare(`UPDATE installations SET downloads = downloads + 1 WHERE token = ?`).run(token);
  }

  listInstallations() {
    return this.db.prepare(`SELECT * FROM installations ORDER BY created_at DESC LIMIT 100`).all();
  }

  // Add any missing columns to an existing DB (forward-compatible schema changes).
  _migrate(table, columns) {
    const have = new Set(this.db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name));
    for (const col of columns) {
      if (!have.has(col)) this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} TEXT`);
    }
  }

  // Returns { ok, error } — refuses any payload carrying raw content (enforces the privacy posture).
  insertAlert(payload, clientId) {
    if (!payload || typeof payload !== "object") return { ok: false, error: "missing alert" };
    for (const k of Object.keys(payload)) {
      if (FORBIDDEN.includes(k.toLowerCase())) return { ok: false, error: `forbidden field: ${k}` };
    }
    if (typeof payload.threatId !== "number") return { ok: false, error: "threatId required" };

    this.db.prepare(`
      INSERT INTO alerts (threat_id, category, risk_level, stage, tool, content_hash, client_id, ts, received_at, user, device, platform, tenant)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      payload.threatId,
      payload.category ?? null,
      payload.riskLevel ?? null,
      payload.stage ?? null,
      payload.tool ?? null,
      payload.contentHash ?? null,
      clientId ?? null,
      payload.ts ?? null,
      new Date().toISOString(),
      payload.user ?? null,
      payload.device ?? null,
      payload.platform ?? null,
      payload.tenant ?? null
    );
    return { ok: true };
  }

  // Counts one prompt the user pushed to the agent. Metadata only — rejects any raw content.
  insertPrompt(payload, clientId) {
    if (!payload || typeof payload !== "object") return { ok: false, error: "missing event" };
    for (const k of Object.keys(payload)) {
      if (FORBIDDEN.includes(k.toLowerCase())) return { ok: false, error: `forbidden field: ${k}` };
    }
    const outcome = payload.outcome === "blocked" ? "blocked" : "sent";
    this.db.prepare(`
      INSERT INTO prompts (tenant, user, device, platform, outcome, findings, ts, received_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      payload.tenant ?? null, payload.user ?? null, payload.device ?? null, payload.platform ?? null,
      outcome, Number.isFinite(payload.findings) ? payload.findings : 0,
      payload.ts ?? null, new Date().toISOString()
    );
    return { ok: true };
  }

  recent(limit = 50, tenant) {
    const lim = Math.min(limit, 200);
    if (tenant) return this.db.prepare(`SELECT * FROM alerts WHERE tenant = ? ORDER BY id DESC LIMIT ?`).all(tenant, lim);
    return this.db.prepare(`SELECT * FROM alerts ORDER BY id DESC LIMIT ?`).all(lim);
  }

  upsertDevice({ tenant, user, device, os, osVersion, tools, patches, browsers, appVersion }) {
    // A physical device belongs to one tenant — clear any rows for it under a different tenant
    // (e.g. after re-enrollment moves it from a previous tenant).
    this.db.prepare(`DELETE FROM devices WHERE user = ? AND device = ? AND tenant <> ?`)
      .run(user || "unknown", device || "unknown", tenant || "unprovisioned");
    this.db.prepare(`
      INSERT INTO devices (tenant, user, device, os, os_version, ai_tools, os_patches, browsers, app_version, last_report)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(tenant, user, device) DO UPDATE SET
        os=excluded.os, os_version=excluded.os_version, ai_tools=excluded.ai_tools,
        os_patches=COALESCE(excluded.os_patches, devices.os_patches),
        browsers=COALESCE(excluded.browsers, devices.browsers),
        app_version=COALESCE(excluded.app_version, devices.app_version), last_report=excluded.last_report
    `).run(tenant || "unprovisioned", user || "unknown", device || "unknown", os || "", osVersion || "",
      JSON.stringify(tools || []), patches ? JSON.stringify(patches) : null,
      browsers ? JSON.stringify(browsers) : null, appVersion || null, new Date().toISOString());
  }

  // Device inventory from client reports, enriched with alert counts.
  inventory(tenant) {
    const w = tenant ? "WHERE d.tenant = ?" : "";
    const a = tenant ? [tenant] : [];
    const rows = this.db.prepare(`
      SELECT d.user, d.device, d.os, d.os_version osVersion, d.ai_tools aiTools, d.os_patches osPatches, d.browsers browsers, d.app_version appVersion, d.last_report lastReport, d.tenant, COALESCE(d.policy_id,'default') policyId,
             (SELECT COUNT(*) FROM alerts a WHERE a.user = d.user AND a.device = d.device) alerts,
             (SELECT COUNT(*) FROM alerts a WHERE a.user = d.user AND a.device = d.device AND a.risk_level IN ('Critical','Blocked')) critical
      FROM devices d ${w}
      ORDER BY d.last_report DESC
    `).all(...a);
    return rows.map((d) => {
      const { risky, broad } = extCounts(d.browsers);
      return { ...d, riskyExt: risky, broadExt: broad, posture: devicePosture({ ...d, riskyExt: risky, broadExt: broad }) };
    });
  }

  // Distinct tenants seen across installations and alerts.
  tenants() {
    const rows = this.db.prepare(`
      SELECT tenant FROM installations WHERE tenant IS NOT NULL
      UNION SELECT tenant FROM alerts WHERE tenant IS NOT NULL
    `).all().map((r) => r.tenant);
    return [...new Set(rows)].sort();
  }

  stats(tenant) {
    const w = tenant ? "WHERE tenant = ?" : "";
    const a = tenant ? [tenant] : [];
    const get = (sql) => this.db.prepare(sql).get(...a);
    const all = (sql) => this.db.prepare(sql).all(...a);
    return {
      total: get(`SELECT COUNT(*) c FROM alerts ${w}`).c,
      byLevel: all(`SELECT risk_level level, COUNT(*) c FROM alerts ${w} GROUP BY risk_level ORDER BY c DESC`),
      byCategory: all(`SELECT category, COUNT(*) c FROM alerts ${w} GROUP BY category ORDER BY c DESC`),
      byThreat: all(`SELECT threat_id threatId, category, COUNT(*) c FROM alerts ${w} GROUP BY threat_id ORDER BY c DESC LIMIT 10`),
      byUser: all(`SELECT COALESCE(user,'unknown') user, COALESCE(device,'unknown') device, COUNT(*) c FROM alerts ${w} GROUP BY user, device ORDER BY c DESC LIMIT 10`),
      devices: get(`SELECT COUNT(DISTINCT device) c FROM alerts ${w}${w ? " AND" : " WHERE"} device IS NOT NULL`).c,
      prompts: {
        total: get(`SELECT COUNT(*) c FROM prompts ${w}`).c,
        sent: get(`SELECT COUNT(*) c FROM prompts ${w}${w ? " AND" : " WHERE"} outcome='sent'`).c,
        blocked: get(`SELECT COUNT(*) c FROM prompts ${w}${w ? " AND" : " WHERE"} outcome='blocked'`).c,
        good: get(`SELECT COUNT(*) c FROM prompts ${w}${w ? " AND" : " WHERE"} findings=0`).c,
        bad: get(`SELECT COUNT(*) c FROM prompts ${w}${w ? " AND" : " WHERE"} findings>0`).c,
        byUser: all(`SELECT COALESCE(user,'unknown') user, COALESCE(device,'unknown') device, COUNT(*) c FROM prompts ${w} GROUP BY user, device ORDER BY c DESC LIMIT 10`),
        heatmap: this.promptHeatmap(tenant, 14)
      }
    };
  }

  // Per-user, per-day prompt counts for the last `days` days (metadata only).
  // Returns [{ user, day:'YYYY-MM-DD', total, bad }] — `bad` = prompts that had findings.
  promptHeatmap(tenant, days = 14) {
    const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const w = tenant ? "WHERE tenant = ? AND" : "WHERE";
    const a = tenant ? [tenant, cutoff] : [cutoff];
    return this.db.prepare(`
      SELECT COALESCE(user,'unknown') user, substr(received_at,1,10) day,
             COUNT(*) total, SUM(CASE WHEN findings>0 THEN 1 ELSE 0 END) bad
      FROM prompts ${w} substr(received_at,1,10) >= ?
      GROUP BY user, day
    `).all(...a);
  }
}
