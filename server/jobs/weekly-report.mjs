// Weekly summary report (#67). Run by AppCrane's host-side cron (see deployhub.json) via
// `docker exec` inside the running container — same filesystem, same /data, same env vars.
// For each tenant that enabled the weekly report, build a 7-day digest and email it.
import { Store } from "../db.js";
import { sendWeeklyReport } from "../email.js";

const store = new Store(process.env.DB_PATH || "data.db");
const base = process.env.PUBLIC_URL || "https://raiseme.glick.run";

const tenants = store.tenants();
let sent = 0;
for (const t of tenants) {
  const w = store.getWeekly(t);
  if (!w.enabled || !w.email) continue;
  try {
    const digest = store.weeklyDigest(t);
    const ok = await sendWeeklyReport(w.email, { tenant: t, digest, base });
    if (ok) sent++;
    console.log(`[weekly-report] ${t} -> ${w.email}: ${ok ? "sent" : "failed"} (${digest.alerts} alerts, ${digest.devices} devices)`);
  } catch (e) {
    console.log(`[weekly-report] ${t}: error ${e.message}`);
  }
}
console.log(`[weekly-report] done — ${sent} tenant(s) emailed of ${tenants.length}`);
process.exit(0);
