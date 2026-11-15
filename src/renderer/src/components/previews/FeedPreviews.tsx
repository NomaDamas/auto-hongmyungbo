import { useState } from "react";
import { Globe2, Heart, MessageCircle, MoreHorizontal, Repeat2, Send } from "lucide-react";
import twitter from "twitter-text";
import { PLATFORMS } from "@shared/platforms";
import { Avatar, MediaGrid, type PreviewProps } from "./common";

export function LinkedInPreview({ text, media, name, mediaUrl }: PreviewProps) {
  const [expanded, setExpanded] = useState(false);
  const truncated = text.length > 210 && !expanded;
  return (
    <article className="p-5 text-[#18181b]">
      <header className="flex items-center gap-3">
        <Avatar name={name} size={48} />
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{name}</div>
          <div className="text-xs text-[#71717a]">1시간 · 🌐</div>
        </div>
        <MoreHorizontal size={20} className="text-[#71717a]" />
      </header>
      <div className="mt-4 whitespace-pre-wrap break-words text-[14px] leading-[1.55]">
        {truncated ? text.slice(0, 210) : text}
        {text.length > 210 && <button className="ml-1 text-[#71717a] hover:underline" onClick={() => setExpanded((value) => !value)}>{truncated ? "…더보기" : "접기"}</button>}
      </div>
      <MediaGrid items={media} mediaUrl={mediaUrl} />
      <footer className="mt-4 flex justify-around border-t border-[#e4e4e7] pt-3 text-xs font-medium text-[#71717a]"><span>좋아요</span><span>댓글</span><span>퍼가기</span><span>공유</span></footer>
    </article>
  );
}

export function XPreview({ text, media, name, mediaUrl, platform = "x" }: PreviewProps & { platform?: "x" | "bluesky" | "mastodon" }) {
  const characters = Array.from(text);
  const limit = PLATFORMS[platform].limit;
  let split = characters.length;
  let weighted = 0;
  for (let index = 0; index < characters.length; index++) {
    weighted = platform === "x" ? twitter.parseTweet(characters.slice(0, index + 1).join("")).weightedLength : index + 1;
    if (weighted > limit) {
      split = index;
      break;
    }
  }
  const count = platform === "x" ? twitter.parseTweet(text).weightedLength : characters.length;
  return (
    <article className="p-5 text-[#0f1419]">
      <header className="flex items-center gap-3">
        <Avatar name={name} size={42} />
        <div className="min-w-0 flex-1">
          <span className="font-bold">{name}</span> <span className="text-[#536471]">@{name.replace(/\s+/g, "").toLowerCase() || "me"}</span>
          <span className="text-[#536471]"> · 1시간</span>
        </div>
        <MoreHorizontal size={19} className="text-[#536471]" />
      </header>
      <div className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-normal">
        <span>{characters.slice(0, split).join("")}</span>
        {split < characters.length && <span className="bg-[#fee2e2] text-[#dc2626]">{characters.slice(split).join("")}</span>}
      </div>
      <MediaGrid items={media} mediaUrl={mediaUrl} max={4} />
      <div className={`mt-3 text-right text-xs ${count > limit ? "font-semibold text-[#dc2626]" : "text-[#536471]"}`}>{count}/{limit}</div>
      <footer className="mt-2 flex justify-between border-t border-[#eff3f4] pt-3 text-[#536471]"><MessageCircle size={17} /><Repeat2 size={17} /><Heart size={17} /><Send size={17} /></footer>
    </article>
  );
}

export function ThreadsPreview({ text, media, name, mediaUrl }: PreviewProps) {
  return (
    <article className="p-5 text-[#101828]">
      <div className="flex gap-3">
        <Avatar name={name} size={40} />
        <div className="min-w-0 flex-1">
          <header className="flex items-center gap-2"><strong className="text-sm">{name.replace(/\s+/g, "_").toLowerCase()}</strong><span className="text-xs text-[#98a2b3]">1시간</span><MoreHorizontal size={18} className="ml-auto text-[#667085]" /></header>
          <div className="mt-1 whitespace-pre-wrap break-words text-[14px] leading-relaxed">{text}</div>
          <MediaGrid items={media} mediaUrl={mediaUrl} />
          <footer className="mt-4 flex gap-5 text-[#667085]"><Heart size={18} /><MessageCircle size={18} /><Repeat2 size={18} /><Send size={18} /></footer>
        </div>
      </div>
    </article>
  );
}

export function InstagramPreview({ text, media, name, mediaUrl }: PreviewProps) {
  const [current, setCurrent] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const item = media[Math.min(current, Math.max(0, media.length - 1))];
  const clipped = text.length > 125 && !expanded;
  return (
    <article className="text-[#18181b]">
      <header className="flex items-center gap-3 p-3"><Avatar name={name} size={34} /><strong className="text-sm">{name}</strong><MoreHorizontal size={19} className="ml-auto" /></header>
      <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-[#e4e4e7]">
        {item ? item.kind === "image" ? <img src={mediaUrl(item.file)} alt={item.alt ?? ""} className="h-full w-full object-cover" /> : <video src={mediaUrl(item.file)} className="h-full w-full object-cover" controls /> : <span className="text-sm text-[#a1a1aa]">미디어를 추가하세요</span>}
        {media.length > 1 && <span className="absolute right-3 top-3 rounded-full bg-black/55 px-2 py-0.5 text-xs text-white">{current + 1}/{media.length}</span>}
      </div>
      {media.length > 1 && <div className="flex justify-center gap-1.5 py-2">{media.map((mediaItem, index) => <button key={`${mediaItem.file}-${index}`} aria-label={`${index + 1}번 미디어`} className={`h-1.5 w-1.5 rounded-full ${index === current ? "bg-[#0095f6]" : "bg-[#d4d4d8]"}`} onClick={() => setCurrent(index)} />)}</div>}
      <div className="flex gap-4 px-4 pb-2 pt-1"><Heart size={23} /><MessageCircle size={23} /><Send size={23} /></div>
      <div className="px-4 pb-5 text-[14px] leading-relaxed">
        <strong className="mr-1.5">{name}</strong>
        <span className="whitespace-pre-wrap break-words">{clipped ? text.slice(0, 125) : text}</span>
        {text.length > 125 && <button className="ml-1 text-[#71717a]" onClick={() => setExpanded((value) => !value)}>{clipped ? "더 보기" : "접기"}</button>}
      </div>
    </article>
  );
}

export function FacebookPreview({ text, media, name, mediaUrl }: PreviewProps) {
  return (
    <article className="p-5 text-[#080809]">
      <header className="flex items-center gap-3"><Avatar name={name} size={42} /><div className="flex-1"><div className="font-semibold">{name}</div><div className="flex items-center gap-1 text-xs text-[#65676b]">1시간 · <Globe2 size={11} /></div></div><MoreHorizontal size={20} className="text-[#65676b]" /></header>
      <div className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-relaxed">{text}</div>
      <MediaGrid items={media} mediaUrl={mediaUrl} />
      <footer className="mt-4 flex justify-around border-y border-[#e4e6eb] py-2 text-sm font-medium text-[#65676b]"><span>좋아요</span><span>댓글</span><span>공유</span></footer>
    </article>
  );
}
