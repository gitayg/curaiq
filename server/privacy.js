// Public privacy policy, served at /privacy. Self-contained. NOTE: this is a plain-language
// starting point that reflects how RAISEME actually handles data — have it reviewed by counsel
// (especially the Families / children's-data section) before relying on it.
export function privacyHtml(base = "") {
  const updated = "June 2026";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Privacy — RAISEME</title>
<meta name="description" content="How RAISEME handles data: on-device review, only redacted metadata leaves the machine, never prompt content.">
<link rel="icon" href="/favicon.svg" type="image/svg+xml"/>
<style>
  :root{--bg:#0e1116;--bg2:#161b22;--border:#2a3140;--text:#e6edf3;--dim:#8b949e;--dim2:#5a6573;--blue:#4c8dff;--green:#3ecf8e;--sans:Inter,'Helvetica Neue',Arial,sans-serif;--mono:ui-monospace,'SF Mono',Consolas,monospace}
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:var(--bg);color:var(--text);font-family:var(--sans);line-height:1.65}
  a{color:var(--blue);text-decoration:none}
  .wrap{max-width:760px;margin:0 auto;padding:0 24px 64px}
  nav{display:flex;align-items:center;gap:14px;height:60px;border-bottom:1px solid var(--border);font-size:13px}
  nav .sp{flex:1} nav .back{color:var(--dim)}
  h1{font-size:34px;font-weight:900;letter-spacing:-.5px;margin:40px 0 4px}
  .upd{color:var(--dim2);font-size:13px;font-family:var(--mono);margin-bottom:8px}
  .tldr{background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:18px 20px;margin:22px 0;color:var(--text);font-size:15px}
  .tldr b{color:var(--blue)}
  h2{font-size:18px;margin:32px 0 8px}
  p{color:var(--dim);font-size:15px;margin:8px 0}
  ul{color:var(--dim);font-size:15px;margin:8px 0 8px 22px}
  li{margin:5px 0}
  .kids{border-left:3px solid var(--green);background:rgba(62,207,142,.06);padding:12px 18px;border-radius:0 10px 10px 0;margin:14px 0}
  strong{color:var(--text)}
  footer{border-top:1px solid var(--border);margin-top:40px;padding:24px 0;color:var(--dim2);font-size:12px;display:flex;gap:14px;flex-wrap:wrap}
</style>
</head>
<body>
<div class="wrap">
  <nav><a class="back" href="/">← Home</a><span class="sp"></span><a href="/about">About</a></nav>

  <h1>Privacy</h1>
  <div class="upd">Last updated: ${updated}</div>

  <div class="tldr"><b>The short version:</b> RAISEME reviews prompts <strong>on your device</strong>. Your prompt and response <strong>content is never stored and never sent to us</strong> — only redacted, content-free metadata (category, risk level, a one-way hash) reaches the RAISEME server so an admin or parent can see <em>that</em> something happened, not <em>what</em> was written.</div>

  <h2>Who controls your data</h2>
  <p>For the <strong>Enterprise</strong> edition, your organization (the tenant) is the data controller; RAISEME is the tool it runs. For the <strong>Families</strong> edition, the parent/guardian is in control of their household's setup.</p>

  <h2>What we collect</h2>
  <ul>
    <li><strong>Account info</strong> — the email and account/organization name you enter at sign-up, to create and verify your tenant.</li>
    <li><strong>Device metadata</strong> — OS version, the RAISEME app version, and an inventory of other AI tools / browser AI extensions present, to compute a posture score.</li>
    <li><strong>Redacted event metadata</strong> — when a policy triggers: category, risk level, stage, a content <em>hash</em>, timestamp, and the device/user label. Used for the dashboard, alerts, and reports.</li>
    <li><strong>Prompt counts</strong> — how many prompts were sent vs. blocked (numbers only).</li>
  </ul>

  <h2>What we do <strong>not</strong> collect</h2>
  <ul>
    <li>The text of your prompts or the AI's responses — review happens locally and content stays on the device.</li>
    <li>Conversation transcripts. The server stores no readable content; payloads carrying raw content are rejected on ingest.</li>
  </ul>

  <h2>Where data lives &amp; how it's protected</h2>
  <p>Account and event metadata is stored on the RAISEME server, isolated per tenant — one tenant can never read another's. Secrets (SSO client secrets, your bring-your-own vision key) are encrypted at rest (AES-256-GCM) and are never sent back to any device. Sessions are signed; the admin console is restricted to the administrator (password or your SSO).</p>

  <h2>Families &amp; children's data</h2>
  <div class="kids">
    <p style="margin-top:0">RAISEME for Families is designed for <strong>data minimization</strong>. The on-device review means a child's conversations are <strong>not uploaded</strong>. Parents receive a <strong>signal</strong> that something needs attention — not their child's transcripts. Where signs of self-harm appear, the app surfaces help resources locally.</p>
    <p style="margin-bottom:0">If you're a parent enrolling a minor's device, you are providing consent for that household setup. We collect the minimum needed to run the controls and never sell or share children's data. <strong>(COPPA / GDPR-K: confirm your specific obligations — see "Legal review" below.)</strong></p>
  </div>

  <h2>Your rights (GDPR / CCPA)</h2>
  <p>You can request access to, correction of, or deletion of your account data. Because RAISEME holds only redacted metadata, there is no conversation content to export or erase. Direct requests to the contact below; enterprise tenants should route requests through their administrator.</p>

  <h2>Retention</h2>
  <p>Event metadata is retained for operational reporting and removed when an account is closed. Installation tokens can be revoked at any time from the console.</p>

  <h2>Contact</h2>
  <p>Questions or requests: the administrator of your tenant, or the operator of this RAISEME instance.</p>

  <p style="color:var(--dim2);font-size:12px;margin-top:28px">Legal review: this page describes RAISEME's actual data handling in plain language and is a starting point — it is not legal advice. Have it reviewed by counsel for your jurisdiction before publishing, especially the children's-data section.</p>

  <footer><a href="/">raiseme.glick.run</a><span>·</span><a href="/about">About</a><span>·</span><a href="https://glick.run">Built on AppCrane</a></footer>
</div>
</body>
</html>`;
}
