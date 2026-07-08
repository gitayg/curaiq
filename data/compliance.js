// #45 — Compliance control mappings. Maps RAISEME's controls to common frameworks. Each control
// references metric keys (resolved server-side from live tenant data) as evidence. Honest scoping:
// status is "implemented" only where RAISEME genuinely provides the control.
export const FRAMEWORKS = {
  soc2: {
    name: "SOC 2 — Trust Services Criteria",
    controls: [
      { id: "CC6.1", name: "Logical & physical access controls", raiseme: "Admin console gated by password or SSO (OIDC/SAML); clients bound by per-device install tokens.", metrics: ["sso", "tenantIsolation"], status: "implemented" },
      { id: "CC6.6", name: "Boundary protection / least exposure", raiseme: "Every prompt reviewed on-device before it reaches the agent; DLP blocks secrets/PII egress.", metrics: ["promptsReviewed", "promptsBlocked", "threatDetectors"], status: "implemented" },
      { id: "CC6.7", name: "Restriction of data transmission", raiseme: "Only redacted metadata leaves the device — no prompt content; client→server bound to the token's tenant.", metrics: ["auditEvents"], status: "implemented" },
      { id: "CC6.8", name: "Encryption of stored secrets", raiseme: "SSO client secrets + BYO vision keys encrypted (AES-256-GCM); sessions are HMAC-signed.", metrics: ["encryption"], status: "implemented" },
      { id: "CC7.2", name: "Monitoring of security events", raiseme: "Policy alerts logged centrally by severity; per-policy email + weekly summary reports.", metrics: ["alerts", "devices"], status: "implemented" },
      { id: "CC7.3", name: "Evaluation of security events", raiseme: "Dashboard triage by threat/category/risk; per-device 0–100 posture score.", metrics: ["postureAvg"], status: "implemented" },
      { id: "C1.1", name: "Confidentiality of sensitive data", raiseme: "On-device DLP (secrets, API keys, PII, cards/IBAN) plus content categories.", metrics: ["threatDetectors", "contentCategories"], status: "implemented" }
    ]
  },
  iso27001: {
    name: "ISO/IEC 27001:2022 — Annex A",
    controls: [
      { id: "A.5.15", name: "Access control", raiseme: "Admin-only console (password/SSO); tenant isolation enforced server-side on every API.", metrics: ["sso", "tenantIsolation"], status: "implemented" },
      { id: "A.5.7", name: "Threat intelligence", raiseme: "AI-security threat detectors + content categories, centrally policy-managed and updatable.", metrics: ["threatDetectors", "contentCategories"], status: "implemented" },
      { id: "A.8.12", name: "Data leakage prevention", raiseme: "On-device DLP reviews every prompt and blocks secrets/PII before egress to the AI.", metrics: ["promptsReviewed", "promptsBlocked"], status: "implemented" },
      { id: "A.8.15", name: "Logging", raiseme: "Content-free, redacted audit of policy events per device and tenant.", metrics: ["auditEvents"], status: "implemented" },
      { id: "A.8.16", name: "Monitoring activities", raiseme: "Central alert log + device telemetry + weekly reports.", metrics: ["alerts", "devices"], status: "implemented" },
      { id: "A.8.24", name: "Use of cryptography", raiseme: "AES-256-GCM for stored secrets; HMAC-signed stateless sessions.", metrics: ["encryption"], status: "implemented" },
      { id: "A.8.9", name: "Configuration / posture management", raiseme: "Per-device AI bill-of-materials, 0–100 posture score, risky-extension flagging.", metrics: ["postureAvg", "devices"], status: "implemented" }
    ]
  },
  "nist-ai-rmf": {
    name: "NIST AI RMF 1.0",
    controls: [
      { id: "GOVERN-1.1", name: "Policies for responsible AI use", raiseme: "Per-tenant AI-usage policy (disabled/alert/notify/block) enforced on every prompt.", metrics: ["promptsReviewed", "threatDetectors"], status: "implemented" },
      { id: "GOVERN-1.6", name: "Inventory of AI systems in use", raiseme: "Shadow-AI inventory across CLIs, desktop tools, and browser AI extensions per device.", metrics: ["devices"], status: "implemented" },
      { id: "MAP-1.1", name: "AI context established", raiseme: "Device AI bill-of-materials: tools, agents, extensions, versions, posture.", metrics: ["devices", "postureAvg"], status: "implemented" },
      { id: "MEASURE-2.6", name: "Data privacy", raiseme: "On-device review; only redacted metadata leaves the machine; DLP for PII/secrets.", metrics: ["promptsReviewed", "threatDetectors"], status: "implemented" },
      { id: "MEASURE-2.7", name: "Security & resilience", raiseme: "Prompt-injection, jailbreak, destructive-command, and DLP detection.", metrics: ["threatDetectors", "promptsBlocked"], status: "implemented" },
      { id: "MEASURE-2.11", name: "Harmful content & safety", raiseme: "Content categories (sexual, self-harm, violence, harassment, grooming…) on prompt and response.", metrics: ["contentCategories"], status: "implemented" },
      { id: "MANAGE-2.2", name: "Mechanisms to oversee AI", raiseme: "In-the-moment coaching/block; central alerts, posture, and weekly reporting.", metrics: ["alerts", "postureAvg"], status: "implemented" }
    ]
  }
};
