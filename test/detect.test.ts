import { describe, it, expect } from "vitest";
import { detectFormat, formatFromExtension } from "../src/core/detect.js";
import { DetectError } from "../src/core/errors.js";

describe("detectFormat", () => {
  it("detects JSON objects and arrays", () => {
    expect(detectFormat('{"a":1}')).toBe("json");
    expect(detectFormat("[1, 2, 3]")).toBe("json");
  });

  it("detects TOML by section headers", () => {
    expect(detectFormat("[server]\nhost = \"localhost\"\nport = 8080")).toBe(
      "toml",
    );
  });

  it("detects TOML by top-level assignments", () => {
    expect(detectFormat('title = "demo"\nversion = 2')).toBe("toml");
  });

  it("detects CSV by delimited columns", () => {
    expect(detectFormat("id,name,age\n1,Ada,36\n2,Linus,54")).toBe("csv");
  });

  it("falls back to YAML for mapping documents", () => {
    expect(detectFormat("name: Ada\nskills:\n  - math\n  - logic")).toBe("yaml");
  });

  it("does not mistake YAML mappings for TOML", () => {
    expect(detectFormat("server:\n  host: localhost\n  port: 8080")).toBe(
      "yaml",
    );
  });

  it("throws on empty input", () => {
    expect(() => detectFormat("   \n  ")).toThrow(DetectError);
  });
});

describe("formatFromExtension", () => {
  it.each([
    ["data.json", "json"],
    ["config.yaml", "yaml"],
    ["config.yml", "yaml"],
    ["table.csv", "csv"],
    ["Cargo.toml", "toml"],
    ["yaml", "yaml"],
  ])("%s -> %s", (path, expected) => {
    expect(formatFromExtension(path)).toBe(expected);
  });

  it("returns undefined for unknown extensions", () => {
    expect(formatFromExtension("notes.txt")).toBeUndefined();
  });
});
