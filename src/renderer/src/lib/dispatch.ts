import { toast } from "sonner";
import type { DocId, PlatformId } from "@shared/types";
import { commentDoc, docLabel, parseDoc } from "@shared/platforms";
import { useStore, type PendingReply } from "@/store";
import { commentDrafts, commentReply, intent, parseSections, propagate, type Preset, type Target } from "./prompts";
import { markLatestReplySeen, sendToWeb, waitForReply } from "./web-bridge";
import { sendToTerminal } from "./term-bridge";

let inflight: AbortController | null = null;

function activeTarget(): { target: Target; id: string } | null {
  const { dockTab } = useStore.getState();
  const [kind, id] = dockTab.split(":");
  if (kind === "web") return { target: "web", id };
  if (kind === "harness") return { target: "harness", id: dockTab };
  if (kind === "run") return { target: "harness", id: dockTab };
  return null;
}

export function cancelPending(): void {
  const pending = useStore.getState().pendingReply;
  if (pending) void markLatestReplySeen(pending.tabId.replace(/^web:/, ""));
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
    if (docs.length > 1) toast.success(`${docs.length}개 문서에 제안 도착`, { description: "각 패널에서 diff를 검토하세요." });
    return;
  }
  const doc = pending.docs[0];
  if (!doc) return;
  const current = proposals[doc]?.proposed ?? project.docs[doc] ?? "";
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
    toast.message("하네스로 전송", { description: "파일이 바뀌면 각 패널에 diff로 표시됩니다." });
    return;
  }

  cancelPending();
  try {
    const before = await sendToWeb(t.id, text, autoSubmit);
    useStore.setState({ pendingReply: { ...pending, tabId: t.id } });
    if (!autoSubmit) {
      toast.message("입력창에 넣었습니다", { description: "직접 전송한 뒤 ⋯ 메뉴에서 '응답 가져오기'를 누르세요." });
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

/** 원문 전파: master → every enabled platform (or one stale platform) in one prompt. */
export function runPropagate(only?: PlatformId[]): Promise<void> {
  const { project, enabledPlatforms } = useStore.getState();
  const master = project?.docs.master ?? "";
  if (!project || !master.trim()) {
    toast.error("원문을 먼저 쓰세요.");
    return Promise.resolve();
  }
  const platforms = only ?? enabledPlatforms();
  if (!platforms.length) {
    toast.error("전파할 플랫폼이 없습니다. 설정에서 플랫폼을 선택하세요.");
    return Promise.resolve();
  }
  const current = Object.fromEntries(platforms.map((p) => [p, textOf(p)]));
  return dispatch((t) => propagate(master, current, platforms, project.meta.brief ?? "", t, project.meta.source), { docs: platforms, selection: "" });
}

/** One request drafts a first-comment for every selected platform. */
export function runComments(platforms?: PlatformId[]): Promise<void> {
  const { project, enabledPlatforms } = useStore.getState();
  const targets = platforms ?? enabledPlatforms();
  const master = project?.docs.master ?? "";
  if (!project || !master.trim()) {
    toast.error("댓글 초안을 만들려면 원문을 먼저 쓰세요.");
    return Promise.resolve();
  }
  if (!targets.length) {
    toast.error("댓글을 작성할 플랫폼이 없습니다.");
    return Promise.resolve();
  }
  const docs = targets.map(commentDoc);
  const current = Object.fromEntries(docs.map((doc) => [doc, textOf(doc)]));
  return dispatch((target) => commentDrafts(master, current, targets, project.meta.brief ?? "", target, project.meta.source), { docs, selection: "" });
}

/** Draft a reply to pasted text in the active platform's comment doc. */
export function runCommentReply(pasted: string, platform?: PlatformId): Promise<void> {
  const { project, activeDoc } = useStore.getState();
  const target = platform ?? parseDoc(activeDoc).platform ?? undefined;
  if (!project || !target) {
    toast.error("답글을 작성할 플랫폼 탭을 먼저 여세요.");
    return Promise.resolve();
  }
  if (!pasted.trim()) {
    toast.error("답할 댓글을 붙여넣으세요.");
    return Promise.resolve();
  }
  const doc = commentDoc(target);
  return dispatch(
    (route) => commentReply(target, pasted, textOf(target), project.meta.brief ?? "", route, project.meta.source),
    { docs: [doc], selection: "" },
  );
}

/** Post all ready first-comments sequentially so Aside handles one browser task at a time. */
export async function publishAllComments(): Promise<void> {
  const { project, enabledPlatforms, proposals } = useStore.getState();
  if (!project) return;
  const candidates = enabledPlatforms().filter((platform) => {
    const doc = commentDoc(platform);
    return !!project.docs[doc]?.trim() && !!project.meta.publish[platform]?.url && !proposals[doc];
  });
  if (!candidates.length) {
    toast.error("게시 URL과 검토 완료된 댓글이 있는 플랫폼이 없습니다.");
    return;
  }
  for (const [index, platform] of candidates.entries()) {
    const label = docLabel(commentDoc(platform));
    const toastId = toast.message(`댓글 등록 ${index + 1}/${candidates.length}`, { description: label });
    useStore.getState().setComment(platform, { mode: "first", status: "sent", error: undefined });
    try {
      await window.api.publish.comment(project.slug, platform);
      toast.success(`${label} 요청 완료`, { id: toastId });
    } catch (error) {
      const message = (error as Error).message;
      useStore.getState().setComment(platform, { status: "failed", error: message });
      toast.error(`${label} 실패`, { id: toastId, description: message });
    }
  }
}

/** One intent applied to the supplied docs, or to the focused editor's active doc. */
export function runIntent(instruction: string, preset?: Preset, docs?: DocId[]): Promise<void> {
  const { project, selections, activeDoc } = useStore.getState();
  if (!project) return Promise.resolve();
  const requested = docs ?? [activeDoc];
  const targets = requested.filter((doc) => textOf(doc).trim() || (!!instruction.trim() && parseDoc(doc).variant === "comment"));
  if (targets.length === 0) {
    toast.error(`${requested.map(docLabel).join(", ")}이(가) 비어 있습니다.`);
    return Promise.resolve();
  }
  if (!instruction.trim() && !preset) return Promise.resolve();
  const texts = Object.fromEntries(targets.map((d) => [d, textOf(d)]));
  const selection = targets.length === 1 ? (selections[targets[0]] ?? "") : "";
  return dispatch(
    (t) => intent({ docs: targets, texts, instruction, preset, selection, brief: project.meta.brief ?? "", source: project.meta.source }, t),
    { docs: targets, selection },
  );
}
