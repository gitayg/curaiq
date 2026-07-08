import { cpSync, rmSync, mkdirSync } from "node:fs";

// Isolate the web assets Tauri bundles into a clean dir, away from node_modules/src-tauri.
const out = ".tauridist";
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync("index.html", `${out}/index.html`);
cpSync("src", `${out}/src`, { recursive: true });
cpSync("data", `${out}/data`, { recursive: true });
console.log(`staged frontend -> ${out}`);
