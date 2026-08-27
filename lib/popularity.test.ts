import { describe, expect, it } from "vitest";
import { formatRatingCount, popularityReason, popularityScore } from "./popularity";

describe("popularityScore", () => {
  it("ranks a well-rated, widely logged book above a 5★ with almost no votes", () => {
    const popular = popularityScore({ averageRating: 4.4, ratingsCount: 80_000 });
    const obscure = popularityScore({ averageRating: 5, ratingsCount: 3 });
    expect(popular).toBeGreaterThan(obscure);
  });

  it("is zero without a rating", () => {
    expect(popularityScore({ averageRating: null, ratingsCount: 9000 })).toBe(0);
    expect(popularityScore(undefined)).toBe(0);
  });
});

describe("popularityReason", () => {
  it("formats Google Books ratings", () => {
    expect(popularityReason({ averageRating: 4.6, ratingsCount: 8431 })).toBe(
      "4.6★ from 8,431 ratings.",
    );
    expect(popularityReason({ averageRating: 4.7, ratingsCount: 84_212 })).toMatch(/84k/);
  });
});

describe("formatRatingCount", () => {
  it("compacts large counts", () => {
    expect(formatRatingCount(9999)).toBe("9,999");
    expect(formatRatingCount(12_400)).toBe("12k");
  });
});
