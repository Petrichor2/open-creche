# OpenCreche 🌱

**OpenCreche** is a free, open-source, privacy-first, multilingual website template and platform designed specifically for **nurseries, creches, and kindergartens** (bölcsődék és óvodák).

It enables child-care institutions to launch a warm, human-crafted, custom-domain website with **zero monthly hosting costs** using **GitHub Pages** and **Cloudflare**, while protecting sensitive data (phone numbers, email addresses, staff profiles, and children's gallery photos) against web scrapers and AI bots using **Cloudflare Turnstile** and **AES-256-GCM encryption**.

---

## ✨ Key Features

- **100% Free Infrastructure:** Hosted on GitHub Pages (public repository) with Cloudflare DNS and a lightweight Cloudflare Worker on the free tier.
- **Anti-Scrape & Child/Staff Privacy Vault:**
  - Phone numbers, email addresses, staff names/photos, and gallery photos are encrypted with **AES-256-GCM** (`.enc` payloads) so they are never exposed in plaintext in the HTML source or public Git repository.
  - Protected assets and contact details are only decrypted in the browser after passing a **Cloudflare Turnstile** human verification challenge via a serverless Cloudflare Worker.
- **Built-in Contact Form (Zero Email Exposure):** Parents can message the institution directly through a Turnstile-protected contact form powered by a Cloudflare Worker and **Resend API / Cloudflare Email Routing**, keeping recipient email addresses completely hidden.
- **Multilingual Out of the Box (`en`, `hu`, `de`) + Free AI Auto-Translation:**
  - Built-in internationalization with English, Hungarian, and German pre-configured, extensible to any language via `config/site.yaml`.
  - **Zero-Config GitHub Actions Auto-Translation:** Write content once in your primary language (e.g., Hungarian); a GitHub Action automatically translates new or updated YAML/Markdown files into all configured target languages using **GitHub Models (`GITHUB_TOKEN`)** for free (with optional Cloudflare Workers AI / Gemini fallback) and commits the translations back to the repository.
- **Warm, Crafted Design (No "AI-Slop"):** Built with **Astro** and pure **Vanilla CSS** (custom properties, organic shapes, warm color palettes, friendly typography). No generic SaaS templates, no bloated Tailwind/shadcn clichés.
- **Config-Driven & Visual Admin UI:**
  - Everything is controlled through clean YAML and Markdown files.
  - Includes **Sveltia CMS** (a modern, lightweight, Decap CMS-compatible Git-based visual editor) with Cloudflare Worker GitHub OAuth support so non-technical nursery directors and teachers can edit content easily.
- **Tailored for Nurseries & Kindergartens:**
  - **Introduction & Pedagogy:** Mission, values, daily routine/schedule, meal plans.
  - **Groups / Rooms:** Age groups, room capacities, daily activities.
  - **News & Event Calendar:** Announcements, upcoming holidays, parent-teacher meetings.
  - **Staff Directory:** Protected caregiver and teacher introductions and photos.
  - **Photo Gallery:** Protected, encrypted photo albums of nursery life and events.

---

## 🏗️ Architecture Overview

```text
+-----------------------------------------------------------------------+
|                           Parent / Visitor                            |
|                        (Web Browser + WebCrypto)                      |
+-----------------------------------+-----------------------------------+
                                    |
                  +-----------------+-----------------+
                  |                                   |
                  v (1. Static HTML/CSS & .enc files) v (2. Turnstile Token / Form)
+-----------------------------------+   +-------------------------------+
|           GitHub Pages            |   |       Cloudflare Worker       |
|       (Static Astro Build)        |   |   (Turnstile + Auth + Mail)   |
|                                   |   |                               |
| - Multilingual Pages (/en, /hu..) |   | - Validates Turnstile Token   |
| - Vanilla CSS Theme               |   | - Releases AES Decryption Key |
| - Encrypted Contact/Staff JSON    |   | - Sends Contact Emails        |
| - Encrypted Gallery Photos (.enc) |   | - GitHub OAuth for Admin CMS  |
+-----------------------------------+   +-------------------------------+
```

For a deep dive into the system design, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## 📚 Documentation

All project documentation is written in English and located in the [`docs/`](docs/) directory:

1. **[Architecture & Technical Design](docs/ARCHITECTURE.md)**
   System components, Astro static generation, Vanilla CSS design tokens, and directory structure.
2. **[Configuration & Content Schema](docs/CONFIGURATION.md)**
   Complete specification of `config/site.yaml`, multilingual (`en`, `hu`, `de`) content collections, groups, daily schedule, news, staff, and galleries.
3. **[Security & Anti-Scrape Privacy Vault](docs/SECURITY_AND_PRIVACY.md)**
   How phone numbers, emails, staff profiles, and gallery photos are encrypted in a public GitHub repository and unlocked via Cloudflare Turnstile + WebCrypto API.
4. **[Deployment & Setup Guide](docs/DEPLOYMENT.md)**
   Step-by-step guide for setting up GitHub Pages, custom domain with Cloudflare DNS, Cloudflare Turnstile, Cloudflare Worker, and Resend email forwarding.
5. **[Editor & CMS Guide](docs/CMS_GUIDE.md)**
   How non-technical staff can update news, schedules, and encrypted photos using the Git-based Admin UI or YAML/Markdown files.

---

## 🚀 Quick Start (Planned Workflow)

1. **Fork or Use Template:** Create a new public GitHub repository from `open-creche`.
2. **Configure Site:** Edit `config/site.yaml` to set your institution's name, active languages (`hu`, `en`, `de`), theme palette, and active sections.
3. **Deploy Cloudflare Worker:** Deploy the included `worker/` script to your free Cloudflare account and set your `VAULT_MASTER_KEY`, `TURNSTILE_SECRET_KEY`, and `RESEND_API_KEY`.
4. **Encrypt Sensitive Data:** Run `npm run vault:encrypt` (or upload via the Admin UI) to encrypt phone numbers, staff profiles, and gallery photos into `.enc` files before committing.
5. **Enable GitHub Pages:** Push to `main`—GitHub Actions automatically builds the Astro site and deploys it to GitHub Pages behind your custom Cloudflare domain.

---

## 📄 License

Released under the **MIT License**. Free for any nursery, creche, kindergarten, or educational institution.
