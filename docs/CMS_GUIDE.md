# Editor & CMS Guide

OpenCreche supports two ways of updating content:
1. **Visual Admin UI (`/admin`):** Powered by **Sveltia CMS** (a fast, modern, Decap CMS-compatible Git-based visual editor) for non-technical nursery directors and teachers.
2. **Direct File Editing:** Editing YAML and Markdown files directly in Git or via the GitHub web interface.

---

## 1. Accessing the Visual Admin UI (`/admin`)

1. Navigate to `https://<your-domain>/admin/` in your web browser.
2. Click **"Sign in with GitHub"**.
3. The Cloudflare Worker OAuth proxy authenticates your GitHub user (you must have write access to the repository).
4. Once signed in, you will see a clean sidebar organized by collections:
   - **Site Settings (`config/site.yaml`)**
   - **Introduction & Daily Schedule (`en`, `hu`, `de`)**
   - **Groups / Rooms (`en`, `hu`, `de`)**
   - **News & Event Calendar (`en`, `hu`, `de`)**
   - **Privacy Vault Manager (Contacts, Staff, Encrypted Gallery)**

---

## 2. Managing Multilingual Content (`en`, `hu`, `de`) & Auto-Translation

OpenCreche combines **automatic AI translation** with **manual editorial control**:

### Automatic Translation (Default Workflow)
1. An editor writes a new announcement or updates the daily schedule in the **default language** (e.g., Hungarian `hu`) and clicks **Save**.
2. When the commit lands on GitHub, the GitHub Actions workflow runs `scripts/auto-translate.mjs` using **GitHub Models** (free via the built-in `GITHUB_TOKEN`).
3. The action translates the new or modified content into all other active languages (`en`, `de`) configured in `config/site.yaml`, commits the translated files back to the repository, and deploys the updated site.

### Manual Review & Locking Translations
- In Sveltia CMS, side-by-side translation is enabled out of the box. You can toggle between **Magyar (`hu`)**, **English (`en`)**, and **Deutsch (`de`)** in the top-right corner of the editor pane.
- If a teacher or translator manually refines an English or German translation and wants to prevent future automatic overwrites, they can toggle **"Lock Manual Translation (`manualOverride: true`)"** in the editor.

---

## 3. Managing Protected Data (Privacy Vault) Safely

Because the GitHub repository is public, **plaintext phone numbers, staff photos, and children's gallery photos must never be committed directly as raw files to Git**.

OpenCreche provides two safe workflows for managing protected data:

### Workflow A: Built-in Browser Vault Manager (Inside `/admin`)
Inside `/admin/`, the **Privacy Vault** tab embeds a custom client-side encryption utility:
1. You enter your institution's `VAULT_MASTER_KEY` (or unlock via your admin session).
2. The browser fetches and decrypts the current `contact.enc.json`, `staff.enc.json`, and `gallery.enc.json` in memory.
3. You can edit phone numbers, add a new staff member, or drag-and-drop new event photos directly in the browser.
4. Before uploading to GitHub:
   - An in-browser `<canvas>` worker strips all EXIF/GPS metadata and resizes the image to WebP.
   - `window.crypto.subtle.encrypt('AES-GCM', ...)` encrypts both the image binary (`.enc`) and the JSON manifest (`.enc.json`).
   - Only the encrypted `.enc` files are committed to the GitHub repository via the GitHub API.

### Workflow B: Local CLI Encryption (`npm run vault:encrypt`)
For maintainers working locally on a computer:
1. Edit `.vault-raw/contact.yaml`, `.vault-raw/staff.yaml`, or `.vault-raw/gallery.yaml`.
2. Drop raw photos into `.vault-raw/media/staff/` or `.vault-raw/media/gallery/`.
3. Run:
   ```bash
   npm run vault:encrypt
   ```
4. Commit the generated `content/vault/*.enc.json` and `public/vault-media/**/*.enc` files.
   *(Note: `.vault-raw/` is in `.gitignore`, so raw photos are never committed.)*
