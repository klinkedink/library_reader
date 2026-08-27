import type {
  DetectedBook,
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

const MAX_PICKS = 7;
const MIN_PICK_SCORE = 14;

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

export function scoreDetectedBook(
  detected: DetectedBook,
  model: TasteModel,
  subjects: string[] = [],
): RankedShelfBook {
  const match = findLibraryMatch(detected, model.books);
  const kind = kindFor(match);
  const reasons: string[] = [];
  let score = 0;

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
    return { book: detected, score: 0, reasons, kind, matchedLibrary: match };
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

  const uniqueReasons = [...new Set(reasons)].slice(0, 2);
  const finalKind: ShelfMatchKind = kind === "queued" ? "queued" : score >= MIN_PICK_SCORE ? "pick" : "weak";

  return {
    book: detected,
    score,
    reasons: uniqueReasons,
    kind: finalKind,
    matchedLibrary: match,
  };
}

export function rankShelf(
  detected: DetectedBook[],
  library: GoodreadsBook[],
  subjectMap: Record<string, string[]> = {},
): RankingResult {
  const model = buildTasteModel(library);
  const seen = new Set<string>();
  const ranked: RankedShelfBook[] = [];

  for (const book of detected) {
    const key = bookKey(book.title, book.author) || book.id;
    if (seen.has(key)) continue;
    seen.add(key);
    const subjects = subjectMap[book.id] ?? [];
    ranked.push(scoreDetectedBook(book, model, subjects));
  }

  const alreadyRead = ranked.filter((r) => r.kind === "already-read");
  const currentlyReading = ranked.filter((r) => r.kind === "currently-reading");
  const candidates = ranked
    .filter((r) => r.kind === "pick" || r.kind === "queued")
    .sort((a, b) => b.score - a.score);

  const picks = candidates.filter((r) => r.score >= MIN_PICK_SCORE).slice(0, MAX_PICKS);
  const pickIds = new Set(picks.map((p) => p.book.id));
  const rest = ranked.filter(
    (r) =>
      r.kind !== "already-read" &&
      r.kind !== "currently-reading" &&
      !pickIds.has(r.book.id),
  );

  return { picks, alreadyRead, currentlyReading, rest };
}
