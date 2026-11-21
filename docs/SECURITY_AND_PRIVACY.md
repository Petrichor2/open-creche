# Security & Anti-Scrape Privacy Vault

Nurseries and kindergartens handle highly sensitive information: direct phone numbers of caregivers, institutional email addresses, staff identities/portraits, and photos of children/events.

At the same time, hosting for free on **GitHub Pages (GitHub Free tier)** requires the repository to be **Public**, and all files served by GitHub Pages are publicly reachable via static URLs.

This document explains how **OpenCreche** resolves this paradox using a **Zero-Plaintext Git Vault (`AES-256-GCM`)** combined with **Cloudflare Turnstile** and a **Cloudflare Worker**.

---

## 1. Threat Model

| Threat | What Happens on Normal Static Sites | How OpenCreche Prevents It |
| :--- | :--- | :--- |
| **Email & Phone Harvesters** | Bots regex-scan HTML or decode simple Base64/`mailto:` links for spam and robocalls. | Contact data is encrypted with `AES-256-GCM`. Plaintext does not exist anywhere in the HTML, JS bundle, or Git repo. |
| **AI Image Scrapers & Crawlers** | Bots crawl `/assets/*.jpg` or inspect the public GitHub repository to harvest staff and children's photos. | Only encrypted binary files (`*.enc`) exist in the Git repo and on GitHub Pages. Without a valid Turnstile token verified by Cloudflare, the bytes are mathematically indistinguishable from random noise. |
| **Automated Form Spam** | Public `mailto:` or unprotected endpoints flood the kindergarten director's inbox. | Contact form submissions go exclusively through the Cloudflare Worker, which validates a single-use Turnstile token and enforces rate limiting before calling the Resend API. |
| **Git History Scraping** | Someone clones the public GitHub repository to look for raw photos or phone numbers. | Raw files reside in `.vault-raw/` (strictly `.gitignore`d) or are encrypted in-memory inside the browser CMS before committing to GitHub. |

---

## 2. Cryptographic Specification

- **Algorithm:** `AES-256-GCM` (Authenticated Encryption with Associated Data, natively supported by the `node:crypto` API in Bun and Node.js, and by Browser `window.crypto.subtle`).
- **Master Key (`VAULT_MASTER_KEY`):** A 256-bit (32-byte, 64-character hex or Base64) secret generated once per institution (`bun run vault:init`).
  - Stored locally in `.env` (gitignored) for CLI encryption.
  - Stored as an encrypted Cloudflare Worker Secret (`wrangler secret put VAULT_MASTER_KEY`).
- **Initialization Vector (IV):** A fresh 96-bit (12-byte) cryptographically random IV is generated for every single encrypted file or JSON payload.
- **Binary File Format (`*.enc` for Photos):**
  ```mermaid
  packet-beta
    0-11: "12 Bytes: Random IV (96-bit)"
    12-43: "N Bytes: AES-256-GCM Ciphertext (WebP/SVG)"
    44-59: "16 Bytes: GCM Auth Tag (128-bit)"
  ```
- **JSON Manifest Format (`*.enc.json` for Contact, Staff & Gallery Metadata):**
  ```json
  {
    "version": 1,
    "alg": "AES-256-GCM",
    "iv": "base64-encoded-12-byte-iv",
    "ciphertext": "base64-encoded-ciphertext-with-auth-tag"
  }
  ```

---

## 3. End-to-End Unlock Flow

```mermaid
sequenceDiagram
    autonumber
    actor Parent as Parent / Visitor (Browser)
    participant Pages as GitHub Pages (Static)
    participant Worker as Cloudflare Worker
    participant Turnstile as Cloudflare Turnstile API

    Parent->>Pages: Loads page (/hu/, /en/, /de/)
    Parent->>Parent: Clicks "Unlock Protected Content"
    Parent->>Turnstile: Completes Managed Turnstile Widget
    Turnstile-->>Parent: Issues single-use turnstileToken
    Parent->>Worker: POST /api/vault/unlock { turnstileToken }
    Worker->>Turnstile: POST /turnstile/v0/siteverify { secret, response, ip }
    Turnstile-->>Worker: { success: true, hostname: "..." }
    Worker-->>Parent: 200 OK { key: VAULT_MASTER_KEY }
    Parent->>Parent: Caches key in sessionStorage
    Parent->>Pages: GET /vault/*.enc.json & /vault-media/**/*.enc
    Pages-->>Parent: Returns encrypted AES-256-GCM payloads
    Parent->>Parent: Decrypts in-memory via window.crypto.subtle.decrypt()
    Parent->>Parent: Renders phone numbers, emails, staff & Blob URLs
```

### Single-Verification UX (Parent-Friendly)
Parents do **not** have to solve a CAPTCHA for every single photo or section:
1. Once a visitor passes Turnstile once (e.g., to view phone numbers or open the staff section), the unlocked key is kept in `sessionStorage` for the duration of their browser tab session.
2. All other protected components on the page (`<protected-contact>`, `<protected-staff>`, `<protected-gallery>`) listen for a custom `vault:unlocked` DOM event and automatically decrypt and render their contents as they scroll into view (`IntersectionObserver`).

---

## 4. Cloudflare Worker API Endpoints

The included Cloudflare Worker (`worker/`) exposes three lightweight endpoints:

### `POST /api/vault/unlock`
- **Request Body:** `{ "turnstileToken": "..." }`
- **Security Checks:**
  1. Verifies `Origin` header matches the configured nursery domain (`ALLOWED_ORIGIN`).
  2. Verifies `turnstileToken` against `https://challenges.cloudflare.com/turnstile/v0/siteverify` using `TURNSTILE_SECRET_KEY`.
  3. Verifies the `hostname` returned by Cloudflare Turnstile matches the expected domain.
- **Response (`200 OK`):**
  ```json
  {
    "ok": true,
    "key": "<base64-aes-256-key>"
  }
  ```

### `POST /api/contact/send`
- **Request Body:**
  ```json
  {
    "turnstileToken": "...",
    "locale": "hu",
    "parentName": "Nagy Eszter",
    "parentEmail": "eszter@example.com",
    "parentPhone": "+36 30 111 2222",
    "childAge": "2.5 év",
    "subject": "Bölcsődei beszoktatás érdeklődés",
    "message": "Tisztelt Intézményvezető! Szeretnék érdeklődni..."
  }
  ```
- **Security Checks:**
  1. **Mandatory human verification:** a Turnstile token must be present AND
     pass Cloudflare's `siteverify` — requests without a valid token (curl,
     bots) are rejected with `403` **before** the Resend API is ever called.
     Every relayed email therefore requires a verified human sender.
  2. Sanitizes inputs and validates field lengths.
  3. Sends an email via the **Resend HTTP API** (`https://api.resend.com/emails`) to the secret `CONTACT_RECIPIENT_EMAIL` stored inside the Cloudflare Worker environment (never exposed to the client).

### `GET /api/oauth/auth` & `GET /api/oauth/callback`
- Handles the GitHub OAuth handshake for **Sveltia CMS / Decap CMS**, allowing nursery staff to log into `/admin` with their GitHub account without paying for third-party OAuth proxies.

---

## 5. Image Optimization & EXIF Stripping Before Encryption

Children's and staff photos taken on smartphones often contain sensitive **EXIF metadata** (exact GPS coordinates, timestamp, device owner name) and large file sizes (5–10 MB).

Before encrypting any image into `public/vault-media/*.enc`:
1. **EXIF Metadata Stripping:** All EXIF/IPTC/GPS tags are completely stripped.
2. **Resizing & WebP Conversion:** Images are automatically resized (e.g., max `1600px` width for gallery, `600px` for staff portraits) and compressed to WebP before AES-256-GCM encryption.
3. This ensures encrypted `.enc` blobs are small (typically 50–150 KB), fast to download from GitHub Pages, and free of hidden GPS leaks.

---

## 6. EU (GDPR + ePrivacy) Compliance Posture

This project targets a primarily Hungarian / EU audience, so the client-side
surface is designed against the **ePrivacy Directive (2002/58/EC)** — transposed
in Hungary as *2011. évi CXII. törvény, 13/A. §* — and the **GDPR
(2016/679)**, transposed as *2011. évi CXII. törvény* / *Az információs
önrendelkezési jogról szóló 2011. évi CXII. törvény* (Act CXII of 2011 on
Informational Self-Determination).

### 6.1 Browser storage inventory (all first-party)

| Storage key | Type | Written when | Lifetime | ePrivacy classification |
|---|---|---|---|---|
| `oc-theme` | `localStorage` | only on an explicit theme-toggle click | persistent, user-removable | Functional (user-requested) — no consent needed |
| `oc_vault_aes_key_b64` | `sessionStorage` | only after the visitor passes Turnstile and unlocks protected content | tab session | Strictly necessary for the explicitly requested service |
| `oc_demo_notice_dismissed` | `sessionStorage` | only after the visitor clicks OK on the demo notice | tab session | Functional (user-requested) |

**The site itself sets zero cookies**, uses no analytics, no advertising
identifiers, and loads no external fonts. Nothing is written to the visitor's
device on page load — every write follows an explicit visitor action, so the
*ePrivacy* consent requirement for non-essential storage is not triggered and
**no cookie banner is needed** (which also keeps the site banner-free for
children's guardians — a deliberate UX decision).

### 6.2 Third-party requests (all user-initiated, all lazy)

- **Cloudflare Turnstile** (`challenges.cloudflare.com`) is loaded **on
  demand only**: when the visitor clicks an unlock button in a protected
  section, or starts filling in the contact form. There is no third-party
  request on plain page load.
- **Cloudflare Worker** (the institution's own deployment) — called only for
  the explicitly requested vault unlock and contact form submission.
- **Resend** — email delivery processor, only involved in the contact form
  flow (server-side, never contacted by the browser).

### 6.3 GDPR information duty (Article 13)

`src/components/layout/PrivacyNotice.astro` renders a localized
**"Data protection information"** dialog (linked from the footer and next to
the contact form submit button) covering: controller identity, browser
storage inventory, contact form data flow with processors (Cloudflare,
Resend), and GDPR data subject rights. Strings live under `privacy.*` in
`content/i18n/{hu,en,de}.yaml`.

### 6.4 What a deploying institution MUST still do

1. **Extend the privacy notice** (`content/i18n/{lang}.yaml`, `privacy.*`)
   with the institution's exact legal name, contact e-mail address, and
   message retention period.
2. **Sign DPAs** (Art. 28 processor agreements) with **Cloudflare** and
   **Resend** — both publish standard GDPR terms; the free tiers are covered.
3. If the institution is **state or municipally maintained**, the EU **Web
   Accessibility Directive (2016/2104)** / *2005. évi XC. törvény* applies —
   the built-in appearance themes (light / dark / WCAG-AAA contrast),
   skip-link, and `:focus-visible` support are designed to help meet the
   WCAG 2.1 AA obligation, but a formal audit is the institution's task.
4. Photographs of children require the **guardians' written consent** under
   GDPR Art. 6/9 (keep the consent records offline — never in this repo).

### 6.5 AI translation pipeline

`scripts/auto-translate.mjs` only ever sends **public `content/` files**
(pages, groups, news, UI strings) to the translation provider. Staff
profiles, phone numbers, and children's photos are never in `content/` — they
exist only as AES-256-GCM ciphertext in `public/vault/` — so **no personal
data is transmitted to any AI provider**.
