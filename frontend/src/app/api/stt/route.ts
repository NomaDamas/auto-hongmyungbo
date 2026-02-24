import { fail, ok } from "@/server/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const key = (request.headers.get("x-openai-api-key") || process.env.OPENAI_API_KEY || "").trim();
    if (!key) return fail("OPENAI_API_KEY is required for STT", 400);

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return fail("No file uploaded", 400);

    const formData = new FormData();
    formData.append("model", process.env.OPENAI_STT_MODEL || "gpt-4o-mini-transcribe");
    formData.append("file", file);

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
      },
      body: formData,
    });
    if (!res.ok) return fail(`STT failed: ${res.status} ${await res.text()}`, 400);
    const transcription = (await res.json()) as { text?: string };

    const text = (transcription.text || "").trim();
    if (!text) return fail("Failed to transcribe audio", 500);
    return ok({ text });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "STT failed", 400);
  }
}
