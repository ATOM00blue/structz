import { QueryError } from "./errors.js";

/**
 * structz "jq-lite" path engine.
 *
 * Grammar (whitespace-insensitive between tokens):
 *   path     := '.'? segment*
 *   segment  := '.' ident
 *             | '[' index ']'        // 0, -1
 *             | '[' a ':' b ']'      // slice (a, b optional)
 *             | '[' '*' ']'          // wildcard over array / object values
 *             | '.' '*'              // wildcard (shorthand)
 *             | '[' '"' key '"' ']'  // quoted key (any characters)
 *             | '[' "'" key "'" ']'
 *
 * Examples:
 *   .                 -> the whole document
 *   users[0].email
 *   users[*].name     -> array of names
 *   matrix[*][0]
 *   ["weird key"].id
 *   items[-1]
 *   items[1:3]
 */

type Step =
  | { kind: "key"; name: string }
  | { kind: "index"; index: number }
  | { kind: "slice"; start?: number; end?: number }
  | { kind: "wildcard" };

const IDENT = /[A-Za-z0-9_$-]/;

/** Parse a query expression into a list of steps. Exposed for testing. */
export function parseQuery(expr: string): Step[] {
  const steps: Step[] = [];
  let i = 0;
  const s = expr.trim();

  // A leading '.' is optional and simply denotes the root.
  if (s[i] === ".") i++;

  while (i < s.length) {
    const c = s[i];

    if (c === ".") {
      i++;
      if (s[i] === "*") {
        steps.push({ kind: "wildcard" });
        i++;
        continue;
      }
      // dotted identifier
      let name = "";
      while (i < s.length && IDENT.test(s[i])) {
        name += s[i];
        i++;
      }
      if (name.length === 0) {
        throw new QueryError(`expected a key after '.' at position ${i}`);
      }
      steps.push({ kind: "key", name });
      continue;
    }

    if (c === "[") {
      const close = findClosingBracket(s, i);
      const inner = s.slice(i + 1, close).trim();
      steps.push(parseBracket(inner, i));
      i = close + 1;
      continue;
    }

    // bare leading identifier (no leading dot), e.g. "users[0]"
    if (IDENT.test(c)) {
      let name = "";
      while (i < s.length && IDENT.test(s[i])) {
        name += s[i];
        i++;
      }
      steps.push({ kind: "key", name });
      continue;
    }

    throw new QueryError(`unexpected character '${c}' at position ${i}`);
  }

  return steps;
}

function findClosingBracket(s: string, open: number): number {
  // Handles quoted keys that may contain ']'.
  let i = open + 1;
  let quote: string | null = null;
  while (i < s.length) {
    const c = s[i];
    if (quote) {
      if (c === "\\") {
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === "]") {
      return i;
    }
    i++;
  }
  throw new QueryError(`unclosed '[' at position ${open}`);
}

function parseBracket(inner: string, at: number): Step {
  if (inner === "*") return { kind: "wildcard" };

  if (
    (inner.startsWith('"') && inner.endsWith('"')) ||
    (inner.startsWith("'") && inner.endsWith("'"))
  ) {
    const raw = inner.slice(1, -1).replace(/\\(["'\\])/g, "$1");
    return { kind: "key", name: raw };
  }

  if (inner.includes(":")) {
    const [a, b] = inner.split(":");
    const start = a.trim() === "" ? undefined : Number(a);
    const end = b.trim() === "" ? undefined : Number(b);
    if ((start !== undefined && Number.isNaN(start)) || (end !== undefined && Number.isNaN(end))) {
      throw new QueryError(`invalid slice '[${inner}]' at position ${at}`);
    }
    return { kind: "slice", start, end };
  }

  const n = Number(inner);
  if (Number.isNaN(n) || !Number.isInteger(n)) {
    // Treat as an unquoted key, e.g. [foo]
    if (/^[A-Za-z0-9_$-]+$/.test(inner)) {
      return { kind: "key", name: inner };
    }
    throw new QueryError(`invalid index '[${inner}]' at position ${at}`);
  }
  return { kind: "index", index: n };
}

/**
 * Apply a query expression to a parsed value and return the selected result.
 *
 * Wildcards and slices fan out: each subsequent step is applied to every
 * matched element, and the results are collected into an array.
 */
export function query(value: unknown, expr: string): unknown {
  const steps = parseQuery(expr);
  let current: unknown[] = [value];
  let fannedOut = false;

  for (const step of steps) {
    const next: unknown[] = [];
    for (const item of current) {
      switch (step.kind) {
        case "key":
          next.push(getKey(item, step.name));
          break;
        case "index":
          next.push(getIndex(item, step.index));
          break;
        case "slice":
          next.push(getSlice(item, step.start, step.end));
          break;
        case "wildcard": {
          fannedOut = true;
          for (const v of iterate(item)) next.push(v);
          break;
        }
      }
    }
    current = next;
  }

  return fannedOut ? current : current[0];
}

function getKey(value: unknown, name: string): unknown {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== "object" || Array.isArray(value)) return undefined;
  return (value as Record<string, unknown>)[name];
}

function getIndex(value: unknown, index: number): unknown {
  if (!Array.isArray(value)) return undefined;
  const idx = index < 0 ? value.length + index : index;
  return value[idx];
}

function getSlice(value: unknown, start?: number, end?: number): unknown {
  if (!Array.isArray(value)) return undefined;
  return value.slice(start, end);
}

function iterate(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value !== null && typeof value === "object") {
    return Object.values(value as Record<string, unknown>);
  }
  return [];
}
