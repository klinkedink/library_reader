import { describe, expect, it } from "vitest";
import { interpretIdentifyError } from "./identify-error";

describe("interpretIdentifyError", () => {
  it("surfaces 401 as a fatal auth error", () => {
    const result = interpretIdentifyError(
      '{"error":{"message":"Incorrect API key provided","code":"invalid_api_key"}}',
    );
    expect(result.kind).toBe("auth");
    expect(result.fatal).toBe(true);
    expect(result.message).toMatch(/401/);
  });

  it("uses the HTTP status when the body is unhelpful", () => {
    const result = interpretIdentifyError("nope", 401);
    expect(result.kind).toBe("auth");
    expect(result.message).toMatch(/401/);
  });

  it("surfaces 429 as a fatal rate-limit error", () => {
    const result = interpretIdentifyError("429 Rate limit reached for gpt-4o");
    expect(result.kind).toBe("rate_limit");
    expect(result.fatal).toBe(true);
    expect(result.message).toMatch(/429/);
  });

  it("treats parse failures as non-fatal", () => {
    const result = interpretIdentifyError("TypeValidationError: No object generated");
    expect(result.kind).toBe("parse");
    expect(result.fatal).toBe(false);
    expect(result.message).toMatch(/502|parse/i);
  });

  it("treats a missing key as a visible 503", () => {
    const result = interpretIdentifyError(
      { error: "missing_key", message: "Shelf Pick needs a vision model key" },
      503,
    );
    expect(result.fatal).toBe(true);
    expect(result.message).toMatch(/503/);
  });
});
