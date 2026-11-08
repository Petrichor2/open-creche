# Deployment & Setup Guide

This guide walks through setting up an **OpenCreche** website for a nursery or kindergarten from scratch using 100% free services: **GitHub Pages**, **Cloudflare DNS**, **Cloudflare Turnstile**, **Cloudflare Workers**, and **Resend**.

---

## Prerequisites

1. A free **[GitHub](https://github.com/)** account.
2. A free **[Cloudflare](https://www.cloudflare.com/)** account.
3. A custom domain name (e.g., `napsugar-ovi.hu` or `sunshine-creche.org`) added to Cloudflare DNS.
4. A free **[Resend](https://resend.com/)** account (for sending contact form emails).
5. **Node.js 20+** installed locally (for initial setup and key generation).

---

## Step 1: Fork & Clone the Repository

1. Click **"Use this template"** or **Fork** the `open-creche` repository on GitHub into a **Public** repository (required for free GitHub Pages).
2. Clone your repository locally:
   ```bash
   git clone https://github.com/<your-org>/<your-repo>.git
   cd <your-repo>
   npm install
   ```

---

## Step 2: Generate Your Privacy Vault Master Key

Generate a unique 256-bit AES encryption key for your institution:

```bash
npm run vault:init
```

This command:
- Creates a `.env` file (which is strictly `.gitignore`d) containing `VAULT_MASTER_KEY=<base64-32-byte-key>`.
- Creates the local `.vault-raw/` directory with sample `contact.yaml`, `staff.yaml`, and `gallery.yaml` files.

> **Important:** Save your `VAULT_MASTER_KEY` in a safe password manager. You will also upload it to your Cloudflare Worker in Step 5.

---

## Step 3: Create a Cloudflare Turnstile Widget

1. Log in to the **Cloudflare Dashboard**.
2. In the left sidebar, go to **Turnstile** -> **Add widget**.
3. Set the widget name (e.g., `OpenCreche Privacy Gate`).
4. Add your domain (e.g., `napsugar-ovi.hu`) and `localhost` (for local testing).
5. Select **Managed** widget mode (recommended).
6. Click **Create** and copy:
   - **Site Key** -> Paste this into `config/site.yaml` under `security.turnstileSiteKey`.
   - **Secret Key** -> Save this for Step 5 (Cloudflare Worker secret).

---

## Step 4: Set Up Resend for Contact Form Emails

1. Log in to **[Resend](https://resend.com/)**.
2. Go to **Domains** -> **Add Domain** and enter your nursery's domain (e.g., `napsugar-ovi.hu`).
3. Use the **"Sign in to Cloudflare"** auto-configure button (or manually copy the DKIM/SPF TXT records into Cloudflare DNS).
4. Go to **API Keys** -> **Create API Key** (`Sending access` only) and copy your `re_...` key for Step 5.

---

## Step 5: Deploy the Cloudflare Worker

The Cloudflare Worker validates Turnstile tokens, releases the AES decryption key to verified human visitors, sends contact form emails, and acts as the GitHub OAuth proxy for the Admin CMS.

1. Navigate to the `worker/` directory:
   ```bash
   cd worker
   npm install
   ```
2. Edit `worker/wrangler.toml` to set your allowed origin:
   ```toml
   name = "open-creche-worker"
   main = "src/index.ts"
   compatibility_date = "2026-01-01"

   [vars]
   ALLOWED_ORIGIN = "https://napsugar-ovi.hu"
   FROM_EMAIL = "weboldal@napsugar-ovi.hu"
   ```
3. Authenticate Wrangler with your Cloudflare account and upload your secrets:
   ```bash
   npx wrangler login
   npx wrangler secret put VAULT_MASTER_KEY
   npx wrangler secret put TURNSTILE_SECRET_KEY
   npx wrangler secret put RESEND_API_KEY
   npx wrangler secret put CONTACT_RECIPIENT_EMAIL
   ```
   *(Optional, if using GitHub login for the `/admin` CMS):*
   ```bash
   npx wrangler secret put GITHUB_OAUTH_CLIENT_ID
   npx wrangler secret put GITHUB_OAUTH_CLIENT_SECRET
   ```
4. Deploy the Worker:
   ```bash
   npx wrangler deploy
   ```
5. Copy the Worker URL (e.g., `https://open-creche-worker.<your-subdomain>.workers.dev` or bind a custom route like `https://api.napsugar-ovi.hu`) and set it in `config/site.yaml` under `security.workerBaseUrl`.

---

## Step 6: Encrypt Sensitive Content & Push to GitHub

1. Place your real phone numbers, emails, staff details, and gallery photos in `.vault-raw/`:
   - `.vault-raw/contact.yaml`
   - `.vault-raw/staff.yaml` + `.vault-raw/media/staff/*.jpg`
   - `.vault-raw/gallery.yaml` + `.vault-raw/media/gallery/**/*.jpg`
2. Run the encryption CLI:
   ```bash
   npm run vault:encrypt
   ```
   This strips EXIF GPS data, converts photos to optimized WebP, encrypts everything with `VAULT_MASTER_KEY`, and outputs:
   - `content/vault/contact.enc.json`
   - `content/vault/staff.enc.json`
   - `content/vault/gallery.enc.json`
   - `public/vault-media/**/*.enc`
3. Commit and push to GitHub:
   ```bash
   git add .
   git commit -m "Configure site and encrypted privacy vault"
   git push origin main
   ```

---

## Step 7: Connect GitHub Pages & Custom Domain via Cloudflare DNS

1. On GitHub, go to your repository **Settings** -> **Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. In **Custom domain**, enter your domain (`napsugar-ovi.hu`) and click **Save**.
4. In the **Cloudflare Dashboard**, go to your domain's **DNS -> Records** and add GitHub Pages' records:
   - **Apex domain (`@`):** Add `A` records pointing to GitHub Pages IPs (`185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`) or a `CNAME` flattened record pointing to `<your-username>.github.io`.
   - **`www` subdomain:** Add a `CNAME` record pointing to `<your-username>.github.io`.
   - Set Cloudflare SSL/TLS mode to **Full (Strict)**.
5. Once DNS propagates, check **"Enforce HTTPS"** in GitHub Pages settings.

---

## Step 8: Enable GitHub Actions Permissions for Auto-Translation

OpenCreche's `.github/workflows/deploy.yml` uses **GitHub Models** (via the built-in `GITHUB_TOKEN`) to automatically translate your primary language content (`hu`) into target languages (`en`, `de`) and commit the translated files back to the repository before building the site.

1. In your GitHub repository, go to **Settings** -> **Actions** -> **General**.
2. Scroll down to **Workflow permissions** and select **"Read and write permissions"**, then click **Save**.
3. The workflow declaration automatically includes:
   ```yaml
   permissions:
     contents: write   # To commit translated YAML/Markdown files back to the repo
     pages: write      # To deploy to GitHub Pages
     id-token: write   # For GitHub Pages deployment attestation
     models: read      # To call GitHub Models API for free using GITHUB_TOKEN
   ```
4. *(Optional Fallback)* If you want to configure a secondary fallback AI provider in case GitHub Models rate limits are reached, you can add `GEMINI_API_KEY` or `CF_AI_TOKEN` under **Settings** -> **Secrets and variables** -> **Actions**.
