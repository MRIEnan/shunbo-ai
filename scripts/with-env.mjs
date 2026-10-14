// Runs a command with variables from an env file, parsing KEY=value lines safely
// (values may contain &, ?, spaces or quotes). Usage: node scripts/with-env.mjs <file> -- <cmd> [args]
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const [file, dashdash, cmd, ...args] = process.argv.slice(2);
if (!file || dashdash !== "--" || !cmd) {
  console.error("usage: node scripts/with-env.mjs <envfile> -- <cmd> [args]");
  process.exit(2);
}
const env = { ...process.env };
for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || line.startsWith("#")) continue;
  const i = line.indexOf("=");
  if (i < 0) continue;
  const key = line.slice(0, i).trim();
  let value = line.slice(i + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
  if (value) env[key] = value;
}
const r = spawnSync(cmd, args, { stdio: "inherit", env, shell: true });
process.exit(r.status ?? 1);
