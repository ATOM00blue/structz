// Bundles src/browser.ts into a single IIFE and inlines it into the
// playground HTML, producing docs/index.html — a fully self-contained,
// offline, zero-network single file ready for GitHub Pages.
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const result = await build({
  entryPoints: [join(root, "src", "browser.ts")],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2020",
  minify: true,
  write: false,
  legalComments: "none",
});

const bundle = result.outputFiles[0].text;

const template = readFileSync(join(root, "web", "template.html"), "utf8");
const placeholder = "/*__STRUCTZ_BUNDLE__*/";
if (!template.includes(placeholder)) {
  throw new Error(`placeholder ${placeholder} not found in web/template.html`);
}

const html = template.replace(placeholder, () => bundle);

const outDir = join(root, "docs");
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, "index.html");
writeFileSync(outFile, html);

// A .nojekyll file ensures GitHub Pages serves the file as-is.
writeFileSync(join(outDir, ".nojekyll"), "");

const kb = (Buffer.byteLength(html) / 1024).toFixed(1);
console.log(`playground built -> docs/index.html (${kb} KB, self-contained)`);
