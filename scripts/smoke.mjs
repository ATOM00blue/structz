// End-to-end smoke test: runs the built CLI for every conversion direction,
// verifies round-trips, and confirms the playground HTML bundled its logic.
// Exits non-zero on any failure. Cross-platform (uses execFileSync, no shell).
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const cli = join(root, "dist", "cli.js");

let passed = 0;
let failed = 0;

function run(args, input) {
  return execFileSync(process.execPath, [cli, ...args], {
    input: input ?? "",
    encoding: "utf8",
  });
}

function check(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL ${name}: ${err.message}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed");
}

console.log("structz smoke test\n");

if (!existsSync(cli)) {
  console.error(`CLI not built at ${cli}. Run "npm run build" first.`);
  process.exit(1);
}

const obj = { name: "structz", version: 2, nested: { a: 1, list: [1, 2, 3] } };
const json = JSON.stringify(obj);

// --- Conversions out of JSON, and back, for object-capable formats ---
for (const to of ["yaml", "toml", "json"]) {
  check(`json -> ${to} -> json round-trips`, () => {
    const converted = run(["-f", "json", "-t", to], json);
    const back = run(["-f", to, "-t", "json"], converted);
    assert(
      JSON.stringify(JSON.parse(back)) === JSON.stringify(obj),
      `round-trip mismatch via ${to}: ${back}`,
    );
  });
}

// --- CSV tabular round-trip ---
check("json table -> csv -> json round-trips", () => {
  const table = JSON.stringify([
    { id: 1, name: "Ada" },
    { id: 2, name: "Linus" },
  ]);
  const csv = run(["-f", "json", "-t", "csv"], table);
  assert(csv.includes("id,name"), `csv missing header: ${csv}`);
  const back = run(["-f", "csv", "-t", "json"], csv);
  assert(JSON.parse(back).length === 2, `expected 2 rows, got: ${back}`);
});

// --- Auto-detection ---
check("auto-detects YAML input", () => {
  const out = run(["-t", "json"], "host: localhost\nport: 8080\n");
  assert(JSON.parse(out).port === 8080, `bad detect/parse: ${out}`);
});
check("auto-detects CSV input", () => {
  const out = run(["-t", "json"], "a,b\n1,2\n");
  assert(JSON.parse(out)[0].b === 2, `bad detect/parse: ${out}`);
});
check("auto-detects TOML input", () => {
  const out = run(["-t", "json"], 'key = "value"\n[tbl]\nn = 1\n');
  assert(JSON.parse(out).key === "value", `bad detect/parse: ${out}`);
});

// --- Query ---
check("query selects nested values", () => {
  const out = run(["query", "nested.list[*]"], json);
  assert(JSON.stringify(JSON.parse(out)) === "[1,2,3]", `bad query: ${out}`);
});

// --- Validate + minify ---
check("--validate reports valid input", () => {
  const out = run(["--validate"], "a: 1\n");
  assert(out.trim() === "valid YAML", `bad validate: ${out}`);
});
check("--minify produces single-line JSON", () => {
  const out = run(["-t", "json", "-m"], "a: 1\nb: 2\n");
  assert(out === '{"a":1,"b":2}', `bad minify: ${JSON.stringify(out)}`);
});

// --- Playground HTML self-containment ---
check("playground docs/index.html is built and self-contained", () => {
  const docs = join(root, "docs", "index.html");
  assert(existsSync(docs), "docs/index.html missing — run build:playground");
  const html = readFileSync(docs, "utf8");
  assert(!html.includes("__STRUCTZ_BUNDLE__"), "bundle placeholder not replaced");
  assert(html.includes("structz="), "bundled core not present");
  assert(
    !/<script[^>]+src=/.test(html),
    "playground must not load external scripts (offline requirement)",
  );
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
