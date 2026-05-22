import type { Format } from "./errors.js";
import { DetectError } from "./errors.js";

/** Map a file extension (with or without leading dot) to a format. */
export function formatFromExtension(pathOrExt: string): Format | undefined {
  const ext = pathOrExt.includes(".")
    ? pathOrExt.slice(pathOrExt.lastIndexOf(".") + 1)
    : pathOrExt;
  switch (ext.toLowerCase()) {
    case "json":
      return "json";
    case "yaml":
    case "yml":
      return "yaml";
    case "csv":
      return "csv";
    case "tsv":
      return "csv";
    case "toml":
      return "toml";
    default:
      return undefined;
  }
}

/**
 * Heuristically detect the format of a text document.
 *
 * Strategy (in order):
 *  1. JSON — if it cleanly `JSON.parse`s.
 *  2. TOML — strong structural signals (`key = value`, `[table]`).
 *  3. CSV — multiple comma/tab separated columns across lines.
 *  4. YAML — the permissive fallback (a YAML parser accepts most plain text).
 *
 * Throws {@link DetectError} on empty input.
 */
export function detectFormat(input: string): Format {
  const text = input.trim();
  if (text.length === 0) {
    throw new DetectError("input is empty");
  }

  // 1. JSON — most precise signal.
  if (/^[[{]/.test(text) || /^"/.test(text) || /^-?\d/.test(text)) {
    try {
      JSON.parse(text);
      return "json";
    } catch {
      // not valid JSON, keep going
    }
  }

  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

  // 2. TOML — look for `[section]` headers or top-level `key = value`,
  //    while making sure it doesn't look like YAML (`key: value`).
  const tomlAssign = /^[A-Za-z0-9_."'-]+\s*=\s*.+/;
  const tomlSection = /^\[\[?[A-Za-z0-9_.\s"'-]+\]\]?\s*$/;
  const looksToml = lines.some(
    (l) => tomlSection.test(l.trim()) || tomlAssign.test(l.trim()),
  );
  const looksYamlMapping = lines.some((l) =>
    /^[^=#]+:\s/.test(l.trim()) || /^[^=#]+:$/.test(l.trim()),
  );
  if (looksToml && !looksYamlMapping) {
    return "toml";
  }

  // 3. CSV — a header line plus data lines with consistent column counts.
  if (lines.length >= 2 && !looksYamlMapping) {
    const delimiter = countOccurrences(lines[0], ",") >= countOccurrences(lines[0], "\t")
      ? ","
      : "\t";
    const headerCols = countOccurrences(lines[0], delimiter) + 1;
    if (headerCols >= 2) {
      const consistent = lines
        .slice(1, Math.min(lines.length, 6))
        .every((l) => Math.abs(countOccurrences(l, delimiter) + 1 - headerCols) <= 1);
      if (consistent) {
        return "csv";
      }
    }
  }

  // 4. YAML — permissive fallback for anything mapping/list shaped.
  return "yaml";
}

function countOccurrences(line: string, char: string): number {
  let count = 0;
  for (const c of line) {
    if (c === char) count++;
  }
  return count;
}
