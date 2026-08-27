import { describe, expect, it } from "vitest";
import { booksFromTilePayload, IdentifyClientError, readIdentifyHttpResult } from "./identify-client";
import { dedupeDetected } from "./shelf";

describe("booksFromTilePayload", () => {
  it("drops empty titles and dedupes across tiles", () => {
    const first = booksFromTilePayload([
      { title: "Klara and the Sun", author: "Kazuo Ishiguro", confidence: 0.4 },
      { title: "  ", author: "Nobody", confidence: 0.9 },
    ]);
    const second = booksFromTilePayload([
      { title: "Klara and the Sun", author: "Kazuo Ishiguro", confidence: 0.9 },
      { title: "The Buried Giant", author: "Kazuo Ishiguro", confidence: 0.7 },
    ]);
    const merged = dedupeDetected([...first, ...second]);
    expect(merged.map((b) => b.title)).toEqual(["Klara and the Sun", "The Buried Giant"]);
    expect(merged[0].confidence).toBe(0.9);
  });
});

describe("readIdentifyHttpResult", () => {
  it("treats 200 + { books: [] } as a genuine empty tile", () => {
    expect(readIdentifyHttpResult(200, JSON.stringify({ books: [] }))).toEqual([]);
  });

  it("treats 200 without books as a parse error, not an empty shelf", () => {
    expect(() => readIdentifyHttpResult(200, JSON.stringify({}))).toThrow(IdentifyClientError);
    try {
      readIdentifyHttpResult(200, JSON.stringify({ object: undefined }));
    } catch (error) {
      const err = error as IdentifyClientError;
      expect(err.kind).toBe("parse");
      expect(err.message).toMatch(/HTTP 200/);
      expect(err.message).toMatch(/not an empty shelf/i);
    }
  });

  it("surfaces 401 as a fatal auth error", () => {
    try {
      readIdentifyHttpResult(401, JSON.stringify({ error: "vision_failed", message: "nope" }));
      throw new Error("expected throw");
    } catch (error) {
      const err = error as IdentifyClientError;
      expect(err.fatal).toBe(true);
      expect(err.kind).toBe("auth");
      expect(err.status).toBe(401);
      expect(err.message).toMatch(/401/);
    }
  });

  it("surfaces 429 as a fatal rate-limit error", () => {
    try {
      readIdentifyHttpResult(429, "Too many requests");
      throw new Error("expected throw");
    } catch (error) {
      const err = error as IdentifyClientError;
      expect(err.fatal).toBe(true);
      expect(err.kind).toBe("rate_limit");
      expect(err.message).toMatch(/429/);
    }
  });

  it("surfaces 502 parse failures without stopping other bands", () => {
    try {
      readIdentifyHttpResult(
        502,
        JSON.stringify({ error: "parse", message: "Vision output did not parse (HTTP 502)." }),
      );
      throw new Error("expected throw");
    } catch (error) {
      const err = error as IdentifyClientError;
      expect(err.fatal).toBe(false);
      expect(err.kind).toBe("parse");
      expect(err.message).toMatch(/502/);
    }
  });
});
