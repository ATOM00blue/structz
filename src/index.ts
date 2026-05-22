/**
 * structz — convert and query between JSON, YAML, CSV, and TOML.
 *
 * Public, programmatic API. The CLI (`structz`) is a thin wrapper over these.
 *
 * @example
 * import { convert, query, parseAuto } from "structz";
 *
 * convert("a: 1\nb: 2", { from: "yaml", to: "json" });
 * const { value } = parseAuto('{"users":[{"name":"Ada"}]}');
 * query(value, "users[0].name"); // "Ada"
 */

export {
  convert,
  parse,
  parseAuto,
  stringifyAs,
  type ConvertOptions,
} from "./core/convert.js";

export { query, parseQuery } from "./core/query.js";

export { detectFormat, formatFromExtension } from "./core/detect.js";

export {
  StructzError,
  ParseError,
  StringifyError,
  QueryError,
  DetectError,
  type Format,
  type InputFormat,
} from "./core/errors.js";

/** Library version, kept in sync with package.json at publish time. */
export const VERSION = "0.1.0";
