import { CheckCircle2, Circle, Send } from "lucide-react";
import { toast } from "sonner";
import clsx from "clsx";
import type { PlatformId } from "@shared/types";
import { PLATFORMS } from "@shared/platforms";
import { useStore } from "@/store";
import { countFor } from "@/lib/count";
import { shellQuote } from "@/lib/term-bridge";
import { PlatformIcon } from "./PlatformIcon";

const COMPOSE_URL: Record<PlatformId, string> = {
  linkedin: "https://www.linkedin.com/feed/?shareActive=true",
  x: "https://x.com/compose/post",
  threads: "https://www.threads.com/",
  reddit: "https://www.reddit.com/submit",
};

/**
 * Publishing goes through the Aside browser (user's logged-in sessions).
 * Each publish spawns `aside "<task>"` in a dock terminal so progress and any
 * confirmation prompts stay visible; exit code updates the tray status.
 */
function asideTask(p: PlatformId, file: string): string {
  const where = p === "reddit" ? "Reddit (use the first '# ' line as the title, rest as body; ask me which subreddit if unclear)" : PLATFORMS[p].label;
  return `Publish the post in the local file ${file} to ${where} using my logged-in account. Open ${COMPOSE_URL[p]}. Paste the text exactly as written, do not edit it. Stop before the final Post button and ask me to confirm.`;
}

export function PublishTray() {
  const project = useStore((s) => s.project)!;
  const settings = useStore((s) => s.settings)!;
  const proposals = useStore((s) => s.proposals);

  const publish = (p: PlatformId) => {
    if (proposals[p]) return toast.error(`${PLATFORMS[p].label}에 검토 안 된 수정 제안이 있습니다.`);
    const text = project.docs[p];
    if (!text.trim()) return toast.error(`${PLATFORMS[p].label} 글이 비어 있습니다.`);
    const c = countFor(p, text);
    if (c.limit !== null && c.used > c.limit) return toast.error(`${PLATFORMS[p].label} 글자수 초과 (${c.used}/${c.limit})`);
    const file = `${project.dir}/${p}.md`;
    const id = `${p}-${Date.now()}`;
    useStore.getState().setPublish(p, { status: "ready", at: new Date().toISOString() });
    useStore.setState((s) => ({
      runTabs: [...s.runTabs, { id, label: `Aside · ${PLATFORMS[p].label}`, command: `aside ${shellQuote(asideTask(p, file))}`, platform: p }],
      dockTab: `run:${id}`,
      dockOpen: true,
    }));
  };

  return (
    <div className="flex items-center gap-1">
      {settings.platforms.map((p) => {
        const st = project.meta.publish[p]?.status ?? "draft";
        const empty = !project.docs[p].trim();
        return (
          <div key={p} className="group flex items-center">
            <button
              className={clsx("btn btn-xs gap-1.5", st === "posted" && "text-[var(--success)]")}
              disabled={empty}
              onClick={() => publish(p)}
              title={empty ? "비어 있음" : `Aside로 ${PLATFORMS[p].label}에 게시`}
            >
              <PlatformIcon doc={p} size={12} />
              {st === "posted" ? <CheckCircle2 size={11} /> : st === "sent" ? <Send size={11} /> : <Circle size={11} className="opacity-40" />}
            </button>
            {(st === "sent" || st === "ready") && (
              <button
                className="btn btn-xs btn-ghost hidden group-hover:flex"
                onClick={() => useStore.getState().setPublish(p, { status: "posted", at: new Date().toISOString() })}
                title="게시됨으로 표시"
              >
                ✓
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
