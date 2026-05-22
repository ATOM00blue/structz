import { parse, stringify } from "yaml";
import { ParseError, StringifyError } from "../core/errors.js";
import { sanitize } from "../core/sanitize.js";

/** Options controlling YAML serialization. */
export interface YamlStringifyOptions {
  /** Indentation width in spaces (default 2). */
  indent?: number;
}

/**
 * Parse a YAML document into a plain JavaScript value.
 *
 * Hardening:
 *  - `schema: "core"` uses the safe, code-free YAML 1.2 core schema. The `yaml`
 *    library never executes custom tags (no `!!js/function` / `!!python/...`
 *    constructors), and this makes that guarantee explicit and stable.
 *  - `maxAliasCount` keeps the alias/anchor "billion laughs" guard explicit.
 *  - `logLevel: "silent"` suppresses noisy unresolved-tag warnings to stderr.
 *  - The result is sanitized so prototype-polluting keys cannot escape.
 */
export function parseYaml(input: string): unknown {
  try {
    return sanitize(
      parse(input, {
        schema: "core",
        version: "1.2",
        maxAliasCount: 100,
        logLevel: "silent",
      }),
    );
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
