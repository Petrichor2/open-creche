# OpenCreche — Task List & Roadmap (`docs/TASKS.md`)

This document tracks completed milestones, active tasks, and future enhancements for **OpenCreche**. AI agents and contributors should update this file as tasks are completed.

---

## Phase 1: Architecture & Documentation ✅ (Completed)

- [x] Define 100% free hosting & security architecture (GitHub Pages + Cloudflare DNS + Turnstile + CF Worker + Resend).
- [x] Design public-repo-safe Privacy Vault using AES-256-GCM (`.enc.json` manifests and `.enc` binary media blobs).
- [x] Write comprehensive English documentation:
  - [x] `README.md`
  - [x] `docs/ARCHITECTURE.md`
  - [x] `docs/CONFIGURATION.md`
  - [x] `docs/SECURITY_AND_PRIVACY.md`
  - [x] `docs/DEPLOYMENT.md`
  - [x] `docs/CMS_GUIDE.md`
- [x] Specify free automated AI translation pipeline in GitHub Actions (initially `GitHub Models` via `GITHUB_TOKEN` + fallbacks).
- [x] **Fix CI auto-translation failure (2026-11-20):** GitHub retired the GitHub Models inference API on July 30, 2026, which broke the `Run Free AI Auto-Translation` step (`getaddrinfo ENOTFOUND models.inference.ai.azure.com`). Migrated `scripts/auto-translate.mjs` to the free **Google Gemini** tier as primary provider (Cloudflare Workers AI fallback), made provider failures non-fatal (build proceeds without translations), removed `models: read` from `.github/workflows/deploy.yml`, and updated all docs.
- [x] **Migrate build pipeline to Bun (2026-11-20):** All `package.json` scripts now invoke `bun` directly (build, dev, vault CLI, auto-translate), and `.github/workflows/deploy.yml` uses `oven-sh/setup-bun@v2` with `bun install` / `bun run` instead of `actions/setup-node` + npm. Enabled GitHub Pages (`build_type: workflow`) on the repository.
- [x] **Fix subpath deployment links (2026-11-20):** GitHub Pages project sites serve the site under `/<repo>/`, but all internal links, the root language redirect, favicon, admin link, and encrypted vault fetches used root-absolute paths (`/hu/`), causing a 404 after the root redirect. `astro.config.mjs` now derives `base` from `site.url`, and every template/runtime path is base-aware (links, `data-base` in the vault config element, `public_folder` in the CMS config). The root page now redirects via inline JS with a `<noscript>` meta-refresh fallback (removes the previous racing double redirect).
- [x] **Demo site notice & fictitious address (2026-11-20):** Added `src/components/layout/DemoNotice.astro` — a warm, accessible, dismissible dialog shown once per session while `security.demoMode: true`, with localized strings (`demoNotice.*`) in `content/i18n/{hu,en,de}.yaml`. Replaced the sample address with unmistakably fictitious demo values (`0000 Példaváros, Példa utca 42.` / null-island coordinates) in `config/site.yaml` and documented both behaviors.
- [x] **Cloudflare integration preparation (2026-11-21):** Added `site.demoContent` flag (independent of `security.demoMode`, so the demo notice stays visible while the Vault runs on the real Worker chain). Added `docs/CLOUDFLARE_SETUP.md` quickstart (DNS subdomain → GitHub Pages custom domain → Turnstile widget → Worker deploy with `VAULT_MASTER_KEY`/`TURNSTILE_SECRET_KEY` secrets → config switch + re-encryption). Set `worker/wrangler.toml` `ALLOWED_ORIGIN` to the target subdomain and prepared the Worker toolchain (`bun install`) and a fresh real `VAULT_MASTER_KEY` in the gitignored `.env`.
- [x] **Cloudflare integration LIVE (2026-11-21):** Executed end-to-end via Cloudflare API + `gh` CLI: CNAME `ovi.danielfekete.com` → `petrichor2.github.io`; managed Turnstile widget (`0x4AAAAAAGLrs-L21MhVMeu3`); Worker `open-creche-worker.fekete-dani1994.workers.dev` deployed with encrypted secrets; GitHub Pages custom domain attached; `security.demoMode: false`; demo vault re-encrypted under the real key. Live-verified: view-source contains no plaintext, invalid-token unlock returns 403 with correct CORS, site serves at `https://ovi.danielfekete.com`. Remaining manual step: tick **Enforce HTTPS** in GitHub Pages settings.
- [x] **Mobile header optimization (2026-11-21):** Collapsed the sticky header behind a craft-styled hamburger toggle below 820px (`nav-toggle` + `.nav-open` inline JS, localized `nav.toggle` aria-labels). Compact row is brand + toggle pinned to the top-right corner; the dropdown lists nav links plus the language switcher (centered, dashed `::before` divider drawn outside the switcher pill so its padding stays symmetric). Language pills are inline-flex with `line-height: 1` so flag emoji + label center together. Desktop layout unchanged.
- [x] **Accessible appearance: dark & high-contrast themes (2026-11-21):** Introduced a three-mode appearance system on `<html data-theme="...">` — warm light (default), warm near-black dark, and a WCAG-AAA black/white/amber high-contrast palette — all defined as token overrides in `tokens.css` (no framework, no SaaS gradients). A craft-styled header button cycles light → dark → contrast, persists the choice in `localStorage ("oc-theme")`, and the bootstrap script honors OS `prefers-contrast: more` / `prefers-color-scheme: dark` before first paint (no flash). Accessibility groundwork: skip-to-content link, global `:focus-visible` ring, `prefers-reduced-motion` support, `<main id="main-content" tabindex="-1">`, and tokenization of every hardcoded color in `base.css` / `DemoNotice.astro` (footer, header blur, buttons, tags, badges). Custom `theme.colors` from `config/site.yaml` now apply to the light appearance only so they can never break the curated dark/contrast palettes. Localized `a11y.skipLink` + `theme.*` strings added to all three i18n dictionaries.
- [x] **EU (GDPR + ePrivacy) compliance pass (2026-11-21):** Audited the client-side surface against the ePrivacy Directive (Hungarian 2011. évi CXII. tv. 13/A. §) and GDPR Art. 13, then closed both gaps found: (1) **Cloudflare Turnstile is now lazy-loaded** — the script is fetched on demand only after the visitor clicks an unlock button or starts filling the contact form (no third-party request on plain page load), with graceful demo fallback; the contact form now also renders a Turnstile widget (first `focusin`) and sends `turnstileToken` to the Worker, which the Worker already verifies. (2) **`PrivacyNotice.astro`** renders a localized, accessible "Data protection information" dialog (footer + contact form links) documenting controller identity, the full browser storage inventory (all keys are functional/strictly-necessary and written only after explicit visitor actions — the site sets zero cookies and no tracking), the form data flow with processors (Cloudflare, Resend), and GDPR rights. Full compliance analysis + institution checklist added as `docs/SECURITY_AND_PRIVACY.md` §6.
- [x] **Mandatory human verification for every relayed email (2026-11-21):** `POST /api/contact/send` in the Worker now **requires** a valid Turnstile token — requests without one (curl, bots) are rejected with `403` *before* the Resend API is called (previously the token was optional, leaving a direct-spam hole). Client side, the contact form refuses to send until the Turnstile challenge returns a token (bounded 15 s wait, progress + localized failure feedback via `contactForm.verifyError` in hu/en/de, widget reset after each send). Site deploy is automated via CI; the Worker change needs a one-command manual deploy (see `docs/SESSION_HANDOVER.md`).
---

## Phase 2: Core Scaffolding & MVP Implementation ✅ (Completed)

- [x] Initialize Astro static site generator with dynamic `config/site.yaml` i18n configuration (`hu`, `en`, `de`).
- [x] Create pure **Vanilla CSS** craft theme (`src/styles/tokens.css`, `src/styles/base.css`) with warm paper textures, pebble borders, and handcrafted SVG illustrations.
- [x] Populate multilingual sample content (`hu`, `en`, `de`) for:
  - [x] Pedagogy & Introduction (`content/pages/{lang}/about.md`)
  - [x] Daily Schedule (`content/pages/{lang}/schedule.yaml`)
  - [x] Creche & Kindergarten Groups (`content/groups/{lang}/{katica,suni,bagoly}.yaml`)
  - [x] News & Event Calendar (`content/news/{lang}/*.md`)
- [x] Build `scripts/vault-cli.mjs` & `scripts/generate-keys.mjs` for AES-256-GCM encryption/decryption and encrypted demo payload generation.
- [x] Build browser-side WebCrypto decryptor & Turnstile gate (`src/components/vault/PrivacyVaultRuntime.astro` & `VaultGateCard.astro`).
- [x] Build Cloudflare Worker (`worker/src/index.ts`) for Turnstile verification, vault key release, Resend contact form relay, and CMS GitHub OAuth.
- [x] Configure Sveltia CMS (`public/admin/index.html`, `public/admin/config.yml`).
- [x] Create `.github/workflows/deploy.yml` for automated translation, commit-back, and GitHub Pages deployment.

---

## Phase 3: Visual Polish, Theme Presets & Interactive Enhancements ⏳ (Next Up)

- [ ] **Theme Palette Presets:** Add automatic CSS variable presets in `BaseLayout.astro` / `tokens.css` so switching `theme.palette` in `config/site.yaml` between `"sunshine"`, `"meadow"`, `"terracotta"`, and `"forest"` automatically applies a curated color scheme.
- [ ] **Decorative SVG Section Dividers:** Create a reusable `<SectionDivider style={siteConfig.theme.dividerStyle} />` Astro component supporting `"waves"`, `"hills"`, `"clouds"`, and `"leaves"`.
- [ ] **Photo Gallery Lightbox:** Add a lightweight, zero-dependency Vanilla JS lightbox modal so parents can click decrypted gallery photos to view them full-screen with captions and keyboard navigation.
- [ ] **Dedicated News & Downloadable Documents Support:**
  - [ ] Add optional downloadable documents section (e.g., House Rules PDF / *Házirend*, Pedagogical Program PDF, Enrollment Form) configurable via YAML.
  - [ ] Add dedicated `/[lang]/news/[slug]` detail pages or expandable modal cards for longer announcements.
- [ ] **Interactive Map / Directions Card:** Add an optional privacy-friendly OpenStreetMap / Leaflet or static SVG map card in the Contact section using coordinates from `config/site.yaml`.

---

## Phase 4: In-Browser Admin Vault Manager & Image Pipeline 📋 (Backlog)

- [ ] **EXIF Stripping & WebP Resizer in `vault-cli.mjs`:** Integrate `sharp` (or zero-native-dep image processing) into `scripts/vault-cli.mjs` to automatically strip GPS/EXIF metadata and convert raw `.jpg`/`.png` files in `.vault-raw/media/` into optimized WebP before AES-256-GCM encryption.
- [ ] **Browser-Based Vault Encryptor UI (`/admin/vault.html`):** Build a standalone client-side tool inside `/admin/` where non-technical directors can paste their `VAULT_MASTER_KEY`, edit phone numbers/staff/gallery photos in the browser, strip EXIF via `<canvas>`, encrypt to `.enc` via WebCrypto, and commit directly to GitHub via the GitHub REST API.
- [ ] **Automated Tests & Schema Validation:**
  - [ ] Add a Zod validation script (`scripts/validate-config.mjs`) run in CI to catch YAML syntax or schema mistakes in `config/` and `content/` with friendly error messages.
  - [ ] Add end-to-end encryption/decryption roundtrip tests for `scripts/vault-cli.mjs`.
