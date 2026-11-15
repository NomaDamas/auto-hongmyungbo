import { useEffect } from "react";
import { ChevronLeft, ChevronRight, X as XIcon } from "lucide-react";
import clsx from "clsx";
import { PLATFORMS, commentDoc } from "@shared/platforms";
import { useStore } from "@/store";
import { PlatformIcon } from "./PlatformIcon";
import { BlogPreview } from "./previews/BlogPreview";
import { HackerNewsPreview, RedditPreview } from "./previews/CommunityPreviews";
import { FacebookPreview, InstagramPreview, LinkedInPreview, ThreadsPreview, XPreview } from "./previews/FeedPreviews";
import { CommentBubble } from "./previews/common";

export function PreviewModal() {
  const previewDoc = useStore((s) => s.previewDoc);
  const activeDoc = useStore((s) => s.activeDoc);
  const project = useStore((s) => s.project);
  const proposal = useStore((s) => (s.previewDoc ? s.proposals[s.previewDoc] : undefined));
  const commentProposal = useStore((s) => (s.previewDoc ? s.proposals[commentDoc(s.previewDoc)] : undefined));
  const name = useStore((s) => s.aside?.name ?? "나");
  const enabledPlatforms = useStore((s) => s.enabledPlatforms);
  const platforms = enabledPlatforms();

  useEffect(() => {
    if (!previewDoc) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") useStore.setState({ previewDoc: null });
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const current = Math.max(0, platforms.indexOf(previewDoc));
      const offset = event.key === "ArrowRight" ? 1 : -1;
      const next = (current + offset + platforms.length) % platforms.length;
      if (platforms[next]) useStore.setState({ previewDoc: platforms[next] });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewDoc, platforms]);

  if (!previewDoc || !project) return null;
  const text = proposal?.proposed ?? project.docs[previewDoc] ?? "";
  const media = project.meta.media?.[previewDoc] ?? [];
  const props = { text, media, name, mediaUrl: (file: string) => window.api.projects.mediaUrl(project.slug, file) };
  const blog = PLATFORMS[previewDoc].tab === "blog";
  const commentId = commentDoc(previewDoc);
  const comment = commentProposal?.proposed ?? project.docs[commentId] ?? "";
  const showComment = activeDoc === commentId || !!comment.trim();

  const preview = () => {
    switch (previewDoc) {
      case "linkedin": return <LinkedInPreview {...props} />;
      case "x": return <XPreview {...props} />;
      case "bluesky": return <XPreview {...props} platform="bluesky" />;
      case "mastodon": return <XPreview {...props} platform="mastodon" />;
      case "threads": return <ThreadsPreview {...props} />;
      case "instagram": return <InstagramPreview {...props} />;
      case "facebook": return <FacebookPreview {...props} />;
      case "reddit": return <RedditPreview {...props} />;
      case "producthunt": return <RedditPreview {...props} platform="producthunt" />;
      case "devto": return <RedditPreview {...props} platform="devto" />;
      case "naver_cafe": return <RedditPreview {...props} platform="naver_cafe" />;
      case "okky": return <RedditPreview {...props} platform="okky" />;
      case "hackernews": return <HackerNewsPreview {...props} />;
      default: return <BlogPreview {...props} platform={previewDoc} />;
    }
  };

  return (
    <div className="scrim flex-col items-center justify-center p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) useStore.setState({ previewDoc: null }); }}>
      <div className="glass flex max-h-full w-[760px] flex-col overflow-hidden">
        <header className="flex h-12 shrink-0 items-center gap-1 border-b border-[var(--border)] px-3">
          <button className="icon-btn" title="이전 플랫폼 (←)" onClick={() => {
            const index = Math.max(0, platforms.indexOf(previewDoc));
            useStore.setState({ previewDoc: platforms[(index - 1 + platforms.length) % platforms.length] ?? previewDoc });
          }}><ChevronLeft size={15} /></button>
          <nav className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
            {platforms.map((platform) => (
              <button key={platform} className={clsx("btn btn-xs btn-ghost", previewDoc === platform && "bg-[var(--surface-3)] text-[var(--fg)]")} onClick={() => useStore.setState({ previewDoc: platform })}>
                <PlatformIcon doc={platform} size={11} /> {PLATFORMS[platform].label}
              </button>
            ))}
          </nav>
          <button className="icon-btn" title="다음 플랫폼 (→)" onClick={() => {
            const index = Math.max(0, platforms.indexOf(previewDoc));
            useStore.setState({ previewDoc: platforms[(index + 1) % platforms.length] ?? previewDoc });
          }}><ChevronRight size={15} /></button>
          <button className="icon-btn ml-1" title="닫기 (Esc)" onClick={() => useStore.setState({ previewDoc: null })}><XIcon size={15} /></button>
        </header>
        <div className="min-h-0 overflow-y-auto bg-[var(--surface-2)] p-5">
          <div key={previewDoc} className="mx-auto select-text overflow-hidden rounded-xl bg-white shadow-xl" style={{ width: blog ? 720 : 560, maxWidth: "100%" }}>
            {preview()}
            {showComment && <CommentBubble text={comment} name={name} />}
          </div>
        </div>
      </div>
    </div>
  );
}
