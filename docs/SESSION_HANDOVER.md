# Session Handover (`docs/SESSION_HANDOVER.md`)

> **Last Updated:** 2026-11-20
> **Current Branch:** `main`
> **Build Status:** ✅ Passing (`4 page(s) built in ~1.75s` — `/index.html`, `/hu/index.html`, `/en/index.html`, `/de/index.html`)
> **CI Status:** ✅ Passing — **live at https://ovi.danielfekete.com** (custom domain on GitHub Pages). The Privacy Vault runs on the production chain: real Turnstile widget + `open-creche-worker.fekete-dani1994.workers.dev` (secrets `VAULT_MASTER_KEY`/`TURNSTILE_SECRET_KEY` in Cloudflare), `security.demoMode: false`, `site.demoContent: true` (sample data, demo notice visible). Worker deploys: `cd worker && CLOUDFLARE_API_TOKEN=... bunx wrangler deploy`. Remaining manual step: **Enforce HTTPS** checkbox in GitHub Pages settings.

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
     - **Fixed on 2026-11-20:** the original GitHub Models provider (`models.inference.ai.azure.com`, free via `GITHUB_TOKEN`) was retired by GitHub on July 30, 2026 and caused every CI run to fail. Now uses the **Google Gemini free tier** (`GEMINI_API_KEY` secret, primary) with **Cloudflare Workers AI** (`CF_ACCOUNT_ID` + `CF_AI_TOKEN` secrets, fallback) to automatically translate updated YAML/Markdown files from `defaultLocale` (`hu`) to `en` and `de`, tracking changes via `_translationMeta.sourceHash` and respecting `manualOverride: true`. Provider failures are non-fatal: without any AI key the workflow logs an info notice and the build/deploy proceeds normally.

    - **Demo Site Notice (`src/components/layout/DemoNotice.astro`, 2026-11-20):**
      - While `site.demoContent: true` (or, as fallback, `security.demoMode: true`) in `config/site.yaml`, every locale page renders a dismissible "This is a demo website" dialog (once per browser session, `sessionStorage`) with localized `demoNotice.*` strings from `content/i18n/{hu,en,de}.yaml`.
      - The sample address is now unmistakably fictitious: `0000 Példaváros, Példa utca 42.` with null-island coordinates. Replace it (and set `demoMode: false`) when deploying for a real institution.
      - Vault demo phone numbers (`+36 30 456 7890`) and `.example.hu` e-mail addresses were already clearly non-real.

---

## 2. Environment & Quirks to Know

- **Runtime:** System Node.js is not in default `/usr/bin`, use **Bun** located at `/home/server/.bun/bin/bun` (`export PATH="$HOME/.bun/bin:$PATH"`).
- **Filesystem:** The repository is on `/media/server/6AEF-FABB/repo/open-creche` (an exFAT/FAT mount), which does not support POSIX symlinks in `node_modules/.bin`. Therefore, `package.json` scripts invoke `bun ./node_modules/astro/astro.js` (and other CLIs) directly instead of relying on `.bin/astro` symlinks. Keep this pattern when adding new CLI scripts to `package.json`.

---

## 3. Recommended Next Steps for the Next Session

Refer to **Phase 3** in [`docs/TASKS.md`](TASKS.md):
1. Implement **Theme Palette Presets** (`sunshine`, `meadow`, `terracotta`, `forest`) and the `<SectionDivider />` SVG component (`waves`, `hills`, `clouds`, `leaves`).
2. Add a zero-dependency **Lightbox modal** for decrypted gallery images.
3. Add a **Downloadable Documents** section (for *Házirend*, *Pedagógiai Program*, enrollment forms).
4. Build the in-browser **Admin Vault Manager (`/admin/vault.html`)** so non-technical staff can encrypt and upload photos directly from their browser without running CLI commands.
