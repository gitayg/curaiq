// Security-team dashboard — server-rendered shell; data fetched client-side from /api.
export function dashboardHtml(version) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<link rel="icon" href="/favicon.svg" type="image/svg+xml"/>
<title>RAISEME — Security Dashboard</title>
<style>
:root{--bg:#0e1116;--surface:#161b22;--surface-2:#1c2230;--border:#2a3140;--text:#e6edf3;--muted:#8b949e;
--crit:#f25555;--high:#f0883e;--med:#d9b32b;--accent:#4c8dff;--ok:#2ea043}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:Inter,system-ui,sans-serif;font-size:14px}
header{display:flex;align-items:center;gap:12px;padding:12px 22px;border-bottom:1px solid var(--border);background:var(--surface)}
.brand{font-weight:700;letter-spacing:.5px}.tag{color:var(--muted);font-size:12px;margin-left:8px}
.tenant-wrap{margin-left:auto;display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted)}
#tenant-sel{background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:8px;padding:5px 10px;font-size:13px;font-weight:600}
.posture{margin-left:12px;font-size:12px;color:var(--muted);border:1px solid var(--border);padding:4px 10px;border-radius:999px}
main{max-width:1100px;margin:0 auto;padding:20px 22px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin-bottom:18px}
.kpi.ok .n{color:var(--ok)}
.hm{overflow-x:auto}
.hm table{border-collapse:separate;border-spacing:3px;font-size:11px}
.hm th{color:var(--muted);font-weight:500;padding:2px 4px;text-align:center;white-space:nowrap}
.hm td.u{color:var(--text);text-align:left;padding:2px 10px 2px 0;white-space:nowrap;position:sticky;left:0;background:var(--surface)}
.hm td.c{width:28px;height:22px;text-align:center;border-radius:4px;color:#fff;font-size:10px;font-variant-numeric:tabular-nums}
.hm td.e{width:28px;height:22px;border-radius:4px;background:var(--surface-2)}
.hm-legend{display:flex;align-items:center;gap:8px;color:var(--muted);font-size:12px;margin-top:10px;flex-wrap:wrap}
.hm-grad{width:120px;height:10px;border-radius:5px;background:linear-gradient(90deg,#4c8dff,#f25555)}
.polbar{display:flex;align-items:center;gap:10px;margin:0 0 14px;flex-wrap:wrap}
.polbar label{color:var(--muted);font-size:13px}
.polbar select{background:var(--surface-2);color:var(--text);border:1px solid var(--border);border-radius:7px;padding:6px 10px;font-size:13px;margin-left:6px}
.polbtn{background:var(--surface-2);color:var(--text);border:1px solid var(--border);border-radius:7px;padding:6px 12px;font-size:13px;cursor:pointer}
.polbtn:hover{border-color:var(--accent)}
.polbtn.danger:hover{border-color:var(--crit);color:var(--crit)}
.polhint{color:var(--muted);font-size:12px;margin-left:4px}
.inv-pol{background:var(--surface-2);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:4px 8px;font-size:12px}
.kpi{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px}
.kpi .n{font-size:26px;font-weight:700}.kpi .l{color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.5px}
.kpi.crit .n{color:var(--crit)}.kpi.high .n{color:var(--high)}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.panel{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:16px}
.panel h2{margin:0 0 12px;font-size:13px;text-transform:uppercase;letter-spacing:.6px;color:var(--muted)}
.sub{margin:0 0 14px;color:var(--muted);font-size:12px}
.bar{display:flex;align-items:center;gap:10px;margin:6px 0;font-size:13px}
.bar .label{width:160px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bar .track{flex:1;height:8px;background:var(--bg);border-radius:999px;overflow:hidden}
.bar .fill{height:100%;background:var(--accent)}
.bar .c{width:30px;text-align:right;color:var(--muted)}
table{width:100%;border-collapse:collapse;font-size:12px}
th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--border)}
th{color:var(--muted);font-weight:600}
.lvl{padding:1px 8px;border-radius:999px;font-size:11px;color:#fff}
.lvl.Critical{background:var(--crit)}.lvl.High{background:var(--high)}.lvl.Medium{background:var(--med);color:#1a1a1a}.lvl.Blocked{background:#b3231f}
.empty{color:var(--muted);padding:8px}
.pc{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.pc input{background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:8px;padding:7px 10px;font-size:13px}
.pc button,#inst-create{background:var(--accent);color:#fff;border:none;border-radius:8px;padding:7px 14px;font-size:13px;font-weight:600;cursor:pointer}
#app-dl{margin-left:auto;background:transparent;color:var(--accent);border:1px solid var(--accent);border-radius:8px;padding:6px 14px;font-size:13px;font-weight:600;text-decoration:none}
#app-dl:hover{background:var(--accent);color:#fff}
nav.tabs{display:flex;gap:6px;margin-left:24px}
nav.tabs button{background:transparent;color:var(--muted);border:1px solid var(--border);border-radius:8px;padding:5px 14px;font-size:13px;font-weight:600;cursor:pointer}
nav.tabs button.active{background:var(--accent);color:#fff;border-color:var(--accent)}
.ptabs{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px}
.ptabs .ptab{background:transparent;color:var(--muted);border:1px solid var(--border);border-radius:8px;padding:5px 12px;font-size:12px;font-weight:600;cursor:pointer}
.ptabs .ptab.active{background:var(--accent);color:#fff;border-color:var(--accent)}
.ptable{width:100%;border-collapse:collapse;font-size:13px}
.ptable th,.ptable td{text-align:left;padding:7px 10px;border-bottom:1px solid var(--border)}
.ptable th{color:var(--muted);font-weight:600}
.ptable td.tname{max-width:300px}
.ptable td.desc{color:var(--muted);font-size:12px;max-width:440px}
.ptable select{background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:4px 8px;font-size:12px}
.ptable select.disabled{color:var(--muted)}
.ptable select.alert{border-color:var(--accent)}
.ptable select.notify{border-color:var(--high)}
.ptable select.block{border-color:var(--crit);color:#fff;background:#b3231f}
#tip{position:fixed;z-index:50;max-width:360px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;font-size:12px;line-height:1.5;color:var(--text);box-shadow:0 8px 24px rgba(0,0,0,.4);pointer-events:none;display:none}
#tip b{color:var(--muted);font-weight:600}
</style></head>
<body>
<header><span class="brand">RAISEME<span class="tag">Security Dashboard v${version}</span></span>
<nav class="tabs"><button data-view="overview" class="active">Overview</button><button data-view="policy">Policy</button><button data-view="inventory">Inventory</button><button data-view="installs">Installs</button><button data-view="compliance">Compliance</button></nav>
<label class="tenant-wrap">Tenant <select id="tenant-sel"></select></label>
<span class="posture">Responsible AI Usage</span>
<a href="/logout" style="margin-left:16px;color:var(--muted);font-size:12px;text-decoration:none">Log out</a></header>
<main>
<div id="view-overview">
<div class="kpis">
  <div class="kpi ok"><div class="n" id="k-prompts">–</div><div class="l">Prompts to agent</div></div>
  <div class="kpi crit"><div class="n" id="k-blocked">–</div><div class="l">Prompts blocked</div></div>
  <div class="kpi"><div class="n" id="k-total">–</div><div class="l">Total alerts</div></div>
  <div class="kpi crit"><div class="n" id="k-crit">–</div><div class="l">Critical</div></div>
  <div class="kpi high"><div class="n" id="k-high">–</div><div class="l">High</div></div>
  <div class="kpi"><div class="n" id="k-devices">–</div><div class="l">Connected Devices</div></div>
</div>
<div class="grid">
  <div class="panel"><h2>By category</h2><div id="cats"></div></div>
  <div class="panel"><h2>By user / device</h2><div id="users"></div></div>
</div>
<div class="panel" style="margin-top:16px"><h2>Prompt usage — per user × day (last 14 days)</h2>
  <p class="sub" id="prompt-summary">–</p>
  <div class="hm" id="prompt-heatmap"></div>
  <div class="hm-legend"><span>all clean</span><span class="hm-grad"></span><span>all flagged</span><span style="margin-left:14px">number = prompts that day · color = share flagged/blocked · brightness = volume</span></div>
</div>
<div class="panel" style="margin-top:16px"><h2>Recent alerts (redacted)</h2>
  <table><thead><tr><th>Time</th><th>User</th><th>Device</th><th>Threat</th><th>Category</th><th>Level</th><th>Stage</th><th>Hash</th></tr></thead>
  <tbody id="recent"></tbody></table>
</div>
</div>
<div id="view-policy" hidden>
  <div class="panel">
    <p class="sub">Per-item action for <b id="pol-tenant">tenant</b> — <b>Disabled</b>: off · <b>Alert</b>: log to dashboard, silent for the user · <b>Notify user</b>: warn the user (override) · <b>Block</b>: enforce.</p>
    <div class="polbar">
      <label>Policy <select id="policy-sel"></select></label>
      <button id="policy-new" class="polbtn">+ New policy</button>
      <button id="policy-rename" class="polbtn">Rename</button>
      <button id="policy-del" class="polbtn danger">Delete</button>
      <span class="polhint">Editing the selected policy. Assign policies to devices in the Inventory tab.</span>
    </div>
    <div class="polbar" style="margin-top:8px">
      <label style="display:flex;align-items:center;gap:7px;cursor:pointer"><input type="checkbox" id="pol-email"/> <b>Email me on alerts</b> for this policy</label>
      <label>Send to <input id="notify-email" type="email" placeholder="alerts@acme.com" style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:6px 10px;color:var(--text);font-size:13px;width:200px"/></label>
      <span class="polhint" id="notify-hint"></span>
    </div>
    <div class="polbar" style="margin-top:8px">
      <label style="display:flex;align-items:center;gap:7px;cursor:pointer"><input type="checkbox" id="weekly-on"/> <b>Weekly summary report</b></label>
      <label>Send to <input id="weekly-email" type="email" placeholder="reports@acme.com" style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:6px 10px;color:var(--text);font-size:13px;width:200px"/></label>
      <span class="polhint">Emailed every Monday (UTC) — alerts, top categories, devices.</span>
    </div>
    <div class="polbar" style="margin-top:8px">
      <b>Allowed AI agents</b>
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" id="tool-claude" value="claude"/> Claude</label>
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" id="tool-codex" value="codex"/> Codex</label>
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" id="tool-copilot" value="copilot"/> Copilot CLI</label>
      <span class="polhint">Which agent CLIs devices on this policy may launch — users pick from these.</span>
    </div>
    <div class="ptabs" id="ptabs"></div>
    <div id="ptab-body"></div>
  </div>
</div>
<div id="view-inventory" hidden>
  <div class="panel"><h2>Device inventory</h2>
    <p class="sub">Endpoints reporting for <b id="inv-tenant">tenant</b> — OS, agent version, <b>other AI tools</b>, browser AI extensions, and a 0–100 <b>posture score</b><span id="inv-posture"></span>.</p>
    <table class="ptable"><thead><tr><th>User</th><th>Device</th><th>Policy</th><th>OS</th><th>Agent</th><th>OS patches</th><th>Other AI tools</th><th>Browsers / extensions</th><th>Alerts</th><th>Crit</th><th>Posture</th><th>Last report</th></tr></thead>
    <tbody id="inv-rows"></tbody></table>
  </div>
</div>
<div id="view-installs" hidden>
  <div class="panel"><h2>Download &amp; install</h2>
    <p class="sub">Create a per-tenant installation, share its link. The user double-clicks — the app extracts user &amp; device itself; the token only carries the tenant/server binding.</p>
    <div class="pc">
      <input id="inst-tenant" placeholder="tenant (e.g. ACME)">
      <button id="inst-create">Create installation</button>
      <a id="app-dl" href="/download/app" download>⤓ Download RAISEME app</a>
    </div>
    <div id="inst-list" style="margin-top:14px"></div>
  </div>
  <div class="panel" style="margin-top:18px"><h2>SSO — admin login</h2>
    <p class="sub">Let the admin sign in through your identity provider. Only emails on the allowlist get in — the console stays admin-only.</p>
    <style>.sso-in{background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:8px 10px;color:var(--text);font-size:13px;width:100%;box-sizing:border-box}.sso-l{display:block;font-size:12px;color:var(--muted);margin:8px 0 3px}.sso-h{margin:20px 0 6px;font-size:14px;font-weight:700}.sso-uri{color:var(--accent);word-break:break-all}</style>
    <div style="max-width:600px">
      <label class="sso-l">Admin emails — comma-separated; <code>@domain.com</code> allowed</label><input id="sso-emails" class="sso-in" placeholder="you@acme.com, @acme.com"/>
      <div class="sso-h">OIDC <span style="color:var(--muted);font-weight:400">(Okta, Entra, Google, Auth0…)</span></div>
      <label style="display:flex;align-items:center;gap:7px;cursor:pointer"><input type="checkbox" id="sso-enabled"/> <b>Enable OIDC</b></label>
      <label class="sso-l">Provider name</label><input id="sso-name" class="sso-in" placeholder="Okta"/>
      <label class="sso-l">Discovery URL</label><input id="sso-disc" class="sso-in" placeholder="https://acme.okta.com/.well-known/openid-configuration"/>
      <label class="sso-l">Client ID</label><input id="sso-cid" class="sso-in"/>
      <label class="sso-l">Client secret</label><input id="sso-secret" class="sso-in" type="password" placeholder="(unchanged)"/>
      <div style="color:var(--muted);font-size:12px;margin-top:8px">Redirect URI: <code id="sso-redir" class="sso-uri"></code></div>
      <div class="sso-h">SAML</div>
      <label style="display:flex;align-items:center;gap:7px;cursor:pointer"><input type="checkbox" id="saml-enabled"/> <b>Enable SAML</b></label>
      <label class="sso-l">Provider name</label><input id="saml-name" class="sso-in" placeholder="Okta"/>
      <label class="sso-l">IdP SSO URL</label><input id="saml-url" class="sso-in" placeholder="https://acme.okta.com/app/.../sso/saml"/>
      <label class="sso-l">IdP X.509 certificate (PEM)</label><textarea id="saml-cert" class="sso-in" rows="3" placeholder="(unchanged)"></textarea>
      <div style="color:var(--muted);font-size:12px;margin-top:8px">ACS URL: <code id="saml-acs" class="sso-uri"></code><br>Metadata: <code id="saml-meta" class="sso-uri"></code></div>
      <label style="display:flex;align-items:center;gap:7px;cursor:pointer;margin-top:16px"><input type="checkbox" id="sso-only"/> <b>SSO only</b> — disable password sign-in</label>
      <div style="display:flex;gap:8px;align-items:center;margin-top:14px"><button id="sso-test" class="polbtn">Test OIDC discovery</button><button id="sso-save" class="btn">Save</button><span id="sso-msg" class="polhint"></span></div>
    </div>
  </div>
  <div class="panel" style="margin-top:18px"><h2>Image inspection — bring your own vision key</h2>
    <p class="sub">Inspect images (screenshots, photos) before they reach the agent. You bring your own vision API key — the image goes only to <b>your</b> provider, the key is stored <b>encrypted</b> on the server and is never sent to devices.</p>
    <div style="max-width:560px">
      <label style="display:flex;align-items:center;gap:7px;cursor:pointer"><input type="checkbox" id="vis-enabled"/> <b>Enable image inspection</b></label>
      <label class="sso-l">Provider</label>
      <select id="vis-provider" class="sso-in"><option value="anthropic">Anthropic (Claude vision)</option><option value="openai">OpenAI (GPT-4o)</option></select>
      <label class="sso-l">Model — optional, defaults per provider</label><input id="vis-model" class="sso-in" placeholder="claude-sonnet-4-6 / gpt-4o"/>
      <label class="sso-l">API key</label><input id="vis-key" class="sso-in" type="password" placeholder="(unchanged)"/>
      <div style="display:flex;gap:8px;align-items:center;margin-top:12px"><button id="vis-save" class="btn">Save</button><span id="vis-msg" class="polhint"></span></div>
    </div>
  </div>
</div>
<div id="view-compliance" hidden>
  <div class="panel"><h2>Compliance mapping</h2>
    <p class="sub">How RAISEME's controls map to common frameworks, with <b>live evidence</b> for <b id="cmp-tenant">tenant</b>. Export to share with auditors. <span style="color:var(--muted)">Self-assessment — not a certification.</span></p>
    <div class="polbar">
      <label>Framework <select id="cmp-fw"></select></label>
      <span id="cmp-sum" class="polhint"></span>
      <span class="sp" style="flex:1"></span>
      <a id="cmp-html" class="polbtn" download>⤓ Export HTML</a>
      <a id="cmp-json" class="polbtn" download>⤓ JSON</a>
    </div>
    <table class="ptable" style="margin-top:8px"><thead><tr><th>Control</th><th>RAISEME mapping</th><th>Evidence (live)</th><th>Status</th></tr></thead>
    <tbody id="cmp-rows"></tbody></table>
  </div>
</div>
</main>
<div id="tip"></div>
<script>
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const riskRank=r=>({Critical:3,High:2,Medium:1,Low:0}[r]??0);
const sevLevel=s=>s==="high"?"High":"Medium";
const ACTION_LABELS={disabled:"Disabled",alert:"Alert (silent)",notify:"Notify user",block:"Block"};
const optsHtml=sel=>["disabled","alert","notify","block"].map(v=>\`<option value="\${v}" \${v===sel?"selected":""}>\${ACTION_LABELS[v]}</option>\`).join("");
const tipEl=document.getElementById("tip");
let TENANT="", currentView="overview";
let PT=[],PTcontent=[],PTtp={},PTcp={},activeTab="parental",policyInit=false;
let POLICIES=[{id:"default",name:"Default"}],activePolicy="default";

const PTABS=[
  {id:"parental",label:"Parental Control",content:true},
  {id:"privacy",label:"Privacy",cats:["Information & Privacy","Meetings & Sharing"]},
  {id:"injection",label:"Prompt Injection",cats:["Prompt Injection"]},
  {id:"addons",label:"Add-ons",cats:["Add-ons & Tools"]},
  {id:"tools",label:"Tools",cats:["Unapproved Tools","Operations & Costs"],ids:[24]},
  {id:"reliability",label:"Reliability",cats:["Information Reliability"]},
  {id:"permissions",label:"Permissions",cats:["Permissions & Exposure","Agents & Permissions"],exclude:[24]},
  {id:"social",label:"Social Engineering",cats:["Social Engineering"]},
  {id:"output",label:"Output",cats:["Output & Code"],ids:[16]},
  {id:"identity",label:"Identity",cats:["Identity & Access"]},
  {id:"data",label:"Data Knowledge",cats:["Data & Knowledge"]},
  {id:"advisory",label:"Advisory",cats:["Advisory & Guidance"]}
];

async function loadTenants(){
  const list=await fetch("/api/tenants").then(r=>r.json()).catch(()=>[]);
  const opts=list.length?list:["default"];
  if(!opts.includes(TENANT)) TENANT=opts[0];
  const sel=document.getElementById("tenant-sel");
  if(sel) sel.innerHTML=opts.map(t=>\`<option \${t===TENANT?"selected":""}>\${esc(t)}</option>\`).join("");
}
document.getElementById("tenant-sel").addEventListener("change",e=>{
  TENANT=e.target.value;
  load();
  if(currentView==="policy") loadPolicy();
  if(currentView==="inventory") loadInventory();
  if(currentView==="installs") loadInstalls();
  if(currentView==="compliance") loadCompliance();
});

async function load(){
  const [stats,recent]=await Promise.all([
    fetch("/api/stats?tenant="+encodeURIComponent(TENANT)).then(r=>r.json()),
    fetch("/api/alerts?limit=25&tenant="+encodeURIComponent(TENANT)).then(r=>r.json())
  ]);
  const lvl=Object.fromEntries(stats.byLevel.map(x=>[x.level,x.c]));
  document.getElementById("k-total").textContent=stats.total;
  document.getElementById("k-crit").textContent=lvl.Critical||0;
  document.getElementById("k-high").textContent=lvl.High||0;
  document.getElementById("k-devices").textContent=stats.devices||0;
  const pr=stats.prompts||{sent:0,blocked:0};
  document.getElementById("k-prompts").textContent=pr.sent||0;
  document.getElementById("k-blocked").textContent=pr.blocked||0;
  renderHeatmap(pr);
  const max=Math.max(1,...stats.byCategory.map(x=>x.c));
  const umax=Math.max(1,...(stats.byUser||[]).map(x=>x.c));
  document.getElementById("users").innerHTML=(stats.byUser&&stats.byUser.length)?stats.byUser.map(x=>
    \`<div class="bar"><span class="label">\${esc(x.user)} <span style="color:var(--muted)">@ \${esc(x.device)}</span></span><span class="track"><span class="fill" style="width:\${x.c/umax*100}%"></span></span><span class="c">\${x.c}</span></div>\`).join(""):'<div class="empty">No data yet.</div>';
  document.getElementById("cats").innerHTML=stats.byCategory.length?stats.byCategory.map(x=>
    \`<div class="bar"><span class="label">\${esc(x.category)}</span><span class="track"><span class="fill" style="width:\${x.c/max*100}%"></span></span><span class="c">\${x.c}</span></div>\`).join(""):'<div class="empty">No data yet.</div>';
  document.getElementById("recent").innerHTML=recent.length?recent.map(a=>
    \`<tr><td>\${esc((a.received_at||"").slice(11,19))}</td><td>\${esc(a.user||"–")}</td><td>\${esc(a.device||"–")}</td><td>#\${esc(a.threat_id)}</td><td>\${esc(a.category)}</td><td><span class="lvl \${esc(a.risk_level)}">\${esc(a.risk_level)}</span></td><td>\${esc(a.stage)}</td><td>\${esc(a.content_hash||"–")}</td></tr>\`).join(""):'<tr><td colspan="8" class="empty">No alerts for this tenant yet.</td></tr>';
}

function renderHeatmap(pr){
  const good=pr.good||0, bad=pr.bad||0;
  document.getElementById("prompt-summary").innerHTML='Good (clean): <b style="color:var(--ok)">'+good+'</b> &nbsp;·&nbsp; Bad (flagged or blocked): <b style="color:var(--crit)">'+bad+'</b> &nbsp;·&nbsp; Total: <b>'+(good+bad)+'</b>';
  const host=document.getElementById("prompt-heatmap");
  const hm=pr.heatmap||[];
  if(!hm.length){host.innerHTML='<div class="empty">No prompt activity yet.</div>';return;}
  const days=[...Array(14)].map((_,i)=>{const d=new Date();d.setDate(d.getDate()-(13-i));return d.toISOString().slice(0,10);});
  const users=[...new Set(hm.map(r=>r.user))];
  const idx={}; let maxT=1;
  hm.forEach(r=>{idx[r.user+"|"+r.day]={total:r.total,bad:r.bad}; if(r.total>maxT)maxT=r.total;});
  const color=(t,b)=>{const ratio=t?b/t:0;const B=[76,141,255],R=[242,85,85];const c=B.map((x,i)=>Math.round(x+(R[i]-x)*ratio));const a=(0.30+0.70*Math.min(1,t/maxT)).toFixed(2);return 'rgba('+c[0]+','+c[1]+','+c[2]+','+a+')';};
  let h='<table><thead><tr><th></th>';
  days.forEach(d=>h+='<th>'+d.slice(5)+'</th>');
  h+='</tr></thead><tbody>';
  users.forEach(u=>{
    h+='<tr><td class="u">'+esc(u)+'</td>';
    days.forEach(d=>{const cell=idx[u+"|"+d];
      if(cell&&cell.total)h+='<td class="c" style="background:'+color(cell.total,cell.bad)+'" title="'+cell.total+' prompts, '+cell.bad+' flagged on '+d+'">'+cell.total+'</td>';
      else h+='<td class="e"></td>';});
    h+='</tr>';
  });
  h+='</tbody></table>';
  host.innerHTML=h;
}

async function loadPolicy(){
  document.getElementById("pol-tenant").textContent=TENANT;
  POLICIES=await fetch("/api/policies?tenant="+encodeURIComponent(TENANT)).then(r=>r.json());
  if(!POLICIES.some(p=>p.id===activePolicy)) activePolicy="default";
  document.getElementById("policy-sel").innerHTML=POLICIES.map(p=>\`<option value="\${esc(p.id)}" \${p.id===activePolicy?"selected":""}>\${esc(p.name)}</option>\`).join("");
  document.getElementById("policy-del").style.display=activePolicy==="default"?"none":"inline-block";
  const [threats,content,policy]=await Promise.all([
    fetch("/api/threats").then(r=>r.json()),
    fetch("/api/content").then(r=>r.json()),
    fetch("/api/policy?tenant="+encodeURIComponent(TENANT)+"&policyId="+encodeURIComponent(activePolicy)).then(r=>r.json())
  ]);
  PT=threats; PTcontent=content; PTtp=policy.threatPolicy||{}; PTcp=policy.contentPolicy||{};
  document.getElementById("pol-email").checked=!!policy.emailNotify;
  {const at=policy.allowedTools||["claude","codex","copilot"];["claude","codex","copilot"].forEach(t=>{const el=document.getElementById("tool-"+t);if(el)el.checked=at.includes(t);});}
  if(!policyInit){
    policyInit=true;
    document.getElementById("pol-email").addEventListener("change",async e=>{
      await fetch("/api/policy/email",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tenant:TENANT,policyId:activePolicy,on:e.target.checked})});
    });
    ["claude","codex","copilot"].forEach(t=>{
      document.getElementById("tool-"+t).addEventListener("change",async()=>{
        const tools=["claude","codex","copilot"].filter(x=>document.getElementById("tool-"+x).checked);
        await fetch("/api/policy/tools",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tenant:TENANT,policyId:activePolicy,tools})});
      });
    });
    const nemail=document.getElementById("notify-email"),nhint=document.getElementById("notify-hint");
    fetch("/api/notify?tenant="+encodeURIComponent(TENANT)).then(r=>r.json()).then(d=>{nemail.value=d.email||"";nhint.textContent=d.configured?"":"⚠ email delivery not configured on server";});
    nemail.addEventListener("change",async()=>{
      const r=await fetch("/api/notify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tenant:TENANT,email:nemail.value.trim()})});
      nhint.textContent=r.ok?"Saved ✓":"Invalid email";setTimeout(()=>{nhint.textContent="";},1500);
    });
    const won=document.getElementById("weekly-on"),wem=document.getElementById("weekly-email");
    fetch("/api/weekly?tenant="+encodeURIComponent(TENANT)).then(r=>r.json()).then(d=>{won.checked=!!d.enabled;wem.value=d.email||"";});
    const saveWeekly=()=>fetch("/api/weekly",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tenant:TENANT,enabled:won.checked,email:wem.value.trim()})});
    won.addEventListener("change",saveWeekly);
    wem.addEventListener("change",saveWeekly);
    document.getElementById("policy-sel").addEventListener("change",e=>{activePolicy=e.target.value; loadPolicy();});
    document.getElementById("policy-new").addEventListener("click",async()=>{
      const name=prompt("New policy name:"); if(!name||!name.trim())return;
      const p=await fetch("/api/policies",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tenant:TENANT,name:name.trim()})}).then(r=>r.json());
      if(p&&p.id){activePolicy=p.id; loadPolicy();}
    });
    document.getElementById("policy-rename").addEventListener("click",async()=>{
      const cur=POLICIES.find(p=>p.id===activePolicy);
      const name=prompt("Rename policy:",cur?cur.name:""); if(!name||!name.trim())return;
      await fetch("/api/policies/rename",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tenant:TENANT,policyId:activePolicy,name:name.trim()})});
      loadPolicy();
    });
    document.getElementById("policy-del").addEventListener("click",async()=>{
      if(activePolicy==="default")return;
      if(!confirm("Delete this policy? Devices using it revert to Default."))return;
      await fetch("/api/policies/delete",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tenant:TENANT,policyId:activePolicy})});
      activePolicy="default"; loadPolicy();
    });
    const body=document.getElementById("ptab-body");
    body.addEventListener("mousemove",e=>{
      const td=e.target.closest("td.tname"); if(!td){tipEl.style.display="none";return;}
      tipEl.innerHTML=\`<b>Guidance</b><br>\${esc(td.dataset.resp)}\`;
      tipEl.style.display="block";
      tipEl.style.left=Math.min(e.clientX+14,innerWidth-372)+"px";
      tipEl.style.top=Math.min(e.clientY+14,innerHeight-160)+"px";
    });
    body.addEventListener("mouseleave",()=>tipEl.style.display="none");
  }
  renderPtabs(); renderPtabBody();
}

function renderPtabs(){
  document.getElementById("ptabs").innerHTML=PTABS.map(t=>\`<button class="ptab \${t.id===activeTab?"active":""}" data-tab="\${t.id}">\${esc(t.label)}</button>\`).join("");
  document.querySelectorAll("#ptabs .ptab").forEach(b=>b.addEventListener("click",()=>{activeTab=b.dataset.tab; renderPtabs(); renderPtabBody();}));
}

function renderPtabBody(){
  const tab=PTABS.find(t=>t.id===activeTab);
  const body=document.getElementById("ptab-body");
  if(tab.content){
    body.innerHTML=\`<table class="ptable"><thead><tr><th>Category</th><th>Description</th><th>Severity</th><th>Action</th></tr></thead><tbody>\`+
      PTcontent.map(c=>{const act=PTcp[c.id]||"disabled";return \`<tr><td>\${esc(c.label)}</td><td class="desc">\${esc(c.description||"")}</td><td><span class="lvl \${sevLevel(c.severity)}">\${esc(c.severity)}</span></td><td><select class="\${act}" data-cid="\${esc(c.id)}">\${optsHtml(act)}</select></td></tr>\`;}).join("")+\`</tbody></table>\`;
    document.querySelectorAll("#ptab-body select").forEach(s=>s.addEventListener("change",async e=>{
      const sel=e.target; sel.className=sel.value; PTcp[sel.dataset.cid]=sel.value;
      await fetch("/api/policy/content",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tenant:TENANT,policyId:activePolicy,id:sel.dataset.cid,action:sel.value})});
    }));
  } else {
    const rows=PT.filter(t=>((tab.cats||[]).includes(t.category)&&!(tab.exclude||[]).includes(t.id))||(tab.ids||[]).includes(t.id)).sort((a,b)=>riskRank(b.riskLevel)-riskRank(a.riskLevel)||a.id-b.id);
    body.innerHTML=\`<table class="ptable"><thead><tr><th>Threat</th><th>Description</th><th>Risk</th><th>Action</th></tr></thead><tbody>\`+
      (rows.length?rows.map(t=>{const act=PTtp[t.id]||"notify";return \`<tr><td class="tname" data-resp="\${esc(t.response)}">\${esc(t.threat)}</td><td class="desc">\${esc(t.example)}</td><td><span class="lvl \${esc(t.riskLevel)}">\${esc(t.riskLevel)}</span></td><td><select class="\${act}" data-id="\${t.id}">\${optsHtml(act)}</select></td></tr>\`;}).join(""):'<tr><td colspan="4" class="empty">No items in this category.</td></tr>')+\`</tbody></table>\`;
    document.querySelectorAll("#ptab-body select").forEach(s=>s.addEventListener("change",async e=>{
      const sel=e.target; sel.className=sel.value; PTtp[sel.dataset.id]=sel.value;
      await fetch("/api/policy/threats",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tenant:TENANT,policyId:activePolicy,id:Number(sel.dataset.id),action:sel.value})});
    }));
  }
}

async function loadInventory(){
  document.getElementById("inv-tenant").textContent=TENANT;
  const [list,pols]=await Promise.all([
    fetch("/api/inventory?tenant="+encodeURIComponent(TENANT)).then(r=>r.json()),
    fetch("/api/policies?tenant="+encodeURIComponent(TENANT)).then(r=>r.json())
  ]);
  const polSel=(cur,u,dev)=>\`<select class="inv-pol" data-user="\${esc(u)}" data-device="\${esc(dev)}">\${pols.map(p=>\`<option value="\${esc(p.id)}" \${p.id===cur?"selected":""}>\${esc(p.name)}</option>\`).join("")}</select>\`;
  const toolsOf=j=>{try{const a=JSON.parse(j||"[]");return a.length?esc(a.join(", ")):"<span style='color:var(--muted)'>none detected</span>";}catch{return "—";}};
  const patchOf=j=>{if(!j)return "<span style='color:var(--muted)'>—</span>";try{const p=JSON.parse(j);if(p.upToDate)return "<span style='color:var(--ok)'>✓ up to date</span>";return "<span style='color:var(--high);font-weight:600'>⚠ "+p.count+" pending</span>";}catch{return "—";}};
  const browsersOf=(j,risky)=>{try{const arr=JSON.parse(j||"[]");if(!arr.length)return "<span style='color:var(--muted)'>—</span>";const cell=arr.map(b=>{const ex=b.extensions||[];const broad=ex.filter(e=>e.broad).length;const names=ex.map(e=>(e.broad?"⚠ ":"")+e.name).join("\\n")||"(no extensions)";return \`<span title="\${esc(names)}">\${esc(b.browser)} <b>\${ex.length}</b>\${broad?" <span style='color:var(--high)'>⚠"+broad+"</span>":""}</span>\`;}).join(" · ");return cell+(risky?\` <span style="color:var(--crit)" title="AI extensions that can read page content">⚠\${risky} AI</span>\`:"");}catch{return "—";}};
  const postureCell=p=>{p=(p==null?100:p);const c=p>=80?"var(--ok)":p>=50?"#f0883e":"var(--crit)";return \`<span style="font-weight:800;color:\${c}">\${p}</span>\`;};
  const avgP=list.length?Math.round(list.reduce((s,d)=>s+(d.posture??100),0)/list.length):null;
  const ph=document.getElementById("inv-posture"); if(ph) ph.innerHTML=avgP==null?"":\` · fleet posture \${postureCell(avgP)}/100\`;
  document.getElementById("inv-rows").innerHTML=list.length?list.map(d=>
    \`<tr><td>\${esc(d.user)}</td><td>\${esc(d.device)}</td><td>\${polSel(d.policyId||"default",d.user,d.device)}</td><td>\${esc(d.os)} \${esc(d.osVersion||"")}</td><td>\${d.appVersion?("v"+esc(d.appVersion)):"–"}</td><td>\${patchOf(d.osPatches)}</td><td>\${toolsOf(d.aiTools)}</td><td>\${browsersOf(d.browsers,d.riskyExt)}</td><td>\${d.alerts}</td><td>\${d.critical||0}</td><td>\${postureCell(d.posture)}</td><td>\${esc((d.lastReport||"").replace("T"," ").slice(0,19))}</td></tr>\`).join(""):'<tr><td colspan="12" class="empty">No devices reported for this tenant yet.</td></tr>';
  document.querySelectorAll("#inv-rows .inv-pol").forEach(s=>s.addEventListener("change",async e=>{
    const sel=e.target;
    await fetch("/api/device-policy",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tenant:TENANT,user:sel.dataset.user,device:sel.dataset.device,policyId:sel.value})});
  }));
}
let ssoInit=false;
async function loadSso(){
  const d=await fetch("/api/sso/admin-config").then(r=>r.json()).catch(()=>null); if(!d)return;
  const o=d.oidc||{},s=d.saml||{};
  $("sso-emails").value=d.admin_emails||"";
  $("sso-enabled").checked=!!o.enabled;$("sso-name").value=o.provider_name||"";$("sso-disc").value=o.discovery_url||"";$("sso-cid").value=o.client_id||"";$("sso-secret").placeholder=o.client_secret_set?"(unchanged)":"";$("sso-redir").textContent=d.redirect_uri||"";
  $("saml-enabled").checked=!!s.enabled;$("saml-name").value=s.provider_name||"";$("saml-url").value=s.idp_sso_url||"";$("saml-cert").placeholder=s.idp_cert_set?"(unchanged)":"";$("saml-acs").textContent=d.acs_url||"";$("saml-meta").textContent=d.metadata_url||"";
  $("sso-only").checked=!!d.sso_only;
  if(ssoInit)return; ssoInit=true;
  const msg=$("sso-msg"),flash=(t,ok)=>{msg.style.color=ok?"var(--ok)":"var(--crit)";msg.textContent=t;setTimeout(()=>msg.textContent="",3000);};
  $("sso-save").addEventListener("click",async()=>{
    const body={admin_emails:$("sso-emails").value.trim(),sso_only:$("sso-only").checked,
      oidc:{enabled:$("sso-enabled").checked,provider_name:$("sso-name").value.trim(),discovery_url:$("sso-disc").value.trim(),client_id:$("sso-cid").value.trim()},
      saml:{enabled:$("saml-enabled").checked,provider_name:$("saml-name").value.trim(),idp_sso_url:$("saml-url").value.trim()}};
    if($("sso-secret").value)body.oidc.client_secret=$("sso-secret").value;
    if($("saml-cert").value.trim())body.saml.idp_cert=$("saml-cert").value.trim();
    const r=await fetch("/api/sso/admin-config",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    const j=await r.json().catch(()=>({}));
    if(r.ok){$("sso-secret").value="";$("saml-cert").value="";flash("Saved ✓",true);loadSso();}else flash(j.error||"Save failed",false);
  });
  $("sso-test").addEventListener("click",async()=>{
    const r=await fetch("/api/sso/test",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({discovery_url:$("sso-disc").value.trim()})}).then(r=>r.json());
    flash(r.ok?("✓ "+r.issuer):("✗ "+(r.error||"unreachable")),r.ok);
  });
}
let visInit=false;
async function loadVision(){
  const d=await fetch("/api/vision?tenant="+encodeURIComponent(TENANT)).then(r=>r.json()).catch(()=>null); if(!d)return;
  $("vis-enabled").checked=!!d.enabled; $("vis-provider").value=d.provider||"anthropic"; $("vis-model").value=d.model||""; $("vis-key").placeholder=d.key_set?"(unchanged)":"";
  if(visInit)return; visInit=true;
  const msg=$("vis-msg"),flash=(t,ok)=>{msg.style.color=ok?"var(--ok)":"var(--crit)";msg.textContent=t;setTimeout(()=>msg.textContent="",2500);};
  $("vis-save").addEventListener("click",async()=>{
    const body={tenant:TENANT,enabled:$("vis-enabled").checked,provider:$("vis-provider").value,model:$("vis-model").value.trim()};
    if($("vis-key").value)body.key=$("vis-key").value;
    const r=await fetch("/api/vision",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    if(r.ok){$("vis-key").value="";flash("Saved ✓",true);loadVision();}else flash("Save failed",false);
  });
}
let cmpInit=false;
async function loadCompliance(){
  const fwSel=$("cmp-fw"),fw=fwSel.value||"soc2";
  const d=await fetch("/api/compliance?tenant="+encodeURIComponent(TENANT)+"&framework="+encodeURIComponent(fw)).then(r=>r.json()).catch(()=>null);
  if(!d||!d.report)return;
  $("cmp-tenant").textContent=TENANT;
  if(!fwSel.options.length){fwSel.innerHTML=d.frameworks.map(f=>\`<option value="\${esc(f.key)}">\${esc(f.name)}</option>\`).join("");fwSel.value=fw;}
  const r=d.report;
  $("cmp-sum").textContent=r.summary.implemented+"/"+r.summary.total+" controls addressed";
  const q="/compliance/export?tenant="+encodeURIComponent(TENANT)+"&framework="+encodeURIComponent(fw);
  $("cmp-html").href=q; $("cmp-json").href=q+"&format=json";
  $("cmp-rows").innerHTML=r.controls.map(c=>\`<tr><td style="font-family:ui-monospace,monospace;color:var(--accent);white-space:nowrap">\${esc(c.id)}</td><td><b>\${esc(c.name)}</b><div style="color:var(--muted);font-size:12px;margin-top:3px">\${esc(c.raiseme)}</div></td><td>\${c.evidence.map(e=>\`<div><span style="color:var(--muted)">\${esc(e.label)}:</span> \${esc(e.value)}</div>\`).join("")||"—"}</td><td><span style="color:var(--ok);font-weight:700">✓ \${esc(c.status)}</span></td></tr>\`).join("");
  if(!cmpInit){cmpInit=true;fwSel.addEventListener("change",loadCompliance);}
}
async function loadInstalls(){
  loadSso(); loadVision();
  const all=await fetch("/api/installations").then(r=>r.json());
  const list=all.filter(i=>i.tenant===TENANT);
  document.getElementById("inst-tenant").value=TENANT;
  document.getElementById("inst-list").innerHTML=list.length
    ? \`<table class="ptable"><thead><tr><th>Tenant</th><th>Filename</th><th>Provision link</th><th>Downloads</th></tr></thead><tbody>\`+
      list.map(i=>\`<tr><td>\${esc(i.tenant)}</td><td>RAISEME-\${esc(i.tenant)}-\${esc(i.token.slice(0,8))}.dmg</td><td><a href="/d/\${esc(i.token)}" style="color:var(--accent)">/d/\${esc(i.token.slice(0,8))}…</a></td><td>\${i.downloads||0}</td></tr>\`).join("")+\`</tbody></table>\`
    : '<div class="empty">No installations for this tenant — create one above.</div>';
}
async function createInstall(){
  const t=document.getElementById("inst-tenant").value.trim()||"default";
  await fetch("/api/installations",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tenant:t})});
  TENANT=t;
  await loadTenants();
  loadInstalls();
}
document.getElementById("inst-create").addEventListener("click",createInstall);

const VIEWS=["overview","policy","inventory","installs"];
document.querySelectorAll("nav.tabs button").forEach(b=>b.addEventListener("click",()=>{
  document.querySelectorAll("nav.tabs button").forEach(x=>x.classList.remove("active"));
  b.classList.add("active");
  currentView=b.dataset.view;
  VIEWS.forEach(n=>document.getElementById("view-"+n).hidden=(n!==currentView));
  if(currentView==="policy") loadPolicy();
  if(currentView==="inventory") loadInventory();
  if(currentView==="installs") loadInstalls();
  if(currentView==="compliance") loadCompliance();
}));

// 30-minute inactivity timeout — locks the portal and stops polling until the user resumes.
let lastActivity=Date.now(), pollTimer=null;
["mousemove","keydown","click","scroll","touchstart"].forEach(e=>document.addEventListener(e,()=>{lastActivity=Date.now();},{passive:true}));
function lockIfIdle(){
  if(Date.now()-lastActivity <= 30*60*1000 || document.getElementById("idle-lock")) return;
  if(pollTimer) clearInterval(pollTimer);
  const d=document.createElement("div");
  d.id="idle-lock";
  d.style.cssText="position:fixed;inset:0;z-index:9999;background:rgba(14,17,22,.96);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center;font-family:Inter,system-ui,sans-serif";
  d.innerHTML='<div style="font-size:22px;font-weight:700">Session timed out</div><div style="color:#8b949e">Locked after 30 minutes of inactivity.</div><button id="idle-resume" style="background:#4c8dff;color:#fff;border:none;border-radius:8px;padding:10px 22px;font-size:14px;font-weight:600;cursor:pointer">Resume</button>';
  document.body.appendChild(d);
  document.getElementById("idle-resume").addEventListener("click",()=>location.reload());
}
(async()=>{
  let me={admin:true,tenant:null};
  try{ me=await fetch("/api/me").then(r=>r.json()); }catch{}
  if(me && !me.admin && me.tenant){
    TENANT=me.tenant;
    const tw=document.querySelector(".tenant-wrap");
    if(tw) tw.innerHTML='Tenant <b style="color:var(--text)">'+esc(me.tenant)+'</b>';
  } else {
    await loadTenants();
  }
  load(); pollTimer=setInterval(load,4000); setInterval(lockIfIdle,15000);
})();
</script>
</body></html>`;
}
