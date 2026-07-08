// Public landing page — explains the value, lets a user self-sign-up, and links the client download.
const SHELL = (title, body, head = "") => `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<link rel="icon" href="/favicon.svg" type="image/svg+xml"/>
<title>${title}</title>${head}
<style>
:root{--bg:#0e1116;--surface:#161b22;--surface-2:#1c2230;--border:#2a3140;--text:#e6edf3;--muted:#8b949e;--accent:#4c8dff;--crit:#f25555;--ok:#2ea043}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--text);font-family:Inter,system-ui,sans-serif;line-height:1.6}
a{color:var(--accent)}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:6px}
header{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:12px;padding:14px 28px;border-bottom:1px solid var(--border);background:rgba(22,27,34,.85);backdrop-filter:blur(10px)}
.brand{font-weight:800;letter-spacing:.5px;font-size:18px}
header .sp{flex:1}header a{font-size:13px;color:var(--muted);text-decoration:none;margin-left:18px;transition:color .15s ease}header a:hover{color:var(--text)}
header a.login{color:var(--text);border:1px solid var(--accent);border-radius:8px;padding:7px 18px;font-weight:600;font-size:14px;transition:background .15s ease,color .15s ease}
header a.login:hover{background:var(--accent);color:#fff}
.wrap{max-width:1000px;margin:0 auto;padding:56px 28px}
.eyebrow{display:inline-block;font-size:12px;font-weight:600;letter-spacing:.4px;color:var(--accent);background:rgba(76,141,255,.12);border:1px solid rgba(76,141,255,.3);border-radius:999px;padding:5px 12px;margin-bottom:18px}
.hero h1{font-size:42px;line-height:1.12;margin:0 0 16px;letter-spacing:-.5px}
.hero .accent{color:var(--accent)}
.hero p.lead{font-size:18px;color:var(--muted);max-width:640px;margin:0 0 28px}
.cta{display:flex;gap:12px;flex-wrap:wrap}
.btn{background:var(--accent);color:#fff;border:none;border-radius:10px;padding:12px 22px;font-size:15px;font-weight:600;cursor:pointer;text-decoration:none;display:inline-block;transition:transform .12s ease,filter .15s ease,box-shadow .15s ease}
.btn.ghost{background:transparent;color:var(--text);border:1px solid var(--border)}
.btn:hover{filter:brightness(1.08);transform:translateY(-1px);box-shadow:0 6px 18px rgba(76,141,255,.25)}
.btn.ghost:hover{box-shadow:none;border-color:var(--accent)}
.btn:active{transform:translateY(0)}
.btn:disabled{opacity:.6;cursor:default;transform:none;box-shadow:none}
.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin:56px 0}
.card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:20px;transition:transform .15s ease,border-color .15s ease,box-shadow .15s ease}
.card:hover{transform:translateY(-3px);border-color:var(--accent);box-shadow:0 10px 24px rgba(0,0,0,.25)}
.card h3{margin:0 0 8px;font-size:16px}.card p{margin:0;color:var(--muted);font-size:14px}
.card .ic{font-size:22px;margin-bottom:10px}
.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin:24px 0 0}
.step{border-left:2px solid var(--accent);padding:4px 0 4px 16px}
.step b{display:block;font-size:14px}.step span{color:var(--muted);font-size:13px}
.two{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:18px}
.aud{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:22px;transition:transform .15s ease,border-color .15s ease}
.aud:hover{transform:translateY(-3px);border-color:var(--accent)}
.aud .k{font-size:12px;font-weight:600;letter-spacing:.4px;text-transform:uppercase;color:var(--accent)}
.aud h3{margin:6px 0 8px;font-size:18px}.aud p{margin:0;color:var(--muted);font-size:14px}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin:14px 0 0}
.chip{font-size:12px;color:var(--text);background:var(--surface-2);border:1px solid var(--border);border-radius:999px;padding:4px 10px;white-space:nowrap}
.aud .act{margin-top:12px;font-size:12px;color:var(--muted)}
.aud .act b{color:var(--text);font-weight:600}
.section{margin-top:64px;scroll-margin-top:80px}.section h2{font-size:24px;margin:0 0 8px}
.panel{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:28px;max-width:520px}
.panel h2{margin:0 0 6px;font-size:22px}.panel p.sub{margin:0 0 20px;color:var(--muted);font-size:14px}
label{display:block;font-size:13px;color:var(--muted);margin:14px 0 5px}
input{width:100%;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:8px;padding:11px 12px;font-size:14px;transition:border-color .15s ease,box-shadow .15s ease}
input:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px rgba(76,141,255,.15)}
input.bad{border-color:var(--crit)}
.note{margin-top:14px;font-size:13px;padding:12px;border-radius:8px;display:none}
.note.ok{display:block;background:rgba(46,160,67,.12);border:1px solid var(--ok);color:var(--text)}
.note.err{display:block;background:rgba(242,85,85,.12);border:1px solid var(--crit);color:var(--text)}
.note code{background:var(--bg);padding:2px 6px;border-radius:5px;font-size:12px;word-break:break-all}
.foot{margin-top:64px;padding-top:24px;border-top:1px solid var(--border);color:var(--muted);font-size:13px}
.tok{background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px 12px;font-family:ui-monospace,Menlo,monospace;font-size:13px;word-break:break-all;margin:10px 0}
@media(max-width:760px){
  header{padding:12px 18px;gap:8px}header a{margin-left:12px}.brand+span{display:none}
  .wrap{padding:40px 20px}
  .hero h1{font-size:30px}.hero p.lead{font-size:16px}
  .grid3,.steps,.two{grid-template-columns:1fr;gap:14px;margin-top:24px}
  .cta .btn{flex:1;text-align:center}
  .section{margin-top:44px}
}
</style></head>
<body>
<header><span class="brand">RAISEME</span><span style="color:var(--muted);font-size:13px">Managed AI Security</span><span class="sp"></span>
<a href="#who">Who it's for</a><a href="#how">How it works</a><a href="/signup">Get started</a><a class="login" href="/login">Log in →</a></header>
${body}
<div class="wrap foot">RAISEME — local-first guardrails for AI usage. The agent runs on the device; only redacted signals reach the portal.</div>
</body></html>`;

const OG_TITLE = "RAISEME — Promote responsible AI usage across your organization";
const OG_DESC = "A managed AI host that reviews every prompt before it reaches the agent — coach, alert or block by policy, all on the device.";
function ogMeta(base) {
  if (!base) return "";
  const img = `${base}/og.png`; // PNG — social platforms don't render SVG og:image
  const ld = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "RAISEME",
    applicationCategory: "SecurityApplication",
    operatingSystem: "macOS",
    description: OG_DESC,
    url: `${base}/`,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD", description: "Free for up to 200 users" },
    publisher: { "@type": "Organization", name: "RAISEME", url: `${base}/` }
  };
  return `
<meta name="description" content="${OG_DESC}"/>
<link rel="canonical" href="${base}/"/>
<meta property="og:type" content="website"/>
<meta property="og:site_name" content="RAISEME"/>
<meta property="og:title" content="${OG_TITLE}"/>
<meta property="og:description" content="${OG_DESC}"/>
<meta property="og:url" content="${base}/"/>
<meta property="og:image" content="${img}"/>
<meta property="og:image:type" content="image/png"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${OG_TITLE}"/>
<meta name="twitter:description" content="${OG_DESC}"/>
<meta name="twitter:image" content="${img}"/>
<script type="application/ld+json">${JSON.stringify(ld)}</script>`;
}

export function landingHtml(base = "") {
  return SHELL("RAISEME — Guard your team's AI usage", `
<div class="wrap">
  <div class="hero">
    <span class="eyebrow">Managed AI security · runs on the device</span>
    <h1>Promote responsible AI usage <span class="accent">across your organization.</span></h1>
    <p class="lead">RAISEME is a managed AI host that reviews every prompt <b>before</b> it reaches the agent,
    coaches users in the moment, and gives security teams visibility — all running locally on the device,
    so sensitive content never leaves the machine.</p>
    <div class="cta">
      <a class="btn" href="/signup">Create your account</a>
      <a class="btn ghost" href="/download/app">⤓ Download the app</a>
    </div>
  </div>

  <div class="grid3">
    <div class="card"><div class="ic">🛡️</div><h3>Pre-flight guard</h3><p>Each message is reviewed against 40 AI-security threats + content policy before it reaches the agent. Block, alert, or allow — your call, per tenant.</p></div>
    <div class="card"><div class="ic">🔒</div><h3>Local-first &amp; private</h3><p>Detection runs on the device. Only redacted metadata (no raw content) is reported to the portal — so the guard never becomes the leak.</p></div>
    <div class="card"><div class="ic">📊</div><h3>Fleet visibility</h3><p>A security dashboard with per-tenant policy, device inventory, and a live detection feed — so you can see and tune AI risk across the org.</p></div>
  </div>

  <div class="section" id="who">
    <h2>One guard, two policy sets</h2>
    <p style="color:var(--muted);max-width:680px;margin:0 0 4px">The same on-device review, with the exact categories you enforce shown below. Every category is set per device to one of four actions.</p>
    <div class="two">
      <div class="aud">
        <div class="k">Enterprise · AI security</div>
        <h3>Stop data leaks to AI</h3>
        <p>40 AI-security threats across these policy areas, plus on-device DLP for secrets and personal data:</p>
        <div class="chips">
          <span class="chip">Privacy &amp; sharing</span>
          <span class="chip">Prompt injection</span>
          <span class="chip">Tools &amp; add-ons</span>
          <span class="chip">Permissions &amp; agents</span>
          <span class="chip">Social engineering</span>
          <span class="chip">Information reliability</span>
          <span class="chip">Output &amp; code</span>
          <span class="chip">Identity &amp; access</span>
          <span class="chip">Data &amp; knowledge</span>
          <span class="chip">Secrets · API keys</span>
          <span class="chip">PII · cards · IBAN</span>
        </div>
        <p style="margin:14px 0 0;color:#56d364;font-weight:600;font-size:13px">Free for up to 200 users</p>
      </div>
      <div class="aud">
        <div class="k">Families · parental control</div>
        <h3>Parental controls for AI</h3>
        <p>Six content categories applied to what's sent to — and returned by — the AI:</p>
        <div class="chips">
          <span class="chip">Sexual / explicit</span>
          <span class="chip">Violence / weapons</span>
          <span class="chip">Self-harm</span>
          <span class="chip">Hate / extremism</span>
          <span class="chip">Drugs</span>
          <span class="chip">Profanity</span>
        </div>
        <p style="margin:14px 0 0;color:#56d364;font-weight:600;font-size:13px">Always free</p>
      </div>
    </div>
  </div>

  <div class="section" id="languages">
    <h2>Languages</h2>
    <p style="color:var(--muted);max-width:660px;margin:0 0 18px">Protection coverage by language today — we're explicit about where it's strong and where it's growing:</p>
    <div class="grid3">
      <div class="card"><div class="ic">🌐</div><h3>Data &amp; secret detection — <span style="color:var(--ok)">any language</span></h3><p>Emails, national IDs, payment cards, IBANs, API keys, private keys, JWTs, phone numbers, code blocks &amp; URLs are matched by pattern — so they're caught regardless of the language you write in.</p></div>
      <div class="card"><div class="ic">🔤</div><h3>Behavioral &amp; content — <span style="color:var(--accent)">English (+ Hebrew)</span></h3><p>Parental-control content (explicit, violence, self-harm, drugs, hate, profanity) now matches <b>English &amp; Hebrew</b>. Prompt-injection and social-engineering (BEC) threat detection are keyword-based and English today.</p></div>
    </div>
  </div>

  <div class="section" id="how">
    <h2>How it works</h2>
    <div class="steps">
      <div class="step"><b>1 · Sign up</b><span>Create your tenant account in seconds and verify your email.</span></div>
      <div class="step"><b>2 · Install</b><span>Download the host, enroll with your token — it binds to your tenant automatically.</span></div>
      <div class="step"><b>3 · Use AI, guarded</b><span>Work with the agent through RAISEME. It coaches, blocks, and reports per your policy.</span></div>
    </div>
  </div>

</div>`, ogMeta(base));
}

export function loginHtml(base = "") {
  return SHELL("RAISEME — Log in", `
<div class="wrap" style="max-width:440px">
  <p style="margin:0 0 14px"><a href="/" style="color:var(--muted);text-decoration:none;font-size:13px">← Back to home</a></p>
  <div class="panel">
    <h2>Log in</h2>
    <p class="sub">Enter your email and we'll send you a secure login link.</p>
    <div id="tenant-form">
      <label for="em">Email</label>
      <input id="em" type="email" placeholder="you@example.com" autofocus />
      <div style="margin-top:14px"><button class="btn" id="em-btn">Email me a login link</button></div>
    </div>
    <div class="note" id="lg-note"></div>
    <p class="sub" style="margin:18px 0 0">Don't have an account? <a href="/signup">Create a tenant →</a></p>
  </div>
</div>
<script>
const $=id=>document.getElementById(id);
const note=$("lg-note");
function showErr(m){note.className="note err";note.textContent=m;}
function showOk(m){note.className="note ok";note.textContent=m;}
async function emailLogin(){
  const em=$("em").value.trim(),btn=$("em-btn");
  if(!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(em)){showErr("Please enter a valid email address.");$("em").focus();return;}
  btn.disabled=true;const old=btn.textContent;btn.textContent="Sending…";note.className="note";note.textContent="";
  try{
    await fetch("/api/login-link",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:em})});
    showOk("✓ If that email has an account, a login link is on its way — check your inbox.");
  }catch(e){showErr("Network error — please try again.");}
  finally{btn.disabled=false;btn.textContent=old;}
}
$("em-btn").addEventListener("click",emailLogin);
$("em").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();emailLogin();}});
const err=new URLSearchParams(location.search).get("err");if(err)showErr(err);
$("em").focus();
</script>`);
}

// Operator (instance owner) sign-in — password + SSO. Deliberately not linked from the public
// /login page; reachable only at /operator so tenants never see an admin-password box.
export function operatorHtml(base = "") {
  return SHELL("RAISEME — Operator sign-in", `
<div class="wrap" style="max-width:440px">
  <p style="margin:0 0 14px"><a href="/login" style="color:var(--muted);text-decoration:none;font-size:13px">← Tenant login</a></p>
  <div class="panel">
    <h2>Operator sign-in</h2>
    <p class="sub">Restricted to the RAISEME operator.</p>
    <div id="sso-box" hidden style="margin:0 0 12px">
      <a id="sso-oidc" class="btn" href="/sso/oidc/start" hidden style="display:block;text-align:center;text-decoration:none">Sign in with SSO</a>
      <a id="sso-saml" class="btn" href="/sso/saml/start" hidden style="display:block;text-align:center;text-decoration:none;margin-top:8px">Sign in with SAML</a>
      <div id="sso-or" style="text-align:center;color:var(--muted);font-size:12px;margin:12px 0 2px">or</div>
    </div>
    <div id="pw-form">
      <label for="pw">Admin password</label>
      <input id="pw" type="password" placeholder="••••••••" autofocus />
      <div style="margin-top:14px"><button class="btn" id="pw-btn">Log in as operator</button></div>
    </div>
    <div class="note" id="lg-note"></div>
  </div>
</div>
<script>
const $=id=>document.getElementById(id);
const note=$("lg-note");
function showErr(m){note.className="note err";note.textContent=m;}
async function adminLogin(){
  const pw=$("pw").value,btn=$("pw-btn");
  btn.disabled=true;const old=btn.textContent;btn.textContent="Checking…";note.className="note";note.textContent="";
  try{
    const r=await fetch("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password:pw})});
    if(r.ok){location.href="/dashboard";return;}
    if(r.status===429){showErr("Too many attempts — try again later.");return;}
    if(r.status===403){const d=await r.json().catch(()=>({}));showErr(d.error||"Password sign-in is disabled.");return;}
    showErr("Incorrect password.");$("pw").value="";$("pw").focus();
  }catch(e){showErr("Network error.");}
  finally{btn.disabled=false;btn.textContent=old;}
}
$("pw-btn").addEventListener("click",adminLogin);
$("pw").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();adminLogin();}});
fetch("/api/sso/config").then(r=>r.json()).then(d=>{let any=false;
  if(d.oidc&&d.oidc.enabled){const b=$("sso-oidc");b.hidden=false;b.textContent="Sign in with "+(d.oidc.provider_name||"SSO");any=true;}
  if(d.saml&&d.saml.enabled){const b=$("sso-saml");b.hidden=false;b.textContent="Sign in with "+(d.saml.provider_name||"SAML");any=true;}
  if(any)$("sso-box").hidden=false;
  if(d.sso_only){$("pw-form").style.display="none";$("sso-or").style.display="none";}
}).catch(()=>{});
const ssoErr=new URLSearchParams(location.search).get("sso_error");if(ssoErr)showErr("SSO: "+ssoErr);
$("pw").focus();
</script>`);
}

export function signupHtml(base = "") {
  const tsKey = process.env.TURNSTILE_SITE_KEY || "";
  return SHELL("RAISEME — Create your account", `
<div class="wrap" style="max-width:560px">
  <p style="margin:0 0 14px"><a href="/" style="color:var(--muted);text-decoration:none;font-size:13px">← Back to home</a></p>
  <div class="panel">
    <h2>Create your account</h2>
    <p class="sub">Free for up to 200 users. We'll email a verification link to activate your tenant.</p>
    <label for="su-name">Organization / account name</label>
    <input id="su-name" placeholder="Acme Inc" />
    <label for="su-email">Email</label>
    <input id="su-email" type="email" placeholder="you@example.com" />
    ${tsKey ? `<div class="cf-turnstile" data-sitekey="${tsKey}" style="margin-top:14px"></div><script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>` : ""}
    <div style="margin-top:18px"><button class="btn" id="su-btn">Create account</button></div>
    <div class="note" id="su-note"></div>
    <p class="sub" style="margin:20px 0 0">Already have an account? <a href="/dashboard">Log in to the dashboard →</a></p>
  </div>
</div>
<script>
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const $=id=>document.getElementById(id);
const btn=$("su-btn"),note=$("su-note"),nameEl=$("su-name"),emailEl=$("su-email");
function fail(el,msg){if(el)el.classList.add("bad");note.className="note err";note.textContent=msg;}
async function submit(){
  const name=nameEl.value.trim(),email=emailEl.value.trim();
  nameEl.classList.remove("bad");emailEl.classList.remove("bad");
  if(!name)return fail(nameEl,"Please enter an organization or account name.");
  if(!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(email))return fail(emailEl,"Please enter a valid email address.");
  btn.disabled=true;const old=btn.textContent;btn.textContent="Creating…";note.className="note";note.textContent="";
  try{
    const turnstileToken=document.querySelector('[name=cf-turnstile-response]')?.value||"";
    const r=await fetch("/api/signup",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,email,turnstileToken})});
    const d=await r.json();
    if(!r.ok){fail(null,d.error||"Signup failed. Please try again.");return;}
    note.className="note ok";
    note.innerHTML=d.emailed
      ? \`✓ Account <b>\${esc(d.tenant)}</b> created. Check <b>\${esc(email)}</b> for a verification link to activate it.\`
      : \`✓ Account <b>\${esc(d.tenant)}</b> created. Email isn't configured on this server, so verify here: <br><a href="\${esc(d.devLink)}">Activate my account →</a>\`;
  }catch(e){fail(null,"Network error — please try again.");}
  finally{btn.disabled=false;btn.textContent=old;}
}
btn.addEventListener("click",submit);
[nameEl,emailEl].forEach(el=>{
  el.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();submit();}});
  el.addEventListener("input",()=>el.classList.remove("bad"));
});
</script>`, ogMeta(base));
}

export function welcomeHtml(acc) {
  if (!acc) return SHELL("RAISEME — Invalid link", `<div class="wrap"><div class="panel"><h2>Link invalid or expired</h2><p class="sub">That verification link isn't valid. <a href="/signup">Sign up again →</a></p></div></div>`);
  const curl = `curl -s "${acc.base}/d/${acc.token}" -o ~/.raiseme/config.json`;
  return SHELL("RAISEME — Account activated", `
<div class="wrap">
  <div class="panel" style="max-width:640px">
    <h2>Welcome, ${esc(acc.name)} 🎉</h2>
    <p class="sub">Your account is verified. Tenant: <b>${esc(acc.tenant)}</b>.</p>
    <p style="font-weight:600;margin:0 0 6px">1 · Download the host</p>
    <a class="btn" href="/download/app">⤓ Download RAISEME</a>
    <p style="color:var(--muted);font-size:13px;margin:8px 0 0">macOS — signed &amp; notarized; just double-click to open.</p>
    <p style="font-weight:600;margin:22px 0 6px">2 · Enroll to your tenant</p>
    <p style="color:var(--muted);font-size:13px;margin:0">Open the app → click the tenant chip → paste this token, or run the command below:</p>
    <div class="tok">${esc(acc.token)}</div>
    <div class="tok">${esc(curl)}</div>
    <p style="margin-top:22px"><a href="/dashboard">Go to the security dashboard →</a></p>
  </div>
</div>`);
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
