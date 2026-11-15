import { ArrowBigUp, MessageSquare, MoreHorizontal, Share2 } from "lucide-react";
import type { PlatformId } from "@shared/types";
import { PLATFORMS } from "@shared/platforms";
import { MediaGrid, splitTitle, type PreviewProps } from "./common";

type CommunityPlatform = Extract<PlatformId, "reddit" | "producthunt" | "devto" | "naver_cafe" | "okky">;

export function RedditPreview({ text, media, name, mediaUrl, platform = "reddit" }: PreviewProps & { platform?: CommunityPlatform }) {
  const { title, body } = splitTitle(text);
  return (
    <article className="p-5 text-[#1c1c1c]">
      <header className="flex items-center gap-2 text-xs">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ff4500] text-[11px] font-bold text-white">{platform === "reddit" ? "r/" : PLATFORMS[platform].label.slice(0, 2)}</span>
        <div><div className="font-semibold">{platform === "reddit" ? "r/subreddit" : PLATFORMS[platform].label}</div><div className="text-[#576f76]">{name} · 1시간 전</div></div>
        <button className="ml-auto rounded-full bg-[#0045ac] px-3 py-1 font-semibold text-white">{platform === "reddit" ? "가입" : "팔로우"}</button>
        <MoreHorizontal size={18} className="text-[#576f76]" />
      </header>
      <h2 className="mt-3 break-words text-[20px] font-semibold leading-snug">{title}</h2>
      <div className="mt-2 whitespace-pre-wrap break-words text-[14px] leading-relaxed">{body}</div>
      <MediaGrid items={media} mediaUrl={mediaUrl} />
      <footer className="mt-4 flex gap-3 text-xs font-semibold text-[#576f76]"><span className="flex items-center gap-1 rounded-full bg-[#e9ebee] px-3 py-1.5"><ArrowBigUp size={16} /> 0</span><span className="flex items-center gap-1 rounded-full bg-[#e9ebee] px-3 py-1.5"><MessageSquare size={14} /> 댓글</span><span className="flex items-center gap-1 rounded-full bg-[#e9ebee] px-3 py-1.5"><Share2 size={14} /> 공유</span></footer>
    </article>
  );
}

export function HackerNewsPreview({ text, name }: PreviewProps) {
  const { title, body } = splitTitle(text);
  return (
    <article className="bg-[#f6f6ef] text-[#000000]">
      <div className="flex items-center gap-3 bg-[#ff6600] px-3 py-1.5 text-[13px]"><strong>Hacker News</strong><span>new | past | comments | ask | show | jobs | submit</span></div>
      <div className="flex gap-2 p-4 font-[Verdana,sans-serif]">
        <ArrowBigUp size={16} className="mt-1 shrink-0 text-[#999999]" />
        <div>
          <h2 className="text-[16px] leading-snug">{title}</h2>
          <div className="mt-1 text-[10px] text-[#828282]">0 points by {name.replace(/\s+/g, "_")} 1 hour ago | hide | past | discuss</div>
          <div className="mt-4 whitespace-pre-wrap break-words text-[13px] leading-relaxed">{body}</div>
        </div>
      </div>
      <footer className="border-t border-[#ff6600] px-4 py-3 text-center text-[11px] text-[#828282]">Guidelines | FAQ | Lists | API | Security | Legal | Apply to YC | Contact</footer>
    </article>
  );
}

