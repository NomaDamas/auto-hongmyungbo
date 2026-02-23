import { availableProvidersFromHeaders } from "@/server/llm";
import { ok } from "@/server/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const available = availableProvidersFromHeaders(request.headers);
  const provider = available.includes("openrouter") ? "openrouter" : "openai";
  return ok({
    provider,
    defaultModel: provider === "openrouter" ? "openai/gpt-4o-mini" : "gpt-4o-mini",
    availableProviders: available,
  });
}
