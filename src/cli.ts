#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { Command, Option } from "commander";
import {
  parseAuto,
  stringifyAs,
  type ConvertOptions,
} from "./core/convert.js";
import { query as runQuery } from "./core/query.js";
import { formatFromExtension } from "./core/detect.js";
import { StructzError, type Format, type InputFormat } from "./core/errors.js";

const VERSION = "0.1.0";
const FORMATS: Format[] = ["json", "yaml", "csv", "toml"];

interface CliOptions {
  from: InputFormat;
  to?: Format;
  query?: string;
  pretty?: boolean;
  minify?: boolean;
  indent: string;
  output?: string;
  delimiter?: string;
  validate?: boolean;
  color: boolean;
}

/** Read the whole of stdin as a UTF-8 string. */
async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/** Resolve input text from a file argument or stdin. */
async function getInput(file: string | undefined): Promise<string> {
  if (file && file !== "-") {
    return readFileSync(file, "utf8");
  }
  if (process.stdin.isTTY) {
    throw new StructzError(
      "no input provided (pass a file or pipe data via stdin)",
      "NO_INPUT",
    );
  }
  return readStdin();
}

function fail(message: string, color: boolean, code = 1): never {
  const prefix = color ? "\x1b[31mstructz:\x1b[0m" : "structz:";
  process.stderr.write(`${prefix} ${message}\n`);
  process.exit(code);
}

/** Core pipeline shared by the default command and `convert`. */
async function runConvert(
  file: string | undefined,
  opts: CliOptions,
): Promise<void> {
  const input = await getInput(file);
  const indent = Number.parseInt(opts.indent, 10);
  if (Number.isNaN(indent) || indent < 0) {
    fail(`invalid --indent value: ${opts.indent}`, opts.color, 2);
  }

  const { value, format } = parseAuto(input, opts.from);

  if (opts.validate) {
    process.stdout.write(`valid ${format.toUpperCase()}\n`);
    return;
  }

  const selected = opts.query ? runQuery(value, opts.query) : value;

  // Determine target format: explicit --to, else infer from -o extension,
  // else default to JSON.
  let to: Format = opts.to ?? "json";
  if (!opts.to && opts.output) {
    const inferred = formatFromExtension(opts.output);
    if (inferred) to = inferred;
  }

  const convertOpts: Omit<ConvertOptions, "from" | "to"> = {
    indent,
    minify: opts.minify ?? false,
    ...(opts.delimiter ? { delimiter: opts.delimiter } : {}),
  };

  const output = stringifyAs(selected, to, convertOpts);

  if (opts.output) {
    writeFileSync(opts.output, output);
  } else {
    process.stdout.write(output);
  }
}

function buildProgram(): Command {
  const program = new Command();

  program
    .name("structz")
    .description(
      "Convert and query between JSON, YAML, CSV, and TOML.\n" +
        "Reads from a file argument or stdin; writes to stdout or --output.",
    )
    .version(VERSION, "-v, --version", "print the version")
    .showHelpAfterError();

  const addSharedOptions = (cmd: Command): Command =>
    cmd
      .addOption(
        new Option("-f, --from <fmt>", "input format")
          .choices([...FORMATS, "auto"])
          .default("auto"),
      )
      .addOption(new Option("-t, --to <fmt>", "output format").choices(FORMATS))
      .option("-q, --query <expr>", "select with a jq-lite path before output")
      .option("-m, --minify", "minify JSON output (single line)")
      .option("-p, --pretty", "pretty-print (default for JSON)")
      .option("-i, --indent <n>", "indentation width", "2")
      .option("-d, --delimiter <char>", "CSV field delimiter")
      .option("-o, --output <file>", "write to a file (infers --to from extension)")
      .option("--validate", "parse only and report whether the input is valid")
      .option("--no-color", "disable colored error output");

  // Default command: `structz [input]`
  addSharedOptions(
    program
      .argument("[input]", "input file (omit or use '-' to read stdin)")
      .action(async (input: string | undefined, opts: CliOptions) => {
        try {
          await runConvert(input, opts);
        } catch (err) {
          handleError(err, opts.color);
        }
      }),
  );

  // Explicit `convert` subcommand (alias of default), for discoverability.
  addSharedOptions(
    program
      .command("convert")
      .description("convert between formats (same as the default command)")
      .argument("[input]", "input file (omit or use '-' to read stdin)")
      .action(async (input: string | undefined, opts: CliOptions) => {
        try {
          await runConvert(input, opts);
        } catch (err) {
          handleError(err, opts.color);
        }
      }),
  );

  // `query` subcommand: `structz query <expr> [input]`
  addSharedOptions(
    program
      .command("query")
      .description("apply a jq-lite path query and print the result")
      .argument("<expr>", "jq-lite path expression, e.g. users[0].name")
      .argument("[input]", "input file (omit or use '-' to read stdin)")
      .action(
        async (expr: string, input: string | undefined, opts: CliOptions) => {
          try {
            await runConvert(input, { ...opts, query: expr });
          } catch (err) {
            handleError(err, opts.color);
          }
        },
      ),
  );

  return program;
}

function handleError(err: unknown, color: boolean): never {
  if (err instanceof StructzError) {
    const code = err.code === "NO_INPUT" ? 2 : 1;
    fail(err.message, color, code);
  }
  fail((err as Error).message ?? String(err), color, 1);
}

const program = buildProgram();
program.parseAsync(process.argv).catch((err) => {
  handleError(err, true);
});
