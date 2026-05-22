import Papa from "papaparse";
import { ParseError, StringifyError } from "../core/errors.js";

/** Options controlling CSV parsing. */
export interface CsvParseOptions {
  /** Field delimiter. Auto-detected when omitted. */
  delimiter?: string;
  /** Convert numeric / boolean strings into real numbers / booleans. */
  dynamicTyping?: boolean;
}

/** Options controlling CSV serialization. */
export interface CsvStringifyOptions {
  /** Field delimiter (default ","). */
  delimiter?: string;
}

/**
 * Parse CSV text into an array of row objects keyed by the header row.
 *
 * The first line is always treated as a header. Values are coerced to
 * numbers / booleans by default so that round-tripping to JSON keeps types.
 */
export function parseCsv(input: string, options: CsvParseOptions = {}): unknown {
  const { delimiter, dynamicTyping = true } = options;
  const result = Papa.parse<Record<string, unknown>>(input.trim(), {
    header: true,
    skipEmptyLines: true,
    dynamicTyping,
    ...(delimiter ? { delimiter } : {}),
  });

  if (result.errors.length > 0) {
    const first = result.errors[0];
    throw new ParseError("csv", `${first.message} (row ${first.row ?? "?"})`);
  }
  return result.data;
}

/**
 * Serialize a value to CSV.
 *
 * Accepts an array of objects (each becomes a row, keys become the header),
 * an array of arrays, or a single object (becomes a one-row table). Anything
 * else cannot be represented as a table and raises a {@link StringifyError}.
 */
export function stringifyCsv(
  value: unknown,
  options: CsvStringifyOptions = {},
): string {
  const { delimiter = "," } = options;

  let rows: unknown;
  if (Array.isArray(value)) {
    rows = value;
  } else if (value !== null && typeof value === "object") {
    rows = [value];
  } else {
    throw new StringifyError(
      "csv",
      "CSV output requires an array of objects (a table); got a scalar value",
    );
  }

  try {
    const csv = Papa.unparse(rows as object[], {
      delimiter,
      newline: "\n",
    });
    return csv.endsWith("\n") ? csv : csv + "\n";
  } catch (err) {
    throw new StringifyError("csv", (err as Error).message);
  }
}
