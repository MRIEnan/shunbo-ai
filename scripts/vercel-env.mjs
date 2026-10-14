// Pushes every KEY=value line from apps/web/.env.production.local to the Vercel project as
// Production environment variables. Values never touch the shell history or the terminal.
// Usage: node scripts/vercel-env.mjs [--target production|preview]
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const target = process.argv.includes("--target") ? process.argv[process.argv.indexOf("--target") + 1] : "production";
const file = "apps/web/.env.production.local";
const lines = readFileSync(file, "utf8").split(/\r?\n/);
let ok = 0, skipped = 0, failed = 0;
for (const raw of lines) {
  const line = raw.trim();
  if (!line || line.startsWith("#")) continue;
  const i = line.indexOf("=");
  if (i < 0) continue;
  const key = line.slice(0, i).trim();
  let value = line.slice(i + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
  if (!value || value.startsWith("<")) { console.log(`skip ${key} (empty/placeholder)`); skipped++; continue; }
  const r = spawnSync("npx", ["--yes", "vercel", "env", "add", key, target, "--force"], { input: value, encoding: "utf8", shell: true });
  if (r.status === 0) { console.log(`set ${key}`); ok++; } else { console.log(`FAILED ${key}: ${(r.stderr || r.stdout).trim().split("\n").pop()}`); failed++; }
}
console.log(`\n${ok} set, ${skipped} skipped, ${failed} failed`);
process.exit(failed ? 1 : 0);
