import { useState } from "react";
import { Command } from "cmdk";
import type { DocId } from "@shared/types";
import { docLabel } from "@shared/platforms";
import { useStore } from "@/store";
import { ACTIONS, type RewriteAction } from "@/lib/prompts";
import { runGenerate, runRewrite } from "@/lib/dispatch";

export function CommandPalette() {
  const open = useStore((s) => s.paletteOpen);
  const focusDoc = useStore((s) => s.focusDoc);
  const settings = useStore((s) => s.settings)!;
  const project = useStore((s) => s.project);
  const [query, setQuery] = useState("");
  if (!open) return null;

  const close = () => {
    setQuery("");
    useStore.setState({ paletteOpen: false });
  };
  const run = (fn: () => unknown) => {
    close();
    fn();
  };
  const docs: DocId[] = ["master", ...settings.platforms];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[15vh]" onMouseDown={close}>
      <Command
        className="w-[560px] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && close()}
        loop
      >
        <Command.Input
          autoFocus
          value={query}
          onValueChange={setQuery}
          placeholder={`${docLabel(focusDoc)}에 할 일, 또는 자유 지시문 입력…`}
          className="w-full border-b border-[var(--border)] bg-transparent px-4 py-3 text-[14px] outline-none"
        />
        <Command.List className="max-h-[360px] overflow-y-auto p-1.5">
          <Command.Empty className="px-3 py-2 text-[13px] text-[var(--muted)]">일치하는 명령 없음</Command.Empty>
          {project && query.trim() && (
            <Command.Group heading="자유 지시">
              <Item value={`custom ${query}`} onSelect={() => run(() => runRewrite(focusDoc, "humanize", query))}>
                “{query}” → {docLabel(focusDoc)}
              </Item>
            </Command.Group>
          )}
          {project && (
            <Command.Group heading={`${docLabel(focusDoc)} 다듬기`}>
              {(Object.keys(ACTIONS) as RewriteAction[]).map((a) => (
                <Item key={a} value={`action ${ACTIONS[a].label} ${a}`} onSelect={() => run(() => runRewrite(focusDoc, a))}>
                  {ACTIONS[a].label}
                </Item>
              ))}
            </Command.Group>
          )}
          {project && (
            <Command.Group heading="작업">
              <Item value="generate all 전체 생성" shortcut="⌘↵" onSelect={() => run(runGenerate)}>
                원문 → 모든 플랫폼 생성
              </Item>
              {docs.map((d, i) => (
                <Item key={d} value={`focus ${docLabel(d)} ${d}`} shortcut={`⌘${i + 1}`} onSelect={() => run(() => useStore.setState({ focusDoc: d, soloDoc: d }))}>
                  {docLabel(d)}만 보기
                </Item>
              ))}
              <Item value="all columns 모든 열" shortcut="⌘0" onSelect={() => run(() => useStore.setState({ soloDoc: null }))}>
                모든 열 보기
              </Item>
              <Item value="history 버전 기록" onSelect={() => run(() => useStore.setState({ historyDoc: focusDoc }))}>
                {docLabel(focusDoc)} 버전 기록
              </Item>
              <Item value="reveal finder 폴더" onSelect={() => run(() => window.api.projects.reveal(project.slug))}>
                Finder에서 프로젝트 폴더 열기
              </Item>
            </Command.Group>
          )}
          <Command.Group heading="AI 도크">
            {settings.webTabs.map((t) => (
              <Item key={t.id} value={`web ${t.label}`} onSelect={() => run(() => useStore.setState({ dockTab: `web:${t.id}`, dockOpen: true }))}>
                {t.label} 열기
              </Item>
            ))}
            {project &&
              settings.harnesses.map((h) => (
                <Item key={h.id} value={`harness ${h.label}`} onSelect={() => run(() => useStore.setState({ dockTab: `harness:${h.id}`, dockOpen: true }))}>
                  {h.label} 터미널
                </Item>
              ))}
            <Item value="toggle dock 도크" shortcut="⌘J" onSelect={() => run(() => useStore.setState((s) => ({ dockOpen: !s.dockOpen })))}>
              도크 열기/닫기
            </Item>
          </Command.Group>
          <Command.Group heading="앱">
            {project && (
              <Item value="projects 프로젝트 목록" onSelect={() => run(() => useStore.getState().closeProject())}>
                프로젝트 목록
              </Item>
            )}
            <Item value="settings 설정" shortcut="⌘," onSelect={() => run(() => useStore.setState({ settingsOpen: true }))}>
              설정
            </Item>
            <Item
              value="theme 테마"
              onSelect={() => run(() => useStore.getState().updateSettings({ theme: settings.theme === "dark" ? "light" : "dark" }))}
            >
              테마 전환
            </Item>
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  );
}

function Item({ value, onSelect, shortcut, children }: { value: string; onSelect: () => void; shortcut?: string; children: React.ReactNode }) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="flex cursor-pointer items-center rounded-md px-3 py-2 text-[13px] data-[selected=true]:bg-[var(--surface-3)]"
    >
      {children}
      {shortcut && <kbd className="ml-auto text-[11px] text-[var(--muted)]">{shortcut}</kbd>}
    </Command.Item>
  );
}
