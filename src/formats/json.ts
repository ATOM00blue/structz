import { ParseError, StringifyError } from "../core/errors.js";

/** Options controlling JSON serialization. */
export interface JsonStringifyOptions {
  /** Indentation width in spaces. Ignored when {@link minify} is true. */
  indent?: number;
  /** Emit compact, single-line JSON with no extra whitespace. */
  minify?: boolean;
}

/** Parse a JSON document into a plain JavaScript value. */
export function parseJson(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch (err) {
    throw new ParseError("json", (err as Error).message);
  }
}

/** Serialize any JSON-compatible value to a JSON string. */
export function stringifyJson(
  value: unknown,
  options: JsonStringifyOptions = {},
): string {
  const { indent = 2, minify = false } = options;
  try {
    const json = JSON.stringify(value, null, minify ? undefined : indent);
    if (json === undefined) {
      throw new Error("value is not serializable to JSON (e.g. undefined or a function)");
    }
    return minify ? json : json + "\n";
  } catch (err) {
    throw new StringifyError("json", (err as Error).message);
  }
}
