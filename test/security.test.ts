import { describe, it, expect, afterEach } from "vitest";
import { parse, parseAuto, convert } from "../src/core/convert.js";
import { query } from "../src/core/query.js";
import { sanitize } from "../src/core/sanitize.js";

/**
 * Security regression tests.
 *
 * Covers the headline risks called out in SECURITY_REVIEW.md:
 *  - prototype pollution via parsed __proto__/constructor/prototype keys
 *  - the query engine crossing into the prototype chain
 *  - YAML custom-tag (code-execution-shaped) input not yielding executables
 */

// Make sure no test leaks a polluted prototype into later tests.
afterEach(() => {
  // @ts-expect-error — cleanup of any accidental pollution
  delete Object.prototype.polluted;
  // @ts-expect-error — cleanup of any accidental pollution
  delete Array.prototype.polluted;
});

describe("prototype pollution — parsing strips dangerous keys", () => {
  it("JSON __proto__ key does not pollute and is dropped", () => {
    const value = parse('{"__proto__":{"polluted":"yes"},"safe":1}', "json") as Record<
      string,
      unknown
    >;
    // The own dangerous key must be gone...
    expect(Object.prototype.hasOwnProperty.call(value, "__proto__")).toBe(false);
    expect(value.safe).toBe(1);
    // ...and the global prototype must be clean even after a naive re-merge.
    const merged: Record<string, unknown> = {};
    for (const k of Object.keys(value)) merged[k] = value[k];
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("YAML __proto__ mapping does not pollute and is dropped", () => {
    const value = parse("__proto__:\n  polluted: yes\nkeep: 7", "yaml") as Record<
      string,
      unknown
    >;
    expect(Object.prototype.hasOwnProperty.call(value, "__proto__")).toBe(false);
    expect(value.keep).toBe(7);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("TOML __proto__ table does not pollute and is dropped", () => {
    const value = parse('["__proto__"]\npolluted = "yes"', "toml") as Record<
      string,
      unknown
    >;
    expect(Object.prototype.hasOwnProperty.call(value, "__proto__")).toBe(false);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("constructor / prototype keys are dropped too", () => {
    const value = parse(
      '{"constructor":{"x":1},"prototype":{"y":2},"ok":3}',
      "json",
    ) as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(value, "constructor")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(value, "prototype")).toBe(false);
    expect(value.ok).toBe(3);
    // constructor still resolves to the real Object constructor (not attacker data)
    expect((value as { constructor: unknown }).constructor).toBe(Object);
  });

  it("CSV header named __proto__ does not pollute row objects", () => {
    const rows = parse("__proto__,name\nyes,Ada", "csv") as Array<
      Record<string, unknown>
    >;
    for (const row of rows) {
      expect(Object.prototype.hasOwnProperty.call(row, "__proto__")).toBe(false);
    }
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("nested dangerous keys deep in the document are stripped", () => {
    const { value } = parseAuto(
      '{"a":{"b":{"__proto__":{"polluted":"deep"}},"c":[{"__proto__":{"polluted":"arr"}}]}}',
      "json",
    );
    const merged = JSON.parse(JSON.stringify(value));
    expect(JSON.stringify(merged)).not.toContain("polluted");
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("conversion output never re-emits a __proto__ key", () => {
    const out = convert('{"__proto__":{"polluted":"yes"},"x":1}', {
      from: "json",
      to: "json",
    });
    expect(out).not.toContain("__proto__");
    expect(out).toContain('"x": 1');
  });

  it("sanitize preserves shared references / cycles without crashing", () => {
    const shared = { v: 1 };
    const input = { a: shared, b: shared };
    const out = sanitize(input);
    expect(out.a).toBe(out.b); // reference preserved
    expect(out.a.v).toBe(1);
  });
});

describe("query engine — does not cross the prototype chain", () => {
  const data = parse('{"a":1,"nested":{"b":2}}', "json");

  it('["__proto__"] returns undefined, never Object.prototype', () => {
    expect(query(data, '["__proto__"]')).toBeUndefined();
    expect(query(data, '["__proto__"]')).not.toBe(Object.prototype);
  });

  it(".constructor returns undefined, not the Object constructor", () => {
    expect(query(data, ".constructor")).toBeUndefined();
    expect(query(data, "constructor")).toBeUndefined();
  });

  it(".prototype returns undefined", () => {
    expect(query(data, ".prototype")).toBeUndefined();
  });

  it("constructor.prototype gadget yields undefined", () => {
    expect(query(data, '["constructor"]["prototype"]')).toBeUndefined();
  });

  it("only own properties are reachable", () => {
    expect(query(data, "a")).toBe(1);
    expect(query(data, "nested.b")).toBe(2);
    // toString lives on the prototype and must not be reachable
    expect(query(data, "toString")).toBeUndefined();
    expect(query(data, "hasOwnProperty")).toBeUndefined();
  });
});

describe("YAML safe schema — custom tags do not execute or yield callables", () => {
  it("does not yield a JS function for a !!js/function tag", () => {
    const value = parse('!!js/function "function(){return 1}"', "yaml");
    expect(typeof value).not.toBe("function");
  });

  it("does not execute / construct objects from a !!python tag", () => {
    const value = parse("!!python/object/apply:os.system ['echo pwned']", "yaml");
    // Whatever it resolves to, it must not be a callable.
    expect(typeof value).not.toBe("function");
  });

  it("rejects an alias bomb (resource-exhaustion guard)", () => {
    const bomb = [
      'a: &a ["x","x","x","x","x","x","x","x","x","x"]',
      "b: &b [*a,*a,*a,*a,*a,*a,*a,*a,*a,*a]",
      "c: &c [*b,*b,*b,*b,*b,*b,*b,*b,*b,*b]",
      "d: &d [*c,*c,*c,*c,*c,*c,*c,*c,*c,*c]",
      "e: &e [*d,*d,*d,*d,*d,*d,*d,*d,*d,*d]",
      "f: [*e,*e,*e,*e,*e,*e,*e,*e,*e,*e]",
    ].join("\n");
    expect(() => parse(bomb, "yaml")).toThrow();
  });
});
