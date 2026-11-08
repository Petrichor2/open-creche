import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { marked } from 'marked';

export interface SiteConfig {
  site: {
    url: string;
    type: 'creche' | 'kindergarten' | 'combined';
    title: Record<string, string>;
    tagline: Record<string, string>;
    heroSubtitle: Record<string, string>;
    location: {
      country: string;
      postalCode: string;
      city: string;
      address: Record<string, string>;
      coordinates: { lat: number; lng: number };
      openingHours: Record<string, string>;
    };
  };
  i18n: {
    defaultLocale: string;
    locales: Array<{ code: string; label: string; flag: string }>;
    fallbackToDefault: boolean;
  };
  theme: {
    palette: string;
    colors: Record<string, string>;
    dividerStyle: string;
  };
  features: Record<string, boolean>;
  security: {
    turnstileSiteKey: string;
    workerBaseUrl: string;
    demoMode?: boolean;
    protect: Record<string, boolean>;
  };
}

export function getSiteConfig(): SiteConfig {
  const filePath = path.resolve('config/site.yaml');
  return YAML.parse(fs.readFileSync(filePath, 'utf-8')) as SiteConfig;
}

export function getNavigationConfig(): { header: Array<{ id: string; href: string }> } {
  const filePath = path.resolve('config/navigation.yaml');
  return YAML.parse(fs.readFileSync(filePath, 'utf-8'));
}

export function getUiDictionary(locale: string, defaultLocale = 'hu'): Record<string, any> {
  const localePath = path.resolve(`content/i18n/${locale}.yaml`);
  const fallbackPath = path.resolve(`content/i18n/${defaultLocale}.yaml`);
  const target = fs.existsSync(localePath) ? localePath : fallbackPath;
  return YAML.parse(fs.readFileSync(target, 'utf-8'));
}

function parseMarkdownWithFrontmatter(raw: string) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, html: marked.parse(raw) as string };
  }
  return {
    frontmatter: YAML.parse(match[1]) || {},
    html: marked.parse(match[2]) as string,
  };
}

export function getAboutContent(locale: string, defaultLocale = 'hu') {
  const localePath = path.resolve(`content/pages/${locale}/about.md`);
  const fallbackPath = path.resolve(`content/pages/${defaultLocale}/about.md`);
  const target = fs.existsSync(localePath) ? localePath : fallbackPath;
  const raw = fs.readFileSync(target, 'utf-8');
  return parseMarkdownWithFrontmatter(raw);
}

export function getScheduleContent(locale: string, defaultLocale = 'hu') {
  const localePath = path.resolve(`content/pages/${locale}/schedule.yaml`);
  const fallbackPath = path.resolve(`content/pages/${defaultLocale}/schedule.yaml`);
  const target = fs.existsSync(localePath) ? localePath : fallbackPath;
  return YAML.parse(fs.readFileSync(target, 'utf-8'));
}

export function getGroupsContent(locale: string, defaultLocale = 'hu') {
  const localeDir = path.resolve(`content/groups/${locale}`);
  const fallbackDir = path.resolve(`content/groups/${defaultLocale}`);
  const targetDir = fs.existsSync(localeDir) ? localeDir : fallbackDir;

  if (!fs.existsSync(targetDir)) return [];

  const files = fs.readdirSync(targetDir).filter((f) => f.endsWith('.yaml'));
  const groups = files.map((file) =>
    YAML.parse(fs.readFileSync(path.join(targetDir, file), 'utf-8'))
  );
  return groups.sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
}

export function getNewsContent(locale: string, defaultLocale = 'hu') {
  const localeDir = path.resolve(`content/news/${locale}`);
  const fallbackDir = path.resolve(`content/news/${defaultLocale}`);
  const targetDir = fs.existsSync(localeDir) ? localeDir : fallbackDir;

  if (!fs.existsSync(targetDir)) return [];

  const files = fs.readdirSync(targetDir).filter((f) => f.endsWith('.md'));
  const items = files.map((file) => {
    const raw = fs.readFileSync(path.join(targetDir, file), 'utf-8');
    const { frontmatter, html } = parseMarkdownWithFrontmatter(raw);
    return {
      slug: file.replace(/\.md$/, ''),
      ...frontmatter,
      html,
    };
  });

  return items.sort((a: any, b: any) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return String(b.date || '').localeCompare(String(a.date || ''));
  });
}
