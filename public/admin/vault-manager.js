/**
 * OpenCreche Vault Manager (`public/admin/vault-manager.js`)
 *
 * Standalone, zero-dependency, client-side editor for the encrypted Privacy Vault.
 * Non-technical directors can unlock the vault with the master key, edit contact
 * details, staff profiles, and gallery photos in the browser, and commit the
 * AES-256-GCM encrypted artifacts straight back to the public GitHub repository.
 *
 * Workflow:  unlock -> edit -> (canvas EXIF strip + WebP) -> WebCrypto encrypt
 *            -> atomic Git commit via the GitHub REST API (or manual downloads).
 *
 * Security model:
 *   - The master key and the GitHub token live in JS memory only; they are never
 *     written to localStorage, sessionStorage, or any remote endpoint.
 *   - Only encrypted bytes leave the browser (GitHub Contents/Git Data API).
 *   - The page itself is public (it is part of the public repo) and contains no secrets.
 */
import {
  DEMO_MASTER_KEY_B64,
  b64ToBytes,
  bytesToB64,
  decryptBinary,
  decryptJson,
  encryptBinary,
  encryptJson,
  generateMasterKeyB64,
  importAesKey,
} from './vault-crypto.js';

/* ============================================================================
 * 1. UI dictionary (hu / en / de) — the admin interface follows the site locales.
 * ========================================================================== */
const I18N = {
  hu: {
    appSubtitle: 'Böngészőben futó, titkosított adatszerkesztő — parancssor nélkül',
    securityNote:
      'A kulcs és a token csak a böngésző memóriájában marad, tárolás nélkül. Csak megbízható számítógépen használd!',
    step1Title: '1. Nyitás',
    step2Title: '2. Védett adatok szerkesztése',
    step3Title: '3. Ellenőrzés és mentés',
    masterKeyLabel: 'Vault mesterkulcs',
    masterKeyHint:
      'A Cloudflare Worker VAULT_MASTER_KEY titka, base64 formátumban (a telepítéskor kaptad).',
    masterKeyPlaceholder: 'base64 kulcs beillesztése…',
    generateKeyBtn: 'Új kulcs generálása',
    keyGeneratedNote:
      'Mentsd el MOST: ez a kulcs a .env fájlba (VAULT_MASTER_KEY) ÉS a Cloudflare Worker titokba kerül. Elveszett kulccsal az adatok visszafejthetetlenek.',
    demoKeyWarning:
      'Figyelem: ez a nyilvánosan ismert DEMO kulcs! Éles üzemben soha ne használd — bárki ki tudja nyitni vele a vaultot.',
    loadBtn: 'Megnyitás és jelenlegi adatok betöltése',
    startEmptyBtn: 'Üres vault indítása',
    ghPatLabel: 'GitHub token (fine-grained PAT)',
    ghPatHint:
      'GitHub → Settings → Developer settings → Fine-grained tokens: csak a saját repo, Contents: Read and write jogosultság, rövid lejárat. Közvetlenül a GitHub API-hoz kell, a webhely nem tárolja.',
    ghPatPlaceholder: 'github_pat_… (opcionális a letöltéses mentéshez)',
    repoLabel: 'Tároló (owner/repo)',
    branchLabel: 'Branch',
    statusWrongKey: 'Hibás mesterkulcs vagy sérült vaultfájl.',
    statusNoVault:
      'Ehhez a webhelyhez még nincs titkosított vault. Kezdd az „Üres vault indítása" gombbal.',
    statusLoaded: 'Vault megnyitva — lent szerkeszthetőek a védett adatok.',
    statusLoading: 'Betöltés…',
    tabContact: 'Elérhetőség',
    tabStaff: 'Pedagógusok',
    tabGallery: 'Galéria',
    phonesTitle: 'Telefonszámok',
    emailsTitle: 'E-mail címek',
    addPhone: '+ Új telefonszám',
    addEmail: '+ Új e-mail cím',
    addMember: '+ Új pedagógus',
    addAlbum: '+ Új album',
    addPhoto: '+ Fotó hozzáadása',
    removeBtn: 'Eltávolítás',
    photoReplace: 'Fotó cseréje',
    photoDrop: 'Fotó ide húzása vagy kattintás a kiválasztáshoz',
    photoNone: 'Nincs fotó — húzz ide egy képet, vagy kattints.',
    memberName: 'Név',
    memberGroup: 'Csoport',
    memberId: 'Azonosító (slug)',
    memberRole: 'Szerepkör',
    memberBio: 'Bemutatkozás',
    albumDate: 'Dátum',
    albumTitle: 'Album címe',
    photoCaption: 'Képaláírás',
    copyFromHu: 'HU → EN/DE másolása',
    langRequired: 'a magyar kötelező; EN/DE opcionális',
    labelLabel: 'Címke',
    numberLabel: 'Telefonszám',
    addressLabel: 'E-mail cím',
    tableFile: 'Fájl',
    tableAction: 'Művelet',
    tableSize: 'Méret',
    actionSave: 'mentés (titkosítva)',
    actionDelete: 'törlés a repóból',
    commitMsgLabel: 'Commit üzenet',
    commitMsgDefault: 'chore(vault): update protected data via browser vault manager',
    commitBtn: 'Titkosítás és commit a GitHubra',
    downloadBtn: 'Titkosított fájlok letöltése (GitHub nélkül)',
    missingMediaWarning: 'Hivatkozott, de még nem létező képfájl — tölts fel hozzá fotót:',
    validateError: 'Hiányzó vagy érvénytelen mezők — lásd a piros jelöléseket.',
    emailInvalid: 'Érvénytelen e-mail cím',
    ghReadingBranch: 'Branch lekérése…',
    ghUploadingBlobs: 'Titkosított fájlok feltöltése ({n}/{total})…',
    ghCreatingTree: 'Git fa összeállítása…',
    ghCreatingCommit: 'Commit létrehozása…',
    ghUpdatingBranch: 'Branch frissítése…',
    ghSuccess: 'Kész! A módosítások el lettek mentve egyetlen commitban:',
    ghDeployNote: 'A GitHub Pages automatikusan újratelepíti a webhelyet 1–2 percen belül.',
    downloadNote:
      'A letöltött fájlokat másold a jelzett útvonalakra a repóban, commitold és pushold — a webhely ezután automatikusan frissül.',
    lockBtn: '🔒 Lezárás és memóriaürítés',
    backToAdmin: 'CMS (tartalomszerkesztő)',
    backToSite: 'Webhely megtekintése',
    confirmRemove: 'Biztosan eltávolítod ezt a bejegyzést?',
    emptyList: 'Még nincs bejegyzés — add hozzá az elsőt a + gombbal.',
    errUnsupportedImage: 'Nem támogatott képformátum (használj JPG, PNG, WebP, GIF, AVIF vagy SVG fájlt).',
    errNoRepo: 'Add meg a GitHub tárolót (owner/repo) és a token-t a commithoz.',
    errNothingStaged: 'Nincs mentendő változtatás.',
    processingImage: 'Kép feldolgozása (EXIF-mentes WebP)…',
  },
  en: {
    appSubtitle: 'In-browser encrypted data editor — no command line required',
    securityNote:
      'The key and token stay in browser memory only and are never stored. Use this only on a trusted computer!',
    step1Title: '1. Unlock',
    step2Title: '2. Edit protected data',
    step3Title: '3. Review & save',
    masterKeyLabel: 'Vault master key',
    masterKeyHint:
      'The Cloudflare Worker VAULT_MASTER_KEY secret, in base64 (issued during setup).',
    masterKeyPlaceholder: 'paste base64 key…',
    generateKeyBtn: 'Generate a new key',
    keyGeneratedNote:
      'Save it NOW: this key goes into your .env file (VAULT_MASTER_KEY) AND the Cloudflare Worker secret. Data is unrecoverable if the key is lost.',
    demoKeyWarning:
      'Warning: this is the publicly known DEMO key! Never use it in production — anyone could unlock the vault.',
    loadBtn: 'Unlock & load current data',
    startEmptyBtn: 'Start with an empty vault',
    ghPatLabel: 'GitHub token (fine-grained PAT)',
    ghPatHint:
      'GitHub → Settings → Developer settings → Fine-grained tokens: your repo only, Contents: Read and write permission, short expiry. It is used directly against the GitHub API and never stored by this site.',
    ghPatPlaceholder: 'github_pat_… (optional for the download workflow)',
    repoLabel: 'Repository (owner/repo)',
    branchLabel: 'Branch',
    statusWrongKey: 'Wrong master key or corrupted vault files.',
    statusNoVault: 'No encrypted vault exists on this site yet. Use "Start with an empty vault".',
    statusLoaded: 'Vault unlocked — edit the protected data below.',
    statusLoading: 'Loading…',
    tabContact: 'Contact',
    tabStaff: 'Staff',
    tabGallery: 'Gallery',
    phonesTitle: 'Phone numbers',
    emailsTitle: 'E-mail addresses',
    addPhone: '+ Add phone',
    addEmail: '+ Add e-mail',
    addMember: '+ Add staff member',
    addAlbum: '+ Add album',
    addPhoto: '+ Add photo',
    removeBtn: 'Remove',
    photoReplace: 'Replace photo',
    photoDrop: 'Drop a photo here or click to choose',
    photoNone: 'No photo yet — drop an image here or click.',
    memberName: 'Name',
    memberGroup: 'Group',
    memberId: 'ID (slug)',
    memberRole: 'Role',
    memberBio: 'Bio',
    albumDate: 'Date',
    albumTitle: 'Album title',
    photoCaption: 'Caption',
    copyFromHu: 'Copy HU → EN/DE',
    langRequired: 'Hungarian required; EN/DE optional',
    labelLabel: 'Label',
    numberLabel: 'Phone number',
    addressLabel: 'E-mail address',
    tableFile: 'File',
    tableAction: 'Action',
    tableSize: 'Size',
    actionSave: 'save (encrypted)',
    actionDelete: 'delete from repo',
    commitMsgLabel: 'Commit message',
    commitMsgDefault: 'chore(vault): update protected data via browser vault manager',
    commitBtn: 'Encrypt & commit to GitHub',
    downloadBtn: 'Download encrypted files (no GitHub)',
    missingMediaWarning: 'Referenced media file does not exist yet — upload a photo for it:',
    validateError: 'Missing or invalid fields — see the red highlights.',
    emailInvalid: 'Invalid e-mail address',
    ghReadingBranch: 'Reading branch…',
    ghUploadingBlobs: 'Uploading encrypted files ({n}/{total})…',
    ghCreatingTree: 'Building git tree…',
    ghCreatingCommit: 'Creating commit…',
    ghUpdatingBranch: 'Updating branch…',
    ghSuccess: 'Done! Changes saved in a single commit:',
    ghDeployNote: 'GitHub Pages will redeploy the site automatically within 1–2 minutes.',
    downloadNote:
      'Copy the downloaded files to the indicated repository paths, then commit & push — the site updates automatically.',
    lockBtn: '🔒 Lock & wipe memory',
    backToAdmin: 'CMS (content editor)',
    backToSite: 'View website',
    confirmRemove: 'Remove this entry?',
    emptyList: 'Nothing here yet — add the first entry with the + button.',
    errUnsupportedImage: 'Unsupported image format (use JPG, PNG, WebP, GIF, AVIF, or SVG).',
    errNoRepo: 'Enter the GitHub repository (owner/repo) and token to commit.',
    errNothingStaged: 'There is nothing to save.',
    processingImage: 'Processing image (EXIF-free WebP)…',
  },
  de: {
    appSubtitle: 'Verschlüsselter Daten-Editor im Browser — ohne Kommandozeile',
    securityNote:
      'Schlüssel und Token bleiben nur im Arbeitsspeicher des Browsers und werden nirgends gespeichert. Nur auf einem vertrauenswürdigen Computer verwenden!',
    step1Title: '1. Öffnen',
    step2Title: '2. Geschützte Daten bearbeiten',
    step3Title: '3. Prüfen & speichern',
    masterKeyLabel: 'Vault-Hauptschlüssel',
    masterKeyHint:
      'Das VAULT_MASTER_KEY-Geheimnis des Cloudflare Workers, base64-kodiert (bei der Einrichtung erhalten).',
    masterKeyPlaceholder: 'base64-Schlüssel einfügen…',
    generateKeyBtn: 'Neuen Schlüssel generieren',
    keyGeneratedNote:
      'JETZT sichern: Dieser Schlüssel gehört in die .env-Datei (VAULT_MASTER_KEY) UND in das Cloudflare-Worker-Geheimnis. Ohne Schlüssel sind die Daten nicht wiederherstellbar.',
    demoKeyWarning:
      'Achtung: Dies ist der öffentlich bekannte DEMO-Schlüssel! Niemals produktiv verwenden — jeder könnte damit den Vault öffnen.',
    loadBtn: 'Öffnen & aktuelle Daten laden',
    startEmptyBtn: 'Mit leerem Vault beginnen',
    ghPatLabel: 'GitHub-Token (Fine-grained PAT)',
    ghPatHint:
      'GitHub → Settings → Developer settings → Fine-grained tokens: nur dein Repository, Berechtigung Contents: Read and write, kurze Laufzeit. Wird direkt für die GitHub-API genutzt und von dieser Website nie gespeichert.',
    ghPatPlaceholder: 'github_pat_… (optional für den Download-Weg)',
    repoLabel: 'Repository (owner/repo)',
    branchLabel: 'Branch',
    statusWrongKey: 'Falscher Hauptschlüssel oder beschädigte Vault-Dateien.',
    statusNoVault: 'Für diese Website existiert noch kein verschlüsselter Vault. Nutze „Mit leerem Vault beginnen".',
    statusLoaded: 'Vault geöffnet — die geschützten Daten können unten bearbeitet werden.',
    statusLoading: 'Wird geladen…',
    tabContact: 'Kontakt',
    tabStaff: 'Team',
    tabGallery: 'Galerie',
    phonesTitle: 'Telefonnummern',
    emailsTitle: 'E-Mail-Adressen',
    addPhone: '+ Telefonnummer',
    addEmail: '+ E-Mail-Adresse',
    addMember: '+ Teammitglied',
    addAlbum: '+ Album',
    addPhoto: '+ Foto hinzufügen',
    removeBtn: 'Entfernen',
    photoReplace: 'Foto ersetzen',
    photoDrop: 'Foto hierher ziehen oder klicken zum Auswählen',
    photoNone: 'Noch kein Foto — Bild hierher ziehen oder klicken.',
    memberName: 'Name',
    memberGroup: 'Gruppe',
    memberId: 'Kennung (Slug)',
    memberRole: 'Rolle',
    memberBio: 'Steckbrief',
    albumDate: 'Datum',
    albumTitle: 'Albumtitel',
    photoCaption: 'Bildunterschrift',
    copyFromHu: 'HU → EN/DE kopieren',
    langRequired: 'Ungarisch erforderlich; EN/DE optional',
    labelLabel: 'Bezeichnung',
    numberLabel: 'Telefonnummer',
    addressLabel: 'E-Mail-Adresse',
    tableFile: 'Datei',
    tableAction: 'Aktion',
    tableSize: 'Größe',
    actionSave: 'speichern (verschlüsselt)',
    actionDelete: 'aus dem Repo löschen',
    commitMsgLabel: 'Commit-Nachricht',
    commitMsgDefault: 'chore(vault): update protected data via browser vault manager',
    commitBtn: 'Verschlüsseln & auf GitHub committen',
    downloadBtn: 'Verschlüsselte Dateien herunterladen (ohne GitHub)',
    missingMediaWarning: 'Referenzierte Mediendatei existiert noch nicht — lade ein Foto hoch:',
    validateError: 'Fehlende oder ungültige Felder — siehe die roten Markierungen.',
    emailInvalid: 'Ungültige E-Mail-Adresse',
    ghReadingBranch: 'Branch wird gelesen…',
    ghUploadingBlobs: 'Verschlüsselte Dateien werden hochgeladen ({n}/{total})…',
    ghCreatingTree: 'Git-Tree wird erstellt…',
    ghCreatingCommit: 'Commit wird erstellt…',
    ghUpdatingBranch: 'Branch wird aktualisiert…',
    ghSuccess: 'Fertig! Alle Änderungen wurden in einem einzigen Commit gespeichert:',
    ghDeployNote: 'GitHub Pages stellt die Website innerhalb von 1–2 Minuten automatisch neu bereit.',
    downloadNote:
      'Kopiere die heruntergeladenen Dateien in die angegebenen Repository-Pfade, dann committen & pushen — die Website aktualisiert sich automatisch.',
    lockBtn: '🔒 Sperren & Speicher leeren',
    backToAdmin: 'CMS (Inhaltseditor)',
    backToSite: 'Website ansehen',
    confirmRemove: 'Diesen Eintrag wirklich entfernen?',
    emptyList: 'Noch keine Einträge — füge den ersten mit + hinzu.',
    errUnsupportedImage: 'Nicht unterstütztes Bildformat (JPG, PNG, WebP, GIF, AVIF oder SVG verwenden).',
    errNoRepo: 'Repository (owner/repo) und Token für den Commit angeben.',
    errNothingStaged: 'Es gibt nichts zu speichern.',
    processingImage: 'Bild wird verarbeitet (EXIF-freies WebP)…',
  },
};

let lang = 'hu';
function t(key) {
  return I18N[lang]?.[key] ?? I18N.hu[key] ?? key;
}

/* ============================================================================
 * 2. Application state — everything sensitive lives here, memory only.
 * ========================================================================== */
const state = {
  cryptoKey: null, // imported AES-GCM CryptoKey (memory only)
  keyIsDemo: false,
  repo: '',
  branch: 'main',
  pat: '', // GitHub fine-grained PAT (memory only)
  contact: null,
  staff: null,
  gallery: null,
  initial: { contact: null, staff: null, gallery: null }, // deep snapshots for dirty-check
  existingPaths: [], // media paths referenced at load time (deletion candidates)
  media: {}, // encPath -> { bytes: Uint8Array (already encrypted), previewUrl }
  activeTab: 'contact',
};

/* ============================================================================
 * 3. Small DOM helpers
 * ========================================================================== */
const $ = (sel) => document.querySelector(sel);

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function setStatus(message, kind) {
  const el = $('#status');
  if (!el) return;
  el.textContent = message || '';
  el.className = 'status' + (kind ? ' status-' + kind : '');
  el.removeAttribute('hidden');
}

function log(message, kind) {
  const logEl = $('#gh-log');
  if (!logEl) return;
  const line = document.createElement('div');
  line.className = 'log-line' + (kind ? ' log-' + kind : '');
  line.textContent = message;
  logEl.appendChild(line);
  logEl.removeAttribute('hidden');
  logEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function slugify(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '') // strip accents (ő -> o, ü -> u)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/** Deep clone that drops transient keys (underscore-prefixed) before serialization. */
function cleanForSerialize(value) {
  if (Array.isArray(value)) return value.map(cleanForSerialize);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (!k.startsWith('_')) out[k] = cleanForSerialize(v);
    }
    return out;
  }
  return value;
}

function bytesLabel(n) {
  if (n < 1024) return n + ' B';
  return (n / 1024).toFixed(1) + ' KB';
}

/** Multilingual field group (HU required first, EN/DE optional + copy helper). */
function mlInputs(obj, field, { rows = 1 } = {}) {
  const tag = rows > 1 ? 'textarea rows="' + rows + '"' : 'input type="text"';
  const langOrder = ['hu', 'en', 'de'];
  const flags = { hu: '🇭🇺', en: '🇬🇧', de: '🇩🇪' };
  return (
    `<div class="ml-field" data-ml-for="${esc(field)}">` +
    langOrder
      .map(
        (l) =>
          `<label class="ml-lang"><span class="flag-chip">${flags[l]}</span>` +
          (rows > 1
            ? `<textarea rows="${rows}" data-ml-lang="${l}" data-field="${esc(field)}">${esc(obj?.[field]?.[l] ?? '')}</textarea>`
            : `<input type="text" data-ml-lang="${l}" data-field="${esc(field)}" value="${esc(obj?.[field]?.[l] ?? '')}" />`) +
          `</label>`
      )
      .join('') +
    `<button type="button" class="btn-ghost btn-small" data-copy-hu title="${esc(t('copyFromHu'))}">⧉</button>` +
    `</div>`
  );
}

function renderMlValue(target, field, mlLang, value) {
  if (!target[field]) target[field] = {};
  if (!['hu', 'en', 'de'].includes(mlLang)) return;
  target[field][mlLang] = value;
  if (!Object.values(target[field]).some((v) => v)) delete target[field];
}

/* ============================================================================
 * 4. Deployment base (works for domain-root AND /<repo>/ subpath deploys)
 * ========================================================================== */
const BASE = location.pathname.replace(/\/admin\/vault\.html?$/, '') || '';

/* ============================================================================
 * 5. Unlock: fetch + decrypt the current vault into the editor state
 * ========================================================================== */
async function unlockVault({ empty = false } = {}) {
  const keyB64 = $('#master-key').value.trim();
  if (!keyB64) {
    setStatus(t('masterKeyLabel') + '?', 'error');
    return;
  }
  if (keyB64 === DEMO_MASTER_KEY_B64) {
    setStatus(t('demoKeyWarning'), 'warn');
    state.keyIsDemo = true;
  } else {
    state.keyIsDemo = false;
  }
  try {
    state.cryptoKey = await importAesKey(keyB64);
  } catch (err) {
    setStatus(err.message, 'error');
    return;
  }

  try {
    setStatus(t('statusLoading'));
    if (empty) {
      state.contact = { phones: [], emails: [] };
      state.staff = { members: [] };
      state.gallery = { albums: [] };
    } else {
      const [contact, staff, gallery] = await Promise.all(
        ['contact', 'staff', 'gallery'].map(async (name) => {
          const res = await fetch(`${BASE}/vault/${name}.enc.json`);
          if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status} for ${name}`), {
            httpStatus: res.status,
          });
          const envelope = await res.json();
          return decryptJson(envelope, state.cryptoKey);
        })
      );
      state.contact = contact;
      state.staff = staff;
      state.gallery = gallery;
    }
    state.initial = {
      contact: JSON.parse(JSON.stringify(state.contact)),
      staff: JSON.parse(JSON.stringify(state.staff)),
      gallery: JSON.parse(JSON.stringify(state.gallery)),
    };
    // Media referenced by the loaded manifests — candidates for orphan deletion.
    const referenced = [];
    for (const m of state.staff?.members ?? []) if (m.photoEncPath) referenced.push(m.photoEncPath);
    for (const album of state.gallery?.albums ?? []) {
      for (const p of album?.photos ?? []) if (p.encPath) referenced.push(p.encPath);
    }
    state.existingPaths = [...new Set(referenced)];
    state.media = {};

    $('#setup-panel').setAttribute('hidden', 'hidden');
    $('#editor-panel').removeAttribute('hidden');
    $('#commit-panel').removeAttribute('hidden');
    setStatus(t('statusLoaded'), 'ok');
    state.activeTab = 'contact';
    renderAll();
  } catch (err) {
    if (err.name === 'OperationError' || /HTTP 400/.test(err.message)) {
      setStatus(t('statusWrongKey'), 'error');
    } else if (err.httpStatus === 404) {
      setStatus(t('statusNoVault'), 'warn');
    } else {
      setStatus(err.message, 'error');
    }
    state.cryptoKey = null;
  }
}

/** Decrypt binary blobs referenced by the current state and cache object URLs. */
const previewCache = new Map();
async function ensurePreviews() {
  const jobs = [];
  for (const m of state.staff?.members ?? []) {
    if (m.photoEncPath && !previewCache.has(m.photoEncPath)) {
      jobs.push(decryptPreview(m.photoEncPath, m.mimeType));
    }
  }
  for (const album of state.gallery?.albums ?? []) {
    for (const p of album?.photos ?? []) {
      if (p.encPath && !previewCache.has(p.encPath)) {
        jobs.push(decryptPreview(p.encPath, p.mimeType));
      }
    }
  }
  await Promise.allSettled(jobs);
}

async function decryptPreview(encPath, mimeType) {
  try {
    const res = await fetch(BASE + encPath);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const bytes = new Uint8Array(await res.arrayBuffer());
    const raw = await decryptBinary(bytes, state.cryptoKey);
    const url = URL.createObjectURL(new Blob([raw], { type: mimeType || 'image/webp' }));
    previewCache.set(encPath, url);
    document.querySelectorAll(`img[data-enc-src="${CSS.escape(encPath)}"]`).forEach((img) => {
      img.src = url;
    });
  } catch (err) {
    /* preview is best-effort; editing still works without it */
  }
}

/* ============================================================================
 * 6. Editing UI — contact / staff / gallery
 * ========================================================================== */
function renderAll() {
  renderTabs();
  renderContact();
  renderStaff();
  renderGallery();
  renderCommit();
  applyI18n();
}

function renderTabs() {
  const tabs = [
    ['contact', t('tabContact')],
    ['staff', t('tabStaff')],
    ['gallery', t('tabGallery')],
  ];
  $('#tabs').innerHTML = tabs
    .map(
      ([id, label]) =>
        `<button type="button" class="tab-pill${state.activeTab === id ? ' active' : ''}" data-tab="${id}">${esc(label)}</button>`
    )
    .join('');
  $('#tabs').querySelectorAll('[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.activeTab = btn.dataset.tab;
      renderTabs();
      ['contact', 'staff', 'gallery'].forEach((id) => {
        $(`#tab-${id}`).hidden = state.activeTab !== id;
      });
      if (state.activeTab !== 'contact') ensurePreviews();
    });
  });
  ['contact', 'staff', 'gallery'].forEach((id) => {
    $(`#tab-${id}`).hidden = state.activeTab !== id;
  });
}

/* ---- Contact tab -------------------------------------------------------- */
function renderContact() {
  const box = $('#tab-contact');
  const phones = state.contact?.phones ?? [];
  const emails = state.contact?.emails ?? [];

  const row = (item, kind, idx, valueLabel, valueField) => `
    <div class="item-card" data-kind="${kind}" data-idx="${idx}">
      <div class="field-grid">
        <span class="field-label">${esc(t('labelLabel'))}</span>
        ${mlInputs(item, 'label')}
      </div>
      <div class="field-grid">
        <span class="field-label">${esc(valueLabel)}</span>
        <input type="text" data-field="${valueField}" value="${esc(item[valueField] ?? '')}" />
        <button type="button" class="btn-ghost btn-small" data-remove>${esc(t('removeBtn'))}</button>
      </div>
    </div>`;

  box.innerHTML = `
    <h3>${esc(t('phonesTitle'))}</h3>
    <div id="phones-list">${phones.map((p, i) => row(p, 'phone', i, t('numberLabel'), 'number')).join('') || emptyHint()}</div>
    <button type="button" class="btn-soft" data-add="phone">${esc(t('addPhone'))}</button>
    <h3>${esc(t('emailsTitle'))}</h3>
    <div id="emails-list">${emails.map((e, i) => row(e, 'email', i, t('addressLabel'), 'address')).join('') || emptyHint()}</div>
    <button type="button" class="btn-soft" data-add="email">${esc(t('addEmail'))}</button>`;

  box.querySelectorAll('[data-add]').forEach((btn) =>
    btn.addEventListener('click', () => {
      if (btn.dataset.add === 'phone') state.contact.phones.push({ label: {}, number: '' });
      else state.contact.emails.push({ label: {}, address: '' });
      renderContact();
      renderCommit();
    })
  );
  box.querySelectorAll('[data-remove]').forEach((btn) =>
    btn.addEventListener('click', () => {
      if (!window.confirm(t('confirmRemove'))) return;
      const card = btn.closest('.item-card');
      const list = card.parentElement.id === 'phones-list' ? state.contact.phones : state.contact.emails;
      list.splice(Number(card.dataset.idx), 1);
      renderContact();
      renderCommit();
    })
  );
  box.addEventListener('input', onEditInput, { passive: true });

  function emptyHint() {
    return `<p class="empty-hint">${esc(t('emptyList'))}</p>`;
  }
}

/* ---- Staff tab ----------------------------------------------------------- */
function renderStaff() {
  const box = $('#tab-staff');
  const members = state.staff?.members ?? [];

  box.innerHTML =
    members
      .map((m, i) => {
        const img = m.photoEncPath
          ? `<img data-enc-src="${esc(m.photoEncPath)}" alt="${esc(m.name ?? '')}" />`
          : `<span class="drop-hint">${esc(t('photoNone'))}</span>`;
        return `
    <div class="item-card" data-kind="member" data-idx="${i}">
      <div class="photo-slot dropzone" title="${esc(t('photoDrop'))}">${img}</div>
      <div class="member-fields">
        <div class="field-grid">
          <span class="field-label">${esc(t('memberName'))} *</span>
          <input type="text" data-field="name" value="${esc(m.name ?? '')}" />
          <label class="inline-label">${esc(t('memberGroup'))}
            <input type="text" data-field="group" value="${esc(m.group ?? '')}" /></label>
        </div>
        <div class="field-grid">
          <span class="field-label">${esc(t('memberId'))}</span>
          <input type="text" data-field="id" data-slugged="1" value="${esc(m.id ?? '')}" />
        </div>
        <div class="field-grid">
          <span class="field-label">${esc(t('memberRole'))}</span>
          ${mlInputs(m, 'role')}
        </div>
        <div class="field-grid">
          <span class="field-label">${esc(t('memberBio'))}</span>
          ${mlInputs(m, 'bio', { rows: 3 })}
        </div>
        <div class="field-grid btn-row">
          <button type="button" class="btn-soft btn-small" data-upload-photo>${esc(t('photoReplace'))}</button>
          <button type="button" class="btn-ghost btn-small" data-remove>${esc(t('removeBtn'))}</button>
        </div>
      </div>
    </div>`;
      })
      .join('') || `<p class="empty-hint">${esc(t('emptyList'))}</p>`;

  box.innerHTML += `<button type="button" class="btn-soft" data-add-member>${esc(t('addMember'))}</button>`;

  box.querySelectorAll('[data-add-member]').forEach((btn) =>
    btn.addEventListener('click', () => {
      state.staff.members.push({ id: '', name: '', group: '', role: {}, bio: {} });
      renderStaff();
      renderCommit();
    })
  );
  box.querySelectorAll('[data-remove]').forEach((btn) =>
    btn.addEventListener('click', () => {
      if (!window.confirm(t('confirmRemove'))) return;
      state.staff.members.splice(Number(btn.closest('.item-card').dataset.idx), 1);
      renderStaff();
      renderCommit();
    })
  );
  box.querySelectorAll('[data-upload-photo]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const card = btn.closest('.item-card');
      pickImage().then((file) => {
        if (file) handleMemberPhoto(file, Number(card.dataset.idx));
      });
    })
  );
  box.querySelectorAll('.photo-slot.dropzone').forEach((slot) => {
    wireDropzone(slot, (file) => handleMemberPhoto(file, Number(slot.closest('.item-card').dataset.idx)));
  });
  box.addEventListener('input', onEditInput, { passive: true });
}

async function handleMemberPhoto(file, memberIdx) {
  const member = state.staff.members[memberIdx];
  if (!member) return;
  if (!member.id) {
    member.id = slugify(member.name) || `pedagogus-${memberIdx + 1}`;
  }
  const encPath = `/vault-media/staff/${member.id}.enc`;
  await stageMediaFile(file, encPath, (previewUrl) => {
    member.photoEncPath = encPath;
    member._previewUrl = previewUrl;
    const slot = $(`#tab-staff .item-card[data-idx="${memberIdx}"] .photo-slot`);
    if (slot) slot.innerHTML = `<img src="${previewUrl}" alt="${esc(member.name)}" />`;
    renderCommit();
  });
}

/* ---- Gallery tab ---------------------------------------------------------- */
function renderGallery() {
  const box = $('#tab-gallery');
  const albums = state.gallery?.albums ?? [];

  box.innerHTML =
    albums
      .map((album, ai) => {
        const photos = album?.photos ?? [];
        return `
    <div class="item-card album" data-kind="album" data-idx="${ai}">
      <div class="album-head">
        <div class="field-grid">
          <span class="field-label">${esc(t('albumTitle'))} *</span>
          ${mlInputs(album, 'title')}
        </div>
        <label class="inline-label">${esc(t('albumDate'))} *
          <input type="date" data-field="date" value="${esc(album.date ?? '')}" /></label>
        <label class="inline-label">${esc(t('memberId'))}
          <input type="text" data-field="id" data-slugged="1" value="${esc(album.id ?? '')}" /></label>
        <button type="button" class="btn-ghost btn-small" data-remove>${esc(t('removeBtn'))}</button>
      </div>
      <div class="album-photos">
        ${photos
          .map(
            (p, pi) => `
        <div class="photo-card" data-kind="photo" data-idx="${pi}">
          <div class="photo-slot dropzone" title="${esc(t('photoDrop'))}">
            ${p.encPath ? `<img data-enc-src="${esc(p.encPath)}" alt="${esc(p.caption?.hu ?? '')}" />` : `<span class="drop-hint">${esc(t('photoNone'))}</span>`}
          </div>
          <div class="photo-fields">
            <span class="field-label">${esc(t('photoCaption'))}</span>
            ${mlInputs(p, 'caption')}
            <div class="btn-row">
              <button type="button" class="btn-soft btn-small" data-upload-photo>${esc(t('photoReplace'))}</button>
              <button type="button" class="btn-ghost btn-small" data-remove-photo>${esc(t('removeBtn'))}</button>
            </div>
          </div>
        </div>`
          )
          .join('')}
      </div>
      <div class="album-actions">
        <button type="button" class="btn-soft btn-small" data-add-photo>${esc(t('addPhoto'))}</button>
      </div>
    </div>`;
      })
      .join('') || `<p class="empty-hint">${esc(t('emptyList'))}</p>`;

  box.innerHTML += `<button type="button" class="btn-soft" data-add-album>${esc(t('addAlbum'))}</button>`;

  box.querySelectorAll('[data-add-album]').forEach((btn) =>
    btn.addEventListener('click', () => {
      state.gallery.albums.push({ id: '', date: '', title: {}, photos: [] });
      renderGallery();
      renderCommit();
    })
  );
  box.querySelectorAll('.item-card[data-kind="album"]').forEach((albumCard) => {
    const ai = Number(albumCard.dataset.idx);
    albumCard.querySelectorAll('[data-remove]').forEach((btn) =>
      btn.addEventListener('click', () => {
        if (!window.confirm(t('confirmRemove'))) return;
        state.gallery.albums.splice(ai, 1);
        renderGallery();
        renderCommit();
      })
    );
    albumCard.querySelectorAll('[data-add-photo]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        const file = await pickImage();
        if (file) handleAlbumPhoto(file, ai, null);
      })
    );
    albumCard.querySelectorAll('[data-remove-photo]').forEach((btn) =>
      btn.addEventListener('click', () => {
        if (!window.confirm(t('confirmRemove'))) return;
        state.gallery.albums[ai].photos.splice(Number(btn.closest('.photo-card').dataset.idx), 1);
        renderGallery();
        renderCommit();
      })
    );
    albumCard.querySelectorAll('[data-upload-photo]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        const pi = Number(btn.closest('.photo-card').dataset.idx);
        const file = await pickImage();
        if (file) handleAlbumPhoto(file, ai, pi);
      })
    );
    albumCard.querySelectorAll('.photo-slot.dropzone').forEach((slot) => {
      const photoCard = slot.closest('.photo-card');
      const pi = photoCard ? Number(photoCard.dataset.idx) : null;
      wireDropzone(slot, (file) => handleAlbumPhoto(file, ai, pi));
    });
    albumCard.addEventListener('input', onEditInput, { passive: true });
  });
  box.addEventListener('input', onEditInput, { passive: true });
}

async function handleAlbumPhoto(file, albumIdx, photoIdx) {
  const album = state.gallery.albums[albumIdx];
  if (!album) return;
  if (!album.id) album.id = slugify(album.title?.hu) || `album-${albumIdx + 1}`;

  // Re-upload keeps a deterministic path (same slot -> same file -> repo overwrite,
  // no orphaned encrypted blobs); new entries get a slugged, collision-free path.
  let encPath;
  if (photoIdx !== null && album.photos[photoIdx]?.encPath) {
    encPath = album.photos[photoIdx].encPath;
  } else {
    const base = slugify(file.name.replace(/\.[^.]+$/, '')) || 'kep';
    let candidate = `/vault-media/gallery/${album.id}-${base}.enc`;
    let n = 2;
    while (
      album.photos.some((p) => p.encPath === candidate) ||
      state.existingPaths.includes(candidate)
    ) {
      candidate = `/vault-media/gallery/${album.id}-${base}-${n++}.enc`;
    }
    encPath = candidate;
  }

  const isNew = photoIdx === null || !album.photos[photoIdx];
  if (isNew) album.photos.push({ caption: {} });
  const target = album.photos[photoIdx === null ? album.photos.length - 1 : photoIdx];

  await stageMediaFile(file, encPath, (previewUrl) => {
    target.encPath = encPath;
    target._previewUrl = previewUrl;
    renderGallery();
    renderCommit();
  });
}

/* ---- Shared edit-input delegation ---------------------------------------- */
function onEditInput(ev) {
  const input = ev.target;
  if (!input.dataset || (!input.dataset.field && !input.dataset.mlLang)) return;
  const card = input.closest('[data-kind]');
  if (!card) return;
  const kind = card.dataset.kind;
  const idx = Number(card.dataset.idx);

  let target = null;
  if (kind === 'phone') target = state.contact.phones[idx];
  else if (kind === 'email') target = state.contact.emails[idx];
  else if (kind === 'member') target = state.staff.members[idx];
  else if (kind === 'album') target = state.gallery.albums[idx];
  else if (kind === 'photo') target = state.gallery.albums[Number(card.closest('[data-kind="album"]').dataset.idx)].photos[idx];
  if (!target) return;

  if (input.dataset.mlLang) {
    renderMlValue(target, input.dataset.field, input.dataset.mlLang, input.value);
  } else {
    target[input.dataset.field] = input.value;
  }

  // Auto-slug: keep ids in sync with names/titles until the user edits them manually.
  if (input.dataset.field === 'name' && kind === 'member') {
    const idInput = card.querySelector('input[data-field="id"]');
    if (idInput && !idInput.dataset.touched) {
      const slug = slugify(input.value);
      idInput.value = slug;
      target.id = slug;
    }
  }
  if (input.dataset.field === 'id') {
    input.dataset.touched = '1';
    input.value = slugify(input.value);
    target.id = input.value;
  }

  renderCommit();
}

/** Wire a [copy HU -> EN/DE] button inside multilingual field groups. */
document.addEventListener('click', (ev) => {
  const btn = ev.target.closest('[data-copy-hu]');
  if (!btn) return;
  const field = btn.closest('.ml-field').dataset.mlFor;
  const card = btn.closest('[data-kind]');
  const kind = card.dataset.kind;
  const idx = Number(card.dataset.idx);
  let target = null;
  if (kind === 'phone') target = state.contact.phones[idx];
  else if (kind === 'email') target = state.contact.emails[idx];
  else if (kind === 'member') target = state.staff.members[idx];
  else if (kind === 'album') target = state.gallery.albums[idx];
  else if (kind === 'photo') target = state.gallery.albums[Number(card.closest('[data-kind="album"]').dataset.idx)].photos[idx];
  if (!target?.[field]) return;
  const hu = target[field].hu ?? '';
  if (!hu) return;
  if (!target[field].en) target[field].en = hu;
  if (!target[field].de) target[field].de = hu;
  kind === 'phone' || kind === 'email' ? renderContact() : kind === 'member' ? renderStaff() : renderGallery();
});

/* ============================================================================
 * 7. Image pipeline: EXIF/GPS strip via canvas + WebP re-encode + encrypt
 * ========================================================================== */
function pickImage() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp,image/gif,image/avif,image/svg+xml';
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}

function wireDropzone(slot, onFile) {
  slot.addEventListener('dragover', (ev) => {
    ev.preventDefault();
    slot.classList.add('drag-over');
  });
  slot.addEventListener('dragleave', () => slot.classList.remove('drag-over'));
  slot.addEventListener('drop', (ev) => {
    ev.preventDefault();
    slot.classList.remove('drag-over');
    const file = ev.dataTransfer?.files?.[0];
    if (file) onFile(file);
  });
  slot.addEventListener('click', () => {
    pickImage().then((file) => file && onFile(file));
  });
}

const MAX_IMAGE_DIMENSION = 1600; // long edge cap for gallery/staff photos

/**
 * Decode -> draw to <canvas> -> encode as WebP. Canvas re-encoding inherently
 * drops ALL metadata (EXIF, GPS, camera serials); SVG is kept byte-exact.
 */
async function processImageFile(file) {
  if (file.type === 'image/svg+xml') {
    const bytes = new Uint8Array(await file.arrayBuffer());
    return { bytes, mimeType: 'image/svg+xml' };
  }
  if (!/^image\/(jpeg|png|webp|gif|avif)$/.test(file.type)) {
    throw new Error(t('errUnsupportedImage'));
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.9));
  if (!blob) throw new Error(t('errUnsupportedImage'));
  return { bytes: new Uint8Array(await blob.arrayBuffer()), mimeType: 'image/webp' };
}

/** Process + AES-256-GCM encrypt an uploaded image and stage it for commit. */
async function stageMediaFile(file, encPath, onReady) {
  if (!state.cryptoKey) return;
  try {
    setStatus(t('processingImage'));
    const { bytes, mimeType } = await processImageFile(file);
    const encrypted = await encryptBinary(bytes, state.cryptoKey);
    const previewUrl = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
    state.media[encPath] = { bytes: encrypted, mimeType, previewUrl };
    setStatus(t('statusLoaded'), 'ok');
    onReady(previewUrl);
  } catch (err) {
    setStatus(err.message, 'error');
  }
}

/* ============================================================================
 * 8. Staging: which manifests / media / deletions will be committed?
 * ========================================================================== */
async function computeStaged() {
  const writes = [];
  const deletes = [];
  const warnings = [];

  for (const name of ['contact', 'staff', 'gallery']) {
    const current = cleanForSerialize(state[name]);
    if (JSON.stringify(current) !== JSON.stringify(state.initial[name])) {
      const envelope = await encryptJson(current, state.cryptoKey);
      writes.push({
        repoPath: `public/vault/${name}.enc.json`,
        kind: 'manifest',
        content: new TextEncoder().encode(JSON.stringify(envelope, null, 2)),
        displayName: `${name}.enc.json`,
      });
    }
  }

  const referenced = new Set();
  for (const m of state.staff?.members ?? []) if (m.photoEncPath) referenced.add(m.photoEncPath);
  for (const album of state.gallery?.albums ?? []) {
    for (const p of album?.photos ?? []) if (p.encPath) referenced.add(p.encPath);
  }

  // New/updated encrypted media (only entries still referenced by the final state).
  for (const [encPath, media] of Object.entries(state.media)) {
    if (!referenced.has(encPath)) continue; // uploaded then entry removed -> skip bytes
    writes.push({
      repoPath: 'public' + encPath,
      kind: 'media',
      content: media.bytes,
      displayName: encPath.split('/').pop(),
    });
  }

  // Orphaned encrypted blobs: referenced at load time, referenced no more.
  for (const encPath of state.existingPaths) {
    if (!referenced.has(encPath)) {
      deletes.push({ repoPath: 'public' + encPath, displayName: encPath.split('/').pop() });
    }
  }

  // Referenced but missing (typed manually / album photo without an upload).
  for (const encPath of referenced) {
    if (!state.existingPaths.includes(encPath) && !state.media[encPath]) {
      warnings.push(encPath);
    }
  }

  return { writes, deletes, warnings };
}

function renderCommit() {
  computeStaged().then(({ writes, deletes, warnings }) => {
    stagedCache = { writes, deletes, warnings };

    const warnBox = $('#commit-warnings');
    warnBox.innerHTML = warnings.length
      ? `<div class="warn-box">${esc(t('missingMediaWarning'))} <code>${warnings.map(esc).join('</code>, <code>')}</code></div>`
      : '';
    warnBox.hidden = warnings.length === 0;

    const rows = [
      ...writes.map((w) => ({ ...w, action: t('actionSave'), checked: true })),
      ...deletes.map((d) => ({ ...d, action: t('actionDelete'), checked: true })),
    ];
    const table = $('#staged-table');
    if (rows.length === 0) {
      table.innerHTML = `<tr><td colspan="3" class="empty-hint">${esc(t('errNothingStaged'))}</td></tr>`;
    } else {
      table.innerHTML = rows
        .map(
          (r, i) => `<tr>
            <td><label class="check-cell"><input type="checkbox" data-row="${i}" ${r.checked ? 'checked' : ''} /><code>${esc(r.repoPath)}</code></label></td>
            <td>${esc(r.action)}</td>
            <td>${r.content ? bytesLabel(r.content.length) : '—'}</td>
          </tr>`
        )
        .join('');
    }
    rowSelection = rows;
  });
}
let stagedCache = { writes: [], deletes: [], warnings: [] };
let rowSelection = [];

function selectedRows() {
  return rowSelection.filter((_, i) => {
    const cb = $(`#staged-table input[data-row="${i}"]`);
    return !cb || cb.checked;
  });
}

/** Light client-side validation before saving. */
function validateAll() {
  let ok = true;
  const bad = (cond, el) => {
    if (cond) el?.classList.add('invalid');
    else el?.classList.remove('invalid');
    if (cond) ok = false;
  };
  document.querySelectorAll('.invalid').forEach((el) => el.classList.remove('invalid'));

  for (const phone of state.contact?.phones ?? []) {
    if (!phone.number?.trim()) {
      const el = [...document.querySelectorAll('#tab-contact [data-field="number"]')].find(
        (i) => i.value.trim() === phone.number?.trim() && !phone.number?.trim()
      );
      bad(true, el);
    }
  }
  for (const email of state.contact?.emails ?? []) {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.address ?? '')) {
      const el = [...document.querySelectorAll('#tab-contact [data-field="address"]')].find(
        (i) => i.value === (email.address ?? '')
      );
      bad(true, el);
    }
  }
  for (const m of state.staff?.members ?? []) {
    if (!m.name?.trim()) ok = false;
  }
  for (const a of state.gallery?.albums ?? []) {
    if (!a.title?.hu?.trim() || !a.date) ok = false;
  }
  return ok;
}

/* ============================================================================
 * 9. Atomic single commit via the GitHub Git Data API
 * ========================================================================== */
async function ghFetch(url, options = {}) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...options.headers,
  };
  if (state.pat) headers.Authorization = 'Bearer ' + state.pat;
  const res = await fetch(url, { ...options, headers });
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const detail = body?.message ? ` — ${body.message}` : '';
    const hint =
      res.status === 401
        ? ' (bad token?)'
        : res.status === 403
          ? ' (token lacks Contents write permission or SSO authorization missing?)'
          : res.status === 404
            ? ' (wrong owner/repo?)'
            : '';
    throw new Error(`GitHub API ${res.status}${hint}${detail}`);
  }
  return body;
}

async function commitToGitHub(rows, message) {
  const api = 'https://api.github.com';
  const repo = state.repo.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '');

  log(t('ghReadingBranch'));
  const ref = await ghFetch(`${api}/repos/${repo}/git/ref/heads/${state.branch}`);
  const headSha = ref.object.sha;
  const headCommit = await ghFetch(`${api}/repos/${repo}/git/commits/${headSha}`);

  const writes = rows.filter((r) => r.content);
  const deletes = rows.filter((r) => !r.content);

  const tree = [];
  let done = 0;
  for (const write of writes) {
    const blob = await ghFetch(`${api}/repos/${repo}/git/blobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: bytesToB64(write.content), encoding: 'base64' }),
    });
    tree.push({ path: write.repoPath, mode: '100644', type: 'blob', sha: blob.sha });
    log(t('ghUploadingBlobs').replace('{n}', String(++done)).replace('{total}', String(writes.length)));
  }
  for (const del of deletes) {
    tree.push({ path: del.repoPath, mode: '100644', type: 'blob', sha: null });
  }

  log(t('ghCreatingTree'));
  const newTree = await ghFetch(`${api}/repos/${repo}/git/trees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base_tree: headCommit.tree.sha, tree }),
  });

  log(t('ghCreatingCommit'));
  const commit = await ghFetch(`${api}/repos/${repo}/git/commits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, tree: newTree.sha, parents: [headSha] }),
  });

  log(t('ghUpdatingBranch'));
  await ghFetch(`${api}/repos/${repo}/git/heads/${state.branch}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sha: commit.sha }),
  });

  return commit.html_url;
}

async function onCommitClick() {
  state.repo = $('#repo').value.trim();
  state.branch = $('#branch').value.trim() || 'main';
  state.pat = $('#gh-pat').value.trim();
  localStorage.setItem('oc-vault-repo', state.repo);
  localStorage.setItem('oc-vault-branch', state.branch);

  const rows = selectedRows();
  if (rows.length === 0) {
    setStatus(t('errNothingStaged'), 'warn');
    return;
  }
  if (!state.repo || !state.pat) {
    setStatus(t('errNoRepo'), 'error');
    return;
  }
  if (!validateAll()) {
    setStatus(t('validateError'), 'error');
    return;
  }

  const btn = $('#commit-btn');
  btn.setAttribute('disabled', 'disabled');
  $('#gh-log').innerHTML = '';
  try {
    const message = $('#commit-msg').value.trim() || t('commitMsgDefault');
    const url = await commitToGitHub(rows, message);
    log(t('ghSuccess') + ' ' + url, 'ok');
    if (url) window.open(url, '_blank', 'noopener');
    setStatus(t('ghSuccess'), 'ok');
    log(t('ghDeployNote'), 'ok');
  } catch (err) {
    log(err.message, 'error');
    setStatus(err.message, 'error');
  } finally {
    btn.removeAttribute('disabled');
  }
}

/* ============================================================================
 * 10. Manual fallback: download the encrypted files + a placement README
 * ========================================================================== */
function onDownloadClick() {
  const rows = selectedRows();
  if (rows.length === 0) {
    setStatus(t('errNothingStaged'), 'warn');
    return;
  }
  if (!validateAll()) {
    setStatus(t('validateError'), 'error');
    return;
  }
  const readme =
    'OpenCreche Vault Manager — manual file placement\n' +
    '='.repeat(56) + '\n\n' +
    'Copy each downloaded file to the matching path in your repository,\n' +
    'then commit & push. GitHub Pages redeploys automatically.\n\n' +
    rows.map((r) => `  ${r.displayName}  ->  ${r.repoPath}`).join('\n') +
    '\n';
  const files = [{ name: 'VAULT-README.txt', blob: new Blob([readme], { type: 'text/plain' }) }];
  for (const row of rows) {
    const type = row.kind === 'manifest' ? 'application/json' : 'application/octet-stream';
    files.push({ name: row.displayName, blob: new Blob([row.content], { type }) });
  }
  files.forEach((f, i) => {
    setTimeout(() => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(f.blob);
      a.download = f.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 30_000);
    }, i * 350);
  });
  setStatus(t('downloadNote'), 'ok');
}

/* ============================================================================
 * 11. Static page wiring — language, unlock, lock, hints
 * ========================================================================== */
function applyI18n() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll('.lang-pill').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });
  $('#commit-msg').placeholder = t('commitMsgDefault');
}

function setLang(newLang) {
  if (!I18N[newLang]) return;
  lang = newLang;
  localStorage.setItem('oc-vault-lang', lang);
  applyI18n();
  if (state.contact) renderAll();
}

function lockAndReset() {
  state.cryptoKey = null;
  state.pat = '';
  state.contact = state.staff = state.gallery = null;
  state.media = {};
  previewCache.forEach((url) => URL.revokeObjectURL(url));
  previewCache.clear();
  $('#master-key').value = '';
  $('#gh-pat').value = '';
  $('#editor-panel').setAttribute('hidden', 'hidden');
  $('#commit-panel').setAttribute('hidden', 'hidden');
  $('#setup-panel').removeAttribute('hidden');
  setStatus('', '');
  $('#status').setAttribute('hidden', 'hidden');
}

/** Prefill repo/branch from the Sveltia CMS config (public, same origin). */
async function loadConfigHints() {
  try {
    const res = await fetch(`${BASE}/admin/config.yml`);
    if (!res.ok) return;
    const text = await res.text();
    const repo = text.match(/^\s*repo:\s*([^\s#]+)/m)?.[1];
    const branch = text.match(/^\s*branch:\s*([^\s#]+)/m)?.[1];
    const defaultLocale = text.match(/default_locale:\s*([^\s#]+)/)?.[1];
    if (repo && !localStorage.getItem('oc-vault-repo')) $('#repo').value = repo;
    if (branch && !localStorage.getItem('oc-vault-branch')) $('#branch').value = branch;
    if (defaultLocale && I18N[defaultLocale] && !localStorage.getItem('oc-vault-lang')) {
      lang = defaultLocale;
    }
  } catch (err) {
    /* hints are optional */
  }
}

document.addEventListener('DOMContentLoaded', () => {
  lang = localStorage.getItem('oc-vault-lang') || lang;
  $('#repo').value = localStorage.getItem('oc-vault-repo') || '';
  $('#branch').value = localStorage.getItem('oc-vault-branch') || 'main';

  document.querySelectorAll('.lang-pill').forEach((btn) =>
    btn.addEventListener('click', () => setLang(btn.dataset.lang))
  );
  $('#load-btn').addEventListener('click', () => unlockVault());
  $('#empty-btn').addEventListener('click', () => unlockVault({ empty: true }));
  $('#lock-btn').addEventListener('click', lockAndReset);
  $('#commit-btn').addEventListener('click', onCommitClick);
  $('#download-btn').addEventListener('click', onDownloadClick);
  $('#generate-key-btn').addEventListener('click', () => {
    $('#master-key').value = generateMasterKeyB64();
    setStatus(t('keyGeneratedNote'), 'warn');
  });

  // Toggle key/token visibility on the eye buttons.
  document.querySelectorAll('[data-toggle-visibility]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.toggleVisibility);
      if (!input) return;
      input.type = input.type === 'password' ? 'text' : 'password';
    });
  });

  loadConfigHints().then(applyI18n);
});
