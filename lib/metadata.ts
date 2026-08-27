import type { BookMetadata } from "./types";

const OL = "https://openlibrary.org";

type OpenLibraryDoc = {
  title?: string;
  author_name?: string[];
  isbn?: string[];
  cover_i?: number;
  subject?: string[];
  key?: string;
  cover_edition_key?: string;
};

type GoogleVolume = {
  volumeInfo?: {
    title?: string;
    authors?: string[];
    industryIdentifiers?: { type: string; identifier: string }[];
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
    categories?: string[];
    infoLink?: string;
    canonicalVolumeLink?: string;
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

export async function lookupBookMetadata(
  title: string,
  author: string,
): Promise<BookMetadata> {
  const empty: BookMetadata = {
    coverUrl: null,
    isbn: null,
    openLibraryUrl: `${OL}/search?q=${q(`${title} ${author}`.trim())}`,
    subjects: [],
  };

  const olUrl = `${OL}/search.json?title=${q(title)}${author ? `&author=${q(author)}` : ""}&limit=5`;
  const ol = await fetchJson<{ docs?: OpenLibraryDoc[] }>(olUrl);
  const doc = ol?.docs?.[0];
  if (doc) {
    const isbn = doc.isbn?.find((v) => v.replace(/\D/g, "").length >= 10) ?? null;
    const coverUrl = doc.cover_i
      ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
      : isbn
        ? `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg`
        : null;
    const workKey = doc.key?.startsWith("/works/") ? doc.key : null;
    return {
      coverUrl,
      isbn,
      openLibraryUrl: workKey ? `${OL}${workKey}` : empty.openLibraryUrl,
      subjects: (doc.subject ?? []).slice(0, 12),
    };
  }

  const gq = `intitle:${title}${author ? ` inauthor:${author}` : ""}`;
  const gUrl = `https://www.googleapis.com/books/v1/volumes?q=${q(gq)}&maxResults=1`;
  const google = await fetchJson<{ items?: GoogleVolume[] }>(gUrl);
  const info = google?.items?.[0]?.volumeInfo;
  if (!info) return empty;

  const isbn =
    info.industryIdentifiers?.find((id) => id.type === "ISBN_13")?.identifier ??
    info.industryIdentifiers?.find((id) => id.type === "ISBN_10")?.identifier ??
    null;
  const thumb = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || null;

  return {
    coverUrl: thumb ? thumb.replace("http://", "https://") : null,
    isbn,
    openLibraryUrl: empty.openLibraryUrl,
    subjects: info.categories ?? [],
  };
}

export function goodreadsSearchUrl(title: string, author: string): string {
  return `https://www.goodreads.com/search?q=${q(`${title} ${author}`.trim())}`;
}

export function goodreadsBookUrl(id: string): string {
  return `https://www.goodreads.com/book/show/${id}`;
}
