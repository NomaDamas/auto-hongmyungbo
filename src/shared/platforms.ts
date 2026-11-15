import type { CommentDocId, DocId, DocVariant, PlatformId } from "./types";

/** Editor tabs. A tab holds one or more platform docs; tabs can be split side by side. */
export type TabId = "master" | "sns" | "community" | "blog";

export interface MediaRules {
  images: number;
  videos: number;
  /** Image and video can be mixed in one post. */
  mixed: boolean;
  /** Text-only posts are rejected (Instagram). */
  required?: boolean;
}

export interface PlatformDef {
  id: PlatformId;
  label: string;
  tab: Exclude<TabId, "master">;
  /** Hard character limit. X uses weighted counting (CJK = 2). */
  limit: number;
  /** Writing guidance injected into prompts. */
  guide: string;
  media: MediaRules;
  /** Where Aside starts when publishing. */
  composeUrl: string;
  /** Signed-in-only page; redirect to a login URL means signed out. */
  probeUrl: string;
  loginUrl: string;
  /** Platform-specific publish instructions for the Aside agent. */
  publishHint: string;
  /** Native scheduling exists in the platform composer (Aside can set it there). */
  nativeSchedule: boolean;
}

export const PLATFORMS: Record<PlatformId, PlatformDef> = {
  linkedin: {
    id: "linkedin",
    label: "LinkedIn",
    tab: "sns",
    limit: 3000,
    guide: "Professional but personal. Strong first two lines (shown before 'see more'). Short paragraphs, concrete lesson or result, max 3 hashtags at the end.",
    media: { images: 20, videos: 1, mixed: false },
    composeUrl: "https://www.linkedin.com/feed/?shareActive=true",
    probeUrl: "https://www.linkedin.com/feed/",
    loginUrl: "https://www.linkedin.com/login",
    publishHint: "Use the 'Start a post' composer. Attach media with the photo/video button.",
    nativeSchedule: true,
  },
  x: {
    id: "x",
    label: "X",
    tab: "sns",
    limit: 280,
    guide: "Single post, max 280 weighted characters (Korean/CJK counts double). Punchy hook, one idea, no hashtags unless essential.",
    media: { images: 4, videos: 1, mixed: false },
    composeUrl: "https://x.com/compose/post",
    probeUrl: "https://x.com/home",
    loginUrl: "https://x.com/i/flow/login",
    publishHint: "Use the post composer. Attach media with the media button.",
    nativeSchedule: true,
  },
  threads: {
    id: "threads",
    label: "Threads",
    tab: "sns",
    limit: 500,
    guide: "Casual, conversational, max 500 characters. Feels like talking to friends; end with an opener for replies.",
    media: { images: 10, videos: 10, mixed: true },
    composeUrl: "https://www.threads.com/",
    probeUrl: "https://www.threads.com/activity",
    loginUrl: "https://www.threads.com/login",
    publishHint: "Open the 'What's new?' composer. Attach media with the image button.",
    nativeSchedule: true,
  },
  instagram: {
    id: "instagram",
    label: "Instagram",
    tab: "sns",
    limit: 2200,
    guide: "Caption for an image/video post. Hook in the first line, line breaks for readability, up to ~5 relevant hashtags at the end.",
    media: { images: 20, videos: 20, mixed: true, required: true },
    composeUrl: "https://www.instagram.com/",
    probeUrl: "https://www.instagram.com/accounts/edit/",
    loginUrl: "https://www.instagram.com/accounts/login/",
    publishHint: "Click 'Create' > 'Post', upload media first, then paste the caption.",
    nativeSchedule: false,
  },
  facebook: {
    id: "facebook",
    label: "Facebook",
    tab: "sns",
    limit: 63206,
    guide: "Friendly, story-first, a few short paragraphs. Clear call to action at the end.",
    media: { images: 30, videos: 1, mixed: true },
    composeUrl: "https://www.facebook.com/",
    probeUrl: "https://www.facebook.com/settings",
    loginUrl: "https://www.facebook.com/login",
    publishHint: "Use the 'What's on your mind?' composer.",
    nativeSchedule: false,
  },
  reddit: {
    id: "reddit",
    label: "Reddit",
    tab: "community",
    limit: 40000,
    guide: "First line is the title as '# Title' (max 300 chars). Body is plain, humble, value-first, no marketing tone, disclose self-promotion honestly.",
    media: { images: 20, videos: 1, mixed: false },
    composeUrl: "https://www.reddit.com/submit",
    probeUrl: "https://www.reddit.com/settings/",
    loginUrl: "https://www.reddit.com/login/",
    publishHint: "Use the first '# ' line as the title and the rest as the body. Ask me which subreddit if unclear.",
    nativeSchedule: true,
  },
  hackernews: {
    id: "hackernews",
    label: "Hacker News",
    tab: "community",
    limit: 2000,
    guide: "First line '# Show HN: …' title (max 80 chars). Then a short, factual, first-person text with the link. No marketing words.",
    media: { images: 0, videos: 0, mixed: false },
    composeUrl: "https://news.ycombinator.com/submit",
    probeUrl: "https://news.ycombinator.com/submit",
    loginUrl: "https://news.ycombinator.com/login",
    publishHint: "Use the '# ' line as the title, put the project URL in the url field and the rest as text.",
    nativeSchedule: false,
  },
  naver_blog: {
    id: "naver_blog",
    label: "네이버 블로그",
    tab: "blog",
    limit: 100000,
    guide: "Korean blog post. First line '# 제목'. Friendly 존댓말, clear sections with subheadings, screenshots placed where referenced, search keywords in title and first paragraph.",
    media: { images: 50, videos: 10, mixed: true },
    composeUrl: "https://blog.naver.com/GoBlogWrite.naver",
    probeUrl: "https://blog.naver.com/GoBlogWrite.naver",
    loginUrl: "https://nid.naver.com/nidlogin.login",
    publishHint: "In the SmartEditor ONE, put the '# ' line in the title field, paste the body, insert media with the photo/video buttons at their markers.",
    nativeSchedule: true,
  },
  tistory: {
    id: "tistory",
    label: "티스토리",
    tab: "blog",
    limit: 100000,
    guide: "Korean blog post in markdown. First line '# 제목'. Sections with ## headings, code blocks where relevant.",
    media: { images: 50, videos: 10, mixed: true },
    composeUrl: "https://www.tistory.com/",
    probeUrl: "https://www.tistory.com/",
    loginUrl: "https://www.tistory.com/auth/login",
    publishHint: "Open my blog's 'Write' page, switch the editor to Markdown, put the '# ' line in the title.",
    nativeSchedule: true,
  },
  medium: {
    id: "medium",
    label: "Medium",
    tab: "blog",
    limit: 100000,
    guide: "Long-form article. First line '# Title', second line optional subtitle. Narrative with ## sections.",
    media: { images: 50, videos: 0, mixed: true },
    composeUrl: "https://medium.com/new-story",
    probeUrl: "https://medium.com/me/settings",
    loginUrl: "https://medium.com/m/signin",
    publishHint: "Put the '# ' line as the title, paste the body, add images at their markers.",
    nativeSchedule: false,
  },
  bluesky: {
    id: "bluesky",
    label: "Bluesky",
    tab: "sns",
    limit: 300,
    guide: "Single post, max 300 characters. Conversational, one idea, link at the end.",
    media: { images: 4, videos: 1, mixed: false },
    composeUrl: "https://bsky.app/",
    probeUrl: "https://bsky.app/settings",
    loginUrl: "https://bsky.app/",
    publishHint: "Click 'New Post', paste the text, attach media with the image button.",
    nativeSchedule: false,
  },
  mastodon: {
    id: "mastodon",
    label: "Mastodon",
    tab: "sns",
    limit: 500,
    guide: "Max 500 characters. Friendly, no hype, add 1-3 CamelCase hashtags at the end (#OpenSource).",
    media: { images: 4, videos: 1, mixed: false },
    composeUrl: "https://mastodon.social/publish",
    probeUrl: "https://mastodon.social/settings/profile",
    loginUrl: "https://mastodon.social/auth/sign_in",
    publishHint: "Use the compose box on my home server. If my server is not mastodon.social, ask me which one.",
    nativeSchedule: false,
  },
  producthunt: {
    id: "producthunt",
    label: "Product Hunt",
    tab: "community",
    limit: 800,
    guide: "Launch first comment from the maker. First line '# Tagline' (max 60 chars). Then why you built it, what it does, and an ask for feedback.",
    media: { images: 8, videos: 1, mixed: true },
    composeUrl: "https://www.producthunt.com/posts/new",
    probeUrl: "https://www.producthunt.com/my/settings/edit",
    loginUrl: "https://www.producthunt.com/login",
    publishHint: "Start a new launch: tagline from the '# ' line, description and maker comment from the body. Stop and ask before scheduling the launch date.",
    nativeSchedule: true,
  },
  devto: {
    id: "devto",
    label: "DEV",
    tab: "community",
    limit: 100000,
    guide: "Developer article in markdown. First line '# Title'. Practical, code samples welcome, up to 4 tags.",
    media: { images: 30, videos: 0, mixed: true },
    composeUrl: "https://dev.to/new",
    probeUrl: "https://dev.to/settings",
    loginUrl: "https://dev.to/enter",
    publishHint: "Use the markdown editor: title from the '# ' line, body below, add up to 4 tags.",
    nativeSchedule: false,
  },
  naver_cafe: {
    id: "naver_cafe",
    label: "네이버 카페",
    tab: "community",
    limit: 100000,
    guide: "Korean community post. First line '# 제목'. 존댓말, follow the cafe's board rules, no hard selling.",
    media: { images: 50, videos: 10, mixed: true },
    composeUrl: "https://section.cafe.naver.com/ca-fe/home",
    probeUrl: "https://section.cafe.naver.com/ca-fe/home",
    loginUrl: "https://nid.naver.com/nidlogin.login",
    publishHint: "Ask me which cafe and board to use, then write there: title from the '# ' line.",
    nativeSchedule: false,
  },
  okky: {
    id: "okky",
    label: "OKKY",
    tab: "community",
    limit: 20000,
    guide: "Korean developer community. First line '# 제목'. Humble, technical, share what you built and ask for feedback.",
    media: { images: 10, videos: 0, mixed: false },
    composeUrl: "https://okky.kr/community/gathering",
    probeUrl: "https://okky.kr/settings/profile",
    loginUrl: "https://okky.kr/login",
    publishHint: "Pick the right board (ask me if unclear), title from the '# ' line, markdown body.",
    nativeSchedule: false,
  },
  brunch: {
    id: "brunch",
    label: "브런치",
    tab: "blog",
    limit: 100000,
    guide: "Korean essay-style article. First line '# 제목'. Reflective, well-paced paragraphs, few headings.",
    media: { images: 50, videos: 5, mixed: true },
    composeUrl: "https://brunch.co.kr/write",
    probeUrl: "https://brunch.co.kr/write",
    loginUrl: "https://brunch.co.kr/signin",
    publishHint: "Title from the '# ' line, paste the body, insert images at their markers.",
    nativeSchedule: true,
  },
  velog: {
    id: "velog",
    label: "velog",
    tab: "blog",
    limit: 100000,
    guide: "Korean developer blog in markdown. First line '# 제목'. ## sections, code blocks, tags.",
    media: { images: 50, videos: 0, mixed: true },
    composeUrl: "https://velog.io/write",
    probeUrl: "https://velog.io/setting",
    loginUrl: "https://velog.io/",
    publishHint: "Title from the '# ' line into the title field, markdown body into the editor, then publish.",
    nativeSchedule: false,
  },
  substack: {
    id: "substack",
    label: "Substack",
    tab: "blog",
    limit: 100000,
    guide: "Newsletter post. First line '# Title', second line subtitle. Personal voice, ## sections.",
    media: { images: 50, videos: 1, mixed: true },
    composeUrl: "https://substack.com/home",
    probeUrl: "https://substack.com/settings",
    loginUrl: "https://substack.com/sign-in",
    publishHint: "Open my publication's dashboard, create a new post, title from the '# ' line.",
    nativeSchedule: true,
  },
  hashnode: {
    id: "hashnode",
    label: "Hashnode",
    tab: "blog",
    limit: 100000,
    guide: "Developer article in markdown. First line '# Title'. Practical, code samples, tags.",
    media: { images: 30, videos: 0, mixed: true },
    composeUrl: "https://hashnode.com/draft",
    probeUrl: "https://hashnode.com/settings",
    loginUrl: "https://hashnode.com/onboard",
    publishHint: "Create a new draft in my blog, title from the '# ' line, markdown body.",
    nativeSchedule: true,
  },
  wordpress: {
    id: "wordpress",
    label: "WordPress",
    tab: "blog",
    limit: 100000,
    guide: "Blog post. First line '# Title'. ## sections, SEO-friendly first paragraph.",
    media: { images: 50, videos: 10, mixed: true },
    composeUrl: "https://wordpress.com/post",
    probeUrl: "https://wordpress.com/me",
    loginUrl: "https://wordpress.com/log-in",
    publishHint: "Pick my site if asked, title from the '# ' line, paste the body in the block editor.",
    nativeSchedule: true,
  },
};

export const ALL_PLATFORMS = Object.keys(PLATFORMS) as PlatformId[];
export const DEFAULT_PLATFORMS: PlatformId[] = ["linkedin", "x", "threads", "reddit", "naver_blog"];

/** Platforms whose first line is a '# Title' field. */
export const TITLE_PLATFORMS: PlatformId[] = ALL_PLATFORMS.filter((p) => PLATFORMS[p].tab !== "sns");

export const TABS: { id: TabId; label: string }[] = [
  { id: "master", label: "원문" },
  { id: "sns", label: "SNS" },
  { id: "community", label: "커뮤니티" },
  { id: "blog", label: "블로그" },
];

/** Comment/reply limit per platform (most platforms reuse the post limit; a few are stricter). */
export const COMMENT_LIMIT: Partial<Record<PlatformId, number>> = {
  linkedin: 1250,
  instagram: 2200,
  reddit: 10000,
  hackernews: 2000,
  producthunt: 1000,
};

export function platformsInTab(tab: TabId, enabled: PlatformId[]): PlatformId[] {
  return tab === "master" ? [] : enabled.filter((p) => PLATFORMS[p].tab === tab);
}

export function commentDoc(p: PlatformId): CommentDocId {
  return `${p}.comment`;
}

/** Split a doc id into its platform and variant ("master" has no platform). */
export function parseDoc(doc: DocId): { platform: PlatformId | null; variant: DocVariant } {
  if (doc === "master") return { platform: null, variant: "post" };
  if (doc.endsWith(".comment")) return { platform: doc.slice(0, -".comment".length) as PlatformId, variant: "comment" };
  return { platform: doc as PlatformId, variant: "post" };
}

export function docLabel(doc: DocId): string {
  const { platform, variant } = parseDoc(doc);
  if (!platform) return "원문";
  return variant === "comment" ? `${PLATFORMS[platform].label} 댓글` : PLATFORMS[platform].label;
}

export function docFile(doc: DocId): string {
  return `${doc}.md`;
}

export function docLimit(doc: DocId): number | null {
  const { platform, variant } = parseDoc(doc);
  if (!platform) return null;
  return variant === "comment" ? (COMMENT_LIMIT[platform] ?? PLATFORMS[platform].limit) : PLATFORMS[platform].limit;
}

export function isDocId(value: string): value is DocId {
  if (value === "master") return true;
  const platform = value.endsWith(".comment") ? value.slice(0, -".comment".length) : value;
  return platform in PLATFORMS;
}
