import { useState } from "react";
import { Copy, ImagePlus, Play, X as XIcon } from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";
import type { DocId, MediaItem, PlatformId } from "@shared/types";
import { PLATFORMS, parseDoc } from "@shared/platforms";
import { useStore } from "@/store";

export function mediaRuleText(doc: PlatformId): string {
  const rule = PLATFORMS[doc].media;
  const parts = [
    rule.images > 0 ? `이미지 최대 ${rule.images}장` : "이미지 불가",
    rule.videos > 0 ? `영상 최대 ${rule.videos}개` : "영상 불가",
  ];
  if (!rule.mixed) parts.push("혼합 불가");
  if (rule.required) parts.push("미디어 필수");
  return parts.join(" · ");
}

export function mediaProblems(doc: PlatformId, items: MediaItem[]): string[] {
  const rule = PLATFORMS[doc].media;
  const images = items.filter((item) => item.kind === "image").length;
  const videos = items.filter((item) => item.kind === "video").length;
  const problems: string[] = [];
  if (images > rule.images) problems.push(`이미지 ${images}/${rule.images}장`);
  if (videos > rule.videos) problems.push(`영상 ${videos}/${rule.videos}개`);
  if (!rule.mixed && images > 0 && videos > 0) problems.push("이미지와 영상을 함께 올릴 수 없습니다");
  if (rule.required && items.length === 0) problems.push("미디어를 1개 이상 추가하세요");
  return problems;
}

function fitMediaRules(doc: PlatformId, items: MediaItem[]): MediaItem[] {
  const rule = PLATFORMS[doc].media;
  const firstKind = items[0]?.kind;
  const allowed = rule.mixed || !firstKind ? items : items.filter((item) => item.kind === firstKind);
  let images = 0;
  let videos = 0;
  return allowed.filter((item) => {
    if (item.kind === "image") return ++images <= rule.images;
    return ++videos <= rule.videos;
  });
}

/** Media attached to the current document, including Finder drag-drop and drag reordering. */
export function MediaStrip({ doc }: { doc: DocId }) {
  const project = useStore((s) => s.project);
  const enabledPlatforms = useStore((s) => s.enabledPlatforms);
  const setMedia = useStore((s) => s.setMedia);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const { platform, variant } = parseDoc(doc);
  if (!project || variant === "comment") return null;

  const items = project.meta.media?.[doc] ?? [];
  const problems = platform ? mediaProblems(platform, items) : [];
  const url = (item: MediaItem) => window.api.projects.mediaUrl(project.slug, item.file);

  const addPaths = async (paths: string[]) => {
    if (paths.length === 0) return;
    setAdding(true);
    try {
      const added = await window.api.projects.addMedia(project.slug, paths);
      setMedia(doc, [...items, ...added]);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setAdding(false);
    }
  };

  const pick = async () => {
    setAdding(true);
    try {
      const added = await window.api.projects.pickMedia(project.slug);
      if (added.length) setMedia(doc, [...items, ...added]);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setAdding(false);
    }
  };

  const move = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return;
    const next = [...items];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setMedia(doc, next);
  };

  const applyToAll = () => {
    for (const platform of enabledPlatforms()) setMedia(platform, fitMediaRules(platform, items));
    toast.success("원문 미디어를 모든 플랫폼에 적용했습니다.");
  };

  return (
    <section
      className="border-t border-[var(--border)] px-3 py-2"
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) event.preventDefault();
      }}
      onDrop={(event) => {
        if (!event.dataTransfer.files.length) return;
        event.preventDefault();
        const files = Array.from(event.dataTransfer.files);
        const paths = files.map((file) => window.api.projects.pathForFile(file)).filter(Boolean);
        if (paths.length !== files.length) toast.error("파일 경로를 읽을 수 없습니다. 파일 선택 버튼으로 추가해 주세요.");
        void addPaths(paths);
      }}
    >
      <div className="flex items-center gap-2 overflow-x-auto">
        <div className="flex shrink-0 gap-2">
          {items.map((item, index) => (
            <div
              key={`${item.file}-${index}`}
              className={clsx("group relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-2)]", dragIndex === index && "opacity-40")}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("application/x-hong-media", String(index));
                setDragIndex(index);
              }}
              onDragEnd={() => setDragIndex(null)}
              onDragOver={(event) => {
                if (event.dataTransfer.types.includes("application/x-hong-media")) event.preventDefault();
              }}
              onDrop={(event) => {
                const raw = event.dataTransfer.getData("application/x-hong-media");
                if (!raw) return;
                event.preventDefault();
                event.stopPropagation();
                move(Number(raw), index);
                setDragIndex(null);
              }}
              title={item.alt ?? item.file}
            >
              {item.kind === "image" ? (
                <img src={url(item)} alt={item.alt ?? item.file} className="h-full w-full object-cover" draggable={false} />
              ) : (
                <>
                  <video src={url(item)} className="h-full w-full object-cover" muted preload="metadata" />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/20 text-white">
                    <Play size={18} fill="currentColor" />
                  </span>
                </>
              )}
              <button
                className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-black/65 text-white group-hover:flex"
                onClick={() => setMedia(doc, items.filter((_, i) => i !== index))}
                title="미디어 제거"
              >
                <XIcon size={11} />
              </button>
            </div>
          ))}
        </div>
        <button
          className="flex h-16 w-16 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-[var(--border-strong)] text-[10px] text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)] disabled:opacity-40"
          disabled={adding}
          onClick={() => void pick()}
          title="이미지 또는 영상 추가 · Finder 파일을 여기에 놓아도 됩니다"
        >
          <ImagePlus size={17} />
          {adding ? "추가 중" : "추가"}
        </button>
        {doc === "master" && items.length > 0 && (
          <button className="btn btn-xs btn-ghost shrink-0" onClick={applyToAll}>
            <Copy size={11} /> 모든 플랫폼에 적용
          </button>
        )}
      </div>
      {platform && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[10.5px] leading-relaxed">
          <span className="text-[var(--muted)]">{mediaRuleText(platform)}</span>
          {problems.map((problem) => (
            <span key={problem} className="text-[var(--error)]">{problem}</span>
          ))}
        </div>
      )}
    </section>
  );
}
