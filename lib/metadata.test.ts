import { describe, expect, it } from "vitest";
import { mergeBookMetadata, pickGoogleVolume } from "./metadata";

describe("mergeBookMetadata", () => {
  it("prefers Google Books ratings when both sources have them", () => {
    const meta = mergeBookMetadata(
      "Twilight",
      "Stephenie Meyer",
      {
        key: "/works/OL123W",
        subject: ["Vampires", "Fantasy fiction"],
        ratings_average: 3.8,
        ratings_count: 200,
        cover_i: 9,
        isbn: ["9780316015844"],
      },
      {
        volumeInfo: {
          averageRating: 4.6,
          ratingsCount: 84000,
          categories: ["Young Adult Fiction"],
        },
      },
    );
    expect(meta.averageRating).toBe(4.6);
    expect(meta.ratingsCount).toBe(84000);
    expect(meta.subjects).toEqual(
      expect.arrayContaining(["Vampires", "Fantasy fiction", "Young Adult Fiction"]),
    );
    expect(meta.coverUrl).toContain("covers.openlibrary.org");
    expect(meta.isbn).toBe("9780316015844");
  });

  it("falls back to Open Library ratings when Google has none", () => {
    const meta = mergeBookMetadata("Narnia", "Lewis", {
      ratings_average: 4.2,
      ratings_count: 1500,
      subject: ["Fantasy"],
    }, {
      volumeInfo: { categories: ["Juvenile Fiction"] },
    });
    expect(meta.averageRating).toBe(4.2);
    expect(meta.ratingsCount).toBe(1500);
  });
});

describe("pickGoogleVolume", () => {
  it("prefers a title match with more ratings", () => {
    const picked = pickGoogleVolume(
      [
        { volumeInfo: { title: "Unrelated", ratingsCount: 999999, averageRating: 5 } },
        { volumeInfo: { title: "Think and Grow Rich", ratingsCount: 12000, averageRating: 4.2 } },
      ],
      "Think and Grow Rich",
    );
    expect(picked?.volumeInfo?.title).toBe("Think and Grow Rich");
  });
});
