# AI Agent Instructions & Project Context (`AGENTS.md`)

This file provides essential architectural context, coding conventions, and operational rules for AI coding agents (OpenCode, Cursor, Claude Code, GitHub Copilot, etc.) working on **OpenCreche**.

---

## 1. Project Identity & Core Goal

**OpenCreche** is a 100% free, open-source, privacy-first, multilingual static website template for **nurseries, creches, and kindergartens** (bölcsődék és óvodák).

- **Hosting:** GitHub Pages (from a **Public** GitHub repository) + Cloudflare DNS.
- **Anti-Scrape & Privacy Vault:** Sensitive data (phone numbers, email addresses, staff bios/photos, and children's gallery photos) is encrypted at rest in Git using **AES-256-GCM** (`public/vault/*.enc.json` and `public/vault-media/**/*.enc`). It is unlocked in the browser via `window.crypto.subtle` only after passing a **Cloudflare Turnstile** challenge verified by a **Cloudflare Worker** (`worker/`).
- **Zero-Email Contact Form:** Messages are sent via the Cloudflare Worker using the **Resend API** so staff email addresses are never exposed.
- **Multilingual + Free AI Auto-Translation:** Built-in `hu`, `en`, `de` support. GitHub Actions automatically translates content from `defaultLocale` using **GitHub Models (`GITHUB_TOKEN`)** (`scripts/auto-translate.mjs`) and commits translations back to the repository.
- **Visual Admin UI:** **Sveltia CMS** (Decap CMS compatible) located at `public/admin/`.

---

## 2. Strict Architectural & Design Rules

1. **NO "AI-Slop" or Generic SaaS Styling:**
   - **DO NOT** introduce Tailwind CSS, shadcn/ui, Radix, or generic purple/blue neon SaaS gradients.
   - **USE** pure semantic HTML and **Vanilla CSS** (`src/styles/tokens.css` and `src/styles/base.css`).
   - Maintain the warm, tactile, early-childhood aesthetic: warm paper backgrounds (`#FAF6F0`, `#F3ECE1`), terracotta (`#D96B43`), sage green (`#5B8266`), mustard yellow (`#E6B84C`), organic pebble border radii, and handcrafted SVG illustrations/dividers.
2. **Zero Plaintext Sensitive Data in Git:**
   - Because GitHub Free requires a **public repository** for GitHub Pages, **NEVER** commit unencrypted real phone numbers, email addresses, staff portraits, or children's photos to tracked directories.
   - Raw source files belong exclusively in `.vault-raw/` (which is strictly `.gitignore`d).
   - Tracked vault artifacts must always be AES-256-GCM encrypted (`public/vault/*.enc.json` and `public/vault-media/**/*.enc`).
3. **Documentation & Code Language:**
   - All code, comments, commit messages, and documentation (`README.md`, `docs/*.md`, `AGENTS.md`) **MUST be written in English**.
   - Default institutional content and UI dictionaries support Hungarian (`hu`), English (`en`), and German (`de`).
4. **Git Commit Convention:**
   - Always use **Conventional Commits** (`feat: ...`, `fix: ...`, `docs: ...`, `chore: ...`, `refactor: ...`).
5. **Keep Handover & Task Files Updated:**
   - Before ending a session or after completing a major milestone, update `docs/TASKS.md` and `docs/SESSION_HANDOVER.md`.

---

## 3. Local Environment & Commands

> **Environment Note:** On the current Linux host (`/media/server/6AEF-FABB/repo/open-creche`), **Bun** is installed at `~/.bun/bin/bun` (and the filesystem is mounted on exFAT/FAT where `node_modules/.bin` symlinks may be skipped).

Use these commands for building and running scripts:

```bash
# Ensure Bun is in PATH
export PATH="$HOME/.bun/bin:$PATH"

# Install dependencies
bun install

# Generate encrypted demo vault manifests & binary images
bun scripts/vault-cli.mjs demo

# Encrypt real local data from .vault-raw/
bun scripts/vault-cli.mjs encrypt

# Run auto-translation check locally
bun scripts/auto-translate.mjs

# Build static Astro site into ./dist
bun ./node_modules/astro/astro.js build

# Start Astro dev server
bun ./node_modules/astro/astro.js dev
```

---

## 4. Key Files Map

- `config/site.yaml` — Master configuration (institution title, address, active languages, theme colors, feature flags, Turnstile & Worker URLs).
- `config/navigation.yaml` — Header navigation links.
- `content/i18n/{hu,en,de}.yaml` — UI translation strings.
- `content/pages/{lang}/about.md` & `schedule.yaml` — Pedagogy introduction and daily routine.
- `content/groups/{lang}/*.yaml` — Creche and kindergarten room/group definitions.
- `content/news/{lang}/*.md` — Announcements and event calendar items.
- `scripts/vault-cli.mjs` — AES-256-GCM encryption/decryption CLI for contact details, staff, and gallery blobs.
- `scripts/auto-translate.mjs` — GitHub Models / Gemini / Cloudflare AI automated translation script.
- `src/components/vault/PrivacyVaultRuntime.astro` — Client-side WebCrypto AES-256-GCM decryptor and Turnstile controller.
- `worker/src/index.ts` — Cloudflare Worker (Turnstile `siteverify`, vault key release, Resend email relay, GitHub OAuth for CMS).
- `docs/TASKS.md` — Project backlog and milestone tracking.
- `docs/SESSION_HANDOVER.md` — Session state and handover notes for the next agent.
