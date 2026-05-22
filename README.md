# structz

> Convert and query between **JSON**, **YAML**, **CSV**, and **TOML** — from the CLI or a tiny in-browser playground.

[![CI](https://github.com/ATOM00blue/structz/actions/workflows/ci.yml/badge.svg)](https://github.com/ATOM00blue/structz/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/structz.svg)](https://www.npmjs.com/package/structz)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D18-43853d.svg)](https://nodejs.org)
[![playground](https://img.shields.io/badge/playground-live-4f8cff.svg)](https://atom00blue.github.io/structz/)

`structz` is a small, fast, **zero-config** data Swiss-army knife. Point it at a
file or pipe data into it, and it auto-detects the format and converts to
whatever you want. It also runs a friendly **jq-lite** path query so you can pull
out exactly the bits you need.

No binary to download, no package manager dance — just `npx structz`. And the
exact same engine runs **100% offline in your browser** at the
[**live playground**](https://atom00blue.github.io/structz/).

```bash
# YAML -> JSON, format auto-detected
cat config.yaml | npx structz -t json

# CSV -> pretty YAML
npx structz users.csv -t yaml

# Pull one field out of a JSON doc
npx structz query 'users[0].email' data.json
```

---

## Why structz?

| | structz | jq | yq | dasel |
| --- | :---: | :---: | :---: | :---: |
| JSON ⇄ YAML ⇄ CSV ⇄ TOML | ✅ | JSON only | ✅ | ✅ |
| Auto-detect input format | ✅ | — | partial | partial |
| Install with `npx` (no binary) | ✅ | — | — | — |
| Friendly path query (no DSL to learn) | ✅ | jq DSL | jq DSL | dot-selectors |
| Self-contained offline web playground | ✅ | — | — | — |
| Importable library API | ✅ | — | — | Go only |

structz isn't trying to replace jq's full programming language. It nails the
**90% case** — convert formats and grab fields — with the smallest possible
learning curve, and ships a delightful browser playground alongside the CLI.

---

## Install

```bash
# one-off, no install
npx structz --help

# or install globally
npm install -g structz

# or as a library
npm install structz
```

Requires **Node.js 18+**. Works on Windows, macOS, and Linux.

---

## CLI usage

```
structz [input] [options]            # convert (default command)
structz convert [input] [options]    # explicit alias of the default
structz query <expr> [input] [opts]  # query, then output
```

Input comes from a **file argument** or **stdin**. Output goes to **stdout** or
a file via `-o`.

### Options

| Flag | Description |
| --- | --- |
| `-f, --from <fmt>` | Input format: `json` `yaml` `csv` `toml` `auto` (default `auto`) |
| `-t, --to <fmt>` | Output format: `json` `yaml` `csv` `toml` (default `json`) |
| `-q, --query <expr>` | Apply a jq-lite path query before output |
| `-m, --minify` | Minify JSON output (single line) |
| `-p, --pretty` | Pretty-print (the default for JSON) |
| `-i, --indent <n>` | Indentation width (default `2`) |
| `-d, --delimiter <c>` | CSV field delimiter |
| `-o, --output <file>` | Write to a file (infers `--to` from the extension) |
| `--validate` | Parse only; report whether the input is valid |
| `--no-color` | Disable colored error output |
| `-v, --version` | Print the version |
| `-h, --help` | Show help |

### Conversion examples

```bash
# Auto-detect YAML on stdin, emit JSON
cat docker-compose.yml | structz -t json

# JSON file -> TOML file (output format inferred from .toml)
structz package.json -o package.toml

# CSV -> minified JSON
structz data.csv -t json -m

# JSON array of objects -> CSV table
echo '[{"id":1,"name":"Ada"},{"id":2,"name":"Linus"}]' | structz -t csv

# TOML -> YAML
structz Cargo.toml -t yaml

# Validate a config file (exit 0 if valid)
structz config.toml --validate
```

### Query examples

structz ships a tiny path language (a "jq-lite") that covers the common cases
without a DSL to memorize:

```bash
# Nested field access
structz query 'server.port' config.yaml

# Array index (negative indices allowed)
structz query 'users[0].email' data.json
structz query 'log[-1]' events.json

# Wildcards map over arrays (and object values)
structz query 'users[*].name' data.json      # -> ["Ada","Linus",...]
structz query 'matrix[*][0]' data.json        # first column

# Slices
structz query 'items[1:3]' data.json

# Bracketed keys with spaces or symbols
structz query '["weird key"].id' data.json

# Query, then convert the result to YAML
structz query 'users[*].name' data.json -t yaml
```

#### Query syntax cheatsheet

| Expression | Meaning |
| --- | --- |
| `.` | the whole document |
| `a.b.c` | nested member access (leading `.` optional) |
| `["key with space"]` | bracketed / quoted key |
| `[0]`, `[-1]` | array index (negative counts from the end) |
| `[1:3]` | array slice |
| `[*]` or `.*` | wildcard — maps over array elements / object values |
| `users[*].name` | chain steps; wildcards fan out into an array |

---

## Web playground

A single self-contained `index.html` runs the **exact same conversion engine**
in your browser — no servers, no network requests, fully offline.

**→ [atom00blue.github.io/structz](https://atom00blue.github.io/structz/)**

You can also open `docs/index.html` locally after cloning. It's deployed to
GitHub Pages from the `docs/` folder.

---

## Library API

```ts
import { convert, parseAuto, stringifyAs, query, detectFormat } from "structz";

// Convert in one call
convert("a: 1\nb: 2", { from: "yaml", to: "json" });
// '{\n  "a": 1,\n  "b": 2\n}\n'

// Parse with auto-detection
const { value, format } = parseAuto('{"users":[{"name":"Ada"}]}');
format; // "json"

// Run a query over a parsed value
query(value, "users[0].name"); // "Ada"

// Serialize a value to any format
stringifyAs({ a: [1, 2, 3] }, "yaml");

// Detect a format from text
detectFormat("id,name\n1,Ada"); // "csv"
```

All functions throw typed errors (`ParseError`, `StringifyError`, `QueryError`,
`DetectError`) that extend `StructzError` and carry a `.code`.

---

## How it works

| Concern | Library |
| --- | --- |
| YAML | [`yaml`](https://github.com/eemeli/yaml) |
| CSV | [`papaparse`](https://www.papaparse.com/) |
| TOML | [`smol-toml`](https://github.com/squirrelchat/smol-toml) |
| CLI | [`commander`](https://github.com/tj/commander.js) |

The TypeScript source is compiled to ESM for the CLI/library and bundled with
[esbuild](https://esbuild.github.io/) into the single-file playground.

---

## FAQ

**Does my data get uploaded anywhere?**
No. The CLI runs locally and the playground does all conversions client-side
with zero network requests.

**Why can't I convert a scalar or a plain array to CSV/TOML?**
CSV needs a *table* (an array of objects or a single object), and TOML needs a
*table* (an object) at the top level. structz raises a clear error instead of
emitting something invalid.

**Are YAML/TOML comments preserved?**
No — like most converters, comments are dropped when converting between formats,
since the target format's structure may not have a place for them.

**Is this a full jq replacement?**
No. The query language deliberately covers paths, indices, slices, and
wildcards — the everyday 90%. For complex transforms, pipe structz output into
jq.

---

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md). In short:

```bash
git clone https://github.com/ATOM00blue/structz
cd structz
npm install
npm run build:all   # build CLI + playground
npm test            # run the test suite
npm run smoke       # end-to-end smoke test
```

## License

[MIT](./LICENSE) © 2026 ATOM00blue
