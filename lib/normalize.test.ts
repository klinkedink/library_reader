import { describe, expect, it } from "vitest";
import {
  authorsMatch,
  isbnDigits,
  isbnsMatch,
  normalizeTitle,
  parseAuthor,
  titlesSimilar,
} from "./normalize";

describe("normalizeTitle", () => {
  it("strips series parentheticals and leading articles", () => {
    expect(normalizeTitle("The Left Hand of Darkness (Hainish Cycle, #1)")).toBe(
      "left hand of darkness",
    );
  });

  it("treats punctuation and case as the same book", () => {
    expect(normalizeTitle("Never Let Me Go")).toBe(
      normalizeTitle("never let me go:"),
    );
  });
});

describe("authorsMatch", () => {
  it("matches inverted Goodreads names", () => {
    expect(authorsMatch("Kazuo Ishiguro", "Ishiguro, Kazuo")).toBe(true);
    expect(authorsMatch("Emily St. John Mandel", "Mandel, Emily St. John")).toBe(
      true,
    );
  });

  it("matches compound last names", () => {
    expect(authorsMatch("Ursula K. Le Guin", "Le Guin, Ursula K.")).toBe(true);
    expect(authorsMatch("Ursula Le Guin", "Ursula K. Le Guin")).toBe(true);
  });

  it("does not collapse different people who share a last name", () => {
    expect(authorsMatch("Stephen King", "Tabitha King")).toBe(false);
  });

  it("parses last names from either order", () => {
    expect(parseAuthor("Le Guin, Ursula K.").last).toBe("le guin");
    expect(parseAuthor("Ursula K. Le Guin").last).toBe("le guin");
  });
});

describe("isbn", () => {
  it("strips Goodreads =\"\" wrappers", () => {
    expect(isbnDigits('="9780316769174"')).toBe("9780316769174");
    expect(isbnDigits('=""')).toBeNull();
  });

  it("matches ISBN-10 against ISBN-13", () => {
    expect(isbnsMatch("9780553381689", "0553381689")).toBe(true);
  });
});

describe("titlesSimilar", () => {
  it("matches a truncated spine against the full title", () => {
    expect(titlesSimilar("Left Hand of Darkness", "The Left Hand of Darkness")).toBe(
      true,
    );
  });
});
