import { useEffect, useMemo, useState } from "react";
import { Bot, FileSearch, GitBranch, Loader2, Send, Sparkles } from "lucide-react";
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

  return (
    <section className="flex h-full min-h-0 flex-col bg-[var(--surface)]">
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-[var(--border)] px-3">
        <Bot size={14} className="text-[var(--focus)]" />
        <div className="flex items-center gap-1 rounded-md bg-[var(--surface-2)] p-0.5">
          <button className={`btn btn-xs ${chatTab === "promotion" ? "btn-primary" : "btn-ghost"}`} onClick={() => setChatTab("promotion")}>홍보관리</button>
          <button className={`btn btn-xs ${chatTab === "files" ? "btn-primary" : "btn-ghost"}`} onClick={() => setChatTab("files")}><FileSearch size={12} /> 파일 에이전트</button>
          <button className={`btn btn-xs ${chatTab === "library" ? "btn-primary" : "btn-ghost"}`} onClick={() => setChatTab("library")}><GitBranch size={12} /> 글 목록</button>
        </div>
        <span className="text-[12px] font-medium">통합 Chat</span>
        <select className="input ml-auto h-7 py-0 text-[11px]" value={provider?.id ?? ""} onChange={(event) => setProviderId(event.target.value)}>
          {providers.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
        {provider?.model && <span className="pill pill-accent">{provider.model}</span>}
        {provider?.effort && <span className="pill pill-accent">{provider.effort}</span>}
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
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[10.5px] text-[var(--muted)]">범위</span>
          {([["all", "전체"], ["sns", "SNS"], ["community", "커뮤니티"], ["blog", "블로그"]] as const).map(([value, label]) => <button key={value} className={`btn btn-xs ${scope === value ? "btn-primary" : "btn-ghost"}`} onClick={() => { setScope(value); setTargets([]); }}>{label}</button>)}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SKILLS.map(([preset, label]) => <button key={preset} className="btn btn-xs" disabled={busy} onClick={() => void send(preset)}>{label}</button>)}
        </div>
        <div className="text-[10px] text-[var(--muted)]">외부 writing/바이럴 skill은 채팅에서 이름을 요청하거나 “추천해줘”라고 말하면 에이전트가 연결합니다.</div>
        <div className="flex items-end gap-2">
          <textarea className="input min-h-20 flex-1 resize-none" value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="현재 글에 원하는 작업을 입력하세요…" onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); void send(); } }} />
          <button className="btn btn-primary h-9" disabled={busy || !instruction.trim()} onClick={() => void send()}>{busy ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} 전송</button>
        </div>
      </div>}
    </section>
  );
}
