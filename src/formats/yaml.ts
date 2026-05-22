import { parse, stringify } from "yaml";
import { ParseError, StringifyError } from "../core/errors.js";

/** Options controlling YAML serialization. */
export interface YamlStringifyOptions {
  /** Indentation width in spaces (default 2). */
  indent?: number;
}

/** Parse a YAML document into a plain JavaScript value. */
export function parseYaml(input: string): unknown {
  try {
    return parse(input);
  } catch (err) {
    throw new ParseError("yaml", (err as Error).message);
  }
}

/** Serialize any value to a YAML string. */
export function stringifyYaml(
  value: unknown,
  options: YamlStringifyOptions = {},
): string {
  const { indent = 2 } = options;
  try {
    return stringify(value, {
      indent,
      // Keep output readable and stable for round-tripping.
      lineWidth: 0,
    });
  } catch (err) {
    throw new StringifyError("yaml", (err as Error).message);
  }
}
