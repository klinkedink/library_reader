import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseGoodreadsCsv } from "./csv";
import { rankShelf } from "./ranking";

describe("sample Goodreads demo CSV", () => {
  const csv = readFileSync("public/sample-goodreads-demo.csv", "utf8");
  const books = parseGoodreadsCsv(csv);

  it("loads the labeled demo library", () => {
    expect(books.length).toBeGreaterThan(10);
    expect(books.some((b) => b.exclusiveShelf === "to-read")).toBe(true);
    expect(books.some((b) => b.exclusiveShelf === "read" && b.myRating >= 5)).toBe(
      true,
    );
  });

  it("will not recommend an already-read demo title from a photographed shelf", () => {
    const result = rankShelf(
      [
        {
          id: "1",
          title: "Never Let Me Go",
          author: "Kazuo Ishiguro",
          confidence: 0.9,
        },
        {
          id: "2",
          title: "Klara and the Sun",
          author: "Kazuo Ishiguro",
          confidence: 0.9,
        },
      ],
      books,
    );
    expect(result.alreadyRead.map((r) => r.book.title)).toContain("Never Let Me Go");
    expect(result.picks.map((r) => r.book.title)).toContain("Klara and the Sun");
    expect(result.picks.map((r) => r.book.title)).not.toContain("Never Let Me Go");
  });
});
