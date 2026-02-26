import type { StoredCard, StoredOAuthToken } from "@/server/store";

export type PublishResult = {
  ok: boolean;
  postId?: string;
  url?: string;
  error?: string;
  screenshotDataUrl?: string;
};

async function asJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  try {
    return (text ? JSON.parse(text) : {}) as Record<string, unknown>;
  } catch {
    return { raw: text };
  }
}

function firstLine(text: string): string {
  return (text || "").split("\n").map((s) => s.trim()).find(Boolean) || "Post";
}

export async function publishToPlatform(input: { card: StoredCard; token: StoredOAuthToken }): Promise<PublishResult> {
  const { card, token } = input;
  const text = `${card.title}\n\n${card.body}`.trim();

  if (card.platform === "twitter") {
    const res = await fetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token.accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ text }),
    });
    const json = await asJson(res);
    if (!res.ok) return { ok: false, error: String(json.detail || json.title || res.status) };
    const id = (json.data as Record<string, unknown> | undefined)?.id;
    return { ok: true, postId: id ? String(id) : undefined, url: id ? `https://x.com/i/status/${id}` : undefined };
  }

  if (card.platform === "linkedin") {
    const author = process.env.LINKEDIN_AUTHOR_URN || "";
    if (!author) return { ok: false, error: "LINKEDIN_AUTHOR_URN is required." };
    const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token.accessToken}`,
        "content-type": "application/json",
        "x-restli-protocol-version": "2.0.0",
      },
      body: JSON.stringify({
        author,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: { text },
            shareMediaCategory: "NONE",
          },
        },
        visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
      }),
    });
    if (!res.ok) {
      const json = await asJson(res);
      return { ok: false, error: String(json.message || json.error || res.status) };
    }
    const urn = res.headers.get("x-restli-id") || "";
    return { ok: true, postId: urn || undefined };
  }

  if (card.platform === "reddit") {
    const subreddit = process.env.REDDIT_SUBREDDIT || "";
    if (!subreddit) return { ok: false, error: "REDDIT_SUBREDDIT is required." };
    const res = await fetch("https://oauth.reddit.com/api/submit", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token.accessToken}`,
        "content-type": "application/x-www-form-urlencoded",
        "user-agent": process.env.REDDIT_USER_AGENT || "auto-hongmyungbo",
      },
      body: new URLSearchParams({
        api_type: "json",
        kind: "self",
        sr: subreddit,
        title: firstLine(card.title),
        text: card.body || card.title,
      }),
    });
    const json = await asJson(res);
    const errors = (((json.json as Record<string, unknown> | undefined)?.errors as unknown[]) || []) as unknown[];
    if (!res.ok || errors.length) {
      return { ok: false, error: JSON.stringify(errors.length ? errors : json) };
    }
    const id = ((json.json as Record<string, unknown> | undefined)?.data as Record<string, unknown> | undefined)?.id;
    return { ok: true, postId: id ? String(id) : undefined };
  }

  if (card.platform === "instagram") {
    const igUserId = process.env.INSTAGRAM_IG_USER_ID || "";
    const imageUrl = process.env.INSTAGRAM_IMAGE_URL || "";
    if (!igUserId || !imageUrl) return { ok: false, error: "INSTAGRAM_IG_USER_ID and INSTAGRAM_IMAGE_URL are required." };
    const createRes = await fetch(`https://graph.facebook.com/v20.0/${igUserId}/media`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        image_url: imageUrl,
        caption: text,
        access_token: token.accessToken,
      }),
    });
    const createJson = await asJson(createRes);
    const creationId = createJson.id ? String(createJson.id) : "";
    if (!createRes.ok || !creationId) return { ok: false, error: String(createJson.error || createJson.message || createRes.status) };

    const publishRes = await fetch(`https://graph.facebook.com/v20.0/${igUserId}/media_publish`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        creation_id: creationId,
        access_token: token.accessToken,
      }),
    });
    const publishJson = await asJson(publishRes);
    if (!publishRes.ok) return { ok: false, error: String(publishJson.error || publishJson.message || publishRes.status) };
    const postId = publishJson.id ? String(publishJson.id) : undefined;
    return { ok: true, postId, url: postId ? `https://www.instagram.com/p/${postId}` : undefined };
  }

  if (card.platform === "threads") {
    const userId = process.env.THREADS_USER_ID || "me";
    const createRes = await fetch(`https://graph.threads.net/v1.0/${userId}/threads`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        media_type: "TEXT",
        text,
        access_token: token.accessToken,
      }),
    });
    const createJson = await asJson(createRes);
    const creationId = createJson.id ? String(createJson.id) : "";
    if (!createRes.ok || !creationId) return { ok: false, error: String(createJson.error || createJson.message || createRes.status) };

    const publishRes = await fetch(`https://graph.threads.net/v1.0/${userId}/threads_publish`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        creation_id: creationId,
        access_token: token.accessToken,
      }),
    });
    const publishJson = await asJson(publishRes);
    if (!publishRes.ok) return { ok: false, error: String(publishJson.error || publishJson.message || publishRes.status) };
    const postId = publishJson.id ? String(publishJson.id) : undefined;
    return { ok: true, postId };
  }

  if (card.platform === "youtube") {
    return { ok: false, error: "YouTube text-only publish is not supported by this flow. Upload flow is required." };
  }

  if (card.platform === "tiktok") {
    return { ok: false, error: "TikTok text-only publish is not supported by this flow. Video upload flow is required." };
  }

  return { ok: false, error: `Unsupported platform: ${card.platform}` };
}
