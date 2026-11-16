import { useEffect, useMemo, useState } from "react";
import { Bot, Loader2, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { DocId } from "@shared/types";
import { useStore } from "@/store";
import { cancelPending, runIntent } from "@/lib/dispatch";
import { shellQuote } from "@/lib/term-bridge";

const SKILLS = [
  ["humanize", "윤문"],
  ["shorter", "짧게"],
  ["hook", "훅 강화"],
  ["casual", "캐주얼"],
  ["professional", "전문적으로"],
  ["x-viral", "X 확산형"],
  ["linkedin", "LinkedIn"],
  ["threads", "Threads"],
] as const;

export function UnifiedChat() {
  const settings = useStore((s) => s.settings);
  const project = useStore((s) => s.project);
  const activeDoc = useStore((s) => s.activeDoc);
  const [providerId, setProviderId] = useState("");
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const [targets, setTargets] = useState<DocId[]>([activeDoc]);
  useEffect(() => setTargets((current) => current.length === 1 ? [activeDoc] : current), [activeDoc]);
  const providers = useMemo(() => (settings?.providers ?? []).filter((provider) => provider.enabled), [settings?.providers]);
  const provider = providers.find((item) => item.id === providerId) ?? providers[0];

  if (!project || !settings) return null;

  const send = async (preset?: string) => {
    if (!provider) return toast.error("Provider를 먼저 설정하세요.");
    const executionKind = provider.kind === "custom" ? (provider.command ? "cli" : provider.url ? "web" : "unsupported") : provider.kind === "browser" ? (provider.url ? "web" : "unsupported") : provider.kind;
    if (executionKind !== "web" && executionKind !== "cli") return toast.error("Provider에 실행 명령 또는 URL을 설정하세요.");
    if (!project.docs[activeDoc]?.trim() && !preset) return toast.error("현재 문서에 내용을 먼저 입력하세요.");
    const previousDock = useStore.getState().dockTab;
    if (executionKind === "web") {
      const webId = provider.id === "claude-web" ? "claude" : provider.id;
      if (!provider.url) return toast.error("Web Provider URL을 설정하세요.");
      const webTabs = settings.webTabs.some((tab) => tab.id === webId)
        ? settings.webTabs.map((tab) => tab.id === webId ? { ...tab, label: provider.label, url: provider.url!, browserProfileId: provider.browserProfileId } : tab)
        : [...settings.webTabs, { id: webId, label: provider.label, url: provider.url, browserProfileId: provider.browserProfileId }];
      await useStore.getState().updateSettings({ webTabs });
      useStore.setState({ dockTab: `web:${webId}` });
    }
    if (executionKind === "cli") {
      if (!provider.command) return toast.error("CLI Provider 명령을 설정하세요.");
      const runId = `provider:${provider.id}`;
      const args = [provider.model && `--model ${shellQuote(provider.model)}`, provider.effort && `--effort ${shellQuote(provider.effort)}`].filter(Boolean).join(" ");
      useStore.setState((state) => ({ runTabs: [...state.runTabs.filter((tab) => tab.id !== runId), { id: runId, label: provider.label, command: `${provider.command} ${args}`.trim() }], dockTab: `run:${runId}` }));
    }
    const settingsHint = [provider.model && `model=${provider.model}`, provider.effort && `effort=${provider.effort}`].filter(Boolean).join(", ");
    const requestInstruction = settingsHint ? `${instruction}\n\nProvider settings: ${settingsHint}` : instruction;
    setBusy(true);
    try {
      const fullInstruction = provider.skills.length ? `${requestInstruction}\n\nSkills: ${provider.skills.join(", ")}` : requestInstruction;
      let lastError: unknown;
      for (let attempt = 0; attempt <= provider.retries; attempt += 1) {
        let timeoutHandle: number | undefined;
        try {
          await Promise.race([
            runIntent(fullInstruction, preset as never, targets),
            new Promise<never>((_, reject) => { timeoutHandle = window.setTimeout(() => {
              if (executionKind === "web") cancelPending();
              reject(new Error(`${provider.label} timed out`));
            }, provider.timeoutMs); }),
          ]);
          lastError = undefined;
          break;
        } catch (error) {
          lastError = error;
          // A timeout cancels the in-flight web request. Retrying would risk
          // submitting the same prompt twice after a late browser response.
          if (String((error as Error)?.message ?? "").includes("timed out")) break;
          // CLI writes are fire-and-forget; replaying them cannot be made
          // idempotent, so provider retries apply only to web adapters.
          if (executionKind === "cli") break;
        } finally {
          if (timeoutHandle !== undefined) window.clearTimeout(timeoutHandle);
        }
      }
      if (lastError) throw lastError;
      setInstruction("");
    } finally {
      setBusy(false);
      if (!provider.url && !provider.command) useStore.setState({ dockTab: previousDock });
    }
  };

  return (
    <section className="flex h-full min-h-0 flex-col bg-[var(--surface)]">
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-[var(--border)] px-3">
        <Bot size={14} className="text-[var(--focus)]" />
        <span className="text-[12px] font-medium">통합 Chat</span>
        <select className="input ml-auto h-7 py-0 text-[11px]" value={provider?.id ?? ""} onChange={(event) => setProviderId(event.target.value)}>
          {providers.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
        {provider?.model && <span className="pill pill-accent">{provider.model}</span>}
        {provider?.effort && <span className="pill pill-accent">{provider.effort}</span>}
      </header>
      <div className="flex min-h-0 flex-1 flex-col justify-end gap-3 p-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 text-[11.5px] text-[var(--muted)]" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const doc = event.dataTransfer.getData("application/x-hmb-doc") as DocId; if (doc) setTargets((current) => current.includes(doc) ? current : [...current, doc]); }}>
          <Sparkles size={13} className="mb-1 text-[var(--focus)]" />
          <div>대상: <strong className="text-[var(--fg)]">{targets.join(", ") || activeDoc}</strong></div>
          <div className="mt-1 text-[10.5px]">SNS Pane을 여기로 드래그하면 해당 글만 다시 생성합니다.</div>
          <div>선택한 Provider가 백그라운드에서 실행되고 결과는 해당 문서의 diff로 돌아옵니다.</div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SKILLS.map(([preset, label]) => <button key={preset} className="btn btn-xs" disabled={busy} onClick={() => void send(preset)}>{label}</button>)}
        </div>
        <div className="flex items-end gap-2">
          <textarea className="input min-h-20 flex-1 resize-none" value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="현재 글에 원하는 작업을 입력하세요…" onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); void send(); } }} />
          <button className="btn btn-primary h-9" disabled={busy || !instruction.trim()} onClick={() => void send()}>{busy ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} 전송</button>
        </div>
      </div>
    </section>
  );
}
