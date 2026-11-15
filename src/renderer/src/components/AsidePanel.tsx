import { useEffect } from "react";
import { CheckCircle2, CircleAlert, CircleDashed, Download, ExternalLink, Loader2, LogIn, RefreshCw, ShieldCheck, X as XIcon } from "lucide-react";
import { toast } from "sonner";
import type { PlatformId } from "@shared/types";
import { PLATFORMS } from "@shared/platforms";
import { useStore } from "@/store";
import { PlatformIcon } from "./PlatformIcon";

/**
 * Aside connection hub. Aside owns every platform login (its browser profile, Apple
 * Passwords autofill, 2FA). This panel only reads non-secret status through the `aside`
 * CLI and opens login pages inside Aside; it never touches cookies, tokens, or passwords.
 */
export function AsidePanel() {
  const open = useStore((s) => s.asideOpen);
  const aside = useStore((s) => s.aside);
  const logins = useStore((s) => s.asideLogins);
  const checking = useStore((s) => s.asideChecking);
  const settings = useStore((s) => s.settings)!;
  const enabledPlatforms = useStore((s) => s.enabledPlatforms);

  useEffect(() => {
    if (open) void useStore.getState().refreshAside(true);
  }, [open]);

  if (!open) return null;
  const close = () => useStore.setState({ asideOpen: false });
  const profileId = settings.asideProfileId || undefined;

  const login = async (p: PlatformId) => {
    try {
      await window.api.aside.openLogin(p, profileId);
      toast.message(`Aside에서 ${PLATFORMS[p].label} 로그인 창을 열었습니다`, {
        description: "Aside 비밀번호 자동완성으로 로그인한 뒤 '다시 확인'을 누르세요.",
      });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="scrim items-center justify-center" onMouseDown={close}>
      <div className="glass flex max-h-[88vh] w-[520px] flex-col" onMouseDown={(e) => e.stopPropagation()}>
        <header className="flex h-12 items-center gap-2 border-b border-[var(--border)] px-5">
          <ShieldCheck size={16} />
          <span className="font-semibold">Aside 연결</span>
          <button className="icon-btn ml-auto" onClick={close}>
            <XIcon size={15} />
          </button>
        </header>

        <div className="min-h-0 space-y-5 overflow-y-auto p-5 text-[13px]">
          {!aside ? (
            <div className="flex items-center gap-2 text-[var(--muted)]">
              <Loader2 size={14} className="animate-spin" /> 상태 확인 중…
            </div>
          ) : !aside.installed ? (
            <div className="space-y-2">
              <p>Aside CLI가 없습니다. 설치 후 다시 확인하세요.</p>
              <code className="block rounded-md bg-[var(--surface-2)] px-3 py-2 text-[12px]">curl -fsSL https://releases.aside.com/install.sh | bash</code>
              <button className="btn btn-sm" onClick={() => window.api.openExternal("https://docs.aside.com/help/developers")}>
                <ExternalLink size={12} /> 설치 안내
              </button>
            </div>
          ) : !aside.signedIn ? (
            <div className="space-y-2">
              <p>Aside CLI가 로그아웃 상태입니다. 터미널에서 로그인하고 Aside 설정 › 계정 › 기기에서 승인하세요.</p>
              <code className="block rounded-md bg-[var(--surface-2)] px-3 py-2 text-[12px]">aside login</code>
            </div>
          ) : (
            <>
              <section className="flex items-center gap-3 rounded-lg border border-[var(--border)] px-3 py-2.5">
                <CheckCircle2 size={16} className="text-[var(--success)]" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{aside.name ?? "Aside"}</div>
                  <div className="truncate text-[12px] text-[var(--muted)]">{aside.email}</div>
                </div>
                <select
                  className="input w-44 py-1 text-[12px]"
                  value={settings.asideProfileId}
                  onChange={(e) => {
                    useStore.setState({ asideLogins: {} });
                    void useStore.getState().updateSettings({ asideProfileId: e.target.value }).then(() => useStore.getState().refreshAside(true));
                  }}
                  title="게시와 로그인 확인에 쓸 Aside 브라우저 프로필"
                >
                  <option value="">기본 프로필</option>
                  {aside.profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                      {p.connected ? "" : " (연결 안 됨)"}
                    </option>
                  ))}
                </select>
              </section>

              <section>
                <div className="mb-2 flex items-center">
                  <h3 className="font-semibold">플랫폼 로그인</h3>
                  <button
                    className="btn btn-xs btn-ghost ml-auto"
                    onClick={() => void window.api.aside.openImporter(profileId).catch((e: Error) => toast.error(e.message))}
                    title="Chrome·Safari·Firefox·Arc의 로그인/쿠키를 Aside가 직접 가져옵니다"
                  >
                    <Download size={12} /> 브라우저에서 가져오기
                  </button>
                  <button className="btn btn-xs btn-ghost" disabled={checking} onClick={() => void useStore.getState().refreshAside(true)}>
                    {checking ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} 다시 확인
                  </button>
                </div>
                <ul className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
                  {enabledPlatforms().map((p) => {
                    const st = logins[p];
                    return (
                      <li key={p} className="flex items-center gap-3 px-3 py-2.5">
                        <PlatformIcon doc={p} size={15} />
                        <span className="flex-1">{PLATFORMS[p].label}</span>
                        {checking && !st ? (
                          <Loader2 size={13} className="animate-spin text-[var(--muted)]" />
                        ) : st === "signed-in" ? (
                          <span className="pill pill-success">
                            <CheckCircle2 size={11} /> 로그인됨
                          </span>
                        ) : st === "signed-out" ? (
                          <span className="pill pill-warning">
                            <CircleAlert size={11} /> 로그인 필요
                          </span>
                        ) : st === "error" ? (
                          <span className="pill pill-warning">확인 실패</span>
                        ) : (
                          <CircleDashed size={13} className="text-[var(--muted)]" />
                        )}
                        <button className="btn btn-xs" onClick={() => void login(p)} title="Aside 브라우저에서 로그인 페이지 열기">
                          <LogIn size={11} /> {st === "signed-in" ? "열기" : "Aside에서 로그인"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </>
          )}

          <p className="rounded-md bg-[var(--surface-2)] px-3 py-2 text-[11.5px] leading-relaxed text-[var(--muted)]">
            로그인 정보(쿠키·비밀번호·2FA)는 Aside 브라우저 안에만 있고 Aside가 관리합니다. 이 앱은 공식 <code>aside</code> CLI로 로그인 여부(페이지 이동 결과)만
            확인하고, 게시도 Aside 에이전트가 수행합니다. 토큰 파일이나 쿠키를 읽지 않습니다.
          </p>
        </div>
      </div>
    </div>
  );
}
