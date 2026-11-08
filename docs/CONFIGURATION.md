# Configuration & Content Schema

OpenCreche is designed to be configured primarily through human-readable **YAML** and **Markdown** files. This document specifies the exact structure and fields for every configuration file in the project.

---

## 1. Global Site Configuration (`config/site.yaml`)

This single file controls the institution's identity, enabled languages, visual theme, active sections, and Cloudflare integration endpoints.

```yaml
# config/site.yaml
site:
  # Public production URL (configured in Cloudflare DNS & GitHub Pages)
  url: "https://napsugar-ovi.example.hu"
  
  # Institution type: "creche" | "kindergarten" | "combined"
  type: "combined"

  # Localized institution names and taglines
  title:
    hu: "Napsugár Bölcsőde és Óvoda"
    en: "Sunshine Creche & Kindergarten"
    de: "Sonnenschein Kinderkrippe und Kindergarten"
  tagline:
    hu: "Szeretetteljes, biztonságos környezet a legkisebbeknek"
    en: "A loving, safe environment for the little ones"
    de: "Eine liebevolle, sichere Umgebung für die Kleinsten"

  # Public (non-sensitive) location info for SEO & map display
  location:
    country: "Hungary"
    postalCode: "1024"
    city: "Budapest"
    address:
      hu: "Kis Rókus utca 12."
      en: "12 Kis Rókus Street"
      de: "Kis Rókus Straße 12"
    coordinates:
      lat: 47.5105
      lng: 19.0265
    openingHours:
      hu: "Hétfő – Péntek: 07:00 – 17:00"
      en: "Monday – Friday: 07:00 – 17:00"
      de: "Montag – Freitag: 07:00 – 17:00"

i18n:
  defaultLocale: "hu"
  locales:
    - code: "hu"
      label: "Magyar"
      flag: "🇭🇺"
    - code: "en"
      label: "English"
      flag: "🇬🇧"
    - code: "de"
      label: "Deutsch"
      flag: "🇩🇪"
  fallbackToDefault: true
  autoTranslate:
    enabled: true
    # Primary provider: "github-models" (uses built-in GITHUB_TOKEN for free)
    # Fallback providers: "cloudflare-ai" | "gemini"
    provider: "github-models"
    model: "gpt-4o-mini"
    tone: "Warm, welcoming, natural early-childhood education terminology"
    collections:
      - "pages"
      - "groups"
      - "news"
      - "i18n"

theme:
  # Built-in craft palettes: "meadow" | "sunshine" | "forest" | "terracotta"
  palette: "sunshine"
  # Optional custom color overrides
  colors:
    background: "#FAF6F0"
    surface: "#F3ECE1"
    primary: "#D96B43"
    secondary: "#6B9080"
    accent: "#E6B84C"
    text: "#2C2523"
  # Decorative SVG divider style: "waves" | "hills" | "clouds" | "leaves"
  dividerStyle: "hills"

features:
  # Toggle major page sections on/off without touching code
  about: true
  dailySchedule: true
  groups: true
  newsAndEvents: true
  staffDirectory: true
  photoGallery: true
  contactForm: true

security:
  # Public Cloudflare Turnstile Site Key (safe to commit)
  turnstileSiteKey: "0x4AAAAAAABkMYinukE_example"
  # Cloudflare Worker base URL for Turnstile verification, vault key release & contact form
  workerBaseUrl: "https://api.napsugar-ovi.example.hu"
  # What requires Turnstile human verification before unlocking?
  protect:
    contactDetails: true   # Phone numbers, direct email addresses
    staffProfiles: true    # Staff names, roles, bios, and portrait photos
    galleryPhotos: true    # Photo albums and event images
    contactForm: true      # Direct message submission via Cloudflare Worker
```

---

## 2. Introduction & Pedagogy (`content/pages/{lang}/about.md`)

Markdown file with YAML frontmatter describing the nursery/kindergarten's mission, values, and environment.

```markdown
---
title: "Bemutatkozás és Nevelési Elveink"
subtitle: "Ahol a játék és a felfedezés kéz a kézben jár"
highlights:
  - icon: "leaf"
    title: "Természetközeli nevelés"
    description: "Saját, árnyékos kertünkben a gyerekek minden nap a szabadban játszanak."
  - icon: "heart"
    title: "Családias légkör"
    description: "Kis létszámú csoportok és állandó, gondoskodó kisgyermeknevelők."
  - icon: "apple"
    title: "Egészséges étkezés"
    description: "Napi négyszeri, helyi alapanyagokból készülő étkezés, ételallergiák figyelembevételével."
---

Intézményünk több mint 15 éve fogadja a 1–6 éves korú gyermekeket. Hiszünk abban, hogy minden gyermek egyedi, és a saját tempójában bontakoztatja ki képességeit...
```

---

## 3. Daily Schedule (`content/pages/{lang}/schedule.yaml`)

Defines the structured daily rhythm so parents know what a typical day looks like.

```yaml
# content/pages/hu/schedule.yaml
title: "Napirendünk"
description: "A kiszámítható, nyugodt napirend biztonságérzetet ad a gyermekeknek."
items:
  - time: "07:00 – 08:15"
    title: "Érkezés és szabad játék"
    description: "Gyermekek fogadása, reggeli beszélgetés, egyéni és kiscsoportos játék."
    category: "play"
  - time: "08:15 – 08:45"
    title: "Reggeli"
    description: "Kézmosás, közös, nyugodt reggelizés."
    category: "meal"
  - time: "08:45 – 10:00"
    title: "Kezdeményezések, alkotó tevékenységek"
    description: "Mondókázás, éneklés, kézműveskedés, mese."
    category: "activity"
  - time: "10:00 – 11:30"
    title: "Tízórai és udvari játék"
    description: "Gyümölcsfogyasztás, majd mozgás és szabad játék a kertben."
    category: "outdoor"
  - time: "11:45 – 12:30"
    title: "Ebéd"
    description: "Meleg, kétfogásos ebéd elfogyasztása."
    category: "meal"
  - time: "12:30 – 15:00"
    title: "Pihenés, mesehallgatás, alvás"
    description: "Elcsendesedés, mesélés, délutáni alvás."
    category: "rest"
  - time: "15:00 – 17:00"
    title: "Uzsonna és hazamenetel"
    description: "Uzsonna, majd szabad játék a szülők érkezéséig."
    category: "play"
```

---

## 4. Groups / Rooms (`content/groups/{lang}/{group-id}.yaml`)

Each group (e.g., *Katica csoport*, *Süni csoport*) has its own YAML file per language.

```yaml
# content/groups/hu/katica.yaml
id: "katica"
order: 1
name: "Katica Csoport"
type: "creche" # "creche" (bölcsőde) | "kindergarten" (óvoda)
ageRange: "1,5 – 3 éves korig"
capacity: 12
badgeColor: "#D96B43"
icon: "ladybug"
summary: "A legkisebbek biztonságos, puha fészke, ahol a beszoktatás egyéni tempóban történik."
details: |
  A Katica csoportban két szakképzett kisgyermeknevelő és egy dajka gondoskodik a gyermekekről.
  Kiemelt figyelmet fordítunk az érzelmi biztonságra, a mondókákra és a finommotorika fejlesztésére.
```

---

## 5. News & Event Calendar (`content/news/{lang}/{slug}.md`)

Supports both general announcements and calendar events (with start/end dates).

```markdown
---
title: "Tavaszi Nyílt Napok a Napsugárban"
date: "2026-04-10"
eventDate: "2026-04-24"
eventTime: "09:30 – 11:30"
category: "event" # "announcement" | "event" | "holiday" | "enrollment"
pinned: true
summary: "Szeretettel várjuk a leendő bölcsődések és óvodások szüleit tavaszi bemutatkozó délelőttünkre!"
---

A nyílt nap során a szülők és a gyermekek megismerkedhetnek a csoportszobákkal, az udvarral és a nevelőkkel...
```

### Auto-Translated Target File Metadata (`_translationMeta`)
When GitHub Actions automatically translates a file from the `defaultLocale` (`hu`) into target locales (`en`, `de`), it attaches a `_translationMeta` block to track synchronization and respect manual human edits:

```markdown
---
title: "Spring Open Days at Sunshine Kindergarten"
date: "2026-04-10"
eventDate: "2026-04-24"
eventTime: "09:30 – 11:30"
category: "event"
pinned: true
summary: "We warmly welcome parents of prospective creche and kindergarten children to our spring introductory morning!"
_translationMeta:
  sourceLocale: "hu"
  sourceHash: "e3b0c44298fc1c14"
  translatedAt: "2026-04-10T08:15:00Z"
  provider: "github-models/gpt-4o-mini"
  manualOverride: false # Set to true to lock this file from being overwritten by auto-translate
---

During the open day, parents and children can get acquainted with our group rooms, the garden, and our caregivers...
```

---

## 6. Privacy Vault Schemas (`.vault-raw/` -> Encrypted to `content/vault/*.enc.json`)

Because the GitHub repository is public, sensitive data is edited locally (or via the CMS browser encryption hook) in `.vault-raw/` and encrypted using **AES-256-GCM** before being committed as `content/vault/*.enc.json` and `public/vault-media/*.enc`.

### 6.1 Protected Contact Details (`.vault-raw/contact.yaml`)
```yaml
phones:
  - label:
      hu: "Központi iroda / Óvodavezető"
      en: "Main Office / Director"
      de: "Hauptbüro / Kindergartenleitung"
    number: "+36 1 234 5678"
  - label:
      hu: "Bölcsődei részleg (Katica csoport)"
      en: "Creche Department (Ladybug Group)"
      de: "Kinderkrippe (Marienkäfer-Gruppe)"
    number: "+36 30 987 6543"

emails:
  - label:
      hu: "Általános érdeklődés és beiratkozás"
      en: "General Inquiries & Enrollment"
      de: "Allgemeine Anfragen & Einschreibung"
    address: "iroda@napsugar-ovi.example.hu"
```

### 6.2 Protected Staff Directory (`.vault-raw/staff.yaml`)
```yaml
members:
  - id: "kovacs-anna"
    name: "Kovács Anna"
    group: "katica"
    photo: "staff/kovacs-anna.jpg" # Encrypted into public/vault-media/staff/kovacs-anna.enc
    role:
      hu: "Intézményvezető, Óvodapedagógus"
      en: "Director, Kindergarten Teacher"
      de: "Leiterin, Erzieherin"
    bio:
      hu: "20 éve dolgozom óvodapedagógusként, szívügyem a zenei nevelés és a mesepszichológia."
      en: "Working as an early childhood educator for 20 years, passionate about music and storytelling."
      de: "Seit 20 Jahren als Erzieherin tätig, mit Schwerpunkt Musikpädagogik und Märchen."
```

### 6.3 Protected Photo Gallery (`.vault-raw/gallery.yaml`)
```yaml
albums:
  - id: "2026-farsang"
    date: "2026-02-14"
    title:
      hu: "Farsangi Mulatság 2026"
      en: "Carnival Celebration 2026"
      de: "Faschingsfest 2026"
    description:
      hu: "Jelmezes felvonulás, fánkevés és közös tánc."
      en: "Costume parade, doughnuts, and dancing together."
      de: "Kostümumzug, Krapfen essen und gemeinsames Tanzen."
    photos:
      - file: "gallery/2026-farsang/01.jpg"
        caption:
          hu: "Kézműves álarcok készítése"
          en: "Making handmade masks"
          de: "Basteln von Masken"
      - file: "gallery/2026-farsang/02.jpg"
        caption:
          hu: "Tavaszi díszítés a csoportszobában"
          en: "Spring decorations in the group room"
          de: "Frühlingsdekoration im Gruppenraum"
```

---

## 7. UI Translation Dictionary (`content/i18n/{lang}.yaml`)

```yaml
# content/i18n/en.yaml
nav:
  about: "About Us"
  schedule: "Daily Routine"
  groups: "Our Groups"
  news: "News & Events"
  staff: "Our Team"
  gallery: "Gallery"
  contact: "Contact"

vault:
  protectedBadge: "Privacy Protected"
  unlockPrompt: "To protect our children and staff from automated data scraping, please complete the security check below to view this content."
  unlockButton: "Verify & Show Protected Content"
  unlocking: "Decrypting protected content..."
  error: "Verification failed. Please try again."

contactForm:
  title: "Send Us a Message"
  parentName: "Your Name"
  parentEmail: "Your Email Address"
  parentPhone: "Phone Number (Optional)"
  childAge: "Child's Age (Optional)"
  subject: "Subject"
  message: "Message"
  submit: "Send Message"
  success: "Thank you! Your message has been sent securely to our institution."
```
