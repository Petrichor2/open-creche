# Cloudflare Integration Quickstart (`docs/CLOUDFLARE_SETUP.md`)

This guide wires up the **production Privacy Vault chain** on a custom subdomain
(e.g. `ovi.danielfekete.com`) with **demo content encrypted under a real master
key** — perfect for validating the full pipeline before real institution data is
loaded.

```
Visitor ──► Turnstile challenge ──► Worker /api/vault/unlock ──► AES-256-GCM key
Scrapper ─► view-source / raw file ─────────────────────────► ciphertext only
```

**Scope of this guide:** DNS + custom domain, Turnstile, and the Vault unlock
Worker. The contact form relay (Resend) and the CMS GitHub OAuth proxy are
optional additions documented in `docs/DEPLOYMENT.md`.

---

## Prerequisites

- A Cloudflare account (free plan is sufficient) with your domain (e.g.
  `danielfekete.com`) added to Cloudflare DNS.
- Admin access to the GitHub repository (Pages settings).
- The repository checked out locally with **Bun** installed, and a fresh
  `VAULT_MASTER_KEY` generated via `bun run vault:init` (stored in the
  gitignored `.env`).

---

## Step 1 — DNS: point the subdomain at GitHub Pages

1. Cloudflare Dashboard → your domain → **DNS → Records → Add record**.
2. Type `CNAME`, Name `ovi`, Target `petrichor2.github.io`, Proxy status:
   **DNS only** (grey cloud — required first so GitHub can issue its
   certificate).
3. Repeat for a `www`-style subdomain if desired.

## Step 2 — GitHub Pages: attach the custom domain

1. GitHub repository → **Settings → Pages → Custom domain** → enter
   `ovi.danielfekete.com` → **Save**.
2. Wait for the DNS check to pass and the certificate to be issued (a few
   minutes), then tick **Enforce HTTPS**. The same toggle is available via the
   REST API once the certificate shows `approved`:
   ```bash
   gh api --method PUT repos/<owner>/<repo>/pages --input - <<< '{"https_enforced":true}'
   ```
3. Optional: once HTTPS works, you may re-enable the Cloudflare proxy (orange
   cloud) and set SSL/TLS to **Full (Strict)**.

## Step 3 — Turnstile: create the human-verification widget

1. Cloudflare Dashboard → **Turnstile → Add site**.
2. Hostname: add `ovi.danielfekete.com` (also add `localhost` if you want
   local testing).
3. Widget mode: **Managed** (recommended).
4. Note the two generated values:
   - **Site Key** (public, embedded in the page)
   - **Secret Key** (goes into the Worker as a secret)

## Step 4 — Deploy the Worker

From the repository root:

```bash
cd worker
bun install

# Authenticate (opens a browser; on a headless machine use the printed
# URL + code flow, or export CLOUDFLARE_API_TOKEN with "Workers Scripts:Edit"
# permission instead).
bunx wrangler login

# Configure the two secrets this scope needs:
bunx wrangler secret put VAULT_MASTER_KEY       # paste the value from .env
bunx wrangler secret put TURNSTILE_SECRET_KEY   # paste the Turnstile secret key

# Deploy (ALLOWED_ORIGIN is already set in wrangler.toml):
bunx wrangler deploy
```

Note the deployed URL, e.g. `https://open-creche-worker.<account>.workers.dev`.

Quick smoke test — an invalid token must be rejected:

```bash
curl -X POST https://open-creche-worker.<account>.workers.dev/api/vault/unlock \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://ovi.danielfekete.com' \
  -d '{"turnstileToken":"invalid"}'
# → 403 {"ok":false,"error":"Invalid Turnstile verification"}
```

## Step 5 — Switch the site to the production chain

Edit `config/site.yaml`:

```yaml
site:
  url: "https://ovi.danielfekete.com"   # links revert to the domain root
  demoContent: true                     # keep: the content is still sample data

security:
  turnstileSiteKey: "<Turnstile Site Key>"
  workerBaseUrl: "https://open-creche-worker.<account>.workers.dev"
  demoMode: false                       # real Worker + Turnstile from now on
```

Re-encrypt the demo vault with the **real** master key (it reads `.env`):

```bash
bun run vault:demo
```

Flip the CMS media path back to the domain root in `public/admin/config.yml`:

```yaml
public_folder: "/assets"
```

Commit and push — CI rebuilds and deploys to the custom domain.

## Step 6 — Verify the whole chain

1. Open `https://ovi.danielfekete.com` — the demo notice still shows
   (`demoContent: true`), navigation works at the domain root.
2. View the page source (Ctrl+U): **no plaintext phones, e-mails, or staff
   names** — only `*.enc.json` / `*.enc` blobs.
3. Click **"Emberi ellenőrzés és feloldás"** in a protected section, solve the
   real Turnstile challenge → contact details, staff, and gallery decrypt.
4. Network tab: the key arrived only after `POST /api/vault/unlock` succeeded.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| Unlock button fails, console shows CORS/403 from the Worker | `ALLOWED_ORIGIN` in `worker/wrangler.toml` does not match the site origin — redeploy after fixing it |
| Turnstile error "not a valid domain" | The widget's hostname list is missing `ovi.danielfekete.com` |
| Unlock succeeds but content stays hidden | Vault files were encrypted with a different key than `VAULT_MASTER_KEY` — re-run `bun run vault:demo` |
| Custom domain serves 404 | DNS not propagated yet, or the Pages custom domain was not saved |
