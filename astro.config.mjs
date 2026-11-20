import { defineConfig } from 'astro/config';
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

// Load site.yaml to configure Astro's site URL and i18n settings dynamically
const siteConfigPath = path.resolve('./config/site.yaml');
const siteConfigRaw = fs.existsSync(siteConfigPath)
  ? YAML.parse(fs.readFileSync(siteConfigPath, 'utf-8'))
  : null;

const siteUrl = siteConfigRaw?.site?.url || 'https://example.org';
const defaultLocale = siteConfigRaw?.i18n?.defaultLocale || 'hu';
const locales = siteConfigRaw?.i18n?.locales?.map((l) => l.code) || ['hu', 'en', 'de'];

// Derive the deployment base path from the site URL (e.g. "https://user.github.io/my-repo"
// -> "/my-repo"). Custom-domain deployments at the domain root resolve to "/" and need no prefix.
let base = '/';
try {
  const pathname = new URL(siteUrl).pathname.replace(/\/+$/, '');
  base = pathname || '/';
} catch {
  // Keep "/" if the configured site URL cannot be parsed.
}

export default defineConfig({
  site: siteUrl,
  base,
  output: 'static',
  i18n: {
    defaultLocale,
    locales,
    routing: {
      prefixDefaultLocale: true,
      redirectToDefaultLocale: false,
    },
  },
  build: {
    format: 'directory',
  },
});
