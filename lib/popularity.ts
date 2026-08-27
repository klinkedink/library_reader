export type PopularityInfo = {
  averageRating: number | null;
  ratingsCount: number | null;
};

export function popularityScore(info: PopularityInfo | undefined | null): number {
  const avg = info?.averageRating;
  const count = info?.ratingsCount;
  if (!avg || avg <= 0) return 0;
  const votes = Math.max(0, count ?? 0);
  const m = 20;
  const C = 3.8;
  const bayesian = (votes / (votes + m)) * avg + (m / (votes + m)) * C;
  return bayesian * Math.log10(votes + 10);
}

export function formatRatingCount(count: number): string {
  if (count >= 1_000_000) {
    const n = count / 1_000_000;
    return `${n >= 10 ? Math.round(n) : n.toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (count >= 10_000) return `${Math.round(count / 1000)}k`;
  return count.toLocaleString("en-US");
}

export function popularityReason(info: PopularityInfo | undefined | null): string | null {
  const avg = info?.averageRating;
  const count = info?.ratingsCount;
  if (avg && avg > 0 && count && count > 0) {
    return `${avg.toFixed(1)}★ from ${formatRatingCount(count)} ratings.`;
  }
  if (avg && avg > 0) return `${avg.toFixed(1)}★ average.`;
  return null;
}
