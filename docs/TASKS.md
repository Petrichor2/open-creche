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
- [x] Specify free automated AI translation pipeline in GitHub Actions (`GitHub Models` via `GITHUB_TOKEN` + fallbacks).

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
