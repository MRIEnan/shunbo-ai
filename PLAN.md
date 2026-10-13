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
