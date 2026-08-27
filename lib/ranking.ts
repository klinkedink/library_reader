import type {
  DetectedBook,
  GenreShelfGroup,
  GoodreadsBook,
  RankedShelfBook,
  RankingResult,
  ShelfMatchKind,
} from "./types";
import {
  authorsMatch,
  bookKey,
  fold,
  isbnsMatch,
  titleTokens,
  titlesSimilar,
} from "./normalize";
import {
  buildTasteModel,
  findAuthorStats,
  isCurrentlyReading,
  isGenreShelf,
  isQueued,
  isRead,
  type TasteModel,
} from "./taste";
import { classifyGenres, genreLabel, SHELF_GENRE_IDS, type ShelfGenreId } from "./genres";
import { popularityReason, popularityScore, type PopularityInfo } from "./popularity";

const MAX_PICKS = 7;
const MIN_PICKS = 3;

export type { PopularityInfo };

function pickThreshold(librarySize: number): number {
  if (librarySize <= 12) return 5;
  if (librarySize <= 30) return 8;
  return 14;
}

export function findLibraryMatch(
  book: DetectedBook,
  library: GoodreadsBook[],
): GoodreadsBook | null {
  if (book.isbn) {
    const isbnHit = library.find(
      (item) => isbnsMatch(item.isbn, book.isbn) || isbnsMatch(item.isbn13, book.isbn),
    );
    if (isbnHit) return isbnHit;
  }

  const exact = library.find(
    (item) => bookKey(item.title, item.author) === bookKey(book.title, book.author),
  );
  if (exact) return exact;

  const titleHits = library.filter((item) => titlesSimilar(item.title, book.title));
  if (titleHits.length === 1 && (!book.author.trim() || authorsMatch(titleHits[0].author, book.author) || !titleHits[0].author)) {
    return titleHits[0];
  }
  const withAuthor = titleHits.find((item) => authorsMatch(item.author, book.author));
  if (withAuthor) return withAuthor;

  if (book.author.trim()) {
    const authorBooks = library.filter((item) => authorsMatch(item.author, book.author));
    const close = authorBooks.find((item) => titlesSimilar(item.title, book.title));
    if (close) return close;
  }

  return null;
}

function kindFor(match: GoodreadsBook | null): ShelfMatchKind {
  if (!match) return "weak";
  if (isCurrentlyReading(match)) return "currently-reading";
  if (isRead(match)) return "already-read";
  if (isQueued(match)) return "queued";
  return "weak";
}

function formatAvg(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1);
}

function authorReason(author: string, books: GoodreadsBook[]): string {
  const rated = books.filter((b) => b.myRating > 0);
  const best = [...rated].sort((a, b) => b.myRating - a.myRating)[0];
  const avg = rated.length
    ? rated.reduce((sum, b) => sum + b.myRating, 0) / rated.length
    : 0;
  if (rated.length === 1 && best) {
    return `You rated ${best.title} by ${author} ${best.myRating}★.`;
  }
  if (best) {
    return `You rated ${rated.length} books by ${author} ${formatAvg(avg)}★ on average, including ${best.title} at ${best.myRating}★.`;
  }
  return `You already have ${author} on your Goodreads shelves.`;
}

function queuedReason(match: GoodreadsBook): string {
  const when = match.dateAdded ? ` (added ${match.dateAdded})` : "";
  return `Already on your Goodreads to-read${when}.`;
}

function shelfReason(
  shelf: string,
  example: GoodreadsBook,
): string {
  const rating = example.myRating ? ` — you gave ${example.title} ${example.myRating}★` : "";
  return `Fits your “${shelf}” reading${rating}.`;
}

function seriesReason(detected: DetectedBook, liked: GoodreadsBook): string {
  return `Close to ${liked.title}, which you rated ${liked.myRating}★.`;
}

function subjectTokens(subjects: string[] | undefined): string[] {
  return (subjects ?? []).map((s) => fold(s).replace(/\s+/g, "-")).filter(Boolean);
}

function tasteGenreSet(model: TasteModel): Set<ShelfGenreId> {
  const tags = [...model.shelfWeights.keys()];
  return new Set(classifyGenres(tags));
}

export function scoreDetectedBook(
  detected: DetectedBook,
  model: TasteModel,
  subjects: string[] = [],
  popularity: PopularityInfo | null = null,
): RankedShelfBook {
  const match = findLibraryMatch(detected, model.books);
  const kind = kindFor(match);
  const reasons: string[] = [];
  let score = 0;
  const tags = [
    ...subjects,
    ...(match?.bookshelves.filter(isGenreShelf) ?? []),
  ];
  const genres = classifyGenres(tags);
  const popScore = popularityScore(popularity);
  const avg = popularity?.averageRating ?? null;
  const count = popularity?.ratingsCount ?? null;

  if (kind === "already-read" || kind === "currently-reading") {
    if (kind === "already-read") {
      reasons.push(
        match?.myRating
          ? `You already read this and rated it ${match.myRating}★.`
          : "You already logged this as read on Goodreads.",
      );
    } else {
      reasons.push("You're currently reading this on Goodreads.");
    }
    return {
      book: detected,
      score: 0,
      reasons,
      kind,
      matchedLibrary: match,
      popularityScore: popScore,
      averageRating: avg,
      ratingsCount: count,
      genres,
    };
  }

  const authorStats = findAuthorStats(model, detected.author);
  if (authorStats && authorStats.ratedCount > 0) {
    if (authorStats.avg >= 4) {
      score += 22 + authorStats.ratedCount * 8 + (authorStats.avg - 4) * 12;
      reasons.push(authorReason(detected.author || authorStats.author, authorStats.titles));
    } else if (authorStats.avg >= 3) {
      score += 8 + authorStats.ratedCount * 2;
      reasons.push(authorReason(detected.author || authorStats.author, authorStats.titles));
    } else if (authorStats.avg > 0) {
      score -= 20;
      reasons.push(
        `You've rated ${authorStats.author} ${formatAvg(authorStats.avg)}★ on average — probably skip.`,
      );
    }
  } else if (authorStats && authorStats.count > 0 && !authorStats.ratedCount) {
    score += 6;
    reasons.push(authorReason(detected.author || authorStats.author, authorStats.titles));
  }

  if (kind === "queued" && match) {
    score += 36;
    reasons.unshift(queuedReason(match));
    for (const shelf of match.bookshelves.filter(isGenreShelf).slice(0, 2)) {
      const weight = model.shelfWeights.get(fold(shelf).replace(/\s+/g, "-"));
      if (weight) {
        score += Math.min(10, weight.weight);
        reasons.push(shelfReason(shelf, weight.example));
      }
    }
  }

  const likedSeries = model.highRated.find((book) => {
    if (match && book === match) return false;
    const shared = titleTokens(detected.title).filter((tok) =>
      titleTokens(book.title).includes(tok),
    );
    return shared.length >= 2 && shared.join(" ").length >= 8;
  });
  if (likedSeries) {
    score += 16;
    reasons.push(seriesReason(detected, likedSeries));
  }

  const detectedSubjects = new Set([
    ...subjectTokens(subjects),
    ...(match?.bookshelves.filter(isGenreShelf).map((s) => fold(s).replace(/\s+/g, "-")) ?? []),
  ]);

  let bestShelf: { shelf: string; weight: number; example: GoodreadsBook } | null = null;
  for (const [shelf, info] of model.shelfWeights) {
    if (detectedSubjects.has(shelf) || [...detectedSubjects].some((s) => s.includes(shelf) || shelf.includes(s))) {
      if (!bestShelf || info.weight > bestShelf.weight) {
        bestShelf = { shelf, weight: info.weight, example: info.example };
      }
    }
  }
  if (bestShelf && !reasons.some((r) => r.includes(`“${bestShelf!.shelf}”`))) {
    score += Math.min(14, 4 + bestShelf.weight);
    reasons.push(shelfReason(bestShelf.shelf, bestShelf.example));
  }

  const likedGenres = tasteGenreSet(model);
  const overlap = genres.filter(
    (genre) => likedGenres.has(genre) && genre !== "fiction" && genre !== "nonfiction",
  );
  if (overlap.length && score >= 0) {
    score += 8 + overlap.length * 3;
    const label = genreLabel(overlap[0]);
    if (!reasons.some((r) => r.toLowerCase().includes(label.toLowerCase()))) {
      reasons.push(`Fits the ${label} books you rate highly.`);
    }
  }

  if (popScore >= 18 && score > 0) {
    const pop = popularityReason(popularity);
    if (pop) reasons.push(`Also widely read (${pop.replace(/\.$/, "")}).`);
  }

  const uniqueReasons = [...new Set(reasons)].slice(0, 2);
  const threshold = pickThreshold(model.books.length);
  const finalKind: ShelfMatchKind = kind === "queued" ? "queued" : score >= threshold ? "pick" : "weak";

  return {
    book: detected,
    score,
    reasons: uniqueReasons,
    kind: finalKind,
    matchedLibrary: match,
    popularityScore: popScore,
    averageRating: avg,
    ratingsCount: count,
    genres,
  };
}

function isDisliked(row: RankedShelfBook): boolean {
  return row.score < 0;
}

function recommendable(row: RankedShelfBook): boolean {
  return (
    row.kind !== "already-read" &&
    row.kind !== "currently-reading" &&
    !isDisliked(row)
  );
}

function combinedScore(row: RankedShelfBook): number {
  return row.score + row.popularityScore * 1.4;
}

export function rankShelf(
  detected: DetectedBook[],
  library: GoodreadsBook[],
  subjectMap: Record<string, string[]> = {},
  popularityMap: Record<string, PopularityInfo> = {},
): RankingResult {
  const model = buildTasteModel(library);
  const seen = new Set<string>();
  const ranked: RankedShelfBook[] = [];

  for (const book of detected) {
    const key = bookKey(book.title, book.author) || book.id;
    if (seen.has(key)) continue;
    seen.add(key);
    const subjects = subjectMap[book.id] ?? [];
    ranked.push(scoreDetectedBook(book, model, subjects, popularityMap[book.id] ?? null));
  }

  const alreadyRead = ranked.filter((r) => r.kind === "already-read");
  const currentlyReading = ranked.filter((r) => r.kind === "currently-reading");
  const threshold = pickThreshold(library.length);

  const candidates = ranked
    .filter((r) => r.kind === "pick" || r.kind === "queued" || (recommendable(r) && r.score > 0))
    .sort((a, b) => b.score - a.score || b.popularityScore - a.popularityScore);

  let picks = candidates.filter((r) => r.kind === "queued" || r.score >= threshold);
  if (picks.length < MIN_PICKS) {
    const extra = candidates.filter((r) => !picks.includes(r) && r.score > 0);
    picks = [...picks, ...extra];
  }
  picks = picks.slice(0, MAX_PICKS);
  for (const pick of picks) {
    if (pick.kind === "weak") pick.kind = "pick";
  }

  const pickIds = new Set(picks.map((p) => p.book.id));
  const rest = ranked.filter(
    (r) =>
      r.kind !== "already-read" &&
      r.kind !== "currently-reading" &&
      !pickIds.has(r.book.id),
  );

  const popular = [...ranked]
    .filter((r) => r.averageRating || (r.ratingsCount && r.ratingsCount > 0))
    .sort((a, b) => b.popularityScore - a.popularityScore)
    .slice(0, 7)
    .map((row) => {
      const pop = popularityReason({
        averageRating: row.averageRating,
        ratingsCount: row.ratingsCount,
      });
      return {
        ...row,
        reasons: pop ? [pop, ...row.reasons.filter((reason) => reason !== pop)].slice(0, 2) : row.reasons,
      };
    });

  const genres: GenreShelfGroup[] = [];
  for (const id of SHELF_GENRE_IDS) {
    const books = ranked
      .filter((row) => row.genres.includes(id))
      .sort((a, b) => {
        const aRec = Number(recommendable(a));
        const bRec = Number(recommendable(b));
        if (bRec !== aRec) return bRec - aRec;
        return combinedScore(b) - combinedScore(a);
      })
      .slice(0, 3);
    if (books.length === 0) continue;
    genres.push({ id, label: genreLabel(id), books });
  }

  return {
    picks,
    popular,
    genres,
    alreadyRead,
    currentlyReading,
    rest,
    tasteBookCount: library.length,
    ratedCount: library.filter((book) => book.myRating > 0).length,
  };
}
