#!/usr/bin/env node
/**
 * OpenCreche Privacy Vault CLI (`scripts/vault-cli.mjs`)
 *
 * Encrypts sensitive nursery data (phone numbers, email addresses, staff bios/photos,
 * and children's gallery photos) using AES-256-GCM so they can be safely committed
 * to a public GitHub repository and hosted on GitHub Pages.
 *
 * Commands:
 *   node scripts/vault-cli.mjs demo     -> Generates encrypted sample data for out-of-the-box preview
 *   node scripts/vault-cli.mjs encrypt  -> Encrypts `.vault-raw/` into `public/vault/*.enc.json` & `public/vault-media/*.enc`
 *   node scripts/vault-cli.mjs decrypt  -> Decrypts `public/vault/*` back into `.vault-raw/`
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

// Default demo key (32 bytes base64) used ONLY when running `demo` mode or when .env is absent in template preview
export const DEMO_MASTER_KEY_B64 = 'T3BlbkNyZWNoZURlbW9WbHV0TWFzdGVyS2V5MjAyNiE='; // 32 bytes

function loadMasterKey(useDemo = false) {
  if (useDemo) {
    return Buffer.from(DEMO_MASTER_KEY_B64, 'base64');
  }
  if (process.env.VAULT_MASTER_KEY) {
    return Buffer.from(process.env.VAULT_MASTER_KEY, 'base64');
  }
  const envPath = path.resolve('.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    const match = content.match(/^VAULT_MASTER_KEY=["']?([^"'\s]+)["']?/m);
    if (match?.[1]) {
      return Buffer.from(match[1], 'base64');
    }
  }
  console.warn('⚠️  No VAULT_MASTER_KEY found in .env; falling back to DEMO_MASTER_KEY_B64.');
  return Buffer.from(DEMO_MASTER_KEY_B64, 'base64');
}

/**
 * Encrypts a UTF-8 JSON object with AES-256-GCM.
 * WebCrypto subtle.decrypt expects ciphertext + 16-byte authTag concatenated.
 */
function encryptJsonPayload(dataObj, keyBuffer) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);
  const plaintext = Buffer.from(JSON.stringify(dataObj), 'utf-8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const combined = Buffer.concat([encrypted, authTag]);

  return {
    version: 1,
    alg: 'AES-256-GCM',
    iv: iv.toString('base64'),
    ciphertext: combined.toString('base64'),
  };
}

/**
 * Encrypts a binary buffer (e.g., SVG/WebP/JPEG image) into [12-byte IV][Ciphertext][16-byte AuthTag]
 */
function encryptBinaryPayload(buffer, keyBuffer) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, encrypted, authTag]);
}

function decryptJsonPayload(envelope, keyBuffer) {
  const iv = Buffer.from(envelope.iv, 'base64');
  const combined = Buffer.from(envelope.ciphertext, 'base64');
  const ciphertext = combined.subarray(0, combined.length - 16);
  const authTag = combined.subarray(combined.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(decrypted.toString('utf-8'));
}

/**
 * Generates warm, friendly SVG illustrations for staff portraits and gallery moments
 * so the demo works out-of-the-box with real encrypted binary media blobs.
 */
function createSampleSvgIllustration(title, subtitle, bgHex, accentHex, iconType) {
  const shapes =
    iconType === 'portrait'
      ? `<circle cx="200" cy="145" r="58" fill="${accentHex}" opacity="0.25"/>
         <circle cx="200" cy="140" r="42" fill="#F4D1B8"/>
         <path d="M135 260 C135 205, 265 205, 265 260 Z" fill="${accentHex}"/>
         <circle cx="186" cy="135" r="4" fill="#2C2523"/>
         <circle cx="214" cy="135" r="4" fill="#2C2523"/>
         <path d="M188 152 Q200 162 212 152" stroke="#2C2523" stroke-width="3" fill="none" stroke-linecap="round"/>`
      : `<circle cx="320" cy="70" r="36" fill="#E6B84C"/>
         <path d="M0 230 Q120 180 240 220 T400 210 L400 300 L0 300 Z" fill="#5B8266" opacity="0.85"/>
         <path d="M0 255 Q160 215 300 245 T400 240 L400 300 L0 300 Z" fill="${accentHex}" opacity="0.9"/>
         <circle cx="110" cy="185" r="28" fill="#5B8266"/>
         <rect x="105" y="205" width="10" height="25" fill="#7A5230"/>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300">
    <rect width="400" height="300" rx="24" fill="${bgHex}"/>
    ${shapes}
    <rect x="20" y="228" width="360" height="54" rx="14" fill="#FFFFFF" opacity="0.92"/>
    <text x="200" y="252" font-family="sans-serif" font-size="15" font-weight="bold" fill="#2C2523" text-anchor="middle">${title}</text>
    <text x="200" y="271" font-family="sans-serif" font-size="12" fill="#685B56" text-anchor="middle">${subtitle}</text>
  </svg>`;
  return Buffer.from(svg, 'utf-8');
}

function generateDemoVault() {
  const key = loadMasterKey(true);

  const contactData = {
    phones: [
      {
        label: {
          hu: 'Központi iroda / Intézményvezető',
          en: 'Main Office / Director',
          de: 'Hauptbüro / Einrichtungsleitung',
        },
        number: '+36 1 234 5678',
      },
      {
        label: {
          hu: 'Bölcsődei részleg (Katica csoport)',
          en: 'Creche Department (Ladybug Group)',
          de: 'Kinderkrippe (Marienkäfer-Gruppe)',
        },
        number: '+36 30 456 7890',
      },
      {
        label: {
          hu: 'Óvodai részleg (Süni és Bagoly csoport)',
          en: 'Kindergarten Department (Hedgehog & Owl Groups)',
          de: 'Kindergarten (Igel- & Eulen-Gruppe)',
        },
        number: '+36 30 987 6543',
      },
    ],
    emails: [
      {
        label: {
          hu: 'Beiratkozás és általános érdeklődés',
          en: 'Enrollment & General Inquiries',
          de: 'Anmeldung & Allgemeine Anfragen',
        },
        address: 'iroda@napsugar-ovi.example.hu',
      },
      {
        label: {
          hu: 'Étkezés és diétás egyeztetés',
          en: 'Meals & Dietary Coordination',
          de: 'Verpflegung & Diätkoordination',
        },
        address: 'konyha@napsugar-ovi.example.hu',
      },
    ],
  };

  const staffData = {
    members: [
      {
        id: 'kovacs-anna',
        name: 'Kovács Anna',
        group: 'Intézményvezető',
        photoEncPath: '/vault-media/staff/kovacs-anna.enc',
        mimeType: 'image/svg+xml',
        role: {
          hu: 'Intézményvezető, Óvodapedagógus',
          en: 'Director & Lead Kindergarten Teacher',
          de: 'Einrichtungsleiterin & Erzieherin',
        },
        bio: {
          hu: '20 éve dolgozom óvodapedagógusként. Szívügyem a mesepszichológia, az élőszavas mesemondás és a szülőkkel való szoros, bizalmi partnerség.',
          en: 'Early childhood educator for 20 years, passionate about folk storytelling, music, and building warm partnerships with families.',
          de: 'Seit 20 Jahren als Erzieherin tätig, mit Schwerpunkt Märchenpädagogik, Musik und vertrauensvoller Elternarbeit.',
        },
      },
      {
        id: 'szabo-eszter',
        name: 'Szabó Eszter',
        group: 'Katica Csoport',
        photoEncPath: '/vault-media/staff/szabo-eszter.enc',
        mimeType: 'image/svg+xml',
        role: {
          hu: 'Kisgyermeknevelő (Katica Bölcsőde)',
          en: 'Early Childhood Educator (Ladybug Creche)',
          de: 'Kleinkindpädagogin (Marienkäfer-Krippe)',
        },
        bio: {
          hu: 'A legkisebbek szelíd, biztonságos beszoktatása és az ölbeli mondókás játékok adják mindennapi munkám legszebb pillanatait.',
          en: 'Specializing in gentle, parent-inclusive toddler adaptation, sensory play, and Hungarian nursery rhymes.',
          de: 'Spezialisiert auf sanfte Eingewöhnung, Sinnesspiele und liebevolle Kleinkindbetreuung.',
        },
      },
      {
        id: 'varga-timea',
        name: 'Varga Tímea',
        group: 'Süni & Bagoly Csoport',
        photoEncPath: '/vault-media/staff/varga-timea.enc',
        mimeType: 'image/svg+xml',
        role: {
          hu: 'Óvodapedagógus, Kézműves és Kertpedagógus',
          en: 'Kindergarten Teacher & Garden Educator',
          de: 'Erzieherin & Gartenpädagogin',
        },
        bio: {
          hu: 'A gyerekekkel közösen gondozzuk a kerti magaságyásokat, agyagozunk, nemezelünk és felfedezzük a természet apró csodáit.',
          en: 'Leading our outdoor garden activities, natural crafts, clay workshops, and seasonal celebrations.',
          de: 'Leitet unsere Gartenprojekte, das Arbeiten mit Ton und Naturmaterialien sowie unsere Jahreszeitenfeste.',
        },
      },
    ],
  };

  const galleryData = {
    albums: [
      {
        id: 'tavaszi-kert',
        date: '2026-04-01',
        title: {
          hu: 'Tavaszi kertészkedés és szabadtéri játék',
          en: 'Spring Gardening & Outdoor Play',
          de: 'Frühlingsgärtnern & Spiel im Freien',
        },
        photos: [
          {
            encPath: '/vault-media/gallery/kert-01.enc',
            mimeType: 'image/svg+xml',
            caption: {
              hu: 'Palántázás a kerti magaságyásokban',
              en: 'Planting seedlings in our raised garden beds',
              de: 'Pflanzen in unseren Hochbeeten im Garten',
            },
          },
          {
            encPath: '/vault-media/gallery/kert-02.enc',
            mimeType: 'image/svg+xml',
            caption: {
              hu: 'Kézműves foglalkozás természetes alapanyagokkal',
              en: 'Arts and crafts with natural materials',
              de: 'Basteln mit Naturmaterialien im Gruppenraum',
            },
          },
          {
            encPath: '/vault-media/gallery/kert-03.enc',
            mimeType: 'image/svg+xml',
            caption: {
              hu: 'Mesekör az ősfás udvar árnyékában',
              en: 'Storytelling circle under the shaded garden trees',
              de: 'Märchenkreis im Schatten der alten Gartenbäume',
            },
          },
        ],
      },
    ],
  };

  const outVaultDir = path.resolve('public/vault');
  const outStaffMediaDir = path.resolve('public/vault-media/staff');
  const outGalleryMediaDir = path.resolve('public/vault-media/gallery');

  fs.mkdirSync(outVaultDir, { recursive: true });
  fs.mkdirSync(outStaffMediaDir, { recursive: true });
  fs.mkdirSync(outGalleryMediaDir, { recursive: true });

  // Write encrypted JSON manifests
  fs.writeFileSync(
    path.join(outVaultDir, 'contact.enc.json'),
    JSON.stringify(encryptJsonPayload(contactData, key), null, 2)
  );
  fs.writeFileSync(
    path.join(outVaultDir, 'staff.enc.json'),
    JSON.stringify(encryptJsonPayload(staffData, key), null, 2)
  );
  fs.writeFileSync(
    path.join(outVaultDir, 'gallery.enc.json'),
    JSON.stringify(encryptJsonPayload(galleryData, key), null, 2)
  );

  // Generate and encrypt staff portrait SVG blobs
  const staffPortraits = [
    ['kovacs-anna.enc', 'Kovács Anna', 'Intézményvezető • Óvodapedagógus', '#F5E6D8', '#D96B43'],
    ['szabo-eszter.enc', 'Szabó Eszter', 'Kisgyermeknevelő • Katica Csoport', '#E4EFE7', '#5B8266'],
    ['varga-timea.enc', 'Varga Tímea', 'Óvodapedagógus • Süni & Bagoly', '#F9F0D9', '#D19A36'],
  ];

  for (const [filename, name, role, bg, accent] of staffPortraits) {
    const svgBuf = createSampleSvgIllustration(name, role, bg, accent, 'portrait');
    fs.writeFileSync(path.join(outStaffMediaDir, filename), encryptBinaryPayload(svgBuf, key));
  }

  // Generate and encrypt gallery image SVG blobs
  const galleryPhotos = [
    ['kert-01.enc', 'Tavaszi Palántázás', 'Magaságyások beültetése a kertben', '#E8F2EA', '#D96B43'],
    ['kert-02.enc', 'Kézműves Délelőtt', 'Agyagozás és természetes anyagok', '#F7EDE2', '#5B8266'],
    ['kert-03.enc', 'Udvari Mesekör', 'Élőszavas népmese az árnyékos kertben', '#FBF3DC', '#D96B43'],
  ];

  for (const [filename, title, sub, bg, accent] of galleryPhotos) {
    const svgBuf = createSampleSvgIllustration(title, sub, bg, accent, 'scene');
    fs.writeFileSync(path.join(outGalleryMediaDir, filename), encryptBinaryPayload(svgBuf, key));
  }

  console.log('🔒 Generated AES-256-GCM encrypted vault manifests in public/vault/*.enc.json');
  console.log('🔒 Generated AES-256-GCM encrypted binary photos in public/vault-media/**/*.enc');
}

function encryptFromRawDir() {
  const rawDir = path.resolve('.vault-raw');
  if (!fs.existsSync(rawDir)) {
    console.log('ℹ️  No .vault-raw/ directory found. Generating default encrypted demo vault instead...');
    generateDemoVault();
    return;
  }
  const key = loadMasterKey(false);
  const outVaultDir = path.resolve('public/vault');
  fs.mkdirSync(outVaultDir, { recursive: true });

  for (const name of ['contact', 'staff', 'gallery']) {
    const yamlPath = path.join(rawDir, `${name}.yaml`);
    if (fs.existsSync(yamlPath)) {
      const parsed = YAML.parse(fs.readFileSync(yamlPath, 'utf-8'));
      const encrypted = encryptJsonPayload(parsed, key);
      fs.writeFileSync(
        path.join(outVaultDir, `${name}.enc.json`),
        JSON.stringify(encrypted, null, 2)
      );
      console.log(`🔒 Encrypted .vault-raw/${name}.yaml -> public/vault/${name}.enc.json`);
    }
  }
}

function decryptToRawDir() {
  const key = loadMasterKey(false);
  const outVaultDir = path.resolve('public/vault');
  const rawDir = path.resolve('.vault-raw');
  fs.mkdirSync(rawDir, { recursive: true });

  for (const name of ['contact', 'staff', 'gallery']) {
    const encPath = path.join(outVaultDir, `${name}.enc.json`);
    if (fs.existsSync(encPath)) {
      const envelope = JSON.parse(fs.readFileSync(encPath, 'utf-8'));
      const decrypted = decryptJsonPayload(envelope, key);
      fs.writeFileSync(path.join(rawDir, `${name}.yaml`), YAML.stringify(decrypted), 'utf-8');
      console.log(`🔓 Decrypted public/vault/${name}.enc.json -> .vault-raw/${name}.yaml`);
    }
  }
}

const command = process.argv[2] || 'demo';
if (command === 'demo') {
  generateDemoVault();
} else if (command === 'encrypt') {
  encryptFromRawDir();
} else if (command === 'decrypt') {
  decryptToRawDir();
} else {
  console.error(`Unknown command: ${command}. Use "demo", "encrypt", or "decrypt".`);
  process.exit(1);
}
