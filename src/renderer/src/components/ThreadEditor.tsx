import { Plus, X } from "lucide-react";
import type { PlatformId } from "@shared/types";
import { PLATFORMS } from "@shared/platforms";
import { useStore } from "@/store";

const SEPARATOR = "\n\n--- THREAD POST ---\n\n";

function splitThread(text: string): string[] {
  const parts = text.split(SEPARATOR);
  return parts.length ? parts : [""];
}

export function ThreadEditor({ platform, value }: { platform: PlatformId; value: string }) {
  const posts = splitThread(value);
  const save = (next: string[]) => useStore.getState().setDoc(platform, next.join(SEPARATOR));
  return (
    <div className="h-full overflow-y-auto p-3">
      <div className="mx-auto flex max-w-2xl flex-col gap-2">
        <header className="flex items-center gap-2 px-1 pb-1 text-[12px] text-[var(--muted)]">
          <span className="font-medium text-[var(--fg)]">{PLATFORMS[platform].label} Thread</span>
          <span>{posts.length}개 게시물 · 각 카드에 미디어를 붙일 수 있습니다.</span>
        </header>
        {posts.map((post, index) => (
          <article key={index} className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
            <div className="mb-2 flex items-center gap-2 text-[11px] text-[var(--muted)]">
              <span className="pill pill-accent">{index + 1}</span>
              <span>{post.length}/{PLATFORMS[platform].limit}</span>
              {posts.length > 1 && <button className="icon-btn ml-auto h-6 w-6" title="게시물 삭제" onClick={() => save(posts.filter((_, item) => item !== index))}><X size={12} /></button>}
            </div>
            <textarea className="min-h-24 w-full resize-y bg-transparent text-[14px] leading-relaxed outline-none" value={post} placeholder="Thread 게시물 내용을 입력하세요…" onChange={(event) => save(posts.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} />
            <div className="mt-2 text-[10.5px] text-[var(--muted)]">미디어는 아래 미디어 스트립에서 이 플랫폼에 추가됩니다.</div>
          </article>
        ))}
        <button className="btn btn-sm self-start" onClick={() => save([...posts, ""])}><Plus size={13} /> 게시물 추가</button>
      </div>
    </div>
  );
}
