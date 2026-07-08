// Social / link-preview frames (1200x630), served at /og.svg (enterprise) and /og-family.svg.
// Self-contained; inline font-family on every text node so any rasterizer renders correctly.
const F = "Inter,system-ui,sans-serif";

// One safeguard line: bold title + muted one-line description.
function item(x, y, title, desc) {
  return `<text x="${x}" y="${y}" font-family="${F}" font-weight="700" font-size="15" fill="#e6edf3">${title}</text>`
    + `<text x="${x}" y="${y + 19}" font-family="${F}" font-weight="400" font-size="12.5" fill="#8b949e">${desc}</text>`;
}

// Shared frame: header, headline, subcopy, two 5-row columns, a free badge, and the Raise mark.
function frame({ tag, h1, h2, sub, col1, col2, badgeW, badge, cap1, cap2 }) {
  const ys = [226, 288, 350, 412, 474];
  let body = "";
  col1.forEach((c, i) => { body += item(72, ys[i], c[0], c[1]); });
  col2.forEach((c, i) => { body += item(372, ys[i], c[0], c[1]); });
  return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg" role="img">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#141B26"/><stop offset="1" stop-color="#0A0D13"/></linearGradient>
    <radialGradient id="gl" cx="50%" cy="46%" r="50%"><stop offset="0" stop-color="#4C8DFF" stop-opacity="0.45"/><stop offset="1" stop-color="#4C8DFF" stop-opacity="0"/></radialGradient>
  </defs>
  <rect x="0" y="0" width="1200" height="630" fill="url(#bg)"/>
  <circle cx="930" cy="250" r="210" fill="url(#gl)"/>
  <text x="72" y="72" font-family="${F}" font-weight="800" font-size="38" letter-spacing="2" fill="#e6edf3">RAISEME</text>
  <text x="1140" y="46" text-anchor="end" font-family="${F}" font-weight="700" font-size="15" letter-spacing="3" fill="#4c8dff">${tag}</text>
  <text x="72" y="120" font-family="${F}" font-weight="800" font-size="28" fill="#e6edf3">${h1}</text>
  <text x="72" y="152" font-family="${F}" font-weight="800" font-size="28" fill="#4c8dff">${h2}</text>
  <text x="72" y="186" font-family="${F}" font-weight="400" font-size="16" fill="#9aa4b1">${sub}</text>
  ${body}
  <rect x="72" y="556" width="${badgeW}" height="30" rx="15" fill="#2ea043" fill-opacity="0.15" stroke="#2ea043" stroke-width="1.2"/>
  <text x="${72 + badgeW / 2}" y="576" font-family="${F}" font-weight="700" font-size="13" fill="#56d364" text-anchor="middle">${badge}</text>
  <text x="${72 + badgeW + 16}" y="577" font-family="${F}" font-weight="600" font-size="18" fill="#8b949e">raiseme.glick.run</text>
  <circle cx="930" cy="250" r="120" fill="#0B0E14" stroke="#1c2230" stroke-width="1"/>
  <path d="M876,300 L930,252 L984,300" fill="none" stroke="#2F6FE0" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M876,266 L930,218 L984,266" fill="none" stroke="#4C8DFF" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M888,234 L930,196 L972,234" fill="none" stroke="#9FC2FF" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="930" y="408" font-family="${F}" font-weight="600" font-size="16" fill="#9aa4b1" text-anchor="middle">${cap1}</text>
  <text x="930" y="432" font-family="${F}" font-weight="400" font-size="15" fill="#8b949e" text-anchor="middle">${cap2}</text>
</svg>`;
}

// Enterprise / organizations frame.
export function ogSvg() {
  return frame({
    tag: "ENTERPRISE · AI SECURITY",
    h1: "Stop data leaks to AI",
    h2: "across your organization",
    sub: "Reviews every prompt on the device — coach, alert or block — before it reaches Claude.",
    col1: [
      ["Secrets · keys · PII", "Data-loss patterns, any language"],
      ["Prompt injection", "Hidden malicious instructions"],
      ["Regulated data", "HIPAA · PCI · GDPR"],
      ["Tools &amp; add-ons", "Unvetted plugins &amp; MCP"],
      ["Output &amp; code", "Insecure code &amp; leaked secrets"]
    ],
    col2: [
      ["Permissions &amp; agents", "Over-broad agent access"],
      ["Destructive commands", "rm -rf, force-push, DROP"],
      ["Social engineering", "Phishing &amp; BEC lures"],
      ["Identity &amp; access", "Credential exposure"],
      ["Posture &amp; compliance", "SSO · SOC 2 · ISO · NIST AI RMF"]
    ],
    badgeW: 188, badge: "Free for up to 200 users",
    cap1: "Every prompt, reviewed", cap2: "on-device · before the agent"
  });
}

// Families / parental-control frame.
export function ogFamilySvg() {
  return frame({
    tag: "FAMILIES · PARENTAL CONTROL",
    h1: "Parental controls for Claude",
    h2: "made safe for your family",
    sub: "Reviews what kids send to — and get back from — Claude, on the device.",
    col1: [
      ["Sexual / explicit", "Porn, nudes, sexting"],
      ["Violence / weapons", "Gore &amp; weapon how-tos"],
      ["Self-harm", "Suicide &amp; self-injury → help card"],
      ["Hate / extremism", "Slurs &amp; extremist content"],
      ["Eating disorders", "Pro-ana/mia, purging"]
    ],
    col2: [
      ["Bullying / harassment", "Cyberbullying &amp; threats"],
      ["Grooming / predatory", "Secrecy, photo requests"],
      ["Drugs / alcohol / vaping", "Substances, underage use"],
      ["Profanity", "Swearing — soften or block"],
      ["English &amp; Hebrew", "Matches both languages"]
    ],
    badgeW: 126, badge: "Always free",
    cap1: "Claude, kid-safe", cap2: "on-device · private"
  });
}
