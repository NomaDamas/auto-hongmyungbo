import { ImagePlus, Plus, X } from "lucide-react";
import { toast } from "sonner";
import type { PlatformId, ThreadDraft, ThreadPost } from "@shared/types";
import { PLATFORMS } from "@shared/platforms";
import { useStore } from "@/store";

const SEPARATOR = "\n\n--- THREAD POST ---\n\n";

function splitThread(text: string): string[] {
  const parts = text.split(SEPARATOR);
  return parts.length ? parts : [""];
}

export function ThreadEditor({ platform, value }: { platform: PlatformId; value: string }) {
  const project = useStore((s) => s.project)!;
  const stored = project.meta.threads?.[platform];
  const threadPlatform = platform as "x" | "threads";
  const storedText = stored?.posts.map((post) => post.text).join(SEPARATOR);
  const initial: ThreadDraft = stored?.platform === threadPlatform
    ? { platform: threadPlatform, posts: splitThread(value).map((text, index): ThreadPost => ({
      id: stored.posts[index]?.id ?? `${platform}-${index + 1}`,
      text,
      media: stored.posts[index]?.media ?? [],
      status: storedText === value ? stored.posts[index]?.status : "draft",
      url: storedText === value ? stored.posts[index]?.url : undefined,
      error: storedText === value ? stored.posts[index]?.error : undefined,
    })) }
    : { platform: threadPlatform, posts: splitThread(value).map((text, index): ThreadPost => ({ id: `${platform}-${index + 1}`, text, media: [], status: "draft" })) };
  const posts = initial.posts;
  const save = (next: ThreadPost[]) => {
    const state = useStore.getState();
    const meta = { ...state.project!.meta, threads: { ...state.project!.meta.threads, [platform]: { platform, posts: next } } };
    useStore.setState({ project: { ...state.project!, meta } });
    void window.api.projects.writeMeta(state.project!.slug, meta);
    state.setDoc(platform, next.map((post) => post.text).join(SEPARATOR));
  };
  const addMedia = async (index: number) => {
    try {
      const added = await window.api.projects.pickMedia(project.slug);
      if (!added.length) return;
      save(posts.map((post, postIndex) => postIndex === index ? { ...post, media: [...post.media, ...added] } : post));
    } catch (error) { toast.error((error as Error).message); }
  };
  return (
    <div className="h-full overflow-y-auto p-3">
      <div className="mx-auto flex max-w-2xl flex-col gap-2">
        <header className="flex items-center gap-2 px-1 pb-1 text-[12px] text-[var(--muted)]">
          <span className="font-medium text-[var(--fg)]">{PLATFORMS[platform].label} Thread</span>
          <span>{posts.length}개 게시물 · 게시물별 미디어와 상태를 보존합니다.</span>
        </header>
        {posts.map((post, index) => (
          <article key={index} className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
            <div className="mb-2 flex items-center gap-2 text-[11px] text-[var(--muted)]">
              <span className="pill pill-accent">{index + 1}</span>
              <span>{post.text.length}/{PLATFORMS[platform].limit}</span>
              <span className="pill pill-accent">{post.status ?? "draft"}</span>
              {posts.length > 1 && <button className="icon-btn ml-auto h-6 w-6" title="게시물 삭제" onClick={() => save(posts.filter((_, item) => item !== index))}><X size={12} /></button>}
            </div>
            <textarea className="min-h-24 w-full resize-y bg-transparent text-[14px] leading-relaxed outline-none" value={post.text} placeholder="Thread 게시물 내용을 입력하세요…" onChange={(event) => save(posts.map((item, itemIndex) => itemIndex === index ? { ...item, text: event.target.value, status: "draft" } : item))} />
            <div className="mt-2 flex items-center gap-2 text-[10.5px] text-[var(--muted)]">
              <button className="btn btn-xs" onClick={() => void addMedia(index)}><ImagePlus size={12} /> 미디어 추가</button>
              <span>미디어 {post.media.length}개 · 게시물별로 보존됩니다.</span>
            </div>
          </article>
        ))}
        <button className="btn btn-sm self-start" onClick={() => save([...posts, { id: `${platform}-${Date.now()}`, text: "", media: [], status: "draft" }])}><Plus size={13} /> 게시물 추가</button>
      </div>
    </div>
  );
}
