import { availableProvidersFromHeaders } from "@/server/llm";
import { ok } from "@/server/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const available = availableProvidersFromHeaders(request.headers);
  const provider =
    available.includes("openrouter")
      ? "openrouter"
      : available.includes("openai")
      ? "openai"
      : available.includes("anthropic")
      ? "anthropic"
      : available.includes("grok")
      ? "grok"
      : "gemini";
  const defaultModel =
    provider === "openrouter"
      ? "openai/gpt-4o-mini"
      : provider === "openai"
      ? "gpt-4o-mini"
      : provider === "anthropic"
      ? "claude-3-5-sonnet-latest"
      : provider === "grok"
      ? "grok-3-mini-fast"
      : "gemini-2.0-flash";
  return ok({
    provider,
    defaultModel,
    availableProviders: available,
  });
}
