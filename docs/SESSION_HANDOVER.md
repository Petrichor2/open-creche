# Session Handover (`docs/SESSION_HANDOVER.md`)

> **Last Updated:** 2026-11-08
> **Current Branch:** `main`
> **Build Status:** ✅ Passing (`4 page(s) built in ~1.75s` — `/index.html`, `/hu/index.html`, `/en/index.html`, `/de/index.html`)

---

## 1. Summary of What Has Been Built

1. **Architecture & English Documentation (`b6b6f88`, `68b28bc`):**
   - Complete technical and user documentation created in `README.md` and `docs/{ARCHITECTURE,CONFIGURATION,SECURITY_AND_PRIVACY,DEPLOYMENT,CMS_GUIDE}.md`, including rich GitHub-native **Mermaid** flowcharts, packet diagrams, and sequence diagrams.
2. **Full Working Project Scaffolding (`f7a75c7`, `a5024e8`):**
   - **Astro 5 Static Site:** Configured dynamically from `config/site.yaml` with `hu` (default), `en`, and `de` locales.
   - **Vanilla CSS Craft Theme:** Located in `src/styles/tokens.css` and `src/styles/base.css`. Designed specifically to avoid generic AI/SaaS aesthetics, using warm paper backgrounds, pebble-shaped cards, and custom SVG nursery illustrations.
   - **AES-256-GCM Privacy Vault:**
     - `scripts/vault-cli.mjs` encrypts contact details (`public/vault/contact.enc.json`), staff profiles (`public/vault/staff.enc.json`), gallery metadata (`public/vault/gallery.enc.json`), and binary images (`public/vault-media/**/*.enc`).
     - `src/components/vault/PrivacyVaultRuntime.astro` handles Cloudflare Turnstile verification and decrypts all JSON and binary image blobs in the browser using `window.crypto.subtle.decrypt()`.
     - Includes `security.demoMode: true` in `config/site.yaml` so the template works out of the box in local preview and demo deployments before a user connects their own Cloudflare Worker.
   - **Cloudflare Worker (`worker/src/index.ts`):**
     - `POST /api/vault/unlock`: Verifies Turnstile token and returns `VAULT_MASTER_KEY`.
     - `POST /api/contact/send`: Verifies Turnstile token and sends contact emails via Resend API without exposing recipient emails.
     - `GET /api/oauth/auth` & `/api/oauth/callback`: GitHub OAuth provider for Sveltia CMS.
   - **Free AI Auto-Translation (`scripts/auto-translate.mjs` & `.github/workflows/deploy.yml`):**
     - Uses GitHub Models (`GITHUB_TOKEN` with `permissions: models: read`) to automatically translate updated YAML/Markdown files from `defaultLocale` (`hu`) to `en` and `de`, tracking changes via `_translationMeta.sourceHash` and respecting `manualOverride: true`.

---

## 2. Environment & Quirks to Know

- **Runtime:** System Node.js is not in default `/usr/bin`, use **Bun** located at `/home/server/.bun/bin/bun` (`export PATH="$HOME/.bun/bin:$PATH"`).
- **Filesystem:** The repository is on `/media/server/6AEF-FABB/repo/open-creche` (an exFAT/FAT mount), which does not support POSIX symlinks in `node_modules/.bin`. Therefore, `package.json` invokes `./node_modules/astro/astro.js` directly instead of relying on `.bin/astro` symlinks. Keep this pattern when adding new CLI scripts to `package.json`.

---

## 3. Recommended Next Steps for the Next Session

Refer to **Phase 3** in [`docs/TASKS.md`](TASKS.md):
1. Implement **Theme Palette Presets** (`sunshine`, `meadow`, `terracotta`, `forest`) and the `<SectionDivider />` SVG component (`waves`, `hills`, `clouds`, `leaves`).
2. Add a zero-dependency **Lightbox modal** for decrypted gallery images.
3. Add a **Downloadable Documents** section (for *Házirend*, *Pedagógiai Program*, enrollment forms).
4. Build the in-browser **Admin Vault Manager (`/admin/vault.html`)** so non-technical staff can encrypt and upload photos directly from their browser without running CLI commands.
