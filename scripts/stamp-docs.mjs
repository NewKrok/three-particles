#!/usr/bin/env node
/**
 * Cache-busting stamper for docs/ assets.
 *
 * Reads the version from package.json and appends ?v=<version> to local
 * asset references in HTML files and ES module imports in JS files.
 * This ensures GitHub Pages serves fresh content after each deploy.
 *
 * Run via: npm run build:docs (called automatically after build + copy).
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const examples = resolve(root, "examples");

const { version } = JSON.parse(
  readFileSync(resolve(root, "package.json"), "utf8")
);
const v = `v=${version}`;

/**
 * Replace local asset references, preserving any existing ?v= query string.
 */
function stamp(file, patterns) {
  if (!existsSync(file)) return;
  let content = readFileSync(file, "utf8");
  for (const [re, replacer] of patterns) {
    content = content.replace(re, replacer);
  }
  writeFileSync(file, content, "utf8");
}

// Strip any existing ?v=... before appending fresh one
const stripV = (ref) => ref.replace(/\?v=[^"')]*/, "");

// --- HTML files: stamp <script src="..."> ---
const examplesHtml = resolve(examples, "index.html");
stamp(examplesHtml, [
  [
    /src="([^"]+\.js)(\?v=[^"]*)?"/g,
    (_m, ref) => {
      if (ref.startsWith("http")) return `src="${ref}"`;
      return `src="${stripV(ref)}?${v}"`;
    },
  ],
]);

// --- JS files: stamp ES import paths for local modules ---
const mainJs = resolve(examples, "main.js");
stamp(mainJs, [
  [
    /from\s+"(\.\/[^"]+\.js)(\?v=[^"]*)?"/g,
    (_m, ref) => `from "${stripV(ref)}?${v}"`,
  ],
]);

console.log(`examples/ assets stamped with ?${v}`);
