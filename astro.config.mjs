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

export default defineConfig({
  site: siteUrl,
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
