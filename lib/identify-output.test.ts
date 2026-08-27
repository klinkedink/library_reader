import { describe, expect, it } from "vitest";
import { coerceIdentifyBooks, parseIdentifyBooksFromText } from "./identify-output";

describe("coerceIdentifyBooks", () => {
  it("reads { books }", () => {
    const result = coerceIdentifyBooks({
      books: [{ title: "Twilight", author: "Stephenie Meyer", confidence: 0.9 }],
    });
    expect(result?.books).toHaveLength(1);
    expect(result?.books[0].title).toBe("Twilight");
  });

  it("wraps a raw array (legacy generateObject shape)", () => {
    const result = coerceIdentifyBooks([
      { title: "Narnia", author: "", confidence: 0.4 },
    ]);
    expect(result?.books[0].title).toBe("Narnia");
  });

  it("returns null when books is missing — that is not an empty shelf", () => {
    expect(coerceIdentifyBooks({})).toBeNull();
    expect(coerceIdentifyBooks(undefined)).toBeNull();
    expect(coerceIdentifyBooks({ object: undefined })).toBeNull();
  });

  it("fills missing author/confidence so a title-only object still counts", () => {
    const result = coerceIdentifyBooks({
      books: [{ title: "Think and Grow Rich" }],
    });
    expect(result?.books[0]).toMatchObject({
      title: "Think and Grow Rich",
      author: "",
      confidence: 0.5,
    });
  });

  it("treats an explicit empty books array as a real empty tile", () => {
    expect(coerceIdentifyBooks({ books: [] })).toEqual({ books: [] });
  });
});

describe("parseIdentifyBooksFromText", () => {
  it("parses fenced JSON", () => {
    const result = parseIdentifyBooksFromText(
      '```json\n{"books":[{"title":"Enron","author":"","confidence":0.7}]}\n```',
    );
    expect(result?.books[0].title).toBe("Enron");
  });
});
