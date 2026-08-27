import { z } from "zod";

/**
 * Every property must be required. OpenAI structured-output strict mode
 * (and AI SDK's Zod conversion with `io: "input"`) rejects optional keys:
 * required must list every key in properties. Use "" for unknown author.
 */
export const detectedSpineSchema = z.object({
  title: z
    .string()
    .describe(
      "Title as printed on the spine or cover in this tile. Partial titles are required when only some letters are readable.",
    ),
  author: z
    .string()
    .describe("Author as printed. Empty string if the author is not readable."),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe(
      "0.9+ clearly readable, 0.6-0.89 likely, 0.25-0.59 only part of the spine is readable. Never omit a book just because confidence is low.",
    ),
});

export const identifyResponseSchema = z.object({
  books: z
    .array(detectedSpineSchema)
    .describe("Every lettered spine in this tile. Empty only if none are readable."),
});

export const SPINE_PROMPT = `You are reading ONE TILE of a real bookshelf photograph. The tile may be:
- a single front-on shelf of readable spines (common), or
- one overlapping horizontal band of a tall closet, sometimes the left or right half of a wide bay.

You MUST return every book in THIS tile for which you can read any part of the title, a series name, or a distinctive spine word. An empty list is wrong if lettered spines are visible.

Expected in frame:
- One shelf is common; two to many shelves on closet tiles
- Bright home lighting or dim shop lighting
- Paperbacks and hardcovers mixed; vertical spines with readable type
- Volumes stacked horizontally — read rotated / sideways text
- Mixed languages, worn fonts, partial occlusion

Rules:
- Return a book whenever you can make out at least a few letters of a title or a series brand. Use confidence 0.25–0.55 when unsure.
- Transcribe what is printed. If you only see "Twilight" or "Think and Grow Rich", return that. Do not invent a subtitle you cannot see, and do not skip the book.
- Never invent a title that is not in THIS tile. Do not complete a half-read spine from memory of bestsellers.
- Author may be an empty string.
- Include thin paperbacks and books lying on their sides.
- Skip only blank wood, plants, and objects with no lettering.
- Deduplicate the same physical volume inside this tile.

Aim for a complete inventory of lettered spines in the crop, not a short high-confidence sample.`;

export const TILE_USER_PROMPT =
  'Inventory every spine and cover text you can read in this photo tile. Return { "books": [ { "title", "author", "confidence" } ] }. Partial titles with low confidence are required. Do not invent books that are not in this tile. An empty books array is only correct if there is no readable lettering.';
