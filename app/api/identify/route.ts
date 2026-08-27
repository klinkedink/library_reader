import { streamObject } from "ai";
import { getVisionProvider } from "@/lib/provider";
import { parseDataUrl } from "@/lib/image";
import { detectedSpineSchema, SPINE_PROMPT } from "@/lib/vision";

export const maxDuration = 60;

export async function POST(req: Request) {
  const provider = getVisionProvider();
  if (!provider) {
    return Response.json(
      {
        error: "missing_key",
        message:
          "Shelf Pick needs a vision model key to read spines. Add OPENAI_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, or ANTHROPIC_API_KEY, then restart the app.",
      },
      { status: 503 },
    );
  }

  let body: { image?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.image || typeof body.image !== "string") {
    return Response.json({ error: "missing_image" }, { status: 400 });
  }
  if (body.image.length > 7_000_000) {
    return Response.json(
      { error: "too_large", message: "That photo is too large. Try a tighter crop." },
      { status: 413 },
    );
  }

  let parsed: { mediaType: string; bytes: Buffer };
  try {
    parsed = parseDataUrl(body.image);
  } catch {
    return Response.json({ error: "bad_image" }, { status: 400 });
  }

  const result = streamObject({
    model: provider.model,
    output: "array",
    schema: detectedSpineSchema,
    system: SPINE_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "List every readable book in this bookshelf photo. Return only books you can see.",
          },
          {
            type: "image",
            image: parsed.bytes,
            mediaType: parsed.mediaType,
          },
        ],
      },
    ],
  });

  return result.toTextStreamResponse();
}
