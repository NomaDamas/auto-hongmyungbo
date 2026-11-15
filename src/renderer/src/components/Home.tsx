import { useState } from "react";
import { ArrowRight, FileText, Plus } from "lucide-react";
import { useStore } from "@/store";

export function Home() {
  const projects = useStore((s) => s.projects);
  const settings = useStore((s) => s.settings)!;
  const [title, setTitle] = useState("");

  const create = () => void useStore.getState().createProject(title || "새 글");

  return (
    <div className="flex h-full items-start justify-center overflow-y-auto pt-[12vh]">
      <div className="w-[560px]">
        <h1 className="mb-1 text-[22px] font-semibold tracking-tight">무엇을 쓸까요?</h1>
        <p className="mb-6 text-[13px] text-[var(--muted)]">
          원문 하나 → LinkedIn · X · Threads · Reddit. AI는 오른쪽 도크(ChatGPT·Claude·Gemini 웹, Claude Code·Codex·omp)에서, 게시는 Aside로.
        </p>
        <form
          className="mb-8 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            create();
          }}
        >
          <input autoFocus className="input flex-1 py-2.5 text-[14px]" placeholder="글 제목 (예: 오픈소스 런칭 후기)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <button className="btn btn-primary px-4">
            <Plus size={14} /> 새 글
          </button>
        </form>
        {projects.length > 0 && (
          <>
            <h2 className="mb-2 text-[12px] font-medium uppercase tracking-wide text-[var(--muted)]">최근</h2>
            <ul className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
              {projects.map((p) => (
                <li key={p.slug}>
                  <button className="group flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[var(--surface-2)]" onClick={() => void useStore.getState().openProject(p.slug)}>
                    <FileText size={15} className="text-[var(--muted)]" />
                    <span className="flex-1 truncate text-[14px]">{p.title}</span>
                    <span className="text-[12px] text-[var(--muted)]">{new Date(p.updatedAt).toLocaleDateString()}</span>
                    <ArrowRight size={14} className="opacity-0 group-hover:opacity-60" />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="mt-6 text-[12px] text-[var(--muted)]">
          저장 위치: <code>{settings.workspaceRoot}</code>
        </p>
      </div>
    </div>
  );
}
