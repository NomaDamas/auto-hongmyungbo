import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");

  const html = `<!doctype html><html><head><meta charset=\"utf-8\"><title>OAuth Callback</title></head><body style=\"font-family: -apple-system, Segoe UI, sans-serif; padding: 24px;\">${
    error
      ? `<h3>${platform} OAuth failed</h3><p>${error}</p>`
      : `<h3>${platform} OAuth callback received</h3><p>${code ? "Authorization code received." : "No code found."}</p><p>Token exchange is optional in local mode.</p>`
  }</body></html>`;

  return new NextResponse(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
