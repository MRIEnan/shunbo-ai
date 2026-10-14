// Captures 1366x768 PNG screenshots of the web app for the Microsoft Store listing.
// Signs in to the LOCAL dev server with the local test account (never production).
// Usage: node scripts/store-screenshots.mjs [baseUrl] [email] [password]
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:3100";
const email = process.argv[3] ?? "qa.tester@shunbo.local";
const password = process.argv[4] ?? process.env.QA_PASSWORD ?? "";
const out = "store-assets/screenshots";
mkdirSync(out, { recursive: true });

const chrome = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"];
const browser = await puppeteer.launch({ executablePath: chrome[0], headless: true, args: ["--no-sandbox", "--hide-scrollbars"] });
const page = await browser.newPage();
await page.setViewport({ width: 1366, height: 768, deviceScaleFactor: 1 });
await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);

const shot = async (path, name, opts = {}) => {
  await page.goto(`${base}${path}`, { waitUntil: "networkidle0", timeout: 60_000 });
  if (opts.scrollTo) await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), opts.scrollTo);
  await new Promise((r) => setTimeout(r, opts.wait ?? 1500));
  await page.screenshot({ path: `${out}/${name}.png`, type: "png" });
  console.log("saved", `${out}/${name}.png`);
};

// Public pages
await shot("/", "01-home");
await shot("/", "02-how-it-works", { scrollTo: 1900, wait: 2500 });
await shot("/notetaker", "03-notetaker");

// Signed-in pages
if (password) {
  await page.goto(`${base}/signin`, { waitUntil: "networkidle0" });
  await page.type("#email", email);
  await page.type("#password", password);
  await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0", timeout: 60_000 }), page.click('button[type="submit"]')]);
  await shot("/app", "04-dictate");
  await shot("/settings", "05-settings");
  await shot("/meetings/new", "06-record-meeting", { wait: 2500 });
} else {
  console.log("no password given: skipping signed-in pages");
}
await browser.close();
