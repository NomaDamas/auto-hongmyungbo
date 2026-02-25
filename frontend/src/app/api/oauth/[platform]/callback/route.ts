import { NextResponse } from "next/server";
import { consumeOAuthState, upsertOAuthToken } from "@/server/store";

export const runtime = "nodejs";

function toHtml(input: { platform: string; ok: boolean; message: string; error?: string }) {
  const safePlatform = JSON.stringify(input.platform);
  const safeError = JSON.stringify(input.error || "");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>OAuth Callback</title></head><body style="font-family: -apple-system, Segoe UI, sans-serif; padding: 24px;">
  <h3>${input.platform} OAuth ${input.ok ? "connected" : "failed"}</h3>
  <p>${input.message}</p>
  <script>
  (function () {
    var payload = { type: "hmb_oauth_callback", platform: ${safePlatform}, ok: ${input.ok ? "true" : "false"}, error: ${safeError} };
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(payload, window.location.origin);
      }
    } catch (e) {}
    setTimeout(function () { window.close(); }, 450);
  })();
  </script></body></html>`;
  return new NextResponse(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}

async function parseJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  try {
    return (text ? JSON.parse(text) : {}) as Record<string, unknown>;
  } catch {
    return { raw: text };
  }
}

function basicAuth(user: string, pass: string) {
  return `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
}

export async function GET(request: Request, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const stateId = url.searchParams.get("state");

  if (error) return toHtml({ platform, ok: false, message: error, error });
  if (!code || !stateId) return toHtml({ platform, ok: false, message: "Missing code/state in callback.", error: "missing_code_or_state" });

  const state = consumeOAuthState(stateId);
  if (!state) return toHtml({ platform, ok: false, message: "OAuth state mismatch or expired.", error: "invalid_state" });
  if (state.platform !== platform) return toHtml({ platform, ok: false, message: "OAuth platform mismatch.", error: "platform_mismatch" });

  try {
    if (platform === "linkedin") {
      const clientId = process.env.LINKEDIN_CLIENT_ID || "";
      const clientSecret = process.env.LINKEDIN_CLIENT_SECRET || "";
      if (!clientId || !clientSecret) return toHtml({ platform, ok: false, message: "LinkedIn credentials are missing.", error: "missing_env" });
      const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: state.redirectUri,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });
      const json = await parseJson(res);
      if (!res.ok || !json.access_token) {
        return toHtml({ platform, ok: false, message: "LinkedIn token exchange failed.", error: String(json.error_description || json.error || res.status) });
      }
      upsertOAuthToken("linkedin", {
        accessToken: String(json.access_token),
        expiresAt: json.expires_in ? new Date(Date.now() + Number(json.expires_in) * 1000).toISOString() : undefined,
        raw: json,
      });
      return toHtml({ platform, ok: true, message: "LinkedIn connected." });
    }

    if (platform === "twitter") {
      const clientId = process.env.TWITTER_CLIENT_ID || "";
      const clientSecret = process.env.TWITTER_CLIENT_SECRET || "";
      if (!clientId || !clientSecret) return toHtml({ platform, ok: false, message: "X credentials are missing.", error: "missing_env" });
      const res = await fetch("https://api.twitter.com/2/oauth2/token", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          authorization: basicAuth(clientId, clientSecret),
        },
        body: new URLSearchParams({
          code,
          grant_type: "authorization_code",
          client_id: clientId,
          redirect_uri: state.redirectUri,
          code_verifier: state.codeVerifier || "",
        }),
      });
      const json = await parseJson(res);
      if (!res.ok || !json.access_token) {
        return toHtml({ platform, ok: false, message: "X token exchange failed.", error: String(json.error || json.error_description || res.status) });
      }
      upsertOAuthToken("twitter", {
        accessToken: String(json.access_token),
        refreshToken: json.refresh_token ? String(json.refresh_token) : undefined,
        scope: json.scope ? String(json.scope) : undefined,
        tokenType: json.token_type ? String(json.token_type) : undefined,
        expiresAt: json.expires_in ? new Date(Date.now() + Number(json.expires_in) * 1000).toISOString() : undefined,
        raw: json,
      });
      return toHtml({ platform, ok: true, message: "X connected." });
    }

    if (platform === "instagram") {
      const clientId = process.env.INSTAGRAM_CLIENT_ID || "";
      const clientSecret = process.env.INSTAGRAM_CLIENT_SECRET || "";
      if (!clientId || !clientSecret) return toHtml({ platform, ok: false, message: "Instagram credentials are missing.", error: "missing_env" });
      const res = await fetch("https://api.instagram.com/oauth/access_token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "authorization_code",
          redirect_uri: state.redirectUri,
          code,
        }),
      });
      const json = await parseJson(res);
      if (!res.ok || !json.access_token) {
        return toHtml({ platform, ok: false, message: "Instagram token exchange failed.", error: String(json.error_message || json.error_type || res.status) });
      }
      upsertOAuthToken("instagram", {
        accessToken: String(json.access_token),
        accountId: json.user_id ? String(json.user_id) : undefined,
        raw: json,
      });
      return toHtml({ platform, ok: true, message: "Instagram connected." });
    }

    if (platform === "threads") {
      const clientId = process.env.THREADS_CLIENT_ID || "";
      const clientSecret = process.env.THREADS_CLIENT_SECRET || "";
      if (!clientId || !clientSecret) return toHtml({ platform, ok: false, message: "Threads credentials are missing.", error: "missing_env" });
      const qp = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: state.redirectUri,
        code,
      });
      const res = await fetch(`https://graph.facebook.com/v20.0/oauth/access_token?${qp.toString()}`);
      const json = await parseJson(res);
      if (!res.ok || !json.access_token) {
        return toHtml({ platform, ok: false, message: "Threads token exchange failed.", error: String(json.error || res.status) });
      }
      upsertOAuthToken("threads", {
        accessToken: String(json.access_token),
        tokenType: json.token_type ? String(json.token_type) : undefined,
        expiresAt: json.expires_in ? new Date(Date.now() + Number(json.expires_in) * 1000).toISOString() : undefined,
        raw: json,
      });
      return toHtml({ platform, ok: true, message: "Threads connected." });
    }

    if (platform === "youtube") {
      const clientId = process.env.YOUTUBE_CLIENT_ID || "";
      const clientSecret = process.env.YOUTUBE_CLIENT_SECRET || "";
      if (!clientId || !clientSecret) return toHtml({ platform, ok: false, message: "YouTube credentials are missing.", error: "missing_env" });
      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: state.redirectUri,
          grant_type: "authorization_code",
        }),
      });
      const json = await parseJson(res);
      if (!res.ok || !json.access_token) {
        return toHtml({ platform, ok: false, message: "YouTube token exchange failed.", error: String(json.error_description || json.error || res.status) });
      }
      upsertOAuthToken("youtube", {
        accessToken: String(json.access_token),
        refreshToken: json.refresh_token ? String(json.refresh_token) : undefined,
        scope: json.scope ? String(json.scope) : undefined,
        tokenType: json.token_type ? String(json.token_type) : undefined,
        expiresAt: json.expires_in ? new Date(Date.now() + Number(json.expires_in) * 1000).toISOString() : undefined,
        raw: json,
      });
      return toHtml({ platform, ok: true, message: "YouTube connected." });
    }

    if (platform === "tiktok") {
      const clientKey = process.env.TIKTOK_CLIENT_KEY || "";
      const clientSecret = process.env.TIKTOK_CLIENT_SECRET || "";
      if (!clientKey || !clientSecret) return toHtml({ platform, ok: false, message: "TikTok credentials are missing.", error: "missing_env" });
      const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_key: clientKey,
          client_secret: clientSecret,
          code,
          grant_type: "authorization_code",
          redirect_uri: state.redirectUri,
          code_verifier: state.codeVerifier || "",
        }),
      });
      const json = await parseJson(res);
      const data = (json.data || {}) as Record<string, unknown>;
      const accessToken = data.access_token ? String(data.access_token) : "";
      if (!res.ok || !accessToken) {
        const errObj = (json.error || {}) as Record<string, unknown>;
        return toHtml({ platform, ok: false, message: "TikTok token exchange failed.", error: String(errObj.message || res.status) });
      }
      upsertOAuthToken("tiktok", {
        accessToken,
        refreshToken: data.refresh_token ? String(data.refresh_token) : undefined,
        scope: data.scope ? String(data.scope) : undefined,
        expiresAt: data.expires_in ? new Date(Date.now() + Number(data.expires_in) * 1000).toISOString() : undefined,
        raw: json,
      });
      return toHtml({ platform, ok: true, message: "TikTok connected." });
    }

    const clientId = process.env.REDDIT_CLIENT_ID || "";
    const clientSecret = process.env.REDDIT_CLIENT_SECRET || "";
    if (!clientId || !clientSecret) return toHtml({ platform, ok: false, message: "Reddit credentials are missing.", error: "missing_env" });
    const res = await fetch("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: {
        authorization: basicAuth(clientId, clientSecret),
        "content-type": "application/x-www-form-urlencoded",
        "user-agent": process.env.REDDIT_USER_AGENT || "auto-hongmyungbo",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: state.redirectUri,
      }),
    });
    const json = await parseJson(res);
    if (!res.ok || !json.access_token) {
      return toHtml({ platform, ok: false, message: "Reddit token exchange failed.", error: String(json.error || res.status) });
    }
    upsertOAuthToken("reddit", {
      accessToken: String(json.access_token),
      refreshToken: json.refresh_token ? String(json.refresh_token) : undefined,
      scope: json.scope ? String(json.scope) : undefined,
      tokenType: json.token_type ? String(json.token_type) : undefined,
      expiresAt: json.expires_in ? new Date(Date.now() + Number(json.expires_in) * 1000).toISOString() : undefined,
      raw: json,
    });
    return toHtml({ platform, ok: true, message: "Reddit connected." });
  } catch (e) {
    return toHtml({
      platform,
      ok: false,
      message: "Unexpected error during token exchange.",
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
