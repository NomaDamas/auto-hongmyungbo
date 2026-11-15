import type { ReactNode } from "react";
import type { PlatformId } from "@shared/types";
import { PLATFORMS } from "@shared/platforms";
import { Avatar, splitTitle, type PreviewProps } from "./common";

function MarkdownBody({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index++;
      continue;
    }
    const heading = line.match(/^(#{2,6})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      blocks.push(level === 2 ? <h2 key={index}>{heading[2]}</h2> : <h3 key={index}>{heading[2]}</h3>);
      index++;
      continue;
    }
    if (/^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      const ordered = /^\d+\.\s+/.test(line);
      const entries: string[] = [];
      while (index < lines.length && (ordered ? /^\d+\.\s+/ : /^[-*]\s+/).test(lines[index])) {
        entries.push(lines[index].replace(ordered ? /^\d+\.\s+/ : /^[-*]\s+/, ""));
        index++;
      }
      blocks.push(ordered ? <ol key={index}>{entries.map((entry, entryIndex) => <li key={entryIndex}>{entry}</li>)}</ol> : <ul key={index}>{entries.map((entry, entryIndex) => <li key={entryIndex}>{entry}</li>)}</ul>);
      continue;
    }
    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim() && !/^#{2,6}\s+/.test(lines[index]) && !/^[-*]\s+/.test(lines[index]) && !/^\d+\.\s+/.test(lines[index])) {
      paragraph.push(lines[index]);
      index++;
    }
    blocks.push(<p key={index}>{paragraph.join("\n")}</p>);
  }
  return <div className="blog-preview-body">{blocks}</div>;
}

export function BlogPreview({ platform, text, media, name, mediaUrl }: PreviewProps & { platform: PlatformId }) {
  const { title, body } = splitTitle(text);
  return (
    <article className={`min-h-[420px] text-[#18181b] ${platform === "medium" ? "px-10 py-7" : "p-7"}`}>
      {platform === "naver_blog" && <div className="mb-7 border-b border-[#e5e7eb] pb-3 text-[15px] font-bold text-[#03c75a]">네이버 블로그 <span className="ml-2 font-normal text-[#71717a]">{name}의 블로그</span></div>}
      {platform === "tistory" && <div className="mb-8 text-[22px] font-black tracking-tight">{name}.tistory</div>}
      {platform === "medium" && <div className="mb-10 text-[25px] font-black tracking-[-0.06em]">Medium</div>}
      {!["naver_blog", "tistory", "medium"].includes(platform) && <div className="mb-8 text-[18px] font-bold tracking-tight">{PLATFORMS[platform].label}</div>}
      <h1 className={`break-words font-bold tracking-tight ${platform === "medium" ? "text-[36px] leading-[1.15]" : "text-[30px] leading-tight"}`}>{title}</h1>
      <div className="my-5 flex items-center gap-2.5 border-b border-[#ececee] pb-5">
        <Avatar name={name} size={34} />
        <div><div className="text-[13px] font-semibold">{name}</div><div className="text-[11px] text-[#71717a]">{platform === "medium" ? "5 min read · " : ""}1시간 전</div></div>
      </div>
      {media.length > 0 && (
        <div className="mb-7 space-y-3">
          {media.map((item, index) => item.kind === "image" ? <img key={`${item.file}-${index}`} src={mediaUrl(item.file)} alt={item.alt ?? ""} className="max-h-[520px] w-full rounded-md object-contain" /> : <video key={`${item.file}-${index}`} src={mediaUrl(item.file)} className="max-h-[520px] w-full rounded-md" controls preload="metadata" />)}
        </div>
      )}
      <div className="text-[16px] leading-[1.85] [&_.blog-preview-body_h2]:mb-3 [&_.blog-preview-body_h2]:mt-8 [&_.blog-preview-body_h2]:text-[23px] [&_.blog-preview-body_h2]:font-bold [&_.blog-preview-body_h3]:mb-2 [&_.blog-preview-body_h3]:mt-6 [&_.blog-preview-body_h3]:text-[19px] [&_.blog-preview-body_h3]:font-semibold [&_.blog-preview-body_ol]:my-4 [&_.blog-preview-body_ol]:list-decimal [&_.blog-preview-body_ol]:pl-6 [&_.blog-preview-body_p]:my-4 [&_.blog-preview-body_p]:whitespace-pre-wrap [&_.blog-preview-body_ul]:my-4 [&_.blog-preview-body_ul]:list-disc [&_.blog-preview-body_ul]:pl-6">{<MarkdownBody text={body} />}</div>
    </article>
  );
}
