import { fail, ok } from "@/server/http";

export const runtime = "nodejs";

const allowed = new Set(["linkedin", "twitter", "instagram", "reddit"]);

export async function GET(request: Request, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  if (!allowed.has(platform)) return fail("Unsupported platform", 400);

  const url = new URL(request.url);
  const redirectUri = url.searchParams.get("redirectUri") || "";
  if (!redirectUri) return fail("redirectUri is required", 400);

  const state = crypto.randomUUID();

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
      code_challenge: "challenge",
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
