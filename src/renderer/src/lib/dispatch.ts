import { toast } from "sonner";
import type { DocId, PlatformId } from "@shared/types";
import { docLabel } from "@shared/platforms";
import { useStore, type PendingReply } from "@/store";
import { intent, parseSections, propagate, type Preset, type Target } from "./prompts";
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

/** Route a chat reply into the target docs as reviewable proposals. */
export function applyReply(reply: string, pending: Pick<PendingReply, "docs" | "selection">): void {
  const { project, propose, proposals } = useStore.getState();
  if (!project || !reply.trim()) return;
  const sections = parseSections(reply);
  if (sections) {
    const docs = (Object.keys(sections) as DocId[]).filter((d) => pending.docs.includes(d) && sections[d]);
    for (const d of docs) propose(d, sections[d]!, "web AI");
    if (docs.length > 1) toast.success(`${docs.length}개 열에 제안 도착`, { description: "상단 검토 바에서 한 번에 수락하거나 열마다 검토하세요." });
    return;
  }
  const doc = pending.docs[0];
  const current = proposals[doc]?.proposed ?? project.docs[doc];
  const next = pending.selection && current.includes(pending.selection) ? current.replace(pending.selection, reply.trim()) : reply.trim();
  propose(doc, next, "web AI");
}

async function dispatch(prompt: (t: Target) => string, pending: Omit<PendingReply, "tabId">): Promise<void> {
  const t = activeTarget();
  const { autoSubmit, project } = useStore.getState();
  if (!project) return;
  if (!t) {
    toast.error("오른쪽 도크에서 AI 웹 탭이나 하네스 터미널을 선택하세요.");
    useStore.setState({ dockOpen: true });
    return;
  }
  const text = prompt(t.target);
  useStore.setState({ dockOpen: true });

  if (t.target === "harness") {
    sendToTerminal(t.id, text, autoSubmit);
    toast.message("하네스로 전송", { description: "파일이 바뀌면 각 열에 diff로 표시됩니다." });
    return;
  }

  cancelPending();
  try {
    const before = await sendToWeb(t.id, text, autoSubmit);
    useStore.setState({ pendingReply: { ...pending, tabId: t.id } });
    if (!autoSubmit) {
      toast.message("입력창에 넣었습니다", { description: "직접 전송한 뒤 '응답 가져오기'를 누르세요." });
      return;
    }
    const ctl = new AbortController();
    inflight = ctl;
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

/** Current text for a doc, including an unreviewed proposal (so chained intents build on it). */
function textOf(doc: DocId): string {
  const { project, proposals } = useStore.getState();
  return proposals[doc]?.proposed ?? project?.docs[doc] ?? "";
}

/** 일괄 전파: master → every enabled platform (fresh or updated) in one prompt. */
export function runPropagate(only?: PlatformId[]): Promise<void> {
  const { project, settings } = useStore.getState();
  if (!project?.docs.master.trim()) {
    toast.error("원문을 먼저 쓰세요.");
    return Promise.resolve();
  }
  const platforms = only ?? settings?.platforms ?? [];
  const current = Object.fromEntries(platforms.map((p) => [p, textOf(p)]));
  return dispatch((t) => propagate(project.docs.master, current, platforms, project.meta.brief ?? "", t), { docs: platforms, selection: "" });
}

/** One intent applied to the given docs (or the intent bar's scope). */
export function runIntent(instruction: string, preset?: Preset, docs?: DocId[]): Promise<void> {
  const { project, selections, scope } = useStore.getState();
  if (!project) return Promise.resolve();
  const targets = (docs ?? scope).filter((d) => textOf(d).trim());
  if (targets.length === 0) {
    toast.error(`${(docs ?? scope).map(docLabel).join(", ")}이(가) 비어 있습니다.`);
    return Promise.resolve();
  }
  if (!instruction.trim() && !preset) return Promise.resolve();
  const texts = Object.fromEntries(targets.map((d) => [d, textOf(d)]));
  const selection = targets.length === 1 ? (selections[targets[0]] ?? "") : "";
  return dispatch((t) => intent({ docs: targets, texts, instruction, preset, selection, brief: project.meta.brief ?? "" }, t), { docs: targets, selection });
}
