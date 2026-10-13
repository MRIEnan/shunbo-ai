# Shunbo AI — Build Plan

Goal: a Wispr Flow–style product under the Shunbo AI brand: marketing site, web dictation app,
desktop app with global hotkey, accounts, usage limits and Stripe billing.

## Stack
- Next.js 15 (App Router) + TypeScript + Tailwind CSS + Framer Motion
- Prisma ORM + PostgreSQL
- Auth.js (NextAuth v5) with Prisma adapter — Google + magic-link email
- OpenAI: `gpt-4o-transcribe` for speech-to-text, `gpt-4o-mini` for cleanup/tone
- Stripe (test mode) — Checkout + Customer Portal + webhooks
- Desktop: Tauri v2 (Rust core, same React UI) — global hotkey, tray, paste into active app
- Monorepo layout: `apps/web`, `apps/desktop`, `packages/ui`, `packages/shared`

## Phase 1 — Marketing site (homepage)
- Design tokens: cream #FFFFEB, forest #034F46, lavender #F0D7FF, ink #1A1A1A, accents
- Fonts: EB Garamond (display) + Figtree (body)
- Sections: announcement bar, pill nav, hero with curved speech→text ticker, logo marquee,
  "4x faster" typing race, "How it works" scroll stepper with chat mockup, feature grid
  (languages, vocabulary, snippets, tone), privacy strip, dark testimonials, FAQ, CTA, footer
- Responsive to 375px, reduced-motion, SEO metadata
- Deliverable: `/` renders and matches reference layout

## Phase 2 — Web dictation app
- `/app` route: push-to-talk button + hotkey (Ctrl+Space), waveform meter, live state
- Audio capture via MediaRecorder → `POST /api/transcribe` (OpenAI) → cleanup via
  `POST /api/clean` (filler removal, punctuation, tone: formal/casual/very casual)
- Output panel: raw vs. cleaned toggle, copy, auto-copy to clipboard
- Anonymous mode: 5 free dictations stored in localStorage, then prompt to sign in
- Deliverable: speak in browser, get polished text

## Phase 3 — Accounts, data, settings
- Prisma schema: User, Account, Session, Dictation, VocabularyWord, Snippet, StylePreset,
  Subscription, UsageRecord
- Auth.js sign-in page (Google + email), protected routes, middleware
- Settings pages: vocabulary (custom words fed into transcription prompt), snippets
  (spoken trigger → expansion), style per context, language auto-detect preference
- History page with search
- Deliverable: signed-in users keep history, vocab and snippets across devices

## Phase 4 — Billing and limits
- Plans: Free (2,000 words/week), Pro ($12/mo unlimited), Business (contact)
- `/pricing` page, Stripe Checkout, Customer Portal, webhook sync to Subscription table
- Usage metering per dictation; soft block + upgrade modal when Free limit hit
- Deliverable: test-card upgrade flow works end-to-end

## Phase 5 — Desktop app (Tauri v2)
- Same React UI packaged for Windows (macOS build config included, untested here)
- Global hotkey (hold to talk), tray icon, floating pill overlay with waveform
- On release: transcribe + clean via the web API with the user's session token, then
  paste result into the active window (clipboard + simulated Ctrl+V via enigo)
- Sign-in via browser deep link (`shunbo://auth`)
- Download link on marketing site + GitHub Releases build via Tauri action
- Deliverable: hold hotkey anywhere on Windows, text appears where the cursor is

## Phase 6 — Polish and launch
- Lighthouse, error states, rate limiting on API routes, logging
- README with env setup, Vercel deploy config, `.env.example`

## What I need from you before Phase 2+
- `OPENAI_API_KEY`
- `DATABASE_URL` (Neon/Supabase/local Docker Postgres — I can set up Docker locally)
- Google OAuth client ID/secret (or I ship email-only first)
- Stripe test secret key + webhook secret
- Rust toolchain installed for Phase 5 (I can run the installer)

## Assumptions
- Brand: "Shunbo AI", product name "Shunbo". Copy rewritten, structure mirrors Wispr Flow.
- Placeholder images/gradients where the original uses photos and videos.
- Each phase is approved separately; I stop at each boundary for review.

---

## Phase 7 — Notetaker (meeting transcription and notes)  ✅ built 2026-10-13

Goal: record any call (Zoom, Teams, Meet, phone bridge on the PC), get a speaker-labelled transcript and
AI notes in the user's account, with consent built in.

### Capture
- **Desktop (primary)**: Rust side captures two streams with `cpal`:
  the microphone (default input) and the system audio output via WASAPI loopback (Windows).
  Both are encoded as 16 kHz mono WAV chunks of ~4 minutes and uploaded while the meeting runs.
- **Web (secondary)**: in Chrome/Edge, `getDisplayMedia({audio:true})` on the call's tab plus the mic,
  mixed in an AudioContext into the same two tracks. Covers Google Meet and browser-based calls without the app.
- Two tracks, not a mix: the mic track is labelled **You**; the loopback track is **Others**, optionally
  diarized into Speaker 1, 2, … by the transcription model.

### Consent and indicators
- First-run notice explaining that the user is responsible for informing participants; must be acknowledged once.
- While recording: tray icon turns red, overlay pill shows "Recording meeting · 12:34", optional start/stop tone.
- Meetings can be paused; audio is never kept after transcription (configurable later).

### Server
- Prisma: `Meeting` (title, startedAt, endedAt, status, source, durationSec, language),
  `MeetingSegment` (meetingId, track, speaker, startSec, endSec, text), `MeetingNotes` (summary, actionItems[],
  decisions[], questions[], generatedAt). `PlanConfig.meetingMinutesPerMonth` for quotas.
- Routes: `POST /api/meetings` start, `POST /api/meetings/:id/chunks` (multipart, track + index) → transcribe
  immediately and store segments, `POST /api/meetings/:id/finish` → generate notes, `GET /api/meetings`,
  `GET /api/meetings/:id`, `DELETE`, `GET /api/meetings/:id/export?format=md`.
- Transcription: `gpt-4o-transcribe` per chunk (per track), with `gpt-4o-transcribe-diarize` for the Others track
  when diarization is on; falls back to plain transcription if the model is unavailable. Vocabulary is passed as a hint.
- Notes: a single `gpt-4o-mini` call over the merged transcript (chunked map-reduce beyond ~60k tokens) producing
  summary, action items with owners, decisions, open questions, in the user's default tone.
- Quota: Free = N meeting minutes per month (configurable in /admin/plans), Pro unlimited; metered on finish.

### UI
- Desktop main window gets a **Notetaker** tab: title (prefilled from the active window, e.g. "Zoom Meeting"),
  mic and system level meters, Start / Pause / Stop, elapsed time, upload status, "Open notes" when done.
- Web `/meetings`: list with search; `/meetings/[id]`: transcript with speaker labels and timestamps, notes panel,
  copy / export Markdown, rename, delete. Live transcript refreshes every 10 s while a meeting is in progress.
- Web recorder at `/meetings/new` for the browser path.
- Nav: Dictation / Notetaker toggle in the site header becomes real; `/notetaker` marketing page.

### Stretch (not in first cut)
- Auto-detect a call (zoom.exe, Teams, Meet tab) and offer to start recording.
- Keep audio for playback with click-to-seek.
- Shared meeting links for teammates.

### Estimate
Desktop capture and chunk upload is the hard part (new Rust code, WASAPI quirks). Roughly: server + web 1 day,
desktop capture 1 day, notes quality + polish half a day.

---

## Phase 8 — Stability, onboarding, password auth, store readiness

### A. Desktop fixes (issues 1 and 3)
- Deep link bug: dev builds registered `shunbo://` to `target/debug/shunbo-desktop.exe`, hijacking sign-in from the
  installed app and leaving a blank, un-closable window. Fix: register at runtime only in debug builds, have the
  installer own the registration, and on sign-in success verify the token arrived in the running instance.
- Close behaviour: window X now asks "Hide to tray or Quit?" the first time; tray and in-app Quit always exit; a
  hung window can be force-closed via tray Quit. Add a watchdog so an unresponsive webview is restarted.
- Diagnostics: file logging (tauri-plugin-log) at %APPDATA%/ai.shunbo.desktop/logs, an in-app "Diagnostics" panel
  showing device names, server URL, last errors, and a "Copy logs" button. Every Notetaker step (start, device open,
  chunk upload, finish) logs an outcome so failures are visible instead of silent.
- Notetaker reliability: upload retry with backoff, upload the final chunk before stopping capture, surface server
  errors (quota, auth) in the tab, and keep the recording going if one chunk fails.

### B. Onboarding and permissions (issue 2)
- First-run wizard: Welcome → Sign in → Microphone check (triggers the Windows mic prompt; detects "blocked for
  desktop apps" and deep-links to ms-settings:privacy-microphone) → System audio check (plays a short tone, verifies
  loopback hears it) → Shortcut test → Notetaker consent → Done. Re-runnable from Settings.
- Explain plainly what "whole system" access means: mic + what you hear + typing into the active app.

### C. Password accounts with email codes (issue 4)
- Sign up: email + password → 6-digit code emailed (link also included) → enter code → verified.
- Sign in: email + password. Unverified accounts are asked for the code again, with "Resend code".
- Forgot password: "Send code" → enter code + new password. Magic link stays as a secondary "Email me a sign-in link".
- Implementation: Auth.js Credentials provider, bcrypt password hashes, JWT sessions, hashed one-time codes with
  10-minute expiry and attempt limits. Existing magic-link users get a "set a password" prompt.

### D. Release and store
- Version 0.3.0: GitHub release via the workflow; `/download` points at it.
- Microsoft Store: MSIX package (makeappx + manifest with runFullTrust, protocol `shunbo`, microphone capability),
  Partner Center submission. Store signs the package, which removes the SmartScreen warning.

### Testing
- Web flows tested with Claude in Chrome using the "irahman tester" profile; desktop flows need the user's hands.
