/** All formats structz can read and write. */
export type Format = "json" | "yaml" | "csv" | "toml";

/** Formats accepted as input, plus the special "auto" detection mode. */
export type InputFormat = Format | "auto";

/**
 * Base error for all structz failures. Carries a machine-readable {@link code}
 * so the CLI can choose an appropriate exit status and message.
 */
export class StructzError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "StructzError";
  }
}

/** Raised when input cannot be parsed as the requested (or detected) format. */
export class ParseError extends StructzError {
  constructor(
    public readonly format: Format,
    detail: string,
  ) {
    super(`Failed to parse ${format.toUpperCase()}: ${detail}`, "PARSE_ERROR");
    this.name = "ParseError";
  }
}

/** Raised when a value cannot be serialized to the requested format. */
export class StringifyError extends StructzError {
  constructor(
    public readonly format: Format,
    detail: string,
  ) {
    super(
      `Failed to serialize to ${format.toUpperCase()}: ${detail}`,
      "STRINGIFY_ERROR",
    );
    this.name = "StringifyError";
  }
}

/** Raised when a query expression is malformed or cannot be evaluated. */
export class QueryError extends StructzError {
  constructor(detail: string) {
    super(`Query error: ${detail}`, "QUERY_ERROR");
    this.name = "QueryError";
  }
}

/** Raised when auto-detection cannot confidently identify the input format. */
export class DetectError extends StructzError {
  constructor(detail: string) {
    super(`Could not detect input format: ${detail}`, "DETECT_ERROR");
    this.name = "DetectError";
  }
}
