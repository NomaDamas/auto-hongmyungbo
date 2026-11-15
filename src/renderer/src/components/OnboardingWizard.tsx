import { useEffect, useState } from "react";
import { Check, CheckCircle2, ChevronLeft, ChevronRight, Circle, CircleAlert, Download, ExternalLink, Loader2, LogIn, RefreshCw, TerminalSquare, X as XIcon } from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";
import type { PlatformId, SetupStatus } from "@shared/types";
import { PLATFORMS } from "@shared/platforms";
import { useStore } from "@/store";
import { PlatformIcon } from "./PlatformIcon";

const STEP_LABELS = ["Aside 앱", "Aside CLI", "Aside 로그인", "플랫폼 로그인"];

export function OnboardingWizard() {
  const open = useStore((s) => s.setupOpen);
  const settings = useStore((s) => s.settings);
  const enabledPlatforms = useStore((s) => s.enabledPlatforms);
  const logins = useStore((s) => s.asideLogins);
  const checking = useStore((s) => s.asideChecking);
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState<{ step: string; pct?: number } | null>(null);

  const refresh = async () => {
    try {
      setStatus(await window.api.setup.status());
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setProgress(null);
    void refresh();
    const offProgress = window.api.setup.onProgress(setProgress);
    return () => offProgress();
  }, [open]);

  useEffect(() => {
    if (open && step === 3) void useStore.getState().refreshAside(true);
  }, [open, step]);

  if (!open || !settings) return null;
  const close = () => useStore.setState({ setupOpen: false });
  const finish = () => {
    void useStore.getState().updateSettings({ onboarded: true }).then(close).catch((error: Error) => toast.error(error.message));
  };
  const runCommand = (label: string, command: string) => {
    const id = `setup-${Date.now()}`;
    useStore.setState((state) => ({
      runTabs: [...state.runTabs, { id, label, command }],
      dockTab: `run:${id}`,
      dockOpen: true,
    }));
  };
  const installApp = async () => {
    setInstalling(true);
    setProgress({ step: "설치 준비 중", pct: 0 });
    try {
      await window.api.setup.installAsideApp();
      await refresh();
      toast.success("Aside 앱을 설치했습니다.");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setInstalling(false);
    }
  };
  const login = async (platform: PlatformId) => {
    try {
      await window.api.aside.openLogin(platform, settings.asideProfileId || undefined);
      toast.message(`Aside에서 ${PLATFORMS[platform].label} 로그인 창을 열었습니다.`);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <div className="scrim items-center justify-center" onMouseDown={close}>
      <div className="glass flex max-h-[88vh] w-[650px] flex-col" onMouseDown={(event) => event.stopPropagation()}>
        <header className="flex h-14 shrink-0 items-center border-b border-[var(--border)] px-5">
          <div>
            <div className="font-semibold">시작 설정</div>
            <div className="text-[11px] text-[var(--muted)]">AI와 게시에 필요한 연결을 확인합니다</div>
          </div>
          <button className="icon-btn ml-auto" onClick={close} title="닫기"><XIcon size={15} /></button>
        </header>

        <ol className="flex shrink-0 items-center gap-1 border-b border-[var(--border)] px-5 py-3">
          {STEP_LABELS.map((label, index) => (
            <li key={label} className="flex min-w-0 flex-1 items-center gap-1.5">
              <button className="flex min-w-0 items-center gap-1.5 text-left" onClick={() => setStep(index)}>
                <span className={clsx("flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px]", index === step ? "border-[var(--fg)] bg-[var(--fg)] text-[var(--bg)]" : index < step ? "border-[var(--success)] text-[var(--success)]" : "border-[var(--border-strong)] text-[var(--muted)]")}>
                  {index < step ? <Check size={11} /> : index + 1}
                </span>
                <span className={clsx("truncate text-[11px]", index === step ? "text-[var(--fg)]" : "text-[var(--muted)]")}>{label}</span>
              </button>
              {index < STEP_LABELS.length - 1 && <span className="h-px min-w-2 flex-1 bg-[var(--border)]" />}
            </li>
          ))}
        </ol>

        <div className="min-h-0 flex-1 overflow-y-auto p-6 text-[13px]">
          {!status ? (
            <div className="flex h-48 items-center justify-center gap-2 text-[var(--muted)]"><Loader2 size={16} className="animate-spin" /> 설치 상태 확인 중…</div>
          ) : step === 0 ? (
            <section className="space-y-5">
              <div className="flex items-start gap-3">
                <img src="https://aside.com/favicon.ico" alt="" className="mt-1 h-8 w-8 rounded-lg" />
                <div>
                  <h2 className="text-lg font-semibold">Aside 앱</h2>
                  <p className="mt-1 leading-relaxed text-[var(--muted)]">플랫폼 로그인과 게시를 수행하는 브라우저입니다. 계정 정보는 Aside 안에만 보관됩니다.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] p-4">
                {status.asideApp ? <CheckCircle2 size={18} className="text-[var(--success)]" /> : <CircleAlert size={18} className="text-[var(--warning)]" />}
                <span className="flex-1">{status.asideApp ? "Aside 앱이 설치되어 있습니다." : "Aside 앱을 찾을 수 없습니다."}</span>
                {!status.asideApp && (
                  <button className="btn btn-sm btn-primary" disabled={installing} onClick={() => void installApp()}>
                    {installing ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} 설치
                  </button>
                )}
              </div>
              {(installing || progress) && !status.asideApp && (
                <div>
                  <div className="mb-1.5 flex justify-between text-[11px] text-[var(--muted)]"><span>{progress?.step ?? "설치 중"}</span>{progress?.pct !== undefined && <span>{Math.round(progress.pct)}%</span>}</div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-3)]"><div className={clsx("h-full rounded-full bg-[var(--fg)]", progress?.pct === undefined && "w-1/2 animate-pulse")} style={{ width: progress?.pct === undefined ? undefined : `${Math.max(0, Math.min(100, progress.pct))}%` }} /></div>
                </div>
              )}
            </section>
          ) : step === 1 ? (
            <section className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold">Aside CLI</h2>
                <p className="mt-1 leading-relaxed text-[var(--muted)]">앱이 Aside와 안전하게 통신하는 공식 명령어 도구입니다. 설치 명령은 오른쪽 독 터미널에서 실행됩니다.</p>
              </div>
              <div className="rounded-xl border border-[var(--border)] p-4">
                <div className="flex items-center gap-2">
                  {status.asideCli ? <CheckCircle2 size={18} className="text-[var(--success)]" /> : <CircleAlert size={18} className="text-[var(--warning)]" />}
                  <span className="flex-1">{status.asideCli ? "Aside CLI를 사용할 수 있습니다." : "Aside CLI를 찾을 수 없습니다."}</span>
                  {!status.asideCli && (
                    <button className="btn btn-sm btn-primary" onClick={() => runCommand("Aside CLI 설치", "curl -fsSL https://releases.aside.com/install.sh | bash")}>
                      <TerminalSquare size={12} /> 설치
                    </button>
                  )}
                </div>
                {!status.asideCli && <code className="mt-3 block overflow-x-auto rounded-lg bg-[var(--term-bg)] p-3 text-[11px] text-white">curl -fsSL https://releases.aside.com/install.sh | bash</code>}
              </div>
              <button className="btn btn-sm" onClick={() => void refresh()}><RefreshCw size={12} /> 다시 확인</button>
            </section>
          ) : step === 2 ? (
            <section className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold">Aside 로그인</h2>
                <p className="mt-1 leading-relaxed text-[var(--muted)]">Aside 계정으로 이 기기를 연결합니다. 터미널에서 로그인한 뒤 Aside 설정 › 계정 › 기기에서 이 기기를 승인하세요.</p>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] p-4">
                {status.asideSignedIn ? <CheckCircle2 size={18} className="text-[var(--success)]" /> : <CircleAlert size={18} className="text-[var(--warning)]" />}
                <span className="flex-1">{status.asideSignedIn ? "Aside에 로그인되어 있습니다." : "Aside 로그인이 필요합니다."}</span>
                {!status.asideSignedIn && <button className="btn btn-sm btn-primary" onClick={() => runCommand("Aside 로그인", "aside login")}><LogIn size={12} /> 로그인</button>}
              </div>
              <button className="btn btn-sm" onClick={() => void refresh()}><RefreshCw size={12} /> 다시 확인</button>
            </section>
          ) : (
            <section className="space-y-5">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold">플랫폼 로그인</h2>
                  <p className="mt-1 text-[var(--muted)]">사용할 플랫폼을 Aside 브라우저에서 로그인하세요.</p>
                </div>
                <button className="btn btn-xs" onClick={() => void window.api.aside.openImporter(settings.asideProfileId || undefined).catch((error: Error) => toast.error(error.message))}><Download size={11} /> 브라우저에서 가져오기</button>
              </div>
              <ul className="grid grid-cols-2 gap-2">
                {enabledPlatforms().map((platform) => {
                  const loginState = logins[platform];
                  return (
                    <li key={platform} className="flex items-center gap-2 rounded-lg border border-[var(--border)] p-2.5">
                      <PlatformIcon doc={platform} size={14} />
                      <span className="min-w-0 flex-1 truncate text-[12px]">{PLATFORMS[platform].label}</span>
                      {checking && !loginState ? <Loader2 size={12} className="animate-spin text-[var(--muted)]" /> : loginState === "signed-in" ? <CheckCircle2 size={13} className="text-[var(--success)]" /> : <Circle size={13} className="text-[var(--muted)]" />}
                      <button className="btn btn-xs" onClick={() => void login(platform)}>{loginState === "signed-in" ? "열기" : "Aside에서 로그인"}</button>
                    </li>
                  );
                })}
              </ul>
              <button className="btn btn-xs btn-ghost" disabled={checking} onClick={() => void useStore.getState().refreshAside(true)}>{checking ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />} 로그인 다시 확인</button>

              <div className="border-t border-[var(--border)] pt-4">
                <h3 className="mb-2 font-semibold">AI 하네스</h3>
                <div className="grid grid-cols-3 gap-2">
                  {settings.harnesses.map((harness) => (
                    <div key={harness.id} className="rounded-lg border border-[var(--border)] p-3">
                      <div className="flex items-center gap-1.5 text-[12px] font-medium">
                        {status.harnesses[harness.id] ? <CheckCircle2 size={13} className="text-[var(--success)]" /> : <CircleAlert size={13} className="text-[var(--warning)]" />}
                        <span className="truncate">{harness.label}</span>
                      </div>
                      <div className="mt-1 text-[10.5px] text-[var(--muted)]">{status.harnesses[harness.id] ? "설치됨" : "찾을 수 없음"}</div>
                      {!status.harnesses[harness.id] && (harness.id === "claude" || harness.id === "codex") && (
                        <code className="mt-2 block break-all text-[10px] text-[var(--muted)]">{harness.id === "claude" ? "npm i -g @anthropic-ai/claude-code" : "npm i -g @openai/codex"}</code>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
        </div>

        <footer className="flex h-14 shrink-0 items-center border-t border-[var(--border)] px-5">
          <button className="btn btn-xs btn-ghost" onClick={finish}>건너뛰기</button>
          <a className="ml-2 inline-flex items-center gap-1 text-[11px] text-[var(--muted)] hover:text-[var(--fg)]" href="https://docs.aside.com" onClick={(event) => { event.preventDefault(); window.api.openExternal("https://docs.aside.com"); }}>도움말 <ExternalLink size={10} /></a>
          <div className="ml-auto flex gap-2">
            {step > 0 && <button className="btn btn-sm" onClick={() => setStep((value) => value - 1)}><ChevronLeft size={12} /> 이전</button>}
            {step < 3 ? <button className="btn btn-sm btn-primary" onClick={() => setStep((value) => value + 1)}>다음 <ChevronRight size={12} /></button> : <button className="btn btn-sm btn-primary" onClick={finish}><Check size={12} /> 완료</button>}
          </div>
        </footer>
      </div>
    </div>
  );
}
