import { z } from "zod";

export const detectedSpineSchema = z.object({
  title: z
    .string()
    .describe("Title as printed on the spine or cover. Empty if unreadable."),
  author: z
    .string()
    .describe("Author as printed. Empty string if the author is not readable."),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe(
      "0.9+ clearly readable, 0.6-0.89 likely, 0.3-0.59 uncertain. Skip anything weaker.",
    ),
});

export const identifyResponseSchema = z.object({
  books: z.array(detectedSpineSchema),
});

export const SPINE_PROMPT = `You are reading a photograph of a real bookshelf. Identify every book whose title you can actually read from a spine or cover in the image.

Rules:
- Only return books you can see. Never invent, complete, or guess popular titles that are not visible.
- If a spine is partially readable, return what you can with low confidence (0.3-0.5). Do not fill in the rest from memory.
- If you cannot read a spine at all, skip it. Empty shelves, plants, and unlabeled boxes are not books.
- Prefer the full title as printed, not a nickname or series shorthand.
- Author may be missing; use an empty string if it is unreadable.
- Deduplicate the same physical volume if it appears twice.
- The photo may be angled, dim, or tightly cropped. Read rotated text.
- Do not include magazines, board games, or binders.`;
