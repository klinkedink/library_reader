const STOP_TITLE = new Set(["the", "a", "an"]);

export function fold(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .trim();
}

export function stripIsbnDecorations(value: string | undefined | null): string | null {
  if (!value) return null;
  const digits = value.replace(/[^0-9Xx]/g, "").toUpperCase();
  if (digits.length === 10 || digits.length === 13) return digits;
  return null;
}

export function isbnDigits(value: string | null | undefined): string | null {
  const cleaned = stripIsbnDecorations(value);
  return cleaned;
}

export function isbnsMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const na = isbnDigits(a);
  const nb = isbnDigits(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length === 13 && nb.length === 10) return na.slice(3) === nb;
  if (nb.length === 13 && na.length === 10) return nb.slice(3) === na;
  return false;
}

export function normalizeTitle(title: string): string {
  let t = fold(title);
  t = t.replace(/\(.*?\)/g, " ");
  t = t.replace(/\[.*?\]/g, " ");
  t = t.replace(/[:/;,]/g, " ");
  t = t.replace(/\b(vol\.?|volume|book|#)\s*\d+\b/g, " ");
  t = t.replace(/[^a-z0-9\s]/g, " ");
  const tokens = t
    .split(/\s+/)
    .filter((tok) => tok && !STOP_TITLE.has(tok));
  return tokens.join(" ");
}

export function titleTokens(title: string): string[] {
  return normalizeTitle(title)
    .split(" ")
    .filter((tok) => tok.length > 2);
}

export type AuthorParts = {
  first: string;
  last: string;
  tokens: string[];
};

export function parseAuthor(name: string): AuthorParts {
  const cleaned = fold(name).replace(/[^a-z\s,.-]/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return { first: "", last: "", tokens: [] };

  if (cleaned.includes(",")) {
    const [lastRaw, restRaw = ""] = cleaned.split(",", 2);
    const lastTokens = tokenizeAuthor(lastRaw);
    const restTokens = tokenizeAuthor(restRaw);
    return {
      last: lastTokens.join(" "),
      first: restTokens[0] ?? "",
      tokens: [...restTokens, ...lastTokens],
    };
  }

  const tokens = tokenizeAuthor(cleaned);
  const last = compoundLastName(tokens);
  const first = tokens[0] ?? "";
  return { first, last, tokens };
}

function tokenizeAuthor(value: string): string[] {
  return value
    .split(/[\s.]+/)
    .map((part) => part.replace(/-/g, " ").trim())
    .flatMap((part) => part.split(" "))
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function compoundLastName(tokens: string[]): string {
  if (tokens.length === 0) return "";
  const particles = new Set(["le", "la", "de", "del", "da", "van", "von", "st", "saint"]);
  if (tokens.length >= 2 && particles.has(tokens[tokens.length - 2])) {
    return `${tokens[tokens.length - 2]} ${tokens[tokens.length - 1]}`;
  }
  return tokens[tokens.length - 1];
}

export function authorsMatch(a: string, b: string): boolean {
  if (!a.trim() || !b.trim()) return false;
  const pa = parseAuthor(a);
  const pb = parseAuthor(b);
  if (!pa.last || !pb.last) return fold(a) === fold(b);
  if (pa.last !== pb.last) return false;

  const firstA = significantFirst(pa);
  const firstB = significantFirst(pb);
  if (!firstA || !firstB) return true;
  if (firstA.length === 1 || firstB.length === 1) {
    return firstA[0] === firstB[0];
  }
  return (
    firstA === firstB ||
    firstA.startsWith(firstB) ||
    firstB.startsWith(firstA)
  );
}

function significantFirst(parts: AuthorParts): string {
  const skip = new Set(["st", "saint", "de", "del", "van", "von", "le", "la"]);
  return parts.tokens.find((tok) => tok.length > 0 && !skip.has(tok) && tok !== parts.last.split(" ")[0]) ?? "";
}

export function bookKey(title: string, author: string): string {
  return `${normalizeTitle(title)}|${parseAuthor(author).last}`;
}

export function titlesSimilar(a: string, b: string): boolean {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.startsWith(nb) || nb.startsWith(na)) {
    const shorter = na.length < nb.length ? na : nb;
    return shorter.split(" ").length >= 2;
  }
  const ta = new Set(titleTokens(a));
  const tb = new Set(titleTokens(b));
  if (ta.size === 0 || tb.size === 0) return false;
  let overlap = 0;
  for (const tok of ta) {
    if (tb.has(tok)) overlap += 1;
  }
  const min = Math.min(ta.size, tb.size);
  return overlap >= 2 && overlap / min >= 0.7;
}

export function uniqueNormalized(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = fold(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}
