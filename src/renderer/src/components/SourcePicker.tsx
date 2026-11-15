import { useRef, useState } from "react";
import { ExternalLink, FolderOpen, Link2, Loader2, Unlink, X as XIcon } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/store";
import { Popover } from "./Popover";

export function SourcePicker() {
  const source = useStore((s) => s.project?.meta.source);
  const setSource = useStore((s) => s.setSource);
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  const [picking, setPicking] = useState(false);

  const pick = async () => {
    setPicking(true);
    try {
      const selected = await window.api.projects.pickSource();
      if (selected) {
        setSource(selected);
        setOpen(true);
      }
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setPicking(false);
    }
  };

  if (!source) {
    return (
      <button
        className="btn btn-xs btn-ghost"
        disabled={picking}
        onClick={() => void pick()}
        title="코드/프로젝트 폴더를 연결하면 하네스가 코드를 읽고 홍보 글을 씁니다"
      >
        {picking ? <Loader2 size={12} className="animate-spin" /> : <FolderOpen size={12} />} 프로젝트 연결
      </button>
    );
  }

  return (
    <div ref={anchor}>
      <button className="pill pill-accent max-w-44" onClick={() => setOpen((value) => !value)} title={source.path}>
        <FolderOpen size={11} /> <span className="truncate">{source.name}</span>
      </button>
      {open && (
        <Popover anchor={anchor} align="left" width={330} onClose={() => setOpen(false)} className="p-4 text-[12px]">
          <div className="flex items-center gap-2">
            <FolderOpen size={14} className="shrink-0 text-[var(--muted)]" />
            <strong className="min-w-0 flex-1 truncate">{source.name}</strong>
            <button className="icon-btn -mr-1 h-6 w-6" onClick={() => setOpen(false)} title="닫기"><XIcon size={12} /></button>
          </div>
          <code className="mt-2 block break-all rounded-md bg-[var(--surface-2)] p-2 text-[10.5px] text-[var(--muted)]">{source.path}</code>
          {source.links.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {source.links.map((link) => (
                <button key={link} className="flex w-full items-center gap-1.5 text-left text-[var(--focus)] hover:underline" onClick={() => window.api.openExternal(link)}>
                  <Link2 size={11} className="shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{link.replace(/^https?:\/\//, "")}</span>
                  <ExternalLink size={10} className="shrink-0" />
                </button>
              ))}
            </div>
          )}
          {source.summary && <p className="mt-3 max-h-32 overflow-y-auto whitespace-pre-wrap leading-relaxed text-[var(--muted)]">{source.summary}</p>}
          <div className="mt-4 flex justify-end gap-1.5 border-t border-[var(--border)] pt-3">
            <button className="btn btn-xs" disabled={picking} onClick={() => void pick()}>
              {picking ? <Loader2 size={11} className="animate-spin" /> : <FolderOpen size={11} />} 변경
            </button>
            <button
              className="btn btn-xs btn-ghost text-[var(--error)]"
              onClick={() => {
                setSource(undefined);
                setOpen(false);
              }}
            >
              <Unlink size={11} /> 연결 해제
            </button>
          </div>
        </Popover>
      )}
    </div>
  );
}
