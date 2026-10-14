// Renders the desktop app's real UI (served by `vite` on :1420) in headless Chrome with a fake
// Tauri bridge, so Store screenshots show the actual windows without driving a desktop session.
// Usage: node scripts/desktop-screenshots.mjs <apiToken> [apiUrl] [uiUrl]
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";

const token = process.argv[2];
const apiUrl = process.argv[3] ?? "http://localhost:3100";
const ui = process.argv[4] ?? "http://localhost:1420";
if (!token) throw new Error("usage: node scripts/desktop-screenshots.mjs <apiToken>");
const out = "store-assets/screenshots";
mkdirSync(out, { recursive: true });

const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-sandbox", "--hide-scrollbars"] });

/** Fake window.__TAURI_INTERNALS__ with canned answers for every command the UI calls. */
const mockScript = (prefs) => `
  (() => {
    const prefs = ${JSON.stringify(prefs)};
    let callbacks = {};
    window.__TAURI_INTERNALS__ = {
      metadata: { currentWindow: { label: "main" }, currentWebview: { label: "main", windowLabel: "main" }, windows: [{ label: "main" }, { label: "overlay" }], webviews: [] },
      transformCallback: (cb, once) => { const id = Math.floor(Math.random() * 1e9); callbacks[id] = cb; window["_" + id] = cb; return id; },
      convertFileSrc: (p) => p,
      invoke: async (cmd, args) => {
        switch (cmd) {
          case "plugin:store|load": return 1;
          case "plugin:store|get": return [prefs, true];
          case "plugin:store|set": Object.assign(prefs, (args && args.value) || {}); return null;
          case "plugin:store|save": return null;
          case "plugin:global-shortcut|is_registered": return false;
          case "plugin:global-shortcut|register": case "plugin:global-shortcut|unregister": return null;
          case "plugin:deep-link|get_current": return null;
          case "plugin:event|listen": return 1;
          case "plugin:event|unlisten": case "plugin:event|emit": case "plugin:event|emit_to": return null;
          case "plugin:log|log": return null;
          case "plugin:clipboard-manager|write_text": return null;
          case "plugin:opener|open_url": return null;
          case "plugin:dialog|message": case "plugin:dialog|ask": return true;
          case "active_app": return "slack.exe";
          case "diagnostics": return { version: "0.3.2", debug: false, exe: "C:\\\\Users\\\\you\\\\AppData\\\\Local\\\\Shunbo\\\\shunbo-desktop.exe", log_dir: "C:\\\\Users\\\\you\\\\AppData\\\\Local\\\\ai.shunbo.desktop\\\\logs", data_dir: "", scheme_target: "\\"C:\\\\Users\\\\you\\\\AppData\\\\Local\\\\Shunbo\\\\shunbo-desktop.exe\\" \\"%1\\"", log_tail: "[INFO] Shunbo 0.3.2 starting (release)\\n[INFO] sign-in token received via deep link\\n[INFO] capture started: mic=\\"Headset Microphone\\" system=\\"Speakers\\"" };
          case "meeting_capture_start": return { mic: "Headset Microphone (Realtek(R) Audio)", system: "Speakers (Realtek(R) Audio)" };
          case "meeting_capture_levels": window.__t = (window.__t || 754) + 0.15; return [0.35 + 0.3 * Math.random(), 0.5 + 0.3 * Math.random(), window.__t];
          case "meeting_capture_pause": case "meeting_capture_stop": case "quit_app": case "paste_from_clipboard": return null;
          case "meeting_capture_take": return new ArrayBuffer(44);
          default:
            if (cmd.startsWith("plugin:window|") || cmd.startsWith("plugin:webview|")) return null;
            console.warn("unmocked invoke", cmd); return null;
        }
      },
    };
    window.__TAURI_OS_PLUGIN_INTERNALS__ = { os_type: "windows" };
  })();
`;

const basePrefs = { apiUrl, token, email: "you@example.com", tone: "casual", language: "auto", shortcut: "CommandOrControl+Shift+Space", pasteMode: "paste", notetakerConsent: true, onboarded: true };

async function capture(name, prefs, fn, viewport = { width: 1366, height: 768 }) {
  const page = await browser.newPage();
  await page.setViewport({ ...viewport, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(mockScript(prefs));
  await page.goto(ui + "/", { waitUntil: "networkidle0", timeout: 60_000 });
  await new Promise((r) => setTimeout(r, 1500));
  if (fn) await fn(page);
  await page.evaluate(() => {
    document.querySelectorAll("span").forEach((el) => { if (/@shunbo\.local$/.test(el.textContent?.trim() ?? "")) el.textContent = "you@example.com"; });
  });
  await page.screenshot({ path: `${out}/${name}.png`, type: "png" });
  console.log("saved", `${out}/${name}.png`);
  await page.close();
}

const clickText = async (page, text) => {
  const [el] = await page.$$(`xpath/.//button[contains(normalize-space(.), "${text}")]`);
  if (!el) throw new Error("button not found: " + text);
  await el.click();
};

// 1. First-run setup wizard
await capture("07-desktop-setup", { ...basePrefs, token: null, email: null, onboarded: false, notetakerConsent: false }, async (page) => {
  await clickText(page, "Get started");
  await new Promise((r) => setTimeout(r, 600));
});

// 2. Main window, Dictate tab (signed in)
await capture("08-desktop-dictate", basePrefs, async (page) => {
  await page.waitForFunction(() => document.body.innerText.includes("Hold to talk"), { timeout: 30_000 });
  await new Promise((r) => setTimeout(r, 800));
});

// 3. Notetaker tab while recording
await capture("09-desktop-notetaker", basePrefs, async (page) => {
  await page.waitForFunction(() => document.body.innerText.includes("Hold to talk"), { timeout: 30_000 });
  await clickText(page, "Notetaker");
  await new Promise((r) => setTimeout(r, 500));
  const title = await page.$("#mtg-title");
  if (title) await title.type("Weekly sync with design");
  await clickText(page, "Start recording");
  await page.waitForFunction(() => document.body.innerText.includes("Stop and make notes"), { timeout: 30_000 });
  await new Promise((r) => setTimeout(r, 1500));
});

// 4. Diagnostics panel open
await capture("10-desktop-diagnostics", basePrefs, async (page) => {
  await page.waitForFunction(() => document.body.innerText.includes("Hold to talk"), { timeout: 30_000 });
  await clickText(page, "Diagnostics");
  await new Promise((r) => setTimeout(r, 800));
});

await browser.close();
