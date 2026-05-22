# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
