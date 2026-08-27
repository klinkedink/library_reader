import type { BookMetadata } from "./types";

const OL = "https://openlibrary.org";

export type OpenLibraryDoc = {
  title?: string;
  author_name?: string[];
  isbn?: string[];
  cover_i?: number;
  subject?: string[];
  key?: string;
  cover_edition_key?: string;
  ratings_average?: number;
  ratings_count?: number;
};

export type GoogleVolume = {
  volumeInfo?: {
    title?: string;
    authors?: string[];
    industryIdentifiers?: { type: string; identifier: string }[];
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
    categories?: string[];
    infoLink?: string;
    canonicalVolumeLink?: string;
    averageRating?: number;
    ratingsCount?: number;
  };
};

function q(value: string): string {
  return encodeURIComponent(value.slice(0, 180));
}

async function fetchJson<T>(url: string, timeoutMs = 8000): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function uniqueSubjects(lists: Array<string[] | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const raw of list ?? []) {
      const key = raw.trim();
      if (!key) continue;
      const folded = key.toLowerCase();
      if (seen.has(folded)) continue;
      seen.add(folded);
      out.push(key);
      if (out.length >= 16) return out;
    }
  }
  return out;
}

export function emptyBookMetadata(title: string, author: string): BookMetadata {
  return {
    coverUrl: null,
    isbn: null,
    openLibraryUrl: `${OL}/search?q=${q(`${title} ${author}`.trim())}`,
    subjects: [],
    averageRating: null,
    ratingsCount: null,
  };
}

export function pickGoogleVolume(
  items: GoogleVolume[] | undefined,
  title: string,
): GoogleVolume | null {
  if (!items?.length) return null;
  const foldedTitle = title.trim().toLowerCase();
  const scored = items.map((item) => {
    const info = item.volumeInfo;
    const volTitle = (info?.title ?? "").toLowerCase();
    const titleHit =
      Boolean(foldedTitle) &&
      (volTitle.includes(foldedTitle.slice(0, 16)) || foldedTitle.includes(volTitle.slice(0, 16)));
    return {
      item,
      titleHit,
      ratings: info?.ratingsCount ?? 0,
    };
  });
  scored.sort((a, b) => Number(b.titleHit) - Number(a.titleHit) || b.ratings - a.ratings);
  return scored[0]?.item ?? items[0];
}

export function mergeBookMetadata(
  title: string,
  author: string,
  ol: OpenLibraryDoc | null | undefined,
  google: GoogleVolume | null | undefined,
): BookMetadata {
  const empty = emptyBookMetadata(title, author);
  const info = google?.volumeInfo;
  const isbn =
    ol?.isbn?.find((v) => v.replace(/\D/g, "").length >= 10) ??
    info?.industryIdentifiers?.find((id) => id.type === "ISBN_13")?.identifier ??
    info?.industryIdentifiers?.find((id) => id.type === "ISBN_10")?.identifier ??
    null;
  const olCover = ol?.cover_i
    ? `https://covers.openlibrary.org/b/id/${ol.cover_i}-M.jpg`
    : isbn
      ? `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg`
      : null;
  const gCover = info?.imageLinks?.thumbnail || info?.imageLinks?.smallThumbnail || null;
  const workKey = ol?.key?.startsWith("/works/") ? ol.key : null;

  const gAvg = typeof info?.averageRating === "number" ? info.averageRating : null;
  const gCount = typeof info?.ratingsCount === "number" ? info.ratingsCount : null;
  const olAvg = typeof ol?.ratings_average === "number" ? ol.ratings_average : null;
  const olCount = typeof ol?.ratings_count === "number" ? ol.ratings_count : null;

  return {
    coverUrl: olCover || (gCover ? gCover.replace("http://", "https://") : null),
    isbn,
    openLibraryUrl: workKey ? `${OL}${workKey}` : empty.openLibraryUrl,
    subjects: uniqueSubjects([ol?.subject, info?.categories]),
    averageRating: gAvg && gAvg > 0 ? gAvg : olAvg && olAvg > 0 ? olAvg : gAvg ?? olAvg,
    ratingsCount: gCount && gCount > 0 ? gCount : olCount && olCount > 0 ? olCount : gCount ?? olCount,
  };
}

export async function lookupBookMetadata(
  title: string,
  author: string,
): Promise<BookMetadata> {
  const olUrl = `${OL}/search.json?title=${q(title)}${author ? `&author=${q(author)}` : ""}&limit=5`;
  const gq = `intitle:${title}${author ? ` inauthor:${author}` : ""}`;
  const gUrl = `https://www.googleapis.com/books/v1/volumes?q=${q(gq)}&maxResults=3`;

  const [ol, google] = await Promise.all([
    fetchJson<{ docs?: OpenLibraryDoc[] }>(olUrl),
    fetchJson<{ items?: GoogleVolume[] }>(gUrl),
  ]);

  return mergeBookMetadata(title, author, ol?.docs?.[0], pickGoogleVolume(google?.items, title));
}

export function goodreadsSearchUrl(title: string, author: string): string {
  return `https://www.goodreads.com/search?q=${q(`${title} ${author}`.trim())}`;
}

export function goodreadsBookUrl(id: string): string {
  return `https://www.goodreads.com/book/show/${id}`;
}
