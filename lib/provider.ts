import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";

export type VisionProvider = {
  id: "openai" | "google" | "anthropic";
  label: string;
  model: LanguageModel;
};

export function getVisionProvider(): VisionProvider | null {
  const override = process.env.VISION_MODEL?.trim();

  if (process.env.OPENAI_API_KEY) {
    return {
      id: "openai",
      label: "OpenAI",
      // Chat Completions: more reliable for vision + Output.object than the
      // default Responses API wrapper (`openai('gpt-4o')`).
      model: openai.chat(override || "gpt-4o"),
    };
  }
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return {
      id: "google",
      label: "Google",
      model: google(override || "gemini-2.5-flash"),
    };
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return {
      id: "anthropic",
      label: "Anthropic",
      model: anthropic(override || "claude-sonnet-4-5"),
    };
  }
  return null;
}
