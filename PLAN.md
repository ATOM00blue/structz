# structz — Plan & Spec

> Convert and query between JSON, YAML, CSV, and TOML — from the CLI or a tiny in-browser playground.

## 1. Research summary

Competitors:

- **jq** — JSON-only powerhouse, hard-to-learn DSL, no YAML/TOML/CSV input.
- **yq** (mikefarah) — Go binary, jq-like syntax, many formats. Great but a binary install, jq syntax has a learning curve, comments dropped on some conversions.
- **dasel** — Go binary, broadest format coverage, unified dot-selector. Binary install, comments discarded on write.
- One-off web tools (json2yaml.com etc.) — single-direction, ad-heavy, no CLI.

**Gaps structz fills:**

1. **Zero-install via `npx structz`** — no binary download, no package manager dance. Pure npm.
2. **Auto-detect input format** so you rarely need flags.
3. **Any-to-any** among JSON / YAML / CSV / TOML in one command.
4. **A tiny, self-contained, offline web playground** (single `index.html`, all logic bundled in, no network) that does the *exact same* conversions client-side — deployable on GitHub Pages. None of the binary tools ship this.
5. **A friendly dot/bracket query syntax** (`a.b[0].c`, `users[*].name`) that is far easier than jq while covering the 90% case, plus pretty/minify/validate.
6. **A clean importable library API** (`convert`, `query`, `parseAuto`, `stringifyAs`) for programmatic use.

## 2. Libraries chosen

| Concern | Library | Why |
| --- | --- | --- |
| YAML | `yaml` (eemeli) | Modern, spec-compliant, Node + browser, ESM. |
| CSV | `papaparse` | Robust, battle-tested, isomorphic (Node + browser). |
| TOML | `smol-toml` | Fast, correct (TOML 1.1), pure JS, browser-friendly, has `parse` + `stringify`. |
| CLI | `commander` | Ergonomic, well-documented, ubiquitous. |
| JSON | built-in | `JSON.parse` / `JSON.stringify`. |

Build: `tsc` for the library/CLI; `esbuild` to bundle the same core into the single-file playground.
Tests: `vitest`.

## 3. CLI design

```
structz [input] [options]
structz convert [input] [options]   # alias of default
structz query <expr> [input] [options]
```

Reads from a file argument or **stdin**; writes to **stdout** or `-o <file>`.

Options:

- `-f, --from <fmt>` input format (`json|yaml|csv|toml|auto`, default `auto`)
- `-t, --to <fmt>` output format (`json|yaml|csv|toml`); inferred from `-o` extension when possible, else defaults to `json`
- `-q, --query <expr>` apply a query before output
- `-p, --pretty` pretty-print (default for JSON to a TTY)
- `-m, --minify` minify (JSON compact)
- `-i, --indent <n>` indent width (default 2)
- `-o, --output <file>` write to file (infers `--to` from extension)
- `--validate` parse only; exit 0 if valid, non-zero with a message if not
- `--no-color` disable colored errors
- `-v, --version`, `-h, --help`

Examples:

```bash
cat config.yaml | structz -t json
structz data.csv -t yaml
structz query 'users[0].email' data.json
echo '{"a":{"b":[1,2,3]}}' | structz -t toml
structz config.toml -t json --validate
```

Exit codes: `0` ok, `1` runtime/parse error, `2` usage error.

## 4. Query language (jq-lite)

Path expression over the parsed value:

- `.` root, `a.b.c` member access, `["weird key"]` bracketed keys.
- `[0]` index, `[-1]` negative index, `[1:3]` slice, `[*]` wildcard (maps over arrays / object values).
- Chaining: `users[*].name`, `matrix[*][0]`.
- Leading `.` optional: `a.b` == `.a.b`.

Returns the selected value, then serialized to `--to`. Wildcards yield arrays.

## 5. File layout

```
structz/
  src/
    formats/        json.ts yaml.ts csv.ts toml.ts
    core/
      detect.ts     # auto-detect input format
      convert.ts    # parseAuto / stringifyAs / convert
      query.ts      # jq-lite path engine
      errors.ts     # typed errors
    index.ts        # public library API
    cli.ts          # commander entry (bin)
  web/
    template.html   # playground shell (logic injected at build)
  scripts/
    build-playground.mjs   # esbuild bundle -> docs/index.html
    smoke.mjs              # end-to-end CLI + playground smoke test
  test/             # vitest specs (round-trip, query, detect, cli)
  docs/index.html   # built playground (served by GitHub Pages)
  dist/             # compiled JS (gitignored)
```

## 6. Milestones

1. Core formats + detect + convert + query + library API.
2. CLI wired to core; stdin/stdout; Windows-safe.
3. Playground template + esbuild bundling into `docs/index.html`.
4. Tests (round-trip, query, detect, CLI smoke) green.
5. CI (`ci.yml`) + Pages deploy (`pages.yml`).
6. Docs polished, publish public repo, set topics, verify.

## 7. Quality bar

Cross-platform (Windows + POSIX), strict TypeScript, real round-trip tests,
verified by running the built CLI and loading the playground, clean README.
