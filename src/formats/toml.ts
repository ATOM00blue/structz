import { parse, stringify } from "smol-toml";
import { ParseError, StringifyError } from "../core/errors.js";

/** Parse a TOML document into a plain JavaScript value. */
export function parseToml(input: string): unknown {
  try {
    return parse(input);
  } catch (err) {
    throw new ParseError("toml", (err as Error).message);
  }
}

/**
 * Serialize a value to TOML.
 *
 * TOML can only represent objects (tables) at the top level. Arrays and
 * scalars are wrapped or rejected with a clear message rather than producing
 * invalid TOML.
 */
export function stringifyToml(value: unknown): string {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new StringifyError(
      "toml",
      "TOML output requires a top-level object (table); got " +
        (Array.isArray(value) ? "an array" : typeof value),
    );
  }
  try {
    const out = stringify(value as Record<string, unknown>);
    return out.endsWith("\n") ? out : out + "\n";
  } catch (err) {
    throw new StringifyError("toml", (err as Error).message);
  }
}
