import { describe, it, expect } from "vitest";
import { query, parseQuery } from "../src/core/query.js";
import { QueryError } from "../src/core/errors.js";

const DATA = {
  users: [
    { name: "Ada", email: "ada@example.com", roles: ["admin", "dev"] },
    { name: "Linus", email: "linus@example.com", roles: ["dev"] },
    { name: "Grace", email: "grace@example.com", roles: [] },
  ],
  meta: { count: 3, "weird key": 42 },
  matrix: [
    [1, 2, 3],
    [4, 5, 6],
  ],
};

describe("query — basic access", () => {
  it("returns the whole document for '.'", () => {
    expect(query(DATA, ".")).toEqual(DATA);
  });

  it("returns the whole document for an empty expression", () => {
    expect(query(DATA, "")).toEqual(DATA);
  });

  it("accesses nested keys with dot notation", () => {
    expect(query(DATA, "meta.count")).toBe(3);
    expect(query(DATA, ".meta.count")).toBe(3);
  });

  it("accesses array elements by index", () => {
    expect(query(DATA, "users[0].name")).toBe("Ada");
  });

  it("supports negative indices", () => {
    expect(query(DATA, "users[-1].name")).toBe("Grace");
  });

  it("supports bracketed quoted keys", () => {
    expect(query(DATA, 'meta["weird key"]')).toBe(42);
  });
});

describe("query — wildcards and slices", () => {
  it("maps a wildcard over arrays", () => {
    expect(query(DATA, "users[*].name")).toEqual(["Ada", "Linus", "Grace"]);
  });

  it("chains wildcards and indices", () => {
    expect(query(DATA, "matrix[*][0]")).toEqual([1, 4]);
  });

  it("maps a wildcard over object values", () => {
    expect(query(DATA, "meta.*")).toEqual([3, 42]);
  });

  it("slices arrays", () => {
    expect(query(DATA, "matrix[0][1:3]")).toEqual([2, 3]);
  });
});

describe("query — missing paths", () => {
  it("returns undefined for missing keys", () => {
    expect(query(DATA, "nope.nothing")).toBeUndefined();
  });

  it("returns undefined for out-of-range indices", () => {
    expect(query(DATA, "users[99]")).toBeUndefined();
  });
});

describe("query — prototype-chain safety", () => {
  it("does not return prototype members for dangerous keys", () => {
    expect(query(DATA, '["__proto__"]')).toBeUndefined();
    expect(query(DATA, ".constructor")).toBeUndefined();
    expect(query(DATA, ".prototype")).toBeUndefined();
  });

  it("does not return inherited members", () => {
    expect(query(DATA, ".toString")).toBeUndefined();
  });
});

describe("parseQuery — errors", () => {
  it("throws on an unclosed bracket", () => {
    expect(() => parseQuery("users[0")).toThrow(QueryError);
  });

  it("throws on a dangling dot", () => {
    expect(() => parseQuery("users.")).toThrow(QueryError);
  });
});
