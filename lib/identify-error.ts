export type IdentifyErrorKind = "auth" | "rate_limit" | "parse" | "too_large" | "other";

export type InterpretedIdentifyError = {
  kind: IdentifyErrorKind;
  message: string;
  fatal: boolean;
  status?: number;
};

function asText(raw: unknown): string {
  if (raw instanceof Error) return raw.message;
  if (typeof raw === "string") return raw;
  try {
    return JSON.stringify(raw);
  } catch {
    return String(raw ?? "");
  }
}

function parseJsonBlob(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function nestedMessage(data: Record<string, unknown> | null): string | null {
  if (!data) return null;
  if (typeof data.message === "string" && data.message.trim()) return data.message;
  const inner = data.error;
  if (typeof inner === "string" && inner.trim()) return inner;
  if (inner && typeof inner === "object") {
    const rec = inner as Record<string, unknown>;
    if (typeof rec.message === "string" && rec.message.trim()) return rec.message;
  }
  return null;
}

function withStatus(message: string, status?: number): string {
  if (!status) return message;
  if (new RegExp(`\\b${status}\\b`).test(message) || /HTTP\s+\d+/.test(message)) {
    return message;
  }
  return `${message} (HTTP ${status})`;
}

export function isFatalIdentifyStatus(status: number): boolean {
  return status === 401 || status === 403 || status === 429 || status === 503;
}

export function interpretIdentifyError(raw: unknown, httpStatus?: number): InterpretedIdentifyError {
  const text = asText(raw);
  const json = parseJsonBlob(text);
  const nested = nestedMessage(json);
  const haystack = `${text} ${nested ?? ""} ${httpStatus ?? ""}`.toLowerCase();
  const statusFromJson =
    typeof json?.status === "number"
      ? json.status
      : typeof json?.statusCode === "number"
        ? json.statusCode
        : undefined;
  const status = httpStatus ?? statusFromJson;

  if (
    status === 401 ||
    status === 403 ||
    haystack.includes("unauthorized") ||
    haystack.includes("invalid api key") ||
    haystack.includes("incorrect api key") ||
    haystack.includes("invalid_api_key")
  ) {
    const code = status === 403 ? 403 : 401;
    return {
      kind: "auth",
      fatal: true,
      status: code,
      message: withStatus(
        `The vision API rejected the key (${code}). Check OPENAI_API_KEY (or Google / Anthropic) and try again.`,
        code,
      ),
    };
  }

  if (status === 429 || haystack.includes("rate limit") || haystack.includes("too many requests")) {
    return {
      kind: "rate_limit",
      fatal: true,
      status: 429,
      message: withStatus(
        "The vision API rate-limited us (429). Wait a few seconds and retry — a closet photo is read in several smaller bands.",
        429,
      ),
    };
  }

  if (status === 413 || haystack.includes("too_large")) {
    return {
      kind: "too_large",
      fatal: false,
      status: 413,
      message: withStatus("One shelf slice was too large to send (HTTP 413).", 413),
    };
  }

  if (
    status === 503 ||
    haystack.includes("missing_key") ||
    haystack.includes("needs a vision model key") ||
    haystack.includes("not configured")
  ) {
    return {
      kind: "auth",
      fatal: true,
      status: status === 503 ? 503 : status,
      message: withStatus(
        "The vision API is not configured (HTTP 503). Add OPENAI_API_KEY (or Google / Anthropic) and retry.",
        status === 503 ? 503 : undefined,
      ),
    };
  }

  if (
    haystack.includes("parse") ||
    haystack.includes("validation") ||
    (haystack.includes("json") && haystack.includes("error")) ||
    haystack.includes("no object generated") ||
    haystack.includes("no output generated") ||
    haystack.includes("missing a books array") ||
    haystack.includes("typevalidation")
  ) {
    return {
      kind: "parse",
      fatal: false,
      status: status ?? 502,
      message: withStatus(
        "A shelf band came back in a form we couldn't parse (not an empty shelf). Other bands will still be read.",
        status ?? 502,
      ),
    };
  }

  if (nested) {
    return { kind: "other", fatal: false, status, message: withStatus(nested, status) };
  }

  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed.length > 0 && trimmed.length < 280) {
    return { kind: "other", fatal: false, status, message: withStatus(trimmed, status) };
  }

  return {
    kind: "other",
    fatal: false,
    status,
    message: withStatus("The vision model failed on a shelf band. Other bands will still be read.", status),
  };
}

export function formatIdentifyError(raw: unknown, httpStatus?: number): string {
  return interpretIdentifyError(raw, httpStatus).message;
}
