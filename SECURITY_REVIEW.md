# structz — Security & Quality Review

Date: 2026-05-22
Reviewer: autonomous application-security pass
Scope: full source tree (`src/`, `web/`, `scripts/`, `test/`), dependency tree, CI,
docs, and the built browser playground (`docs/index.html`).

This document records findings (Phase 1) and the disposition of each (Phase 2:
fixed / mitigated / intentionally not changed). Severity uses CVSS-style
qualitative bands. Line numbers refer to the source at review time.

---

## Summary

| ID | Severity | Title | Status |
| --- | --- | --- | --- |
| H-1 | High | Prototype-pollution gadget in parsed output (`__proto__`/`constructor`/`prototype` survive parsing and are returned to library consumers) | Fixed |
| H-2 | High | Query engine walks the prototype chain (`["__proto__"]` returns `Object.prototype`; `.constructor`/`.prototype` reachable) | Fixed |
| M-1 | Medium | YAML custom tags resolve to unexpected values and print warnings to stderr; no explicit safe-schema guarantee in code | Fixed |
| M-2 | Medium | Dev-only dependency CVEs (esbuild / vite / vitest) reported by `npm audit` (5 moderate) | Fixed |
| L-1 | Low | No upper bound on input size (memory DoS against the local process) | Documented (intentional) |
| L-2 | Low | CLI reads/writes arbitrary user-supplied paths | Not a vuln (documented) |
| I-1 | Info | YAML alias/anchor "billion laughs" bomb | Already mitigated by `yaml` lib |
| I-2 | Info | ReDoS in detect/query parsers | Not present (verified) |
| I-3 | Info | Playground DOM-XSS | Not present (verified) |

Net: 2 High and 2 Medium fixed; regression tests added; `npm audit` clean after
dependency bumps. The CLI runs locally on a trusting user's machine, but the
**library API and the browser playground accept untrusted documents**, which is
why the prototype-pollution and query-traversal findings are rated High.

---

## H-1 — Prototype pollution: dangerous keys survive parsing (High)

**Files:** `src/formats/json.ts:12`, `src/formats/yaml.ts:11`,
`src/formats/toml.ts:5`, `src/formats/csv.ts:24`, funnelled through
`src/core/convert.ts:35` (`parse`) and `:26` (`parseAuto`).

**Impact.** The underlying parsers (`JSON.parse`, `yaml`, `smol-toml`) do *not*
mutate `Object.prototype` directly — they assign `__proto__` as an **own data
property** via safe definition. That avoids self-pollution, but the parsed value
that structz returns from its **public library API** (`parse`, `parseAuto`,
`convert`, and the playground) still contains an own enumerable `__proto__`
(and/or `constructor` / `prototype`) key carrying attacker-controlled data.

The moment a downstream consumer copies/merges that object with ordinary
assignment, the runtime is polluted. Demonstrated:

```js
const obj = parseAuto('__proto__:\n  polluted: yes', 'yaml').value; // own __proto__ key
function naiveMerge(t, s){ for (const k of Object.keys(s)){ /* t[k]=... */ } }
naiveMerge({}, obj);
({}).polluted; // => "yes"   ← global Object.prototype polluted
```

Because structz is published as a library and the playground feeds parsed values
back through conversion, shipping objects with live `__proto__`/`constructor`/
`prototype` keys is a prototype-pollution gadget handed to every consumer.

**Fix.** Added `src/core/sanitize.ts`: a depth-bounded, cycle-safe deep walk that
rebuilds every plain object, dropping the dangerous keys `__proto__`,
`constructor`, and `prototype` and re-asserting `Object.prototype` as the
prototype. Every parser (`parseJson`, `parseYaml`, `parseToml`, `parseCsv`) now
returns sanitized output, so the dangerous keys never escape the parse boundary.
Regression test: `test/security.test.ts`.

---

## H-2 — Query engine walks the prototype chain (High)

**File:** `src/core/query.ts:182` (`getKey`).

**Impact.** `getKey` did `return (value as Record<string, unknown>)[name];`.
For an untrusted query expression, this exposes the prototype chain:

- `query(obj, '["__proto__"]')` returned **`Object.prototype` itself**
  (verified `=== Object.prototype`).
- `query(obj, '.constructor')` returned the `Object`/`Function` constructor.
- `query(obj, '["constructor"]["prototype"]')` reaches the prototype object.

This is both an information-disclosure surface (reaching built-ins) and a
pollution gadget if a consumer ever writes through a queried reference. The
brief explicitly calls out the "jq-lite query setting keys like `__proto__`/
`constructor`/`prototype`" — structz's query is read-only, but the *read* still
crossed the prototype boundary, which is the same root cause.

**Fix.** `getKey` now (a) refuses the dangerous key names
(`__proto__`/`constructor`/`prototype`) by returning `undefined`, and (b) only
returns **own** properties via `Object.prototype.hasOwnProperty`, so no query can
ever cross into the prototype chain. Regression test in `test/security.test.ts`
and additions to `test/query.test.ts`.

---

## M-1 — YAML safe schema not explicitly enforced (Medium)

**File:** `src/formats/yaml.ts:11` (`parseYaml`).

**Impact.** The `yaml` (eemeli) library does **not** execute code for custom tags
by default — it has no `!!js/function` / `!!python/...` constructors, unlike the
old `js-yaml` `load` foot-gun. Verified: such tags resolve to `null`/raw scalars
and the parse does not run code. **However**, the code relied on this implicitly,
emitted noisy `TAG_RESOLVE_FAILED` warnings to stderr, and a future option/dep
change could silently widen the schema.

**Fix.** `parseYaml` now passes explicit hardening options:
`schema: "core"` (the safe, code-free schema), `version: "1.2"`,
`logLevel: "silent"` (suppress the tag-resolution warnings), and a `maxAliasCount`
cap to keep the alias-bomb guard explicit. A regression test asserts that a
`!!js/function` document does **not** produce an executable/function value.

---

## M-2 — Dev-dependency CVEs (Medium, dev-only)

**Source:** `npm audit` reported 5 moderate advisories, all in the **dev**
toolchain and **not** shipped in the published package (`files` is `dist` +
docs only):

- `esbuild <= 0.24.2` — GHSA-67mh-4wv8-2f99 (dev server can be reached by any
  website). Dev-server only.
- `vite <= 6.4.1` — GHSA-4w7w-66w2-5vf9 (path traversal in optimized-deps `.map`).
  Transitive via vitest; dev-server only.
- `@vitest/mocker`, `vite-node`, `vitest` — transitive on the above.

None affect the runtime dependencies (`commander`, `papaparse`, `smol-toml`,
`yaml`), and structz does not run a Vite/esbuild dev server in production.

**Fix.** Bumped `vitest` to `^4` and `esbuild` to `^0.25` (the audited fixed
ranges) so `npm audit` is clean. Verified the build, playground bundle, and test
suite still pass on the new versions.

---

## L-1 — No input size limit (Low, intentional)

`getInput`/`readStdin` (`src/cli.ts:30–50`) and the library buffer the whole
document in memory. A multi-GB input can OOM the process. This is a denial of
service only against the user's own local process (CLI) or the user's own browser
tab (playground) — there is no shared/server surface. Matching the behavior of
`jq`, `yq`, `cat`, etc., we leave streaming as out of scope. **Documented, not
changed.**

## L-2 — CLI file paths (Low, not a vulnerability)

`getInput` (`readFileSync(file)`) and `runConvert` (`writeFileSync(opts.output)`)
use paths supplied directly by the invoking user on the command line. There is no
untrusted path source (no web server, no archive extraction), so this is normal,
intended CLI behavior — equivalent to `cat`/`cp`. **Not a vulnerability.**

---

## Verified-safe areas (no action needed)

- **I-1 YAML alias bomb.** A nested-anchor "billion laughs" document is rejected
  by the `yaml` library with *"Excessive alias count indicates a resource
  exhaustion attack."* The `maxAliasCount` option (M-1) makes the bound explicit.
- **I-2 ReDoS.** All regexes in `detect.ts` (`tomlAssign`, `tomlSection`,
  `looksYamlMapping`) and `query.ts` are anchored and contain no overlapping
  nested quantifiers. Stress inputs of 50k–100k chars complete in single-digit
  ms. CSV uses `papaparse` (a state-machine scanner, not regex). No catastrophic
  backtracking.
- **I-3 Playground DOM-XSS.** Every value rendered into the page uses
  `textContent` (`output`, `detected`, `outFmt`, `statusText`, `statusDetected`).
  There is **no** `innerHTML`/`outerHTML`/`insertAdjacentHTML`/`document.write`/
  `eval`/`new Function` anywhere in `src/`, `web/template.html`, or the built
  `docs/index.html`. The playground loads no external scripts (`smoke.mjs`
  asserts this) and runs fully offline. A `<script>`-laden payload is shown as
  literal text. Confirmed by source audit + grep over the built bundle.

---

## Quality notes

- **Tests:** added `test/security.test.ts` (prototype-pollution on parse,
  query prototype-traversal guard, YAML tag rejection) and extended
  `test/query.test.ts`. Existing round-trip / detect / CLI suites retained.
- **Lint:** `npm run lint` is `tsc --noEmit` under `strict`. No ESLint is
  configured; the strict compiler covers the type surface. Left as-is.
- **README accuracy:** verified — documented behavior (any-to-any conversion,
  query syntax, offline playground, library API) matches the implementation. The
  sanitization fix preserves all documented behavior (dangerous keys were never a
  documented feature).
- **Round-trip / encoding / cross-platform:** smoke test exercises every
  conversion direction and round-trips; CLI reads/writes UTF-8 and uses
  `execFileSync` (no shell) so it is Windows/POSIX safe.
