import { useEffect, useRef, useState } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import { RotateCw } from "lucide-react";

interface Props {
  ptyId: string;
  command: string;
  cwd: string;
  visible: boolean;
  onExit?: (code: number) => void;
}

/** xterm.js bound to a node-pty session in the main process. Restartable after exit. */
export function Terminal({ ptyId, command, cwd, visible, onExit }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const fit = useRef<FitAddon | null>(null);
  const [exited, setExited] = useState<number | null>(null);
  const [run, setRun] = useState(0);

  useEffect(() => {
    if (!host.current) return;
    const css = getComputedStyle(document.documentElement);
    const term = new XTerm({
      fontFamily: '"JetBrains Mono", "SF Mono", Menlo, monospace',
      fontSize: 12.5,
      lineHeight: 1.2,
      cursorBlink: true,
      allowProposedApi: true,
      macOptionIsMeta: true,
      theme: { background: css.getPropertyValue("--term-bg").trim() || "#0b0b0f", foreground: css.getPropertyValue("--fg").trim() },
    });
    const f = new FitAddon();
    fit.current = f;
    term.loadAddon(f);
    term.loadAddon(new WebLinksAddon((_e, url) => window.api.openExternal(url)));
    term.open(host.current);
    f.fit();
    setExited(null);

    const offData = window.api.pty.onData(({ id, data }) => id === ptyId && term.write(data));
    const offExit = window.api.pty.onExit(({ id, code }) => {
      if (id !== ptyId) return;
      setExited(code);
      onExit?.(code);
    });
    const sub = term.onData((d) => window.api.pty.write(ptyId, d));
    void window.api.pty.spawn(ptyId, command, cwd, term.cols, term.rows);

    const ro = new ResizeObserver(() => {
      if (!host.current?.offsetParent) return;
      f.fit();
      window.api.pty.resize(ptyId, term.cols, term.rows);
    });
    ro.observe(host.current);

    return () => {
      ro.disconnect();
      sub.dispose();
      offData();
      offExit();
      window.api.pty.kill(ptyId);
      term.dispose();
    };
    // onExit is a notification only; restarting on its identity change would kill the session.
  }, [ptyId, command, cwd, run]);

  useEffect(() => {
    if (visible) requestAnimationFrame(() => fit.current?.fit());
  }, [visible]);

  return (
    <div className="relative h-full w-full bg-[var(--term-bg)] p-2">
      <div ref={host} className="h-full w-full" />
      {exited !== null && (
        <button
          className="btn btn-xs absolute right-3 top-3 shadow-lg"
          onClick={() => setRun((n) => n + 1)}
          title="다시 실행"
        >
          <RotateCw size={12} /> 종료됨 ({exited}) · 다시 실행
        </button>
      )}
    </div>
  );
}
