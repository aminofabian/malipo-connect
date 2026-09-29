#!/usr/bin/env node
/**
 * Guards the two copies of the integration guide against drift:
 *   - docs/INTEGRATION.md     (human-readable docs)
 *   - src/pages/guide.astro   (Malipo Connect at /guide)
 *
 * The prose and page chrome differ on purpose, so those are not compared.
 * Every code sample, though, must match in both places.
 *
 * Run with: npm run check:guide
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const mdPath = resolve(here, "../../docs/INTEGRATION.md");
const astroPath = resolve(here, "../src/pages/guide.astro");

const FENCE = /```[^\n]*\n([\s\S]*?)```/g;
const SNIPPET = /<pre class="snippet">([\s\S]*?)<\/pre>/g;

function nonEmptyLines(body) {
  return body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function markdownCode() {
  const src = readFileSync(mdPath, "utf8");
  const out = new Set();
  for (const match of src.matchAll(FENCE)) {
    for (const line of nonEmptyLines(match[1])) out.add(line);
  }
  return out;
}

function astroCode() {
  const src = readFileSync(astroPath, "utf8");
  const out = new Set();
  for (const match of src.matchAll(SNIPPET)) {
    let body = match[1];
    // Snippets are either bare text or a `{` template literal `}`.
    if (body.startsWith("{`")) body = body.slice(2);
    if (body.endsWith("`}")) body = body.slice(0, -2);
    // Undo JS string escaping so the sample matches the markdown source.
    body = body.replace(/\\\\/g, "\\").replace(/\\`/g, "`").replace(/\\\$\{/g, "${");
    for (const line of nonEmptyLines(body)) out.add(line);
  }
  return out;
}

const md = markdownCode();
const astro = astroCode();
const onlyMd = [...md].filter((line) => !astro.has(line));
const onlyAstro = [...astro].filter((line) => !md.has(line));

if (onlyMd.length || onlyAstro.length) {
  console.error("Integration guide drift — code samples no longer match.\n");
  if (onlyMd.length) {
    console.error("In docs/INTEGRATION.md but not src/pages/guide.astro:");
    for (const line of onlyMd) console.error("  - " + line);
    console.error("");
  }
  if (onlyAstro.length) {
    console.error("In src/pages/guide.astro but not docs/INTEGRATION.md:");
    for (const line of onlyAstro) console.error("  - " + line);
    console.error("");
  }
  console.error("Update both copies, then re-run `npm run check:guide`.");
  process.exit(1);
}

console.log(`Guide sync OK — ${md.size} code lines match across both copies.`);
