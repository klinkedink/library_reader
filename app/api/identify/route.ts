import {
  generateText,
  Output,
  APICallError,
  NoObjectGeneratedError,
  NoOutputGeneratedError,
  type LanguageModel,
} from "ai";
import { getVisionProvider } from "@/lib/provider";
import { parseDataUrl } from "@/lib/image";
import { formatIdentifyError } from "@/lib/identify-error";
import {
  coerceIdentifyBooks,
  parseIdentifyBooksFromText,
  type IdentifyBooks,
} from "@/lib/identify-output";
import { identifyResponseSchema, SPINE_PROMPT, TILE_USER_PROMPT } from "@/lib/vision";

export const maxDuration = 60;

function httpStatusFor(error: unknown): number {
  if (APICallError.isInstance(error) && typeof error.statusCode === "number") {
    const code = error.statusCode;
    if (code === 401 || code === 403 || code === 429 || code === 413) return code;
  }
  return 502;
}

function parseErrorResponse(message: string, extra?: Record<string, unknown>) {
  return Response.json(
    {
      error: "parse",
      message,
      status: 502,
      ...extra,
    },
    { status: 502 },
  );
}

async function readStructuredBooks(params: {
  model: LanguageModel;
  image: Buffer;
  mediaType: string;
}): Promise<IdentifyBooks> {
  let result;
  try {
    result = await generateText({
      model: params.model,
      output: Output.object({
        schema: identifyResponseSchema,
        name: "ShelfBooks",
        description: "Every book title readable in this bookshelf photo tile",
      }),
      system: SPINE_PROMPT,
      maxRetries: 1,
      temperature: 0.2,
      maxOutputTokens: 4000,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: TILE_USER_PROMPT },
            {
              type: "image",
              image: params.image,
              mediaType: params.mediaType,
            },
          ],
        },
      ],
    });
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      const recovered = parseIdentifyBooksFromText(error.text);
      if (recovered) return recovered;
    }
    throw error;
  }

  try {
    const coerced = coerceIdentifyBooks(result.output);
    if (coerced) return coerced;
  } catch (error) {
    const fromErrorText = NoObjectGeneratedError.isInstance(error)
      ? parseIdentifyBooksFromText(error.text)
      : null;
    if (fromErrorText) return fromErrorText;
    const fromResultText = parseIdentifyBooksFromText(result.text);
    if (fromResultText) return fromResultText;
    throw error;
  }

  const fromText = parseIdentifyBooksFromText(result.text);
  if (fromText) return fromText;

  throw new Error("Vision output was missing a books array");
}

export async function POST(req: Request) {
  const provider = getVisionProvider();
  if (!provider) {
    return Response.json(
      {
        error: "missing_key",
        message:
          "Shelf Pick needs a vision model key to read spines. Add OPENAI_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, or ANTHROPIC_API_KEY, then restart the app.",
        status: 503,
      },
      { status: 503 },
    );
  }

  let body: { image?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "invalid_json", message: "That photo slice did not upload.", status: 400 },
      { status: 400 },
    );
  }

  if (!body.image || typeof body.image !== "string") {
    return Response.json(
      { error: "missing_image", message: "Missing photo slice.", status: 400 },
      { status: 400 },
    );
  }
  if (body.image.length > 7_000_000) {
    return Response.json(
      {
        error: "too_large",
        message: "That shelf slice is too large to send (HTTP 413).",
        status: 413,
      },
      { status: 413 },
    );
  }

  let parsed: { mediaType: string; bytes: Buffer };
  try {
    parsed = parseDataUrl(body.image);
  } catch {
    return Response.json(
      { error: "bad_image", message: "Could not read that photo slice.", status: 400 },
      { status: 400 },
    );
  }

  try {
    const output = await readStructuredBooks({
      model: provider.model,
      image: parsed.bytes,
      mediaType: parsed.mediaType,
    });

    console.info("[identify]", {
      provider: provider.id,
      titles: output.books.length,
    });

    return Response.json({ books: output.books });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Vision output was missing a books array"
    ) {
      console.error("[identify] parse: missing books array", { provider: provider.id });
      return parseErrorResponse(
        "Vision returned a successful response with no books array (parse error). This is not an empty shelf.",
      );
    }

    if (NoObjectGeneratedError.isInstance(error) || NoOutputGeneratedError.isInstance(error)) {
      const recovered = NoObjectGeneratedError.isInstance(error)
        ? parseIdentifyBooksFromText(error.text)
        : null;
      if (recovered) {
        console.info("[identify]", {
          provider: provider.id,
          titles: recovered.books.length,
          recovered: true,
        });
        return Response.json({ books: recovered.books });
      }
      console.error("[identify] parse: no structured output", {
        provider: provider.id,
        message: error.message,
      });
      return parseErrorResponse(
        `Vision output did not parse (HTTP 502). ${formatIdentifyError(error)}`,
      );
    }

    const status = httpStatusFor(error);
    console.error("[identify] failed", {
      provider: provider.id,
      status,
      message: error instanceof Error ? error.message : String(error),
    });
    return Response.json(
      {
        error: "vision_failed",
        message: formatIdentifyError(error, status),
        status,
      },
      { status },
    );
  }
}
