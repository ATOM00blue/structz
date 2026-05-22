# Contributing to structz

Thanks for your interest in improving structz! This project aims to be a small,
focused, well-tested tool. Contributions of all sizes are welcome.

## Development setup

```bash
git clone https://github.com/ATOM00blue/structz
cd structz
npm install
```

Requires **Node.js 18+**.

## Common tasks

| Command | What it does |
| --- | --- |
| `npm run build` | Compile TypeScript (`src/`) to JS (`dist/`) |
| `npm run build:playground` | Bundle the browser playground to `docs/index.html` |
| `npm run build:all` | Both of the above |
| `npm run dev` | Compile in watch mode |
| `npm test` | Run the vitest suite |
| `npm run test:watch` | Run tests in watch mode |
| `npm run smoke` | End-to-end smoke test of the built CLI + playground |
| `npm run lint` | Type-check without emitting |

## Project layout

```
src/
  formats/   json.ts yaml.ts csv.ts toml.ts   # per-format parse/stringify
  core/
    detect.ts    # auto-detection
    convert.ts   # parseAuto / stringifyAs / convert
    query.ts     # jq-lite path engine
    errors.ts    # typed errors + Format types
  index.ts       # public library API
  cli.ts         # commander CLI (the `structz` bin)
  browser.ts     # browser entry, bundled into the playground
web/template.html  # playground shell (logic injected at build)
scripts/           # build-playground.mjs, smoke.mjs
test/              # vitest specs
docs/index.html    # built playground (served by GitHub Pages)
```

## Guidelines

- **Stay in scope.** structz converts and queries JSON/YAML/CSV/TOML. New
  formats or query features should fit that mission and keep the tool small.
- **Add tests.** Conversions should round-trip; new query features need cases in
  `test/query.test.ts`. Run `npm test` and `npm run smoke` before opening a PR.
- **TypeScript is strict.** Keep `npm run lint` clean (no unused vars, no `any`
  where a real type fits).
- **Cross-platform.** Code must work on Windows, macOS, and Linux. Avoid
  shell-isms; the smoke test uses `execFileSync` without a shell on purpose.
- **Keep the playground offline.** It must remain a single self-contained file
  with no external script/style/network requests.

## Submitting changes

1. Fork and create a branch.
2. Make your change with tests.
3. `npm run build:all && npm test && npm run smoke` — all green.
4. Open a pull request describing the change and the motivation.

By contributing, you agree your work is licensed under the project's
[MIT License](./LICENSE).
