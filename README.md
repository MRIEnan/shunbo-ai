# Shunbo AI

Voice-to-text dictation product. Marketing site, web app, and desktop app. See [PLAN.md](PLAN.md) for the phased build plan.

## Layout

```
apps/web        Next.js 16 marketing site + web app (Phase 1 done)
apps/desktop    Tauri v2 desktop app (Phase 5)
packages/*      Shared UI and types (added as needed)
```

## Run locally

```bash
npm install
npm run dev
```

Opens on http://localhost:3100 (pinned in `.claude/launch.json`; change `-p 3100` and `NEXT_PUBLIC_APP_URL` together).

For Stripe webhooks in development, run in a second terminal:

```bash
stripe listen --events checkout.session.completed,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted --forward-to localhost:3100/api/stripe/webhook
```

## Stack

Next.js 16 (App Router), TypeScript, Tailwind CSS v4, Framer Motion, lucide-react.
Fonts: EB Garamond (display) and Figtree (body) via next/font.

## Environment

Create `apps/web/.env.local` with:

```
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql://user:pass@localhost:5432/shunboai
AUTH_SECRET=<random 32+ bytes, base64>
AUTH_TRUST_HOST=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
GMAIL_USER=you@gmail.com
GMAIL_APP_PASSWORD=<Gmail app password>
SMTP_FROM="Shunbo <you@gmail.com>"
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...        # from `stripe listen`, or the dashboard endpoint in production
ADMIN_EMAILS=you@example.com           # comma-separated; these accounts see /admin
NEXT_PUBLIC_APP_URL=http://localhost:3100
```

Then push the schema to Postgres:

```bash
cd apps/web && npx prisma db push
```

(Prisma reads `DATABASE_URL` from the shell. On bash: `set -a; . ./.env.local; set +a` first.)

## Deploying

**Web (Vercel + managed Postgres)**

1. Create a Postgres database (Neon, Supabase, or Vercel Postgres) and copy its connection string.
2. Import the repo in Vercel. `vercel.json` at the root sets the monorepo build (`npm run build -w web`).
3. Add every variable from `apps/web/.env.example` in Vercel → Settings → Environment Variables.
   Set `NEXT_PUBLIC_APP_URL` to `https://shunboai.com` and `NODE_ENV` is set by Vercel.
4. Run the schema migrations once against production: `cd apps/web && DATABASE_URL=... npx prisma migrate deploy`
   (CI does the same against its throwaway database on every push).
5. Stripe → Developers → Webhooks → add endpoint `https://<domain>/api/stripe/webhook` with events
   `checkout.session.completed`, `customer.subscription.created|updated|deleted`; put its signing secret in
   `STRIPE_WEBHOOK_SECRET`. Switch to live keys when ready and re-sync plans from `/admin/plans`.
6. Optional: `UPSTASH_REDIS_REST_URL`/`TOKEN` make API rate limits shared across serverless instances.

**Desktop installer (GitHub Releases)**

Push a tag like `desktop-v0.1.0`. `.github/workflows/desktop-release.yml` builds the NSIS installer on
`windows-latest` and attaches it to a draft release. Set the repo variable `PUBLIC_APP_URL` so the installed
app talks to production, then put the release asset URL in `NEXT_PUBLIC_DOWNLOAD_URL` on the web app.
Code signing is not configured; Windows SmartScreen will warn until you sign the installer.

**CI**

`.github/workflows/ci.yml` lints, type-checks, migrates a scratch Postgres and builds the web app on Ubuntu,
and type-checks plus `cargo check`s the desktop app on Windows.

## Installer return codes

`Shunbo_<version>_x64-setup.exe` is an NSIS installer built by Tauri. Silent install: `Shunbo_<version>_x64-setup.exe /S`.
It installs per user (no admin prompt), upgrades an existing version in place, never requires a reboot, and needs no network.

| Exit code | Meaning |
|---|---|
| 0 | Installation successful (also returned when the same version is already installed and was refreshed in place) |
| 1 | Installation cancelled by the user |
| 2 | Installation aborted by the installer: insufficient disk space, files locked by a running Shunbo instance, a security policy blocked the install, or a file could not be written. Close Shunbo (tray, Quit Shunbo) and run the installer again |

Uninstall silently: `"%LOCALAPPDATA%\Shunbo\uninstall.exe" /S`.

## Phase 8 status (stability, onboarding, password auth, Store prep)

- **Accounts**: sign up with email + password → 6-digit emailed code (`/signup`, `/verify`); sign in with password
  (`/signin`); forgot/reset by code (`/forgot`, `/reset`); magic link kept as "Email me a sign-in link".
  Sessions are JWT (required by the Credentials provider). Codes are hashed, expire in 10 min, 5 attempts, 45 s
  resend cooldown. In development the code is also printed to the server console (`[dev] verify code for …`).
- **Desktop deep-link bug fixed**: dev builds no longer register `shunbo://` unless `SHUNBO_DEV_DEEPLINK=1` is set,
  so an installed copy can't be hijacked by a debug build. If sign-in ever opens the wrong program, delete
  `HKCU\Software\Classes\shunbo` and reinstall. The Diagnostics panel shows which executable the link opens.
- **Closing the window** now asks "Keep in tray" or "Quit"; the tray menu and the Quit button always exit.
- **Logging and diagnostics**: `%LOCALAPPDATA%i.shunbo.desktop\logs\shunbo.log`; Diagnostics panel with
  "Copy report". Notetaker chunk uploads retry three times and log each outcome.
- **Onboarding wizard** on first run: sign-in, microphone check (links to Windows privacy settings when blocked),
  system-audio check (plays a tone and verifies loopback), shortcut test, Notetaker consent. Re-run from Diagnostics.
- **Microsoft Store**: `apps/desktop/msix/AppxManifest.xml` + `scripts/build-msix.ps1` build an MSIX with
  `runFullTrust`, the `shunbo` protocol and the microphone capability. Needs the Windows 10/11 SDK (makeappx).
  Steps: register at https://partner.microsoft.com (one-time $19 for individuals) → reserve the name "Shunbo" →
  copy Package identity name / Publisher / Publisher display name → run the script → upload the `.msix` in a new
  submission. The Store signs it, which removes the SmartScreen warning.

## Phase 7 status (Notetaker)

Meeting recording with speaker-labelled transcripts and AI notes.

- **Desktop**: Notetaker tab in the app records the default microphone and system audio (WASAPI loopback via
  `cpal`, with a silent keep-alive output stream so loopback keeps real timing). Audio is resampled to 16 kHz mono,
  cut into 4-minute WAV chunks and uploaded while the meeting runs. A red pill shows "Recording meeting".
- **Browser**: `/meetings/new` records a shared tab's audio plus the mic (Chrome/Edge). Same chunk upload.
- **Server**: `POST /api/meetings` (checks the monthly minute allowance), `POST /api/meetings/:id/chunks`
  (transcribes immediately with `gpt-4o-transcribe-diarize`, falling back to `whisper-1`; audio is never stored),
  `POST /api/meetings/:id/finish` (meters minutes, generates summary / action items / decisions / questions),
  `GET /api/meetings/:id/export` (Markdown). Pages: `/meetings`, `/meetings/[id]`, `/notetaker`.
- **Quota**: `PlanConfig.meetingMinutesPerMonth` (Free 60, editable in `/admin/plans`; blank = unlimited).
- **Consent**: one-time notice in both recorders; the user is responsible for informing participants.
- Known limitation: speaker labels are assigned per 4-minute chunk, so "Speaker A" in one chunk may be a
  different person in the next. Carrying speaker identity across chunks is a follow-up.
- Local Rust smoke test for the capture engine (needs real audio devices):
  `cd apps/desktop/src-tauri && cargo test --lib -- --ignored --nocapture`

## Phase 5 status (desktop app)

`apps/desktop` is a Tauri v2 app (Rust core + the same React/Tailwind UI).

- Hold **Ctrl+Shift+Space** anywhere, speak, release. The polished text is pasted into the active app
  (clipboard + simulated Ctrl+V). A transparent always-on-top pill at the bottom of the screen shows state.
- Sign-in: the app opens `<server>/desktop/auth` in your browser, which mints a long-lived API token and hands it
  back through the `shunbo://auth?token=...` deep link (with a copy-paste fallback). Tokens are stored hashed in
  `ApiToken` and sent as `Authorization: Bearer`; `/api/tokens` revokes them.
- Style presets from Settings apply per app: the Rust side reports the foreground process name (e.g. `slack.exe`),
  which maps to a context (`chat`, `email`, `notes`, `code`) or matches a preset named after the exe.
- Closing the window hides to the tray. The server URL is configurable in the app (defaults to `http://localhost:3100`).

Prerequisites on Windows: Rust (rustup), Visual Studio Build Tools with the C++ workload, WebView2 (built into Windows 11).
In dev the webview is served by Vite on `http://localhost:1420`, which the API's CORS layer allows only when
`NODE_ENV` is not production. The `/download` button uses `NEXT_PUBLIC_DOWNLOAD_URL` when set; otherwise it serves the newest
installer found in `apps/web/public/downloads/` (gitignored). To refresh it locally after a desktop change:

```bash
npm run desktop:publish-local
```

```bash
cd apps/desktop
npm run tauri dev      # dev build with hot reload
npm run tauri build    # NSIS installer in src-tauri/target/release/bundle/nsis
```

## Phase 4 status

Billing with Stripe (test mode) and an admin dashboard.
- Plans live in the `PlanConfig` table and are editable at `/admin/plans` (name, price, weekly word limit, features,
  button type, visibility). "Sync to Stripe" creates the product and a new price when the amount changes.
- `/pricing` reads plans from the database. Checkout and the customer portal are Stripe-hosted.
- `/api/stripe/webhook` keeps the `Subscription` table in sync. Quota is enforced in `/api/transcribe` (402 when over).
- `/admin` shows users, MRR, dictations and usage; `/admin/users` lets admins change plan or role, or delete a user.
- Admins are users with `role = admin` or whose email is in `ADMIN_EMAILS`.

## Phase 3 status

Accounts with Auth.js v5 email magic links (Nodemailer over Gmail SMTP), Prisma + Postgres.
Pages: `/signin`, `/history` (search, load more, raw/clean toggle), `/settings` (default style, vocabulary,
snippets, per-context style presets). Signed-in users get unlimited dictations synced to the server;
anonymous users keep the 5-dictation local demo. API routes under `/api/{dictations,vocabulary,snippets,presets,settings}`
all require a session and return 401 otherwise.

## Phase 2 status

Web dictation app at `/app` (`apps/web/src/components/app/Dictation.tsx`).
API routes: `POST /api/transcribe` (multipart `audio`, optional `language`, `vocabulary`) and
`POST /api/clean` (`{ raw, tone, vocabulary }`). Both use OpenAI and are rate-limited per IP in memory.
Anonymous users get 5 free dictations tracked in localStorage; history and settings are local too.

## Phase 1 status

Homepage at `apps/web/src/app/page.tsx` with sections in `apps/web/src/components/site/`.
All copy lives in `apps/web/src/content/site.ts`. Testimonials and company logos are placeholders.
