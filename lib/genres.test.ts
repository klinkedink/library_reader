import { describe, expect, it } from "vitest";
import { classifyGenres } from "./genres";

describe("classifyGenres", () => {
  it("maps the common shelf genres from subjects", () => {
    expect(classifyGenres(["Young Adult Fiction", "Vampires", "Fantasy fiction"])).toEqual(
      expect.arrayContaining(["ya", "fantasy", "fiction"]),
    );
    expect(classifyGenres(["Self-Help", "Success", "Business"])).toEqual(
      expect.arrayContaining(["selfhelp", "nonfiction"]),
    );
    expect(classifyGenres(["Biography & Autobiography", "Memoir"])).toEqual(
      expect.arrayContaining(["biography", "nonfiction"]),
    );
    expect(classifyGenres(["Science fiction", "Dystopias"])).toEqual(
      expect.arrayContaining(["scifi", "fiction"]),
    );
    expect(classifyGenres(["Travel", "Guidebooks"])).toEqual(
      expect.arrayContaining(["travel", "nonfiction"]),
    );
    expect(classifyGenres(["Mystery", "Thriller"])).toEqual(
      expect.arrayContaining(["mystery", "fiction"]),
    );
    expect(classifyGenres(["Romance", "Love stories"])).toEqual(
      expect.arrayContaining(["romance", "fiction"]),
    );
    expect(classifyGenres(["History", "World War II"])).toEqual(
      expect.arrayContaining(["history", "nonfiction"]),
    );
    expect(classifyGenres(["Literary fiction", "Novels"])).toEqual(
      expect.arrayContaining(["fiction"]),
    );
  });

  it("does not treat non-fiction as fiction", () => {
    const genres = classifyGenres(["Non-fiction", "Business"]);
    expect(genres).toContain("nonfiction");
    expect(genres).not.toContain("fiction");
  });

  it("maps Goodreads sci-fi shelves", () => {
    expect(classifyGenres(["sci-fi", "to-read"])).toContain("scifi");
  });

  it("returns nothing for empty tags", () => {
    expect(classifyGenres([])).toEqual([]);
  });
});
