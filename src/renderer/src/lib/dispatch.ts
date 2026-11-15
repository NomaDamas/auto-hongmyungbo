import { toast } from "sonner";
import type { DocId, PlatformId } from "@shared/types";
import { docLabel } from "@shared/platforms";
import { useStore, type PendingReply } from "@/store";
import { generateAll, parseSections, rewrite, updateFromMaster, type RewriteAction, type Target } from "./prompts";
import { sendToWeb, waitForReply } from "./web-bridge";
import { sendToTerminal } from "./term-bridge";

let inflight: AbortController | null = null;

function activeTarget(): { target: Target; id: string } | null {
  const { dockTab } = useStore.getState();
  const [kind, id] = dockTab.split(":");
  if (kind === "web") return { target: "web", id };
  if (kind === "harness") return { target: "harness", id: dockTab };
  return null;
}

export function cancelPending(): void {
  inflight?.abort();
  inflight = null;
  useStore.setState({ pendingReply: null });
}

/** Apply a chat reply to the editor as a reviewable proposal. */
export function applyReply(reply: string, pending: Pick<PendingReply, "doc" | "selection" | "kind">): void {
  const { project, propose, settings } = useStore.getState();
  if (!project || !reply.trim()) return;
  const sections = parseSections(reply);
  if (sections) {
    const enabled = settings?.platforms ?? [];
    const docs = (Object.keys(sections) as PlatformId[]).filter((p) => enabled.includes(p));
    for (const p of docs) propose(p, sections[p]!, "web AI");
    toast.success(`${docs.length}개 플랫폼 초안 도착`, { description: "각 열에서 diff를 검토하세요." });
    return;
  }
  const current = useStore.getState().proposals[pending.doc]?.proposed ?? project.docs[pending.doc];
  const next = pending.selection && current.includes(pending.selection) ? current.replace(pending.selection, reply.trim()) : reply.trim();
  propose(pending.doc, next, "web AI");
}

async function dispatch(build: (t: Target) => string, pending: Omit<PendingReply, "tabId">): Promise<void> {
  const t = activeTarget();
  const { autoSubmit, project } = useStore.getState();
  if (!project) return;
  if (!t) {
    toast.error("오른쪽 도크에서 AI 웹 탭이나 하네스 터미널을 선택하세요.");
    useStore.setState({ dockOpen: true });
    return;
  }
  const prompt = build(t.target);
  useStore.setState({ dockOpen: true });

  if (t.target === "harness") {
    sendToTerminal(t.id, prompt, autoSubmit);
    toast.message("하네스로 전송", { description: "파일이 바뀌면 diff로 표시됩니다." });
    return;
  }

  cancelPending();
  try {
    const before = await sendToWeb(t.id, prompt, autoSubmit);
    if (!autoSubmit) {
      toast.message("입력창에 넣었습니다", { description: "직접 전송한 뒤 '응답 가져오기'를 누르세요." });
      useStore.setState({ pendingReply: { ...pending, tabId: t.id } });
      return;
    }
    const ctl = new AbortController();
    inflight = ctl;
    useStore.setState({ pendingReply: { ...pending, tabId: t.id } });
    const reply = await waitForReply(t.id, before, ctl.signal);
    if (inflight !== ctl) return;
    inflight = null;
    useStore.setState({ pendingReply: null });
    applyReply(reply, pending);
  } catch (e) {
    if ((e as Error).name === "AbortError") return;
    useStore.setState({ pendingReply: null });
    toast.error((e as Error).message);
  }
}

export function runGenerate(): Promise<void> {
  const { project, settings } = useStore.getState();
  if (!project?.docs.master.trim()) {
    toast.error("원문을 먼저 쓰세요.");
    return Promise.resolve();
  }
  const platforms = settings?.platforms ?? [];
  return dispatch((t) => generateAll(project.docs.master, platforms, t), { doc: "master", selection: "", kind: "generate" });
}

export function runRewrite(doc: DocId, action: RewriteAction, custom?: string): Promise<void> {
  const { project, selections, proposals } = useStore.getState();
  if (!project) return Promise.resolve();
  const text = proposals[doc]?.proposed ?? project.docs[doc];
  if (!text.trim()) {
    toast.error(`${docLabel(doc)}이(가) 비어 있습니다.`);
    return Promise.resolve();
  }
  const selection = selections[doc] ?? "";
  return dispatch((t) => rewrite({ doc, action, text, selection, custom }, t), { doc, selection, kind: "rewrite" });
}

export function runUpdateFromMaster(doc: PlatformId): Promise<void> {
  const { project } = useStore.getState();
  if (!project) return Promise.resolve();
  return dispatch((t) => updateFromMaster(doc, project.docs.master, project.docs[doc], t), { doc, selection: "", kind: "rewrite" });
}
