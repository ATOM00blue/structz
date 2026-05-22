/**
 * Browser entry point for the playground.
 *
 * This module is bundled by esbuild into a single IIFE and inlined into
 * docs/index.html, so the playground works fully offline with no network
 * requests and no external scripts.
 */
import { convert, parseAuto } from "./core/convert.js";
import { query } from "./core/query.js";
import { detectFormat } from "./core/detect.js";
import type { Format, InputFormat } from "./core/errors.js";

export interface RunOptions {
  from: InputFormat;
  to: Format;
  indent: number;
  minify: boolean;
  query?: string;
}

export interface RunResult {
  ok: boolean;
  output: string;
  detected: Format;
  error?: string;
}

/** Run a single conversion for the playground, capturing errors as text. */
function run(input: string, opts: RunOptions): RunResult {
  try {
    if (input.trim().length === 0) {
      return { ok: true, output: "", detected: "json" };
    }
    const { value, format } = parseAuto(input, opts.from);
    const selected =
      opts.query && opts.query.trim().length > 0
        ? query(value, opts.query)
        : value;
    const output = convertSelected(selected, opts);
    return { ok: true, output, detected: format };
  } catch (err) {
    return {
      ok: false,
      output: "",
      detected: safeDetect(input),
      error: (err as Error).message,
    };
  }
}

function convertSelected(value: unknown, opts: RunOptions): string {
  // Re-use the library by going value -> string directly.
  return convert(JSON.stringify(value), {
    from: "json",
    to: opts.to,
    indent: opts.indent,
    minify: opts.minify,
  });
}

function safeDetect(input: string): Format {
  try {
    return detectFormat(input);
  } catch {
    return "json";
  }
}

// Expose a tiny, stable API on the global object for the inline UI script.
const api = { run, detectFormat: safeDetect };
(globalThis as unknown as { structz: typeof api }).structz = api;

export { run };
