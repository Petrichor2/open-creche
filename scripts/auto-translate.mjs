#!/usr/bin/env node
/**
 * OpenCreche Automated AI Translation Script (`scripts/auto-translate.mjs`)
 *
 * Translates YAML and Markdown files from `i18n.defaultLocale` (e.g., "hu")
 * into all target locales configured in `config/site.yaml` (e.g., "en", "de").
 *
 * Primary Free Engine:
 *   - Google Gemini Free Tier (`GEMINI_API_KEY` secret)
 *
 * Fallback Engine:
 *   - Cloudflare Workers AI (`CF_ACCOUNT_ID` + `CF_AI_TOKEN` secrets)
 *
 * NOTE: The former GitHub Models inference API (`models.inference.ai.azure.com`,
 * later `models.github.ai`) was fully retired by GitHub on July 30, 2026, and is
 * therefore no longer supported as a provider.
 *
 * If no provider credentials are configured, the script logs an informational
 * message and exits successfully (exit code 0) so that CI builds never fail
 * solely because translations are unavailable.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

const siteConfigPath = path.resolve('config/site.yaml');
const siteConfig = YAML.parse(fs.readFileSync(siteConfigPath, 'utf-8'));

const i18nConfig = siteConfig.i18n || {};
const defaultLocale = i18nConfig.defaultLocale || 'hu';
const locales = (i18nConfig.locales || []).map((l) => l.code);
const targetLocales = locales.filter((code) => code !== defaultLocale);
const autoTranslateConfig = i18nConfig.autoTranslate || { enabled: true };

function computeHash(text) {
  return crypto.createHash('sha256').update(text, 'utf-8').digest('hex').slice(0, 16);
}

/**
 * Calls the configured free LLM provider (Gemini -> Cloudflare Workers AI).
 * Network or API errors are caught per provider and logged as warnings so a
 * single unreachable provider never crashes the translation run.
 */
async function callTranslationModel(systemPrompt, userContent) {
  // 1. Primary: Google Gemini Free Tier API
  if (process.env.GEMINI_API_KEY) {
    const model = autoTranslateConfig.model || 'gemini-2.5-flash';
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
    try {
      const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userContent }] }],
          generationConfig: { temperature: 0.2 },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return {
          text: data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '',
          provider: `gemini/${model}`,
        };
      }
      console.warn(`⚠️ Gemini returned ${response.status}. Trying fallback provider if available...`);
    } catch (err) {
      console.warn(`⚠️ Gemini request failed (${err.message}). Trying fallback provider if available...`);
    }
  }

  // 2. Fallback: Cloudflare Workers AI
  if (process.env.CF_ACCOUNT_ID && process.env.CF_AI_TOKEN) {
    const cfUrl = `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/ai/run/@cf/meta/llama-3.1-8b-instruct`;
    try {
      const response = await fetch(cfUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.CF_AI_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent },
          ],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return {
          text: data.result?.response?.trim() || '',
          provider: 'cloudflare-ai/llama-3.1-8b',
        };
      }
      console.warn(`⚠️ Cloudflare Workers AI returned ${response.status}.`);
    } catch (err) {
      console.warn(`⚠️ Cloudflare Workers AI request failed (${err.message}).`);
    }
  }

  return null;
}

function stripCodeFences(raw) {
  return raw
    .replace(/^```(?:yaml|markdown|md)?\s*\n/i, '')
    .replace(/\n```\s*$/i, '')
    .trim();
}

function splitMarkdownFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: content };
  return {
    frontmatter: YAML.parse(match[1]) || {},
    body: match[2] || '',
  };
}

function joinMarkdownFrontmatter(frontmatterObj, body) {
  const yamlStr = YAML.stringify(frontmatterObj).trim();
  return `---\n${yamlStr}\n---\n\n${body.trim()}\n`;
}

async function processCollectionFolder(collectionName) {
  const sourceDir = path.resolve('content', collectionName, defaultLocale);
  if (!fs.existsSync(sourceDir)) return 0;

  const files = fs.readdirSync(sourceDir).filter((f) => f.endsWith('.yaml') || f.endsWith('.md'));
  let translatedCount = 0;

  for (const file of files) {
    const sourcePath = path.join(sourceDir, file);
    const sourceRaw = fs.readFileSync(sourcePath, 'utf-8');
    const sourceHash = computeHash(sourceRaw);
    const isMarkdown = file.endsWith('.md');

    for (const targetLocale of targetLocales) {
      const targetDir = path.resolve('content', collectionName, targetLocale);
      fs.mkdirSync(targetDir, { recursive: true });
      const targetPath = path.join(targetDir, file);

      if (fs.existsSync(targetPath)) {
        const existingRaw = fs.readFileSync(targetPath, 'utf-8');
        const existingMeta = isMarkdown
          ? splitMarkdownFrontmatter(existingRaw).frontmatter?._translationMeta
          : YAML.parse(existingRaw)?._translationMeta;

        if (existingMeta?.manualOverride === true) {
          console.log(`🔒 Skipping ${collectionName}/${targetLocale}/${file} (manualOverride: true)`);
          continue;
        }
        if (existingMeta?.sourceHash === sourceHash) {
          // Up to date
          continue;
        }
        // If target file already exists in template without _translationMeta, stamp it if no AI token is set
        if (!existingMeta && !process.env.GEMINI_API_KEY && !process.env.CF_AI_TOKEN) {
          continue;
        }
      }

      if (!process.env.GEMINI_API_KEY && !process.env.CF_AI_TOKEN) {
        console.log(
          `ℹ️  No AI token in environment to translate ${collectionName}/${defaultLocale}/${file} -> ${targetLocale}.`
        );
        continue;
      }

      const systemPrompt = [
        `You are a professional translator for a nursery and kindergarten website.`,
        `Translate the provided ${isMarkdown ? 'Markdown document with YAML frontmatter' : 'YAML file'} from "${defaultLocale}" to "${targetLocale}".`,
        `Tone: ${autoTranslateConfig.tone || 'Warm, welcoming, natural early-childhood education terminology'}.`,
        `Rules:`,
        `1. Keep all YAML property keys, IDs, dates, times, numbers, hex colors, and icon names UNCHANGED.`,
        `2. Translate only human-readable text strings and Markdown body paragraphs.`,
        `3. Output ONLY the valid translated ${isMarkdown ? 'Markdown with --- YAML frontmatter ---' : 'YAML'} without wrapping code fences or commentary.`,
      ].join('\n');

      console.log(`🌐 Translating ${collectionName}/${defaultLocale}/${file} -> ${targetLocale}...`);
      const result = await callTranslationModel(systemPrompt, sourceRaw);
      if (!result || !result.text) {
        console.warn(`⚠️ Could not translate ${file} to ${targetLocale}.`);
        continue;
      }

      const cleaned = stripCodeFences(result.text);
      const metaBlock = {
        sourceLocale: defaultLocale,
        sourceHash,
        translatedAt: new Date().toISOString(),
        provider: result.provider,
        manualOverride: false,
      };

      if (isMarkdown) {
        const parsed = splitMarkdownFrontmatter(cleaned);
        parsed.frontmatter._translationMeta = metaBlock;
        fs.writeFileSync(targetPath, joinMarkdownFrontmatter(parsed.frontmatter, parsed.body), 'utf-8');
      } else {
        const parsed = YAML.parse(cleaned) || {};
        parsed._translationMeta = metaBlock;
        fs.writeFileSync(targetPath, YAML.stringify(parsed), 'utf-8');
      }

      translatedCount++;
      console.log(`✅ Saved ${collectionName}/${targetLocale}/${file}`);
    }
  }

  return translatedCount;
}

async function main() {
  if (!autoTranslateConfig.enabled) {
    console.log('ℹ️  i18n.autoTranslate.enabled is false in config/site.yaml. Skipping.');
    return;
  }

  console.log(`🌱 OpenCreche Auto-Translator (${defaultLocale} -> ${targetLocales.join(', ')})`);
  let total = 0;
  for (const col of ['pages', 'groups', 'news']) {
    total += await processCollectionFolder(col);
  }
  console.log(`✨ Auto-translation check complete. Updated ${total} file(s).`);
}

main().catch((err) => {
  console.error('❌ Auto-translation error:', err);
  process.exit(1);
});
