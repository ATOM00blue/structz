# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Security

- **Prototype-pollution hardening.** All parsers (JSON, YAML, CSV, TOML) now
  sanitize their output through a depth-bounded, cycle-safe deep walk that strips
  `__proto__` / `constructor` / `prototype` keys, so attacker-controlled
  documents can no longer hand library consumers a prototype-pollution gadget.
- **Query engine prototype-chain guard.** Path queries now only read *own*
  properties and refuse the dangerous key names, so expressions like
  `["__proto__"]` or `.constructor` return `undefined` instead of leaking
  `Object.prototype` / built-in constructors.
- **Explicit safe YAML schema.** YAML parsing now pins the code-free `core`
  schema (YAML 1.2) with an explicit alias-count cap and silenced tag warnings,
  making the "no custom-tag code execution" guarantee explicit and stable.
- **Dependencies.** Bumped dev-only `vitest` (→ ^4) and `esbuild` (→ ^0.28, a
  single deduped copy) to clear 5 moderate `npm audit` advisories (esbuild/vite
  dev-server CVEs). No runtime dependencies were affected. `npm audit` now
  reports 0 vulnerabilities.

### Changed

- **CI.** vitest 4 / vite 8 require Node >= 20.19, so the vitest-based job now
  runs on Node 20 and 22. A separate Node 18 job builds the CLI/playground and
  runs the standalone smoke test, preserving the documented `engines >= 18`
  runtime contract.

### Added

- `SECURITY_REVIEW.md` documenting the audit and dispositions, plus a
  `test/security.test.ts` regression suite (prototype pollution on parse, query
  prototype-traversal guard, YAML tag rejection, alias-bomb guard).

## [0.1.0] - 2026-05-22

### Added

- **Any-to-any conversion** among JSON, YAML, CSV, and TOML.
- **Auto-detection** of the input format (`--from auto`, the default).
- **jq-lite query engine**: dot/bracket member access, array indices (incl.
  negative), slices, wildcards (`[*]` / `.*`) that fan out, and quoted keys.
- **CLI** (`structz`) with `convert` and `query` subcommands, stdin/stdout
  piping, file I/O with format inferred from the output extension, `--minify`,
  `--indent`, `--delimiter`, and `--validate`.
- **Library API**: `convert`, `parse`, `parseAuto`, `stringifyAs`, `query`,
  `parseQuery`, `detectFormat`, `formatFromExtension`, and typed errors.
- **Self-contained browser playground** (`docs/index.html`) that runs the same
  engine fully offline, deployable via GitHub Pages.
- Round-trip, detection, query, and CLI test suites (vitest) plus an end-to-end
  smoke test.
- CI workflow (lint, build, test, smoke across Node 18/20/22) and a GitHub Pages
  deploy workflow for the playground.

[Unreleased]: https://github.com/ATOM00blue/structz/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/ATOM00blue/structz/releases/tag/v0.1.0
