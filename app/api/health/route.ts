import { getVisionProvider } from "@/lib/provider";

export async function GET() {
  const provider = getVisionProvider();
  return Response.json({
    visionConfigured: Boolean(provider),
    provider: provider?.id ?? null,
    providerLabel: provider?.label ?? null,
  });
}
