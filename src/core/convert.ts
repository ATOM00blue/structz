import type { Format, InputFormat } from "./errors.js";
import { detectFormat } from "./detect.js";
import { parseJson, stringifyJson } from "../formats/json.js";
import { parseYaml, stringifyYaml } from "../formats/yaml.js";
import { parseCsv, stringifyCsv } from "../formats/csv.js";
import { parseToml, stringifyToml } from "../formats/toml.js";

/** Options shared across parse + stringify in a single conversion. */
export interface ConvertOptions {
  /** Source format, or "auto" to detect from the text (default "auto"). */
  from?: InputFormat;
  /** Target format (default "json"). */
  to?: Format;
  /** Indentation width for JSON/YAML (default 2). */
  indent?: number;
  /** Minify JSON output (single line). */
  minify?: boolean;
  /** Field delimiter used for CSV input and output. */
  delimiter?: string;
}

/**
 * Parse a text document into a JavaScript value, detecting the format when
 * `format` is "auto".
 */
export function parseAuto(
  input: string,
  format: InputFormat = "auto",
): { value: unknown; format: Format } {
  const resolved: Format = format === "auto" ? detectFormat(input) : format;
  return { value: parse(input, resolved), format: resolved };
}

/** Parse text using an explicitly known format. */
export function parse(input: string, format: Format): unknown {
  switch (format) {
    case "json":
      return parseJson(input);
    case "yaml":
      return parseYaml(input);
    case "csv":
      return parseCsv(input);
    case "toml":
      return parseToml(input);
  }
}

/** Serialize a value to the given format. */
export function stringifyAs(
  value: unknown,
  format: Format,
  options: Omit<ConvertOptions, "from" | "to"> = {},
): string {
  const { indent = 2, minify = false, delimiter } = options;
  switch (format) {
    case "json":
      return stringifyJson(value, { indent, minify });
    case "yaml":
      return stringifyYaml(value, { indent });
    case "csv":
      return stringifyCsv(value, delimiter ? { delimiter } : {});
    case "toml":
      return stringifyToml(value);
  }
}

/**
 * Convert a document from one format to another in a single call.
 *
 * @example
 * convert('a: 1\nb: 2', { from: 'yaml', to: 'json' })
 */
export function convert(input: string, options: ConvertOptions = {}): string {
  const { from = "auto", to = "json", indent, minify, delimiter } = options;
  const { value } = parseAuto(input, from);
  return stringifyAs(value, to, { indent, minify, delimiter });
}
