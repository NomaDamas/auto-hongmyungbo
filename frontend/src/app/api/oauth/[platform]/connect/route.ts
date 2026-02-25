import { fail, ok } from "@/server/http";
import { createOAuthState } from "@/server/store";

export const runtime = "nodejs";

const allowed = new Set(["linkedin", "twitter", "instagram", "reddit", "threads", "youtube", "tiktok"]);

export async function GET(request: Request, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  if (!allowed.has(platform)) return fail("Unsupported platform", 400);

  const url = new URL(request.url);
  const redirectUri = url.searchParams.get("redirectUri") || "";
  if (!redirectUri) return fail("redirectUri is required", 400);

  const state = crypto.randomUUID();
  const codeVerifier = crypto.randomUUID().replace(/-/g, "");
  createOAuthState({ state, platform, redirectUri, codeVerifier });

  if (platform === "linkedin") {
    const clientId = process.env.LINKEDIN_CLIENT_ID || "";
    if (!clientId) return fail("Missing LinkedIn OAuth credentials", 400);
    const qp = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: "openid profile w_member_social email",
      state,
    });
    return ok({ authUrl: `https://www.linkedin.com/oauth/v2/authorization?${qp.toString()}`, state });
  }

  if (platform === "twitter") {
    const clientId = process.env.TWITTER_CLIENT_ID || "";
    if (!clientId) return fail("Missing X(Twitter) OAuth credentials", 400);
    const qp = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: "tweet.read tweet.write users.read offline.access",
      state,
      code_challenge: codeVerifier,
      code_challenge_method: "plain",
    });
    return ok({ authUrl: `https://twitter.com/i/oauth2/authorize?${qp.toString()}`, state });
  }

  if (platform === "instagram") {
    const clientId = process.env.INSTAGRAM_CLIENT_ID || "";
    if (!clientId) return fail("Missing Instagram OAuth credentials", 400);
    const qp = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "user_profile,user_media",
      state,
    });
    return ok({ authUrl: `https://api.instagram.com/oauth/authorize?${qp.toString()}`, state });
  }

  if (platform === "threads") {
    const clientId = process.env.THREADS_CLIENT_ID || "";
    if (!clientId) return fail("Missing Threads OAuth credentials", 400);
    const qp = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "threads_basic,threads_content_publish",
      state,
    });
    return ok({ authUrl: `https://www.facebook.com/v20.0/dialog/oauth?${qp.toString()}`, state });
  }

  if (platform === "youtube") {
    const clientId = process.env.YOUTUBE_CLIENT_ID || "";
    if (!clientId) return fail("Missing YouTube OAuth credentials", 400);
    const qp = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      access_type: "offline",
      include_granted_scopes: "true",
      prompt: "consent",
      scope: "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly",
      state,
    });
    return ok({ authUrl: `https://accounts.google.com/o/oauth2/v2/auth?${qp.toString()}`, state });
  }

  if (platform === "tiktok") {
    const clientKey = process.env.TIKTOK_CLIENT_KEY || "";
    if (!clientKey) return fail("Missing TikTok OAuth credentials", 400);
    const qp = new URLSearchParams({
      client_key: clientKey,
      redirect_uri: redirectUri,
      response_type: "code",
      code_challenge: codeVerifier,
      code_challenge_method: "plain",
      scope: "user.info.basic,video.publish",
      state,
    });
    return ok({ authUrl: `https://www.tiktok.com/v2/auth/authorize/?${qp.toString()}`, state });
  }

  const clientId = process.env.REDDIT_CLIENT_ID || "";
  if (!clientId) return fail("Missing Reddit OAuth credentials", 400);
  const qp = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    state,
    redirect_uri: redirectUri,
    duration: "permanent",
    scope: "submit identity read",
  });
  return ok({ authUrl: `https://www.reddit.com/api/v1/authorize?${qp.toString()}`, state });
}
