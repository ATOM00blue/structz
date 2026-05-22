import { describe, it, expect } from "vitest";
import { convert, parseAuto, stringifyAs } from "../src/core/convert.js";
import type { Format } from "../src/core/errors.js";

const SAMPLE = {
  name: "structz",
  version: 1,
  enabled: true,
  pi: 3.14,
  tags: ["json", "yaml", "toml"],
  nested: { a: 1, b: { c: 2 } },
};

const TABLE = [
  { id: 1, name: "Ada", admin: true },
  { id: 2, name: "Linus", admin: false },
];

describe("any-to-any conversion of an object", () => {
  // CSV excluded here because it only round-trips tabular data.
  const objectFormats: Format[] = ["json", "yaml", "toml"];

  for (const from of objectFormats) {
    for (const to of objectFormats) {
      it(`${from} -> ${to} round-trips the value`, () => {
        const original = stringifyAs(SAMPLE, from);
        const converted = convert(original, { from, to });
        const back = parseAuto(converted, to).value;
        expect(back).toEqual(SAMPLE);
      });
    }
  }
});

describe("CSV tabular round-trips", () => {
  it("JSON table -> CSV -> JSON keeps rows and types", () => {
    const csv = stringifyAs(TABLE, "csv");
    const back = parseAuto(csv, "csv").value;
    expect(back).toEqual(TABLE);
  });

  it("CSV -> YAML -> CSV preserves the table", () => {
    const csv = stringifyAs(TABLE, "csv");
    const yaml = convert(csv, { from: "csv", to: "yaml" });
    const csv2 = convert(yaml, { from: "yaml", to: "csv" });
    expect(parseAuto(csv2, "csv").value).toEqual(TABLE);
  });
});

describe("JSON formatting options", () => {
  it("minify produces single-line output", () => {
    const out = stringifyAs({ a: 1, b: 2 }, "json", { minify: true });
    expect(out).toBe('{"a":1,"b":2}');
  });

  it("indent controls width", () => {
    const out = stringifyAs({ a: 1 }, "json", { indent: 4 });
    expect(out).toContain('    "a": 1');
  });
});

describe("error handling", () => {
  it("rejects invalid JSON", () => {
    expect(() => parseAuto("{not json", "json")).toThrow(/parse JSON/i);
  });

  it("rejects scalar -> CSV", () => {
    expect(() => stringifyAs(42, "csv")).toThrow(/CSV output requires/i);
  });

  it("rejects array -> TOML at top level", () => {
    expect(() => stringifyAs([1, 2, 3], "toml")).toThrow(/TOML output requires/i);
  });
});
