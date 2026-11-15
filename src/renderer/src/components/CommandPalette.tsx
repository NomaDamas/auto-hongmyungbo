import { useState } from "react";
import { Command } from "cmdk";
import { TABS, docLabel, parseDoc } from "@shared/platforms";
import { useStore } from "@/store";
import { PRESETS, type Preset } from "@/lib/prompts";
import { runIntent, runPropagate } from "@/lib/dispatch";
import { focusEditorTab } from "./EditorArea";

export function CommandPalette() {
  const open = useStore((s) => s.paletteOpen);
  const activeDoc = useStore((s) => s.activeDoc);
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
    void fn();
  };
  // window.prompt is unsupported in Electron; open the sidebar's inline form instead.
  const newPost = () => useStore.setState({ sidebarOpen: true, sidebarInput: { kind: "post", path: "" } });
  const newFolder = () => useStore.setState({ sidebarOpen: true, sidebarInput: { kind: "folder", path: "" } });

  return (
    <div className="scrim items-start justify-center pt-[15vh]" onMouseDown={close}>
      <Command
        className="glass w-[560px] overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && close()}
        loop
      >
        <Command.Input
          autoFocus
          value={query}
          onValueChange={setQuery}
          placeholder={`${docLabel(activeDoc)}에 할 일, 또는 자유 지시문 입력…`}
          className="w-full border-b border-[var(--border)] bg-transparent px-4 py-3 text-[14px] outline-none"
        />
        <Command.List className="max-h-[380px] overflow-y-auto p-1.5">
          <Command.Empty className="px-3 py-2 text-[13px] text-[var(--muted)]">일치하는 명령 없음</Command.Empty>
          {project && query.trim() && (
            <Command.Group heading="의도 전달">
              <Item value={`custom ${query}`} onSelect={() => run(() => runIntent(query, undefined, [activeDoc]))}>
                “{query}” → {docLabel(activeDoc)}
              </Item>
              <Item value={`custom all ${query}`} onSelect={() => run(() => runIntent(query, undefined, useStore.getState().enabledPlatforms()))}>
                “{query}” → 모든 플랫폼
              </Item>
            </Command.Group>
          )}
          {project && (
            <Command.Group heading={`${docLabel(activeDoc)} 다듬기`}>
              {(Object.keys(PRESETS) as Preset[]).map((preset) => (
                <Item key={preset} value={`action ${PRESETS[preset].label} ${preset}`} onSelect={() => run(() => runIntent("", preset, [activeDoc]))}>
                  {PRESETS[preset].label}
                </Item>
              ))}
            </Command.Group>
          )}
          {project && (
            <Command.Group heading="작업">
              <Item value="propagate 원문 전파 전체 생성" shortcut="⌘↵" onSelect={() => run(() => runPropagate())}>
                원문 → 모든 플랫폼 전파
              </Item>
              {activeDoc !== "master" && (
                <Item value="preview 미리보기" shortcut="⌘P" onSelect={() => run(() => {
                const platform = parseDoc(activeDoc).platform;
                if (platform) useStore.setState({ previewDoc: platform });
              })}>
                  {docLabel(activeDoc)} 미리보기
                </Item>
              )}
              <Item value="history 버전 기록" onSelect={() => run(() => useStore.setState({ historyDoc: activeDoc }))}>
                {docLabel(activeDoc)} 버전 기록
              </Item>
              <Item value="reveal finder 폴더" onSelect={() => run(() => window.api.projects.reveal(project.slug))}>
                Finder에서 프로젝트 폴더 열기
              </Item>
              <Item value="aside 연결 로그인" onSelect={() => run(() => useStore.setState({ asideOpen: true }))}>
                Aside 연결 · 로그인 관리
              </Item>
            </Command.Group>
          )}
          <Command.Group heading="보기 모드">
            <Item value="mode post 글 모드" shortcut="⌘⇧1" onSelect={() => run(() => useStore.getState().setMode("post"))}>
              글 모드
            </Item>
            <Item value="mode comment 댓글 모드" shortcut="⌘⇧2" onSelect={() => run(() => useStore.getState().setMode("comment"))}>
              댓글 모드
            </Item>
            <Item value="mode insights 인사이트 모드" shortcut="⌘⇧3" onSelect={() => run(() => useStore.getState().setMode("insights"))}>
              인사이트 모드
            </Item>
          </Command.Group>
          <Command.Group heading="에디터 패널">
            {TABS.map((tab, index) => (
              <Item key={tab.id} value={`focus panel ${tab.label} ${tab.id}`} shortcut={`⌘${index + 1}`} onSelect={() => run(() => focusEditorTab(tab.id))}>
                {tab.label} 패널로 이동
              </Item>
            ))}
          </Command.Group>
          <Command.Group heading="AI 도크">
            {settings.webTabs.map((tab) => (
              <Item key={tab.id} value={`web ${tab.label}`} onSelect={() => run(() => useStore.setState({ dockTab: `web:${tab.id}`, dockOpen: true }))}>
                {tab.label} 열기
              </Item>
            ))}
            {project && settings.harnesses.map((harness) => (
              <Item key={harness.id} value={`harness ${harness.label}`} onSelect={() => run(() => useStore.setState({ dockTab: `harness:${harness.id}`, dockOpen: true }))}>
                {harness.label} 터미널
              </Item>
            ))}
            <Item value="toggle dock 도크" shortcut="⌘J" onSelect={() => run(() => useStore.setState((s) => ({ dockOpen: !s.dockOpen })))}>
              도크 열기/닫기
            </Item>
          </Command.Group>
          <Command.Group heading="앱">
            <Item value="new post 새 글" onSelect={() => run(newPost)}>새 글</Item>
            <Item value="new folder directory 새 디렉터리" onSelect={() => run(newFolder)}>새 디렉터리</Item>
            <Item value="setup onboarding 설정 마법사" onSelect={() => run(() => useStore.setState({ setupOpen: true }))}>설정 마법사</Item>
            {!project && (
              <Item value="aside connect Aside 연결" onSelect={() => run(() => useStore.setState({ asideOpen: true }))}>Aside 연결</Item>
            )}
            <Item value="settings 설정" shortcut="⌘," onSelect={() => run(() => useStore.setState({ settingsOpen: true }))}>설정</Item>
            <Item value="theme 테마" onSelect={() => run(() => useStore.getState().updateSettings({ theme: settings.theme === "dark" ? "light" : "dark" }))}>
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
