// Outbound email via the Resend HTTP API — no SMTP, no extra dependency (Node's global fetch).
// When RESEND_API_KEY is unset, send() returns {ok:false} so the caller can surface a dev link.
const API = "https://api.resend.com/emails";

export function emailConfigured() {
  return !!process.env.RESEND_API_KEY;
}

// Low-level send. Returns {ok:true, id} on success, {ok:false, reason} otherwise.
export async function send({ to, subject, text, html }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, reason: "no-key" };
  const from = process.env.EMAIL_FROM || "RAISEME <no-reply@glick.run>";
  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, text, html })
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, reason: `${res.status} ${body.message || JSON.stringify(body)}` };
    return { ok: true, id: body.id };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// Verification email used by self-signup. Logs failures and returns a boolean for the route.
export async function sendVerification(email, link) {
  const r = await send({
    to: email,
    subject: "Verify your RAISEME account",
    text: `Activate your RAISEME account:\n\n${link}\n\nThis link expires in 30 minutes.`,
    html: verificationHtml(link)
  });
  if (r.ok) {
    console.log(`[RAISEME] verification emailed to ${email} (id ${r.id})`);
    return true;
  }
  console.log(`[RAISEME] email send failed: ${r.reason} — dev link: ${link}`);
  return false;
}

// Operator alert on each new self-signup. Goes to SIGNUP_ALERT_TO (default gitayg@gmail.com),
// independent of the tenant's own notification address. Fire-and-forget; returns boolean.
export async function sendSignupAlert({ name, email, tenant, ip, base }) {
  const to = process.env.SIGNUP_ALERT_TO || "gitayg@gmail.com";
  if (!emailConfigured()) return false;
  const subject = `RAISEME · new signup: ${name || email}`;
  const text = `A new account just signed up on RAISEME.\n\n`
    + `Name:   ${name || "—"}\nEmail:  ${email}\nTenant: ${tenant}\nIP:     ${ip || "—"}\n`
    + `${base ? `\nConsole: ${base}/dashboard` : ""}`;
  const r = await send({ to, subject, text, html: signupAlertHtml({ name, email, tenant, ip, base }) });
  if (r.ok) { console.log(`[RAISEME] signup alert -> ${to} (${email}, id ${r.id})`); return true; }
  console.log(`[RAISEME] signup alert failed: ${r.reason}`);
  return false;
}

function signupAlertHtml({ name, email, tenant, ip, base }) {
  const row = (k, v) => `<tr><td style="color:#8b949e;padding:4px 14px 4px 0;font-size:13px">${k}</td><td style="color:#e6edf3;font-size:13px;font-weight:600">${v || "—"}</td></tr>`;
  return `<!DOCTYPE html><html><body style="margin:0;background:#0e1116;font-family:Inter,Segoe UI,system-ui,sans-serif;color:#e6edf3">
  <div style="max-width:480px;margin:0 auto;padding:40px 24px">
    <div style="font-weight:800;letter-spacing:.5px;font-size:20px">RAISEME <span style="color:#8b949e;font-size:13px;font-weight:500">· new signup</span></div>
    <div style="background:#161b22;border:1px solid #2a3140;border-radius:14px;padding:24px;margin-top:20px">
      <h1 style="font-size:18px;margin:0 0 14px">🎉 ${name || email}</h1>
      <table style="border-collapse:collapse">${row("Name", name)}${row("Email", email)}${row("Tenant", tenant)}${row("IP", ip)}</table>
      ${base ? `<a href="${base}/dashboard" style="display:inline-block;margin-top:16px;background:#4c8dff;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 20px;border-radius:10px">Open console</a>` : ""}
    </div>
  </div></body></html>`;
}

// Magic-link login email. Returns boolean.
export async function sendLoginLink(email, link) {
  const r = await send({
    to: email,
    subject: "Your RAISEME login link",
    text: `Log in to your RAISEME dashboard:\n\n${link}\n\nThis link expires in 15 minutes. If you didn't request it, ignore this email.`,
    html: loginHtmlEmail(link)
  });
  if (r.ok) { console.log(`[RAISEME] login link emailed to ${email} (id ${r.id})`); return true; }
  console.log(`[RAISEME] login email failed: ${r.reason} — dev link: ${link}`);
  return false;
}

// Policy-alert notification (#66). Redacted metadata only — never prompt content. Returns boolean.
export async function sendAlertEmail(to, { tenant, alert, user, device, base }) {
  if (!to || !emailConfigured()) return false;
  const a = alert || {};
  const subject = `RAISEME alert · ${a.category || "policy"} (${a.riskLevel || "—"}) · ${device || "device"}`;
  const text = `A policy alert was recorded for tenant "${tenant}".\n\n`
    + `User:     ${user || "—"}\nDevice:   ${device || "—"}\nCategory: ${a.category || "—"}\nRisk:     ${a.riskLevel || "—"}\n`
    + `Stage:    ${a.stage || "—"}\nThreat:   #${a.threatId ?? "—"}${a.tool ? `\nTool:     ${a.tool}` : ""}\nTime:     ${a.ts || ""}\n\n`
    + `RAISEME stores redacted metadata only — no prompt content is included.\n${base ? `\nDashboard: ${base}/dashboard` : ""}`;
  const r = await send({ to, subject, text, html: alertHtml({ tenant, alert: a, user, device, base }) });
  if (r.ok) { console.log(`[RAISEME] alert emailed to ${to} (id ${r.id})`); return true; }
  console.log(`[RAISEME] alert email failed: ${r.reason}`);
  return false;
}

// Weekly summary report (#67). Aggregate metadata only. Returns boolean.
export async function sendWeeklyReport(to, { tenant, digest, base }) {
  if (!to || !emailConfigured()) return false;
  const d = digest || {};
  const cats = (d.topCategories || []).map(([c, n]) => `  ${c}: ${n}`).join("\n") || "  (none)";
  const subject = `RAISEME weekly summary · ${tenant} · ${d.alerts || 0} alerts`;
  const text = `RAISEME weekly summary for "${tenant}" (last 7 days)\n\n`
    + `Alerts:        ${d.alerts || 0}\nBlocked:       ${d.blocked || 0}\nDevices:       ${d.devices || 0}\nAll-time alerts: ${d.allTime || 0}\n\n`
    + `Top categories:\n${cats}\n\nAggregate metadata only — no prompt content.\n${base ? `\nDashboard: ${base}/dashboard` : ""}`;
  const r = await send({ to, subject, text, html: weeklyHtml({ tenant, digest: d, base }) });
  if (r.ok) { console.log(`[RAISEME] weekly report emailed to ${to} for ${tenant} (id ${r.id})`); return true; }
  console.log(`[RAISEME] weekly report failed for ${tenant}: ${r.reason}`);
  return false;
}

function weeklyHtml({ tenant, digest, base }) {
  const d = digest || {};
  const stat = (label, val, color = "#e6edf3") => `<td style="padding:0 18px 0 0"><div style="font-size:26px;font-weight:800;color:${color}">${val ?? 0}</div><div style="color:#8b949e;font-size:12px">${label}</div></td>`;
  const cats = (d.topCategories || []).map(([c, n]) => `<tr><td style="color:#e6edf3;font-size:13px;padding:3px 16px 3px 0">${c}</td><td style="color:#8b949e;font-size:13px;font-weight:600">${n}</td></tr>`).join("") || `<tr><td style="color:#8b949e;font-size:13px">No alerts this week 🎉</td></tr>`;
  return `<!DOCTYPE html><html><body style="margin:0;background:#0e1116;font-family:Inter,Segoe UI,system-ui,sans-serif;color:#e6edf3">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px">
    <div style="font-weight:800;letter-spacing:.5px;font-size:20px">RAISEME <span style="color:#8b949e;font-size:13px;font-weight:500">· weekly summary</span></div>
    <div style="color:#8b949e;font-size:13px;margin-top:4px">${tenant} · last 7 days</div>
    <div style="background:#161b22;border:1px solid #2a3140;border-radius:14px;padding:24px;margin-top:20px">
      <table style="border-collapse:collapse;margin-bottom:18px"><tr>${stat("Alerts", d.alerts)}${stat("Blocked", d.blocked, "#f0883e")}${stat("Devices", d.devices, "#4c8dff")}</tr></table>
      <div style="color:#8b949e;font-size:12px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Top categories</div>
      <table style="border-collapse:collapse">${cats}</table>
      <p style="color:#8b949e;font-size:12px;line-height:1.6;margin:18px 0 0">Aggregate metadata only — no prompt content is stored or sent.</p>
      ${base ? `<a href="${base}/dashboard" style="display:inline-block;margin-top:16px;background:#4c8dff;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 20px;border-radius:10px">Open dashboard</a>` : ""}
    </div>
  </div></body></html>`;
}

function alertHtml({ tenant, alert, user, device, base }) {
  const row = (k, v) => `<tr><td style="color:#8b949e;padding:4px 14px 4px 0;font-size:13px">${k}</td><td style="color:#e6edf3;font-size:13px;font-weight:600">${v ?? "—"}</td></tr>`;
  return `<!DOCTYPE html><html><body style="margin:0;background:#0e1116;font-family:Inter,Segoe UI,system-ui,sans-serif;color:#e6edf3">
  <div style="max-width:520px;margin:0 auto;padding:40px 24px">
    <div style="font-weight:800;letter-spacing:.5px;font-size:20px">RAISEME <span style="color:#8b949e;font-size:13px;font-weight:500">· alert</span></div>
    <div style="background:#161b22;border:1px solid #2a3140;border-radius:14px;padding:24px;margin-top:20px">
      <h1 style="font-size:18px;margin:0 0 14px">${alert.category || "Policy"} — <span style="color:#f0883e">${alert.riskLevel || ""}</span></h1>
      <table style="border-collapse:collapse">${row("Tenant", tenant)}${row("User", user)}${row("Device", device)}${row("Stage", alert.stage)}${row("Threat", "#" + (alert.threatId ?? "—"))}${alert.tool ? row("Tool", alert.tool) : ""}${row("Time", alert.ts)}</table>
      <p style="color:#8b949e;font-size:12px;line-height:1.6;margin:18px 0 0">Redacted metadata only — no prompt content is stored or sent.</p>
      ${base ? `<a href="${base}/dashboard" style="display:inline-block;margin-top:16px;background:#4c8dff;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 20px;border-radius:10px">Open dashboard</a>` : ""}
    </div>
  </div></body></html>`;
}

function loginHtmlEmail(link) {
  return `<!DOCTYPE html><html><body style="margin:0;background:#0e1116;font-family:Inter,Segoe UI,system-ui,sans-serif;color:#e6edf3">
  <div style="max-width:480px;margin:0 auto;padding:40px 24px">
    <div style="font-weight:800;letter-spacing:.5px;font-size:20px;color:#e6edf3">RAISEME</div>
    <div style="background:#161b22;border:1px solid #2a3140;border-radius:14px;padding:28px;margin-top:24px">
      <h1 style="font-size:20px;margin:0 0 10px">Log in to your dashboard</h1>
      <p style="color:#8b949e;font-size:14px;line-height:1.6;margin:0 0 22px">Click below to open your RAISEME security dashboard. This link expires in 15 minutes.</p>
      <a href="${link}" style="display:inline-block;background:#4c8dff;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 24px;border-radius:10px">Log in</a>
      <p style="color:#8b949e;font-size:12px;line-height:1.6;margin:22px 0 0">Or paste this link:<br><span style="color:#4c8dff;word-break:break-all">${link}</span></p>
    </div>
  </div></body></html>`;
}

function verificationHtml(link) {
  return `<!DOCTYPE html><html><body style="margin:0;background:#0e1116;font-family:Inter,Segoe UI,system-ui,sans-serif;color:#e6edf3">
  <div style="max-width:480px;margin:0 auto;padding:40px 24px">
    <div style="font-weight:800;letter-spacing:.5px;font-size:20px;color:#e6edf3">RAISEME</div>
    <div style="color:#8b949e;font-size:13px;margin-top:2px">Managed AI Security</div>
    <div style="background:#161b22;border:1px solid #2a3140;border-radius:14px;padding:28px;margin-top:24px">
      <h1 style="font-size:20px;margin:0 0 10px">Verify your account</h1>
      <p style="color:#8b949e;font-size:14px;line-height:1.6;margin:0 0 22px">Click below to activate your RAISEME tenant and download the host. This link expires in 30 minutes.</p>
      <a href="${link}" style="display:inline-block;background:#4c8dff;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 24px;border-radius:10px">Activate my account</a>
      <p style="color:#8b949e;font-size:12px;line-height:1.6;margin:22px 0 0">Or paste this link into your browser:<br><span style="color:#4c8dff;word-break:break-all">${link}</span></p>
    </div>
    <p style="color:#8b949e;font-size:12px;margin-top:20px">If you didn't request this, you can ignore this email.</p>
  </div></body></html>`;
}
