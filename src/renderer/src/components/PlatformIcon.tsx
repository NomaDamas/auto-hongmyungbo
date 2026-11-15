import { FileText } from "lucide-react";
import type { DocId, PlatformId } from "@shared/types";
import { parseDoc } from "@shared/platforms";

const PATHS: Partial<Record<PlatformId, string>> = {
  linkedin:
    "M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z",
  x: "M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.41l-5.8-7.58-6.64 7.58H.47l8.6-9.83L0 1.15h7.59l5.24 6.93 6.07-6.93zm-1.29 19.5h2.04L6.48 3.24H4.3l13.31 17.41z",
  threads:
    "M12 2c5.5 0 9.5 3.7 9.8 9.1l-2.5.3C18.8 7.6 16.1 5 12 5 7.6 5 5 8.1 5 12s2.6 7 7 7c2.5 0 4.2-.8 5.3-2.1.8-1 .8-2.1-.1-2.8-1.1 1.1-2.4 1.7-4 1.7-2.6 0-4.2-1.2-4.2-3 0-1.9 1.7-3 4.5-3 1.1 0 2.1.2 3 .5-.2-1.6-1.5-2.5-3.4-2.5-1.5 0-2.8.5-3.8 1.6L7.8 7.8C9.2 6.4 10.9 5.8 13 5.8c3.4 0 5.5 2.1 5.6 5.2 1.5 1.1 2.2 2.5 2.2 4.1 0 1.2-.4 2.3-1.2 3.3C17.9 20.6 15.4 22 12 22 5.9 22 2 18 2 12S5.9 2 12 2zm1.1 10.8c-1.4 0-2.1.4-2.1 1 0 .5.7.9 1.8.9.9 0 1.6-.2 2.2-.7.1-.4.1-.8 0-1.2-.6-.1-1.2-.1-1.9 0z",
  facebook: "M13.7 22v-9h3l.45-3.5h-3.45V7.3c0-1 .28-1.7 1.74-1.7H17.3V2.45c-.32-.04-1.4-.14-2.65-.14-2.62 0-4.42 1.6-4.42 4.54v2.64H7.25V13h2.98v9h3.47z",
};

function Badge({ label, background, size, circle = false, foreground = "white" }: { label: string; background: string; size: number; circle?: boolean; foreground?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      {circle ? <circle cx="12" cy="12" r="12" fill={background} /> : <rect width="24" height="24" rx="5" fill={background} />}
      <text x="12" y={label.length > 2 ? "15.5" : "16"} fill={foreground} fontFamily="Arial, sans-serif" fontSize={label.length > 2 ? "7.5" : label.length > 1 ? "10" : "14"} fontWeight="700" textAnchor="middle">
        {label}
      </text>
    </svg>
  );
}

export function PlatformIcon({ doc, size = 14 }: { doc: DocId; size?: number }) {
  const { platform } = parseDoc(doc);
  if (!platform) return <FileText size={size} className="text-[var(--accent)]" />;

  switch (platform) {
    case "hackernews":
      return <Badge label="Y" background="#ff6600" size={size} />;
    case "naver_blog":
      return <Badge label="N" background="#03c75a" size={size} />;
    case "tistory":
      return <Badge label="T" background="#f44f05" size={size} circle />;
    case "mastodon":
      return <Badge label="M" background="#6364ff" size={size} />;
    case "producthunt":
      return <Badge label="P" background="#ff6154" size={size} circle />;
    case "devto":
      return <Badge label="DEV" background="#0a0a0a" size={size} />;
    case "naver_cafe":
      return <Badge label="C" background="#03c75a" size={size} />;
    case "okky":
      return <Badge label="OK" background="#2563eb" size={size} />;
    case "brunch":
      return <Badge label="b" background="#111111" size={size} circle />;
    case "velog":
      return <Badge label="v" background="#20c997" size={size} />;
    case "hashnode":
      return <Badge label="H" background="#2962ff" size={size} />;
    case "wordpress":
      return <Badge label="W" background="#21759b" size={size} circle />;
    case "bluesky":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
          <rect width="24" height="24" rx="6" fill="#1185fe" />
          <path d="M12 13.2C10.6 10.1 7.3 5.2 4.5 5.2 2.4 5.2 2 7.4 2 9.1c0 4.8 2.6 7.5 5.6 8.1-2.1.4-3.5 1.2-2.4 2.4 2.3 2.4 5.5-.9 6.8-2.8 1.3 1.9 4.5 5.2 6.8 2.8 1.1-1.2-.3-2-2.4-2.4 3-0.6 5.6-3.3 5.6-8.1 0-1.7-.4-3.9-2.5-3.9-2.8 0-6.1 4.9-7.5 8z" fill="white" />
        </svg>
      );
    case "substack":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
          <rect width="24" height="24" rx="5" fill="#ff6719" />
          <path d="M6 4h12v3H6zm0 5h12v3H6zm0 5h12v6l-6-3-6 3z" fill="white" />
        </svg>
      );
    case "medium":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <ellipse cx="8" cy="12" rx="7" ry="7" />
          <ellipse cx="18" cy="12" rx="3" ry="7" />
          <ellipse cx="22.5" cy="12" rx="1.5" ry="6.5" />
        </svg>
      );
    case "instagram":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.4" cy="6.6" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case "reddit":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 7c4.7 0 8 2.7 8 6.2S16.7 19 12 19s-8-2.3-8-5.8S7.3 7 12 7z" />
          <path d="M12 7l1-4 3 .7M9 19l-3 2M15 19l3 2" />
          <circle cx="18" cy="4" r="1.5" />
          <circle cx="9" cy="12" r="1" fill="currentColor" stroke="none" />
          <circle cx="15" cy="12" r="1" fill="currentColor" stroke="none" />
          <path d="M9.5 15.2c1.6 1 3.4 1 5 0" />
        </svg>
      );
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d={PATHS[platform]} />
        </svg>
      );
  }
}
