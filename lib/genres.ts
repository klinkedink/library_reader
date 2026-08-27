import { fold } from "./normalize";

export const SHELF_GENRE_IDS = [
  "fiction",
  "nonfiction",
  "fantasy",
  "scifi",
  "mystery",
  "romance",
  "history",
  "biography",
  "selfhelp",
  "travel",
  "ya",
] as const;

export type ShelfGenreId = (typeof SHELF_GENRE_IDS)[number];

export const SHELF_GENRE_LABELS: Record<ShelfGenreId, string> = {
  fiction: "Fiction",
  nonfiction: "Non-fiction",
  fantasy: "Fantasy",
  scifi: "Sci-fi",
  mystery: "Mystery/thriller",
  romance: "Romance",
  history: "History",
  biography: "Biography/memoir",
  selfhelp: "Self-help",
  travel: "Travel",
  ya: "YA",
};

type GenreRule = {
  id: ShelfGenreId;
  phrases: string[];
};

const SPECIFIC_RULES: GenreRule[] = [
  {
    id: "ya",
    phrases: [
      "young adult",
      "juvenile fiction",
      "juvenile",
      "teen fiction",
      "ya fiction",
      "children",
      "childrens",
    ],
  },
  {
    id: "fantasy",
    phrases: ["fantasy", "magic", "mythology", "fairy tale", "fairy tales", "epic fantasy", "urban fantasy"],
  },
  {
    id: "scifi",
    phrases: [
      "science fiction",
      "sci fi",
      "scifi",
      "dystopia",
      "dystopian",
      "cyberpunk",
      "space opera",
      "speculative fiction",
    ],
  },
  {
    id: "mystery",
    phrases: ["mystery", "thriller", "crime", "detective", "suspense", "noir", "true crime"],
  },
  {
    id: "romance",
    phrases: ["romance", "love stories", "romantic"],
  },
  {
    id: "history",
    phrases: ["history", "historical", "world war", "civil war"],
  },
  {
    id: "biography",
    phrases: ["biography", "autobiography", "memoir", "biographical"],
  },
  {
    id: "selfhelp",
    phrases: [
      "self help",
      "selfhelp",
      "personal development",
      "personal growth",
      "productivity",
      "business",
      "success",
      "habit",
      "habits",
      "motivational",
    ],
  },
  {
    id: "travel",
    phrases: ["travel", "guidebook", "guide book", "lonely planet", "voyages"],
  },
];

function haystack(tags: string[]): string {
  return ` ${tags
    .map((tag) =>
      fold(tag)
        .replace(/[-_/]/g, " ")
        .replace(/non\s*fiction/g, "nonfic")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean)
    .join(" ")} `;
}

function hasPhrase(hay: string, phrase: string): boolean {
  const needle = fold(phrase).replace(/[-_/]/g, " ").replace(/\s+/g, " ").trim();
  if (!needle) return false;
  if (needle.includes(" ")) return hay.includes(needle);
  return hay.includes(` ${needle} `);
}

export function classifyGenres(tags: string[]): ShelfGenreId[] {
  const hay = haystack(tags);
  if (!hay.trim()) return [];

  const found = new Set<ShelfGenreId>();
  for (const rule of SPECIFIC_RULES) {
    if (rule.phrases.some((phrase) => hasPhrase(hay, phrase))) {
      found.add(rule.id);
    }
  }

  const nonfictionSignal =
    found.has("history") ||
    found.has("biography") ||
    found.has("selfhelp") ||
    found.has("travel") ||
    hasPhrase(hay, "nonfic") ||
    hasPhrase(hay, "essays") ||
    hasPhrase(hay, "philosophy") ||
    hasPhrase(hay, "politics") ||
    hasPhrase(hay, "science") && !found.has("scifi");

  const fictionSignal =
    found.has("fantasy") ||
    found.has("scifi") ||
    found.has("mystery") ||
    found.has("romance") ||
    found.has("ya") ||
    hasPhrase(hay, "fiction") ||
    hasPhrase(hay, "novel") ||
    hasPhrase(hay, "literary") ||
    hasPhrase(hay, "literature");

  if (fictionSignal) found.add("fiction");
  if (nonfictionSignal) found.add("nonfiction");

  return SHELF_GENRE_IDS.filter((id) => found.has(id));
}

export function genreLabel(id: ShelfGenreId): string {
  return SHELF_GENRE_LABELS[id];
}
