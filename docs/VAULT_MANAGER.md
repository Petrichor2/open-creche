# Browser Vault Manager Guide (`/admin/vault.html`)

The **Vault Manager** is a standalone, zero-dependency, client-side editor for the encrypted Privacy Vault. It lets a non-technical institution director update protected data — phone numbers, e-mail addresses, staff profiles, and gallery photos — **entirely in the browser**, without installing anything or running CLI commands.

Everything it produces is byte-compatible with the CLI (`scripts/vault-cli.mjs`) and the visitor-side decryptor (`PrivacyVaultRuntime.astro`):

| Artifact | Format |
| --- | --- |
| `public/vault/{contact,staff,gallery}.enc.json` | `{ version: 1, alg: "AES-256-GCM", iv, ciphertext }` JSON envelope |
| `public/vault-media/**/*.enc` | `[12-byte IV][ciphertext][16-byte GCM authTag]` binary blob |

---

## 1. Opening the tool

Navigate to `https://<your-domain>/admin/vault.html` (or `http://localhost:4321/admin/vault.html` in local preview). The page is `noindex` and available in Hungarian, English, and German.

### Security model

- The **master key** and the **GitHub token** are kept in JavaScript memory only. They are never written to `localStorage`, cookies, or any server.
- Only **encrypted** bytes leave the browser (toward the GitHub API, or into downloaded files).
- The page itself is public — like the rest of the repository — and contains no secrets.
- Use the tool only on a computer you trust. Press **🔒 Lock & wipe memory** when you are done.

> **Demo key warning:** if you paste the template's public demo key (`T3BlbkNy...`), the tool warns you loudly. The demo key is committed to the public repository, so anything encrypted with it is readable by anyone — never use it in production.

---

## 2. Unlocking the vault

1. Paste your institution's **`VAULT_MASTER_KEY`** (the base64 value from your `.env` file — the same value stored in the Cloudflare Worker secret).
2. Click **Unlock & load current data**. The browser fetches `public/vault/*.enc.json` from the live site and decrypts them in memory with `window.crypto.subtle`.
3. If your site has no vault yet, click **Start with an empty vault** instead.

No Turnstile challenge is needed here: you are not a visitor asking the Worker for the key — you already *have* the key.

---

## 3. Editing the protected data

The editor has three tabs:

- **Contact** — phone numbers and e-mail addresses with multilingual labels (`hu`/`en`/`de`).
- **Staff** — members with name, group, multilingual role & bio, and a portrait photo.
- **Gallery** — albums with multilingual titles, dates, and photos with multilingual captions.

Conventions that keep the runtime happy:

- Multilingual fields accept Hungarian, English, and German. **Hungarian is the required fallback** (`hu`) — the site falls back to it when a visitor's language is missing. Use the small **⧉** button to copy a Hungarian value into the empty EN/DE fields.
- Staff IDs and album IDs are auto-slugged from the name/title (e.g. `Kovács Anna` → `kovacs-anna`) and used as deterministic `.enc` file names.

### Uploading photos (EXIF stripping)

Click a photo slot or **drag-and-drop** an image. The tool then:

1. Decodes the image and draws it onto a `<canvas>` (long edge capped at 1600 px).
2. Re-encodes it as **WebP** — this inherently strips **all EXIF/GPS/camera metadata**. (SVG uploads are kept byte-exact; animated GIFs become still WebP.)
3. Encrypts the bytes with AES-256-GCM and stages the `.enc` blob.

Re-uploading a photo for the same entry writes the **same repository path** (no orphaned encrypted blobs). Deleting an entry stages deletion of its `.enc` file so removed children's photos do not linger in the public repository.

---

## 4. Saving

### Option A — Commit directly to GitHub (recommended)

1. Create a **fine-grained personal access token**: GitHub → *Settings → Developer settings → Fine-grained tokens*:
   - **Repository access:** only your website repository.
   - **Permissions:** `Contents: Read and write`.
   - **Expiration:** short (30 days is plenty).
2. Paste the token, confirm the prefilled `owner/repo` and branch (auto-detected from `public/admin/config.yml`).
3. Review the staged file table (each row can be unchecked), type a commit message, and click **Encrypt & commit to GitHub**.

The tool uses the **Git Data API** to create a **single atomic commit** containing every changed manifest, every new/updated `.enc` blob, and every orphan deletion. GitHub Pages redeploys automatically in a couple of minutes.

### Option B — Download the encrypted files (no token needed)

Click **Download encrypted files**: you receive each `.enc`/`.enc.json` file plus a `VAULT-README.txt` that lists the exact repository path for every file. Copy them into your repository, commit, and push.

---

## 5. Troubleshooting

| Symptom | Meaning / fix |
| --- | --- |
| "Wrong master key or corrupted vault files." | The pasted key does not match the deployed vault files. Use the same key as the Worker secret (`wrangler secret put VAULT_MASTER_KEY`). |
| GitHub API 401/403 | The token is invalid, expired, lacks `Contents: Read and write`, or misses SSO authorization. |
| Visitors pass Turnstile but the vault never opens | The deployed vault artifacts were encrypted with a different key than the Worker secret — the classic demo-key trap. Re-encrypt with the real key (this tool or the CLI) and verify both sides use the same key. |
| A staged row says "save" for a file you did not touch | That manifest really did change — the tool stages a write only when the decrypted JSON differs from what was loaded. |

---

## 6. Relationship to the CLI workflow

Both workflows produce identical artifacts and can be used interchangeably:

| | Browser Vault Manager | CLI (`bun run vault:encrypt`) |
| --- | --- | --- |
| Audience | Directors, non-technical staff | Maintainers working locally |
| Input | Forms, drag-and-drop | `.vault-raw/*.yaml` + raw photos in `.vault-raw/media/` |
| EXIF strip + WebP | Automatic (canvas) | Not yet (see `docs/TASKS.md` Phase 4) |
| Commit | GitHub API from the browser | Local `git commit` + push |

> **Note:** `bun run vault:encrypt` now **aborts** (instead of silently falling back) when `.vault-raw/` does not exist. Historically that fallback generated demo-key artifacts even during "real" encryption runs, which once left a live site's vault undecryptable by its own Worker key. The Vault Manager's demo-key warning guards against the same mistake.
