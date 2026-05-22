import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const cli = join(here, "..", "dist", "cli.js");

/** Run the built CLI with the given args and stdin, returning stdout. */
function run(args: string[], input?: string): string {
  return execFileSync(process.execPath, [cli, ...args], {
    input: input ?? "",
    encoding: "utf8",
  });
}

describe("CLI end-to-end", () => {
  beforeAll(() => {
    if (!existsSync(cli)) {
      throw new Error(
        `built CLI not found at ${cli}. Run "npm run build" before tests.`,
      );
    }
  });

  it("converts YAML to JSON via stdin", () => {
    const out = run(["-t", "json"], "name: Ada\nage: 36\n");
    expect(JSON.parse(out)).toEqual({ name: "Ada", age: 36 });
  });

  it("converts JSON to TOML", () => {
    const out = run(["-f", "json", "-t", "toml"], '{"a":1,"b":"x"}');
    expect(out).toContain("a = 1");
    expect(out).toContain('b = "x"');
  });

  it("converts JSON table to CSV", () => {
    const out = run(["-t", "csv"], '[{"id":1,"n":"a"},{"id":2,"n":"b"}]');
    expect(out.trim().split("\n")).toEqual(["id,n", "1,a", "2,b"]);
  });

  it("auto-detects CSV input", () => {
    const out = run(["-t", "json"], "id,name\n1,Ada\n");
    expect(JSON.parse(out)).toEqual([{ id: 1, name: "Ada" }]);
  });

  it("applies a query subcommand", () => {
    const out = run(
      ["query", "users[*].name"],
      '{"users":[{"name":"Ada"},{"name":"Bo"}]}',
    );
    expect(JSON.parse(out)).toEqual(["Ada", "Bo"]);
  });

  it("minifies JSON", () => {
    const out = run(["-t", "json", "-m"], "a: 1\nb: 2\n");
    expect(out).toBe('{"a":1,"b":2}');
  });

  it("validates input", () => {
    const out = run(["--validate"], "a: 1\n");
    expect(out.trim()).toBe("valid YAML");
  });

  it("prints the version", () => {
    expect(run(["--version"]).trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("exits non-zero on a parse error", () => {
    expect(() => run(["-f", "json", "-t", "yaml"], "{bad json")).toThrow();
  });
});
