import { useEffect, useMemo, useState } from "react";
import { Bot, FileSearch, GitBranch, Loader2, Send, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import type { DocId, FileSearchResult } from "@shared/types";
import { platformsInTab, type TabId } from "@shared/platforms";
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
type Scope = "all" | TabId;

export function UnifiedChat() {
  const settings = useStore((s) => s.settings);
  const project = useStore((s) => s.project);
  const projects = useStore((s) => s.projects);
  const activeDoc = useStore((s) => s.activeDoc);
  const [providerId, setProviderId] = useState("");
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const [chatTab, setChatTab] = useState<"promotion" | "files" | "library">("promotion");
  const [scope, setScope] = useState<Scope>("all");
  const [fileQuery, setFileQuery] = useState("");
  const [fileResults, setFileResults] = useState<FileSearchResult[]>([]);
  const [fileContext, setFileContext] = useState<FileSearchResult[]>([]);
  const [slashOpen, setSlashOpen] = useState(false);
  const [chatTabs, setChatTabs] = useState<Array<"promotion" | "files" | "library">>(["promotion", "files", "library"]);
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
    const scopedPlatforms = scope === "all" ? enabled : platformsInTab(scope, enabled);
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
      const fullInstruction = `${requestInstruction}\n\n대상 범위: ${targets.length ? "드래그한 문서만" : scope === "all" ? "전체 SNS·커뮤니티·블로그" : scope}\n사용 가능한 외부 skill은 사용자가 이름을 요청하거나 추천을 요청할 때만 연결: ${HIDDEN_SKILLS}${skills.length ? `\n명시적으로 켠 provider skill: ${skills.join(", ")}` : ""}`;
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
  return (
    <section className="flex h-full min-h-0 flex-col bg-[var(--surface)]">
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-[var(--border)] px-3">
        <Bot size={14} className="text-[var(--focus)]" />
        <div className="flex items-center gap-1 rounded-md bg-[var(--surface-2)] p-0.5" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { const from = event.dataTransfer.getData("application/x-hmb-chat-tab") as typeof chatTab; if (from) setChatTabs((current) => { const next = current.filter((item) => item !== from); return [...next.slice(0, 1), from, ...next.slice(1)]; }); }}>
          {chatTabs.map((tab) => <button key={tab} draggable className={`btn btn-xs ${chatTab === tab ? "btn-primary" : "btn-ghost"}`} onClick={() => setChatTab(tab)} onDragStart={(event) => event.dataTransfer.setData("application/x-hmb-chat-tab", tab)}>{tab === "files" ? <FileSearch size={12} /> : tab === "library" ? <GitBranch size={12} /> : null}{tabLabel[tab]}</button>)}
        </div>
        <span className="text-[12px] font-medium">통합 Chat</span>
        <select className="input ml-auto h-7 py-0 text-[11px]" value={provider?.id ?? ""} onChange={(event) => setProviderId(event.target.value)}>
          {providers.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
        {provider && <select className="input h-7 max-w-32 py-0 text-[10px]" value={provider.model ?? ""} onChange={(event) => void useStore.getState().updateSettings({ providers: settings.providers.map((item) => item.id === provider.id ? { ...item, model: event.target.value || undefined } : item) })}><option value="">기본 모델</option>{provider.model && <option value={provider.model}>{provider.model}</option>}</select>}
        {provider && <select className="input h-7 w-20 py-0 text-[10px]" value={provider.effort ?? "medium"} onChange={(event) => void useStore.getState().updateSettings({ providers: settings.providers.map((item) => item.id === provider.id ? { ...item, effort: event.target.value as typeof provider.effort } : item) })}><option value="low">low</option><option value="medium">medium</option><option value="high">high</option><option value="xhigh">xhigh</option></select>}
      </header>
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
      ) : <div className="flex min-h-0 flex-1 flex-col justify-end gap-3 p-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 text-[11.5px] text-[var(--muted)]" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const doc = event.dataTransfer.getData("application/x-hmb-doc") as DocId; if (doc) setTargets([doc]); }}>
          <Sparkles size={13} className="mb-1 text-[var(--focus)]" />
          <div>대상: <strong className="text-[var(--fg)]">{targets.join(", ") || (scope === "all" ? "전체" : scope)}</strong></div>
          <div>선택한 Provider가 백그라운드에서 실행되고 결과는 해당 문서의 diff로 돌아옵니다.</div>
        </div>
        <div className="relative flex items-end gap-2">
          <div className="relative flex-1">
            {slashOpen && <div className="absolute bottom-full left-0 z-10 mb-1 w-64 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1 shadow-xl"><div className="px-2 py-1 text-[10px] text-[var(--muted)]">Skill 선택 · 입력하면 필터링</div>{RECOMMENDED_SKILLS.map(([preset, label]) => <button key={preset} className="block w-full rounded px-2 py-1.5 text-left text-[11px] hover:bg-[var(--surface-2)]" onClick={() => sendSkill(preset)}>{label}</button>)}<div className="border-t border-[var(--border)] px-2 py-1 text-[10px] text-[var(--muted)]">외부 Skill은 이름을 입력하거나 추천을 요청하세요.</div></div>}
            <textarea className="input min-h-20 w-full resize-none pb-8" value={instruction} onChange={(event) => { const value = event.target.value; setInstruction(value); setSlashOpen(value.endsWith("/")); }} placeholder="현재 글에 원하는 작업을 입력하세요…" onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); void send(); } }} />
            <div className="absolute bottom-1.5 left-2 flex items-center gap-1"><select className="input h-6 w-28 border-0 bg-transparent py-0 text-[10px]" value={scope} onChange={(event) => { setScope(event.target.value as Scope); setTargets([]); }}><option value="all">대상: 전체</option><option value="sns">대상: SNS</option><option value="community">대상: 커뮤니티</option><option value="blog">대상: 블로그</option></select></div>
            <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1">{RECOMMENDED_SKILLS.slice(0, 2).map(([preset, label]) => <button key={preset} className="btn btn-xs" disabled={busy} onClick={() => void send(preset)}>{label}</button>)}<button className="btn btn-xs btn-primary" disabled={busy || !instruction.trim()} onClick={() => void send()}>{busy ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}</button></div>
          </div>
        </div>
      </div>}
    </section>
  );
}
