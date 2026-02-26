import { ok } from "@/server/http";

export const runtime = "nodejs";

type OAuthPlatform = "linkedin" | "twitter" | "instagram" | "reddit" | "threads" | "youtube" | "tiktok";

const OAUTH_ENV_KEYS: Record<OAuthPlatform, string[]> = {
  linkedin: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"],
  twitter: ["TWITTER_CLIENT_ID", "TWITTER_CLIENT_SECRET"],
  instagram: ["INSTAGRAM_CLIENT_ID", "INSTAGRAM_CLIENT_SECRET"],
  reddit: ["REDDIT_CLIENT_ID", "REDDIT_CLIENT_SECRET"],
  threads: ["THREADS_CLIENT_ID", "THREADS_CLIENT_SECRET"],
  youtube: ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET"],
  tiktok: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"],
};

function platformStatus(platform: OAuthPlatform) {
  const required = OAUTH_ENV_KEYS[platform];
  const missing = required.filter((key) => !process.env[key] || !process.env[key]?.trim());
  return {
    configured: missing.length === 0,
    missing,
  };
}

export async function GET() {
  return ok({
    llm: {
      envOpenAI: Boolean(process.env.OPENAI_API_KEY?.trim()),
      envOpenRouter: Boolean(process.env.OPENROUTER_API_KEY?.trim()),
    },
    oauth: {
      linkedin: platformStatus("linkedin"),
      twitter: platformStatus("twitter"),
      instagram: platformStatus("instagram"),
      reddit: platformStatus("reddit"),
      threads: platformStatus("threads"),
      youtube: platformStatus("youtube"),
      tiktok: platformStatus("tiktok"),
    },
  });
}
