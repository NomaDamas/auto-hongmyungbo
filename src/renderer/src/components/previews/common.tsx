import type { MediaItem } from "@shared/types";

export interface PreviewProps {
  text: string;
  media: MediaItem[];
  name: string;
  mediaUrl: (file: string) => string;
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-[#e7e5e4] font-semibold text-[#57534e]"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {Array.from(name.trim() || "나")[0]}
    </span>
  );
}

export function MediaGrid({ items, mediaUrl, max = items.length }: { items: MediaItem[]; mediaUrl: (file: string) => string; max?: number }) {
  const visible = items.slice(0, max);
  if (visible.length === 0) return null;
  return (
    <div className={`mt-3 grid gap-1 overflow-hidden rounded-lg ${visible.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
      {visible.map((item, index) => (
        <div key={`${item.file}-${index}`} className={`relative max-h-80 min-h-28 bg-[#e5e7eb] ${visible.length === 3 && index === 2 ? "col-span-2" : ""}`}>
          {item.kind === "image" ? (
            <img src={mediaUrl(item.file)} alt={item.alt ?? ""} className="h-full max-h-80 w-full object-cover" />
          ) : (
            <video src={mediaUrl(item.file)} className="h-full max-h-80 w-full object-cover" controls preload="metadata" />
          )}
          {index === max - 1 && items.length > max && <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-xl font-semibold text-white">+{items.length - max}</span>}
        </div>
      ))}
    </div>
  );
}

export function CommentBubble({ text, name }: { text: string; name: string }) {
  return (
    <div className="flex items-start gap-2.5 border-t border-[#e4e4e7] bg-[#fafafa] px-5 py-4 text-[#18181b]">
      <Avatar name={name} size={30} />
      <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm bg-[#e9e9ec] px-3.5 py-2.5">
        <div className="mb-0.5 text-[11px] font-semibold">{name} <span className="font-normal text-[#71717a]">· 댓글</span></div>
        <div className="whitespace-pre-wrap break-words text-[13px] leading-relaxed">{text || "댓글 초안이 비어 있습니다."}</div>
      </div>
    </div>
  );
}

export function splitTitle(text: string): { title: string; body: string } {
  const lines = text.split("\n");
  const titleIndex = lines.findIndex((line) => /^#\s+/.test(line));
  if (titleIndex < 0) return { title: "제목 없음", body: text };
  const title = lines[titleIndex].replace(/^#\s+/, "").trim();
  return { title: title || "제목 없음", body: [...lines.slice(0, titleIndex), ...lines.slice(titleIndex + 1)].join("\n").trim() };
}
