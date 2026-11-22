# Session Handover (`docs/SESSION_HANDOVER.md`)

> **Last Updated:** 2026-11-22
> **Current Branch:** `main`
> **Build Status:** ✅ Passing (`4 page(s) built in ~1.8s` — `/index.html`, `/hu/index.html`, `/en/index.html`, `/de/index.html`)
> **CI Status:** ✅ Passing — **live at https://ovi.danielfekete.com** (custom domain on GitHub Pages, **HTTPS enforced** — `https_enforced: true` set via the GitHub REST API on 2026-11-22; plain HTTP 301-redirects to HTTPS). The Privacy Vault runs on the production chain: real Turnstile widget + `open-creche-worker.fekete-dani1994.workers.dev` (secrets `VAULT_MASTER_KEY`/`TURNSTILE_SECRET_KEY` in Cloudflare), `security.demoMode: false`, `site.demoContent: true` (sample data, demo notice visible). Worker deploys: `cd worker && CLOUDFLARE_API_TOKEN=... bunx wrangler deploy`.

---

## 0. This Session (2026-11-22): Browser Vault Manager + critical demo-key fix

1. **Browser Vault Manager (`/admin/vault.html`) shipped** — the Phase 4 headline feature:
   - Files: `public/admin/vault.html` (shell), `vault-manager.js` (app), `vault-crypto.js` (pure WebCrypto core, importable for tests), `vault-manager.css` (standalone craft styling incl. `prefers-color-scheme: dark`).
   - Workflow: paste master key → browser fetches & decrypts `public/vault/*.enc.json` → edit Contact/Staff/Gallery in tabbed forms (hu/en/de with HU→EN/DE copy buttons, auto-slugged ids) → drag-and-drop photos (canvas EXIF/GPS strip → WebP, 1600 px cap; SVG kept byte-exact) → review staged writes/deletes → **single atomic commit** via the GitHub **Git Data API** (blobs → tree → commit → ref update), or **download** the `.enc` files + `VAULT-README.txt` with target paths.
   - Safety: key & PAT live in JS memory only (Lock & wipe button); **public demo key detected & warned**; orphaned media `.enc` blobs staged for deletion when entries are removed; repo/branch auto-filled from `public/admin/config.yml`; UI localized hu/en/de (`localStorage oc-vault-lang`).
   - Verified: Node-crypto ↔ WebCrypto roundtrip parity test (JSON + binary, both directions, byte-identical) using the real `.env` key; `bun build` syntax/import check; full site build includes all four files in `dist/admin/`.
2. **Live-site integrity bug found & fixed (root cause + data):**
   - `bun scripts/vault-cli.mjs decrypt` proved the vault artifacts committed in `a5c97fd` ("re-encrypted under the real key") were actually encrypted with the **public DEMO key** — `encryptFromRawDir()` silently fell back to `generateDemoVault()` (which always uses the demo key) when `.vault-raw/` was missing. The Worker secret holds the real key, so live visitors passed Turnstile but browser decryption failed silently.
   - CLI fixed: `loadMasterKey` no longer silently falls back to the demo key (throws with instructions); `encrypt` aborts with a clear message when `.vault-raw/` is missing; `demo` output now states it used the public demo key.
   - Data fixed: all 9 artifacts (3 manifests + 6 media blobs) re-encrypted under the real `.env` master key; verified via CLI `decrypt` → `.vault-raw/*.yaml` now exists locally (gitignored) as the editing source.
   - ⚠️ **After pushing these commits, verify live unlock once in a browser.** If the Worker secret were somehow *not* the `.env` key, the one-command fix is `cd worker && echo "VAULT_MASTER_KEY=<.env value>" | bunx wrangler secret put VAULT_MASTER_KEY` (secret values are write-only in Cloudflare, so this could not be verified remotely).
3. **Docs:** new `docs/VAULT_MANAGER.md` guide; `docs/CMS_GUIDE.md` Workflow A rewritten to match the real tool (plus stale `content/vault/` path fixed); README feature bullet, docs list entry, Quick Start step; `AGENTS.md` key files map; TASKS.md Phase 4 item checked.
4. **Enforce HTTPS enabled (2026-11-22):** `gh api --method PUT repos/Petrichor2/open-creche/pages -f https_enforced=true` (the REST `PUT /repos/{owner}/{repo}/pages` body parameter `https_enforced` does what the web checkbox does; certificate was already `approved`). Verified: `https_enforced: true` in the API, `http://` returns `301` → `https://ovi.danielfekete.com/`, HTTPS serves 200. The last remaining manual step from the 2026-11-21 deployment is closed.
5. **Contact form email relay made operational (2026-11-22):** The live Worker previously had only `TURNSTILE_SECRET_KEY` + `VAULT_MASTER_KEY` — every real form submission would have hit the Resend call without an API key and failed with 502. Now fixed and verified:
   - `RESEND_API_KEY` (sending-only) and `CONTACT_RECIPIENT_EMAIL=***REMOVED***` set as Worker secrets via the Cloudflare REST API (`PUT /accounts/…/workers/scripts/open-creche-worker/secrets`, HTTP 201 both; secret list now shows all four).
   - Resend side proven live from this session: probe email to the owner's Gmail accepted (`200`), and a probe to a non-owner address (`ovi@…`) also returned `200` — proving the `danielfekete.com` domain is **verified** in Resend (unverified domains only allow sends to the owner's own address). DKIM (`resend._domainkey`) is in DNS.
   - ✅ **Inbound delivery fully configured via API (same session):** the user added `Zone Settings:Edit` to the session token, then: **Email Routing enabled** on the zone (`POST /zones/…/email/routing/enable` → status `ready`); MX records `route1/2/3.mx.cloudflare.net` (10/20/30), a merged SPF TXT (`v=spf1 include:_spf.mx.cloudflare.net include:_resend.com ~all`), and a DMARC TXT (`v=DMARC1; p=none;`) added via the DNS API; the destination address (the owner's personal Gmail — kept private, never committed to the repository) was already present and **verified** (created 2025-10-27); the routing rule `***REMOVED***` → owner's Gmail was created (id `36388ff2…`, enabled, priority 0, catch-all remains disabled). A probe email tracing the exact form path (Resend `***REMOVED***` → Cloudflare MX → rule → Gmail, id `01a20385…`) was sent and **confirmed received in the Gmail inbox (2026-11-22)** — the visitor-facing contact form relay is fully operational and verified end-to-end. The sender stays `***REMOVED***` by owner's choice (sending from the `ovi.` subdomain was tested and rejected by Resend: subdomains need their own verification; the switch would also require replacing the website CNAME with GitHub Pages A-records).
   - Note: `GITHUB_OAUTH_CLIENT_ID/SECRET` are still unset, so the Sveltia CMS "Sign in with GitHub" login remains inactive (CLI/Git workflows are unaffected).
6. **Owner's personal Gmail redacted from docs + git history (2026-11-22):** the destination Gmail of the contact relay had been written into `docs/SESSION_HANDOVER.md` and `docs/TASKS.md` (AGENTS.md rule 2 violation — personal contact data must never live in plaintext in the public repo). Fixed in three layers: (1) files rewritten to neutral phrasing ("the owner's Gmail"), (2) `main` history rewritten with `git filter-repo --replace-text` (both case variants → `***REMOVED***`, only `--refs main`, earlier SHAs like `a5c97fd` intentionally preserved so doc references stay valid), (3) force-pushed. The pre-rewrite history is kept ONLY on the local branch `local-pre-redaction-backup` (delete with `git branch -D local-pre-redaction-backup` once satisfied — never push it). Remote main verified clean (branch history + current file contents). **Caveat:** GitHub still serves the three unreachable old commits by direct SHA (`c2dbfc7`, `f49d1e6`, `d7156c2`) until its garbage collection — repo has 0 forks / 0 watchers, exposure is minimal; for immediate purge contact GitHub Support ("please garbage-collect unreachable commits after a history rewrite to remove sensitive data"). Also observed: the git author identity on every commit is a personal Gmail (`petrichor.basewalk@gmail.com`) — left as-is pending an owner decision; the GitHub-noreply conversion would rewrite ALL commit SHAs.

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

3. **Accessible Appearance & Theme System (2026-11-21):**
   - **Three appearance modes** on `<html data-theme="...">`: `light` (warm paper default), `dark` (warm ember/cocoa near-black — terracotta & sage lifted for AA/AAA contrast, never cold SaaS gray), and `contrast` (pure black + white + amber `#FFD100`, AAA text pairs). All defined as pure CSS token overrides in `src/styles/tokens.css`.
   - **Header appearance toggle** (sun/moon/contrast icons) cycles `light → dark → contrast`, persists in `localStorage ("oc-theme")`, exposes action-based localized `aria-label`s (`theme.toLight/toDark/toContrast` in all three i18n dictionaries), and sits in a new `.header-actions` group that also holds the mobile hamburger (mobile grid placement moved from `.nav-toggle` to `.header-actions`).
   - **Bootstrap script in `<head>`** runs before first paint: saved choice > `prefers-contrast: more` > `prefers-color-scheme: dark` > light (no flash of the wrong palette).
   - **Accessibility groundwork:** skip-to-content link (`.skip-link` + `a11y.skipLink` strings), global `:focus-visible` ring, `prefers-reduced-motion` kill-switch, `<main id="main-content" tabindex="-1">`, and every previously hardcoded color in `base.css`/`DemoNotice.astro` tokenized (`--color-on-primary`, `--header-bg`, `--footer-*`, `--tag-sun-*`, `--badge-sage-border`, `--dot-color-*`, `--shadow-hard-accent`, `--pill-active-shadow`).
   - **Custom colors scoped:** `theme.colors` from `config/site.yaml` are now emitted as `html[data-theme='light']` overrides only (replacing the old empty `<style define:vars>` block), so user palettes can never break the dark/contrast themes.
   - The handcrafted hero SVG illustration intentionally keeps its light cream canvas in all themes (reads as a framed painting on dark surfaces).

4. **EU (GDPR + ePrivacy) Compliance Pass (2026-11-21):**
   - **Audit result:** the site sets **zero cookies**, no analytics, no external fonts; all browser storage (`oc-theme`, `oc_vault_aes_key_b64`, `oc_demo_notice_dismissed`) is functional/strictly-necessary and written only after explicit visitor actions → no consent banner needed (deliberate UX choice).
   - **Fix 1 — lazy Turnstile:** the `challenges.cloudflare.com` script is no longer eagerly loaded on every page; `PrivacyVaultRuntime.astro` injects it on demand (unlock click / contact form `focusin`). The contact form now renders its own Turnstile widget and sends `turnstileToken` (Worker-side verification was already implemented). Demo fallbacks preserved.
   - **Fix 2 — GDPR Art. 13 notice:** new `src/components/layout/PrivacyNotice.astro` dialog ("Adatkezelési információk"), linked from the footer and under the form submit button; localized `privacy.*` + `contactForm.privacyNote` strings in all three dictionaries.
   - Full analysis and the deploying-institution checklist (extend the notice with real controller data, Cloudflare/Resend DPAs, Web Accessibility Directive for municipal institutions, photo consents) documented in `docs/SECURITY_AND_PRIVACY.md` §6.

5. **Mandatory Human Verification for Every Email (2026-11-21):**
   - **Worker (`worker/src/index.ts`):** `POST /api/contact/send` now rejects any request without a server-verified Turnstile token with `403` *before* calling Resend — previously the token was optional, so the endpoint could be spammed directly (e.g. via curl). **Deployed live (Version `9d90a2e6-b89b-4956-9d13-d6005720d7d1`) and verified from this session:** token-less POST → `403 Missing or invalid Turnstile verification`; fake-token POST → `403`; vault unlock still rejects fake tokens with `403` as before. The deploy used the API token at `/tmp/opencode/cf.token` (Workers Scripts:Edit scope).
   - **Client (`PrivacyVaultRuntime.astro`):** the contact form now *refuses to send* until the Turnstile challenge returns a token — if the visitor submits before the widget resolves (or the script is blocked), the form waits (bounded 15 s, "Küldés folyamatban..." feedback) and shows the localized `contactForm.verifyError` message on failure; the widget resets after every send so each email needs a fresh human check.

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
4. Smaller Phase 4 leftovers: EXIF stripping/WebP for the **CLI** (`vault-cli.mjs`) and the **Zod config validation** CI script.
5. Verify the live Vault Manager once after this session's commits deploy: unlock `https://ovi.danielfekete.com/admin/vault.html` with the `.env` key — it should decrypt all three manifests (this doubles as the end-to-end proof that vault artifacts and Worker secret now share the same key).
