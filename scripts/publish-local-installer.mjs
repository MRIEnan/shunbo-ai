// Copies the newest NSIS installer into the web app's public folder so /download serves it locally.
import { readdirSync, mkdirSync, copyFileSync, statSync } from "node:fs";
import { join } from "node:path";
const src = join("apps", "desktop", "src-tauri", "target", "release", "bundle", "nsis");
const dst = join("apps", "web", "public", "downloads");
const exes = readdirSync(src).filter((f) => f.endsWith(".exe")).map((f) => ({ f, t: statSync(join(src, f)).mtimeMs })).sort((a, b) => b.t - a.t);
if (!exes.length) { console.error("No installer found in", src); process.exit(1); }
mkdirSync(dst, { recursive: true });
copyFileSync(join(src, exes[0].f), join(dst, exes[0].f));
console.log("Published", exes[0].f, "to /downloads/");
