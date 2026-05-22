/**
 * Prototype-pollution hardening.
 *
 * Parsers for JSON / YAML / TOML / CSV can produce objects that carry an own
 * `__proto__`, `constructor`, or `prototype` key holding attacker-controlled
 * data. The underlying libraries do not mutate `Object.prototype` themselves,
 * but handing such objects back to a consumer (or re-keying them) turns them
 * into a prototype-pollution gadget: a single `target[key] = value` with
 * `key === "__proto__"` pollutes the global prototype.
 *
 * {@link sanitize} deep-rebuilds parsed values so these dangerous keys never
 * cross the parse boundary, while preserving all legitimate data.
 */

/** Keys that must never appear as data keys on returned objects. */
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/** True for keys that could pollute the prototype chain if assigned. */
export function isForbiddenKey(key: string): boolean {
  return FORBIDDEN_KEYS.has(key);
}

/**
 * Recursively rebuild a parsed value, dropping prototype-polluting keys from
 * every plain object. Arrays are rebuilt element-wise; primitives, dates, and
 * other non-plain objects are returned unchanged.
 *
 * Cycle-safe (parsers can emit shared references via YAML anchors) and
 * depth-bounded to avoid stack exhaustion on pathological inputs.
 */
export function sanitize<T>(value: T): T {
  return sanitizeInner(value, new WeakMap(), 0) as T;
}

const MAX_DEPTH = 10_000;

function sanitizeInner(
  value: unknown,
  seen: WeakMap<object, unknown>,
  depth: number,
): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (depth > MAX_DEPTH) {
    throw new RangeError("structz: input nesting too deep to sanitize safely");
  }

  // Preserve shared references / break cycles.
  const cached = seen.get(value);
  if (cached !== undefined) return cached;

  if (Array.isArray(value)) {
    const out: unknown[] = [];
    seen.set(value, out);
    for (const item of value) {
      out.push(sanitizeInner(item, seen, depth + 1));
    }
    return out;
  }

  // Leave non-plain objects (Date, Map, etc.) untouched — the parsers used here
  // only emit plain objects, arrays, and primitives, but this keeps us safe if
  // that ever changes.
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    return value;
  }

  // Rebuild as a clean object with Object.prototype, dropping forbidden keys.
  const out: Record<string, unknown> = {};
  seen.set(value, out);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    if (isForbiddenKey(key)) continue;
    out[key] = sanitizeInner(
      (value as Record<string, unknown>)[key],
      seen,
      depth + 1,
    );
  }
  return out;
}
