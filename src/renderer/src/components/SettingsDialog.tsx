import { useEffect, useState } from "react";
import { FolderOpen, Plus, Trash2, X as XIcon } from "lucide-react";
import type { HarnessConfig, Settings, WebTabConfig } from "@shared/types";
import { ALL_PLATFORMS, PLATFORMS } from "@shared/platforms";
import { useStore } from "@/store";

export function SettingsDialog() {
  const open = useStore((s) => s.settingsOpen);
  const settings = useStore((s) => s.settings);
  const [draft, setDraft] = useState<Settings | null>(settings);

  useEffect(() => {
    if (open) setDraft(settings);
  }, [open, settings]);

  if (!open || !draft) return null;
  const close = () => useStore.setState({ settingsOpen: false });
  const save = async () => {
    await useStore.getState().updateSettings({
      webTabs: draft.webTabs.filter((t) => t.label && t.url),
      harnesses: draft.harnesses.filter((h) => h.label && h.command),
      platforms: draft.platforms,
      dockGroups: draft.dockGroups,
      theme: draft.theme,
    });
    close();
  };

  return (
    <div className="scrim items-center justify-center" onMouseDown={close}>
      <div className="glass flex max-h-[85vh] w-[640px] flex-col" onMouseDown={(e) => e.stopPropagation()}>
        <header className="flex h-12 items-center border-b border-[var(--border)] px-5">
          <span className="font-semibold">설정</span>
          <button className="icon-btn ml-auto" onClick={close}>
            <XIcon size={15} />
          </button>
        </header>
        <div className="flex-1 space-y-6 overflow-y-auto p-5 text-[13px]">
          <Section title="작업 폴더" hint="프로젝트마다 하위 폴더에 master.md, linkedin.md… 가 저장됩니다. 하네스는 이 폴더에서 실행됩니다.">
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-md bg-[var(--surface-2)] px-2 py-1.5">{draft.workspaceRoot}</code>
              <button className="btn btn-sm" onClick={() => void window.api.settings.pickWorkspace().then((s) => s && useStore.getState().updateSettings({ workspaceRoot: s.workspaceRoot }))}>
                <FolderOpen size={13} /> 변경
              </button>
            </div>
          </Section>

          <Section title="플랫폼">
            <div className="space-y-3">
              {([
                ["sns", "SNS"],
                ["community", "커뮤니티"],
                ["blog", "블로그"],
              ] as const).map(([tab, label]) => (
                <div key={tab}>
                  <h4 className="mb-1.5 text-[11px] font-medium text-[var(--muted)]">{label}</h4>
                  <div className="flex flex-wrap gap-2">
                    {ALL_PLATFORMS.filter((p) => PLATFORMS[p].tab === tab).map((p) => (
                      <label key={p} className="flex items-center gap-1.5 rounded-md border border-[var(--border)] px-2.5 py-1.5">
                        <input
                          type="checkbox"
                          checked={draft.platforms.includes(p)}
                          onChange={(e) =>
                            setDraft({ ...draft, platforms: e.target.checked ? ALL_PLATFORMS.filter((x) => x === p || draft.platforms.includes(x)) : draft.platforms.filter((x) => x !== p) })
                          }
                        />
                        {PLATFORMS[p].label}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="AI 웹 탭" hint="로그인은 앱 안에 유지됩니다 (모든 탭이 한 세션 공유).">
            <ListEditor<WebTabConfig>
              items={draft.webTabs}
              onChange={(webTabs) => setDraft({ ...draft, webTabs })}
              fields={[
                { key: "label", placeholder: "이름" },
                { key: "url", placeholder: "https://…" },
              ]}
              blank={() => ({ id: crypto.randomUUID().slice(0, 8), label: "", url: "" })}
            />
          </Section>

          <Section title="하네스" hint="로그인 셸에서 프로젝트 폴더를 cwd로 실행합니다. 예: claude, codex, omp, aside">
            <ListEditor<HarnessConfig>
              items={draft.harnesses}
              onChange={(harnesses) => setDraft({ ...draft, harnesses })}
              fields={[
                { key: "label", placeholder: "이름" },
                { key: "command", placeholder: "명령어" },
                { key: "addDirFlag", placeholder: "추가 디렉터리 플래그 (--add-dir)" },
              ]}
              blank={() => ({ id: crypto.randomUUID().slice(0, 8), label: "", command: "", addDirFlag: "--add-dir" })}
            />
          </Section>

          <Section title="AI 독 탭 그룹" hint="Web과 CLI 기본 그룹으로 되돌리고 현재 탭을 다시 배치합니다.">
            <button
              className="btn btn-sm"
              onClick={() => setDraft({
                ...draft,
                dockGroups: [
                  { id: "web", title: "Web", color: "blue", collapsed: false, tabIds: draft.webTabs.map((tab) => `web:${tab.id}`) },
                  { id: "cli", title: "CLI", color: "green", collapsed: false, tabIds: draft.harnesses.map((harness) => `harness:${harness.id}`) },
                ],
              })}
            >
              탭 그룹 초기화
            </button>
          </Section>

          <Section title="테마">
            <select className="input w-40" value={draft.theme} onChange={(e) => setDraft({ ...draft, theme: e.target.value as Settings["theme"] })}>
              <option value="dark">다크</option>
              <option value="light">라이트</option>
            </select>
          </Section>
        </div>
        <footer className="flex justify-end gap-2 border-t border-[var(--border)] px-5 py-3">
          <button className="btn btn-sm" onClick={close}>
            취소
          </button>
          <button className="btn btn-sm btn-primary" onClick={() => void save()}>
            저장
          </button>
        </footer>
      </div>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1 font-semibold">{title}</h3>
      {hint && <p className="mb-2 text-[12px] text-[var(--muted)]">{hint}</p>}
      {children}
    </section>
  );
}

function ListEditor<T extends { id: string }>(props: {
  items: T[];
  onChange: (items: T[]) => void;
  fields: { key: keyof T & string; placeholder: string }[];
  blank: () => T;
}) {
  const { items, onChange, fields, blank } = props;
  return (
    <div className="space-y-1.5">
      {items.map((item, i) => (
        <div key={item.id} className="flex gap-1.5">
          {fields.map((f, fi) => (
            <input
              key={f.key}
              className={fi === 0 ? "input w-32" : "input flex-1"}
              placeholder={f.placeholder}
              value={String(item[f.key] ?? "")}
              onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, [f.key]: e.target.value } : x)))}
            />
          ))}
          <button className="icon-btn" onClick={() => onChange(items.filter((_, j) => j !== i))}>
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      <button className="btn btn-xs btn-ghost" onClick={() => onChange([...items, blank()])}>
        <Plus size={12} /> 추가
      </button>
    </div>
  );
}
