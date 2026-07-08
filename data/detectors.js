export const DETECTORS = [
  {
    // Advisory: contract / legal language → recommend legal counsel (notify by default), logged to dashboard.
    detectorId: "legal-language",
    threatId: 41,
    stage: "prompt",
    mode: "warn",
    hint: "Looks like legal / contract language — consider professional legal review.",
    patterns: [
      /\b(hereby|whereas|indemnif\w+|in witness whereof|govern(ing|ed) (law|by the)|non[- ]disclosure|terms (and|&) conditions|force majeure|represents and warrants|breach of (this )?(contract|agreement)|party of the (first|second) part|binding (agreement|contract)|arbitration clause|confidentiality (clause|agreement)|liabilit(y|ies) (shall|will|is) (limited|excluded)|\bNDA\b)/i,
      /(חוזה|הסכם|כתב התחייבות|אי[- ]גילוי|סעיף סודיות|הצדדים מסכימים|תניית|בכפוף לדין|בוררות|שיפוט בלעדי)/
    ]
  },
  {
    // Advisory: employee-relations / PIP language → recommend HR + legal (notify), logged to dashboard.
    detectorId: "hr-employee-relations",
    threatId: 42,
    stage: "prompt",
    mode: "warn",
    hint: "Looks like an employee-relations / PIP action — involve HR and legal.",
    patterns: [
      /\b(performance improvement plan|written warning|final warning|verbal warning|disciplinary (action|process|hearing|measure)|corrective action|wrongful termination|terminat(e|ing|ion)( of)?( (the|an|his|her|their))? (employment|employee)|severance( pay| package)?|lay(\s|-)?off|laid off|gross misconduct|harassment complaint|place(d)? (\w+ )?on probation)/i,
      /\bPIP\b/,
      /(תוכנית שיפור ביצועים|שימוע|פיטורי(ם|ן)|מכתב התראה|הליך משמעתי|פיצויי פיטורים|סיום העסקה|תלונת הטרדה|אזהרה בכתב)/
    ]
  },
  {
    detectorId: "dlp-email",
    threatId: 15,
    stage: "prompt",
    mode: "warn",
    hint: "Looks like an email address (personal data).",
    patterns: [/\b[\w.+-]+@[\w-]+\.[\w.-]{2,}\b/]
  },
  {
    detectorId: "dlp-national-id",
    threatId: 15,
    stage: "prompt",
    mode: "warn",
    hint: "Looks like a 9-digit national ID.",
    patterns: [/(?<!\d)\d{9}(?!\d)/]
  },
  {
    detectorId: "dlp-payment-card",
    threatId: 1,
    stage: "prompt",
    mode: "warn",
    hint: "Looks like a payment-card number.",
    patterns: [/\b(?:\d[ -]?){13,16}\b/]
  },
  {
    detectorId: "dlp-iban",
    threatId: 1,
    stage: "prompt",
    mode: "warn",
    hint: "Looks like an IBAN / bank account.",
    patterns: [/\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/]
  },
  {
    detectorId: "dlp-secret-token",
    threatId: 39,
    stage: "prompt",
    mode: "warn",
    hint: "Looks like an API key, token, or secret.",
    patterns: [
      /\b(sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36}|xox[baprs]-[A-Za-z0-9-]{10,})\b/,
      /\b(password|api[_ -]?key|secret|client[_ -]?secret|access[_ -]?token)\b\s*[:=]/i
    ]
  },
  {
    detectorId: "dlp-private-key",
    threatId: 39,
    stage: "prompt",
    mode: "warn",
    hint: "Contains a private key block.",
    patterns: [/-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/]
  },
  {
    detectorId: "dlp-jwt",
    threatId: 39,
    stage: "prompt",
    mode: "warn",
    hint: "Looks like a JWT / bearer token.",
    patterns: [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}\b/, /\bBearer\s+[A-Za-z0-9._-]{20,}/i]
  },
  {
    detectorId: "dlp-cloud-keys",
    threatId: 39,
    stage: "prompt",
    mode: "warn",
    hint: "Looks like a cloud / vendor API key (Stripe, Google, OpenAI, etc.).",
    patterns: [
      /\b(sk|pk|rk)_(live|test)_[A-Za-z0-9]{16,}\b/,
      /\bAIza[0-9A-Za-z_-]{35}\b/,
      /\bsk-(proj-)?[A-Za-z0-9_-]{20,}\b/,
      /\bglpat-[A-Za-z0-9_-]{20,}\b/
    ]
  },
  {
    detectorId: "dlp-phone",
    threatId: 15,
    stage: "prompt",
    mode: "warn",
    hint: "Looks like a phone number (personal data).",
    patterns: [/(?<!\d)(?:\+?\d{1,3}[ .-]?)?\(?\d{2,4}\)?[ .-]?\d{3}[ .-]?\d{4}(?!\d)/]
  },
  {
    detectorId: "dlp-ip-markers",
    threatId: 9,
    stage: "prompt",
    mode: "warn",
    hint: "Mentions intellectual property (roadmap, architecture, source, trade secret).",
    patterns: [/\b(confidential|proprietary|internal[ -]use[ -]only|road[ -]?map|architecture diagram|source code|trade secret|pricing strategy)\b/i]
  },
  {
    detectorId: "inj-ignore",
    threatId: 3,
    stage: "prompt",
    mode: "warn",
    hint: "Contains an instruction-override phrase (possible prompt injection).",
    patterns: [
      /ignore (the |all |any )?(previous|above|prior|earlier) (instructions?|prompts?|messages?)/i,
      /disregard (all |any )?(previous|prior|above|earlier)/i,
      /\b(reveal|print|show) (your |the )?(system prompt|instructions|developer message)\b/i,
      /\b(jailbreak|do anything now|\bDAN\b)\b/i
    ]
  },
  {
    detectorId: "inj-exfil",
    threatId: 2,
    stage: "prompt",
    mode: "warn",
    hint: "Asks to send data out / to an external destination.",
    patterns: [/\b(exfiltrate|send (the )?(data|info|information|file)s? (out|to)|post (it )?to https?:)/i]
  },
  {
    detectorId: "bec-payment",
    threatId: 11,
    stage: "prompt",
    mode: "coach",
    hint: "Payment / bank-detail change context — verify on a pre-known channel.",
    patterns: [/\b(change (the )?bank (details|account)|new (bank )?account number|update (the )?payment details|wire transfer|urgent payment|pay (this|the) invoice|iban change)\b/i]
  },
  {
    detectorId: "out-code-exec",
    threatId: 32,
    stage: "output",
    mode: "warn",
    hint: "Output contains runnable code / a risky command.",
    patterns: [
      /```/,
      /\b(powershell|invoke-webrequest|set-executionpolicy|cmd\.exe|reg add|schtasks)\b/i,
      /curl\s+[^\n]*\|\s*(ba)?sh/i,
      /\brm\s+-rf\b/,
      /\b(macro|vba|autoopen|enablemacros)\b/i
    ]
  },
  {
    detectorId: "out-links",
    threatId: 17,
    stage: "output",
    mode: "warn",
    hint: "Output contains a link — do not open without checking.",
    patterns: [/https?:\/\/[^\s)<>]+/i]
  },
  {
    detectorId: "out-citation",
    threatId: 29,
    stage: "output",
    mode: "coach",
    hint: "Output cites a source/standard — verify it exists before using it.",
    patterns: [/\b(et al\.|doi:|ISO\s?\d{3,}|APA|section\s?\d+(\.\d+)?|\[\d+\])\b/i]
  },
  {
    detectorId: "destructive-command",
    threatId: 43,
    stage: "prompt",
    mode: "warn",
    hint: "Contains a destructive, hard-to-reverse command — review before it runs.",
    patterns: [
      /\brm\s+-[a-z]*r[a-z]*f|\brm\s+-[a-z]*f[a-z]*r/i,
      /\bsudo\s+rm\b/i,
      /\bgit\s+push\s+(--force\b|-f\b)/i,
      /\bgit\s+reset\s+--hard\b/i,
      /\bdrop\s+(database|table|schema)\b/i,
      /\btruncate\s+table\b/i,
      /\bdelete\s+from\s+\w+\s*;?\s*$/i,
      /\b(mkfs|diskutil\s+erase|dd\s+if=\S+\s+of=\/dev\/)/i,
      /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/
    ]
  },
  {
    detectorId: "phi-hipaa",
    threatId: 44,
    stage: "prompt",
    mode: "warn",
    hint: "Looks like protected health information (PHI) — don't send patient data to the AI.",
    patterns: [
      /\b(diagnos(is|es|ed)|prescri(be|bed|ption)|patient (record|id|name|chart)|medical record|health insurance (number|claim|id)|protected health information|\bPHI\b|lab results|prognosis|treatment plan)\b/i,
      /\bMRN[:#\s]*[A-Z0-9-]{4,}/i,
      /\bNPI[:#\s]*\d{10}\b/i,
      /\bDEA[:#\s]*[A-Z]{2}\d{7}\b/i,
      /\b[A-TV-Z]\d{2}\.\d{1,4}\b/
    ]
  },
  {
    detectorId: "pii-passport",
    threatId: 15,
    stage: "prompt",
    mode: "warn",
    hint: "Looks like a passport number (regulated personal data).",
    patterns: [/\bpassport\b.{0,20}?\b[A-Z]{0,2}\d[A-Z0-9]{4,8}\b/i]
  },
  {
    detectorId: "pci-cvv",
    threatId: 1,
    stage: "prompt",
    mode: "warn",
    hint: "Looks like a card security code (PCI data).",
    patterns: [/\b(cvv2?|cvc2?|security code|card verification)\s*(no\.?|#|:)?\s*\d{3,4}\b/i]
  }
];
