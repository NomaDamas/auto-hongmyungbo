import { useEffect, useMemo, useState } from "react";
import { Bot, FileSearch, GitBranch, Loader2, Send, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import type { DocId, FileSearchResult, PlatformId } from "@shared/types";
import { PLATFORMS, platformsInTab, type TabId } from "@shared/platforms";
import type { Preset } from "@/lib/prompts";
import { useStore } from "@/store";
import { cancelPending, runAsideIntent, runIntent } from "@/lib/dispatch";
import { shellQuote } from "@/lib/term-bridge";

const SKILLS = [
  ["humanize", "윤문"],
  ["hook", "훅 강화"],
] as const;
const HIDDEN_SKILLS = "marketingskills, x-skills, x-growth-skills (사용자가 요청하거나 추천을 요청할 때만 에이전트가 연결)";
const HIDDEN_SKILL_MATCHERS: readonly [string, string][] = [
  ["marketing", "marketingskills"], ["마케팅", "marketingskills"], ["카피라이팅", "marketingskills/copywriting"],
  ["x viral", "x-skills"], ["x 바이럴", "x-skills"], ["x-growth", "x-growth-skills"], ["x 성장", "x-growth-skills"],
  ["thread", "x-skills/x-thread-builder"], ["스레드", "x-skills/x-thread-builder"], ["humanizer", "x-skills/x-humanizer"],
];
const RECOMMENDED_SKILLS = [["humanize", "윤문"], ["hook", "훅 강화"], ["shorter", "짧게"], ["professional", "전문적으로"]] as const;
const COMMON_MODELS = ["gpt-6.1-sol", "gpt-6.1-sol-high", "gpt-6.1-terra-medium", "claude-sonnet", "gemini-2.5-pro", "grok-4"];
type Scope = "all" | TabId;

export function UnifiedChat({ initialTab = "promotion", hideHeader = false, onCloseSplit }: { initialTab?: "promotion" | "files" | "library"; hideHeader?: boolean; onCloseSplit?: () => void } = {}) {
  const settings = useStore((s) => s.settings);
  const project = useStore((s) => s.project);
  const projects = useStore((s) => s.projects);
  const activeDoc = useStore((s) => s.activeDoc);
  const [providerId, setProviderId] = useState("");
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const [chatTab, setChatTab] = useState<"promotion" | "files" | "library">(initialTab);
  const [splitTab, setSplitTab] = useState<"promotion" | "files" | "library" | null>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformId[]>([]);
  const [fileQuery, setFileQuery] = useState("");
  const [fileResults, setFileResults] = useState<FileSearchResult[]>([]);
  const [fileContext, setFileContext] = useState<FileSearchResult[]>([]);
  const [slashOpen, setSlashOpen] = useState(false);
  const [chatTabs, setChatTabs] = useState<Array<"promotion" | "files" | "library">>(["promotion", "files", "library"]);
  const [closedChatTabs, setClosedChatTabs] = useState<Array<"promotion" | "files" | "library">>([]);
  const [newItem, setNewItem] = useState<"post" | "folder" | null>(null);
  const [newTitle, setNewTitle] = useState("");
  useEffect(() => { setFileQuery(""); setFileResults([]); setFileContext([]); }, [project?.slug]);
  useEffect(() => {
    const onLibraryCreate = (event: Event) => {
      const detail = (event as CustomEvent<"post" | "folder">).detail;
      useStore.setState({ dockOpen: true });
      setChatTab("library");
      setNewItem(detail);
      setNewTitle("");
    };
    window.addEventListener("hmb:library-create", onLibraryCreate);
    return () => window.removeEventListener("hmb:library-create", onLibraryCreate);
  }, []);
  const [targets, setTargets] = useState<DocId[]>([]);
  const providers = useMemo(() => (settings?.providers ?? []).filter((provider) => provider.enabled), [settings?.providers]);
  const provider = providers.find((item) => item.id === providerId) ?? providers[0];

  if (!project || !settings) return null;

  const send = async (preset?: Preset) => {
    if (!provider) return toast.error("Provider를 먼저 설정하세요.");
    const executionKind = provider.kind === "custom" ? (provider.command ? "cli" : provider.url ? "web" : "unsupported") : provider.kind === "browser" ? (provider.url ? "web" : "unsupported") : provider.kind;
    if (executionKind !== "web" && executionKind !== "cli") return toast.error("Provider에 실행 명령 또는 URL을 설정하세요.");
    const enabled = useStore.getState().enabledPlatforms();
    const scopedPlatforms = selectedPlatforms.length ? selectedPlatforms : enabled;
    const requestedTargets = targets.length ? targets : scopedPlatforms;
    const requestTargets = requestedTargets.filter((doc) => !!project.docs[doc]?.trim());
    if (!requestTargets.length) return toast.error("대상 플랫폼을 먼저 설정하세요.");
    if (!requestTargets.some((doc) => project.docs[doc]?.trim()) && !preset) return toast.error("현재 문서에 내용을 먼저 입력하세요.");
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
    const context = fileContext.length ? `\n\nSelected project files for context:\n${fileContext.map((item) => `--- ${item.path} ---\n${item.snippet}`).join("\n")}` : "";
    const requestInstruction = settingsHint ? `${instruction}\n\nProvider settings: ${settingsHint}${context}` : `${instruction}${context}`;
    setBusy(true);
    try {
      const normalizedInstruction = `${instruction} ${preset ?? ""}`.toLowerCase();
      const requestedSkills = HIDDEN_SKILL_MATCHERS.filter(([term]) => normalizedInstruction.includes(term.toLowerCase())).map(([, skill]) => skill);
      const skills = [...new Set([...provider.skills, ...requestedSkills])];
      const fullInstruction = `${requestInstruction}\n\n선택한 플랫폼: ${targets.length ? "드래그한 문서" : scopedPlatforms.join(", ")}\n사용 가능한 외부 skill은 사용자가 이름을 요청하거나 추천을 요청할 때만 연결: ${HIDDEN_SKILLS}${skills.length ? `\n명시적으로 켠 provider skill: ${skills.join(", ")}` : ""}`;
      let lastError: unknown;
      for (let attempt = 0; attempt <= provider.retries; attempt += 1) {
        let timeoutHandle: number | undefined;
        try {
          await Promise.race([
            executionKind === "web"
              ? runAsideIntent(provider.url!, provider.browserProfileId || settings.asideProfileId || undefined, fullInstruction, preset, requestTargets)
              : runIntent(fullInstruction, preset, requestTargets),
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

  const tabLabel = { promotion: "홍보관리", files: "파일 에이전트", library: "글 목록" } as const;
  const sendSkill = (skill: Preset) => { setInstruction(""); setSlashOpen(false); void send(skill); };
  const slashQuery = instruction.endsWith("/") ? "" : instruction.split("/").at(-1)?.toLowerCase() ?? "";
  const visibleSkills = RECOMMENDED_SKILLS.filter(([id, label]) => !slashQuery || id.includes(slashQuery) || label.toLowerCase().includes(slashQuery));
  const reorderChatTab = (from: "promotion" | "files" | "library", toIndex: number) => setChatTabs((current) => { const next = current.filter((item) => item !== from); next.splice(Math.max(0, Math.min(toIndex, next.length)), 0, from); return next; });
  const closeChatTab = (tab: "promotion" | "files" | "library") => { setChatTabs((current) => current.filter((item) => item !== tab)); setClosedChatTabs((current) => current.includes(tab) ? current : [...current, tab]); if (chatTab === tab) setChatTab(chatTabs.find((item) => item !== tab) ?? "promotion"); if (splitTab === tab) setSplitTab(null); };
  const reopenChatTab = (tab: "promotion" | "files" | "library") => { setChatTabs((current) => current.includes(tab) ? current : [...current, tab]); setClosedChatTabs((current) => current.filter((item) => item !== tab)); setChatTab(tab); };
  const enabled = useStore.getState().enabledPlatforms();
  const groupState = (tab: TabId) => { const ids = platformsInTab(tab, enabled); const count = ids.filter((id) => selectedPlatforms.includes(id)).length; return { ids, checked: ids.length > 0 && count === ids.length, partial: count > 0 && count < ids.length }; };
  const toggleGroup = (tab: TabId) => { const { ids, checked } = groupState(tab); setSelectedPlatforms((current) => checked ? current.filter((id) => !ids.includes(id)) : [...new Set([...current, ...ids])]); };
  const togglePlatform = (id: PlatformId) => setSelectedPlatforms((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  return (
    <div className={splitTab && !hideHeader ? "grid h-full min-h-0 grid-cols-2 gap-px bg-[var(--border)]" : "h-full min-h-0"}>
    <section className="flex h-full min-h-0 flex-col bg-[var(--surface)]" onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
      const tab = event.dataTransfer.getData("application/x-hmb-chat-tab") as "promotion" | "files" | "library";
      if (tab && tab !== chatTab) { event.preventDefault(); setSplitTab(tab); }
    }}>
      {!hideHeader && <header className="flex h-11 shrink-0 items-center gap-2 border-b border-[var(--border)] px-3">
        <Bot size={14} className="text-[var(--focus)]" />
        <div className="flex items-center gap-1 rounded-md bg-[var(--surface-2)] p-0.5" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { const from = event.dataTransfer.getData("application/x-hmb-chat-tab") as typeof chatTab; if (from) reorderChatTab(from, chatTabs.length); }}>
          {chatTabs.map((tab, index) => <div key={tab} draggable className={`flex items-center rounded ${chatTab === tab ? "bg-[var(--surface-3)]" : ""}`} onDragStart={(event) => event.dataTransfer.setData("application/x-hmb-chat-tab", tab)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); event.stopPropagation(); const from = event.dataTransfer.getData("application/x-hmb-chat-tab") as typeof chatTab; if (from) reorderChatTab(from, index); }}><button className={`btn btn-xs ${chatTab === tab ? "btn-primary" : "btn-ghost"}`} onClick={() => setChatTab(tab)}>{tab === "files" ? <FileSearch size={12} /> : tab === "library" ? <GitBranch size={12} /> : null}{tab === "promotion" ? "통합 Chat" : tabLabel[tab]}</button><button className="icon-btn h-5 w-5" title={`${tabLabel[tab]} 닫기`} onClick={() => closeChatTab(tab)}><X size={11} /></button></div>)}
          {closedChatTabs.length > 0 && <div className="relative"><button className="icon-btn h-6 w-6" title="닫힌 Chat 탭 다시 열기" onClick={() => { const tab = closedChatTabs[0]; if (tab) reopenChatTab(tab); }}>+</button></div>}
        </div>
        <select className="input ml-auto h-7 max-w-36 py-0 text-[11px]" value={provider?.id ?? ""} onChange={(event) => setProviderId(event.target.value)}>
          {providers.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </header>}
      {chatTab === "library" ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className="mb-2 text-[11px] text-[var(--muted)]">홍보 글과 Git 버전 기록</div>
          <div className="space-y-1">
            <div className="mb-2 flex gap-1"><button className="btn btn-xs" onClick={() => { setNewItem("post"); setNewTitle(""); }}>새 글</button><button className="btn btn-xs" onClick={() => { setNewItem("folder"); setNewTitle(""); }}>새 폴더</button></div>
            {newItem && <form className="mb-2 flex gap-1" onSubmit={(event) => { event.preventDefault(); const title = newTitle.trim(); if (!title) return; void (newItem === "post" ? useStore.getState().createProject(title, "") : useStore.getState().createFolder(title)).then(() => { setNewItem(null); setNewTitle(""); }); }}><input autoFocus className="input min-w-0 flex-1 text-[11px]" value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder={newItem === "post" ? "글 제목" : "폴더 이름"} /><button className="btn btn-xs btn-primary">확인</button></form>}
            {projects.map((item) => <button key={item.slug} className={`block w-full rounded-md px-2 py-2 text-left text-[12px] hover:bg-[var(--surface-2)] ${project.slug === item.slug ? "bg-[var(--surface-3)]" : ""}`} onClick={() => void useStore.getState().openProject(item.slug)}>{item.title}<span className="ml-2 text-[10px] text-[var(--muted)]">{new Date(item.updatedAt).toLocaleDateString()}</span></button>)}
          </div>
          <button className="btn btn-sm mt-3 w-full" onClick={() => useStore.setState({ historyDoc: activeDoc })}>현재 문서 Git 버전 기록</button>
        </div>
      ) : chatTab === "files" ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
          <div className="text-[11px] text-[var(--muted)]">현재 프로젝트 폴더에서 파일명·본문을 검색하고, 선택한 파일을 홍보관리 Chat context로 넘깁니다. 바이너리·media·node_modules는 제외합니다.</div>
          <div className="flex gap-2">
            <input className="input flex-1" value={fileQuery} onChange={(event) => setFileQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && fileQuery.trim()) void window.api.projects.searchFiles(project.slug, fileQuery).then(setFileResults); }} placeholder="파일명 또는 내용 검색…" />
            <button className="btn btn-primary" onClick={() => void window.api.projects.searchFiles(project.slug, fileQuery).then(setFileResults)}><FileSearch size={13} /> 찾기</button>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
            {fileResults.map((item) => <button key={item.path} className={`block w-full rounded-lg border p-2 text-left text-[11px] ${fileContext.some((selected) => selected.path === item.path) ? "border-[var(--focus)]" : "border-[var(--border)]"}`} onClick={() => setFileContext((current) => current.some((selected) => selected.path === item.path) ? current.filter((selected) => selected.path !== item.path) : [...current, item])}><div className="font-medium">{item.path}</div><div className="mt-1 line-clamp-3 text-[var(--muted)]">{item.snippet}</div></button>)}
          </div>
          <div className="text-[11px] text-[var(--muted)]">Chat에 전달할 파일: {fileContext.map((item) => item.path).join(", ") || "없음"}</div>
        </div>
      ) : <div className="flex min-h-0 flex-1 flex-col justify-end gap-3 p-3" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { const tab = event.dataTransfer.getData("application/x-hmb-chat-tab") as "promotion" | "files" | "library"; if (tab && tab !== chatTab) setSplitTab(tab); }}>
        <div className="flex flex-wrap gap-1.5" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const doc = event.dataTransfer.getData("application/x-hmb-doc") as DocId; if (doc) setTargets([doc]); }}>
          {(["sns", "community", "blog"] as const).map((tab) => { const state = groupState(tab); return <div key={tab} className="group relative rounded-lg border border-[var(--border)] px-2 py-1"><label className="flex items-center gap-1 text-[10.5px]"><input type="checkbox" checked={state.checked} ref={(element) => { if (element) element.indeterminate = state.partial; }} onChange={() => toggleGroup(tab)} />{tab === "sns" ? "SNS" : tab === "community" ? "커뮤니티" : "블로그"}</label><div className="absolute left-0 top-full z-10 hidden min-w-40 rounded-md border border-[var(--border)] bg-[var(--surface)] p-1 shadow-xl group-hover:block">{state.ids.map((id) => <label key={id} className="flex items-center gap-1 px-2 py-1 text-[10.5px]"><input type="checkbox" checked={selectedPlatforms.includes(id)} onChange={() => togglePlatform(id)} />{PLATFORMS[id].label}</label>)}</div></div>; })}
          {targets.length > 0 && <button className="btn btn-xs" onClick={() => setTargets([])}>{targets.join(", ")} ×</button>}
        </div>
        <div className="relative flex items-end gap-2">
          <div className="relative flex-1">
            {slashOpen && <div className="absolute bottom-full left-0 z-10 mb-1 w-64 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1 shadow-xl"><div className="px-2 py-1 text-[10px] text-[var(--muted)]">Skill 선택 · 입력하면 필터링</div>{visibleSkills.map(([preset, label]) => <button key={preset} className="block w-full rounded px-2 py-1.5 text-left text-[11px] hover:bg-[var(--surface-2)]" onClick={() => sendSkill(preset)}>{label}</button>)}<div className="border-t border-[var(--border)] px-2 py-1 text-[10px] text-[var(--muted)]">외부 Skill은 이름을 입력하거나 추천을 요청하세요.</div></div>}
            <div className="absolute bottom-1.5 left-2 right-1.5 flex items-center gap-1 overflow-x-auto">
              {RECOMMENDED_SKILLS.slice(0, 2).map(([preset, label]) => <button key={preset} className="btn btn-xs" disabled={busy} onClick={() => void send(preset)}>{label}</button>)}
              {provider && <input list="hmb-models" className="input h-6 w-28 shrink-0 border-0 bg-transparent py-0 text-[10px]" value={provider.model ?? ""} placeholder="모델 선택" onChange={(event) => void useStore.getState().updateSettings({ providers: settings.providers.map((item) => item.id === provider.id ? { ...item, model: event.target.value || undefined } : item) })} />}
              <datalist id="hmb-models">{[...new Set([...COMMON_MODELS, ...(provider?.model ? [provider.model] : [])])].map((model) => <option key={model} value={model} />)}</datalist>
              {provider && <select aria-label="추론 effort" className="input h-6 w-36 shrink-0 border-0 bg-transparent py-0 text-[10px]" value={provider.effort ?? "medium"} onChange={(event) => void useStore.getState().updateSettings({ providers: settings.providers.map((item) => item.id === provider.id ? { ...item, effort: event.target.value as typeof provider.effort } : item) })}><option value="low">Low · 빠른 응답</option><option value="medium">Medium · 균형</option><option value="high">High · 깊은 추론</option><option value="xhigh">XHigh · 최대 추론</option></select>}
              <button className="btn btn-xs btn-primary ml-auto shrink-0" disabled={busy || !instruction.trim()} onClick={() => void send()}>{busy ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} 전송</button>
            </div>
          </div>
        </div>
      </div>}
    </section>
    {splitTab && !hideHeader && <div className="relative min-h-0"><UnifiedChat initialTab={splitTab} hideHeader onCloseSplit={() => setSplitTab(null)} /><button className="icon-btn absolute right-1 top-1 z-10 h-6 w-6" title={`${tabLabel[splitTab]} 닫기`} onClick={() => setSplitTab(null)}><X size={12} /></button></div>}
    </div>
  );
}
