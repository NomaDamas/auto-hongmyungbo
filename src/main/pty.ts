import type { WebContents } from "electron";
import * as nodePty from "node-pty";
import { userInfo } from "node:os";

const ptys = new Map<string, nodePty.IPty>();

/**
 * Harnesses (claude, codex, omp, aside...) run through the user's login shell so
 * PATH, nvm, and auth from ~/.zshrc behave exactly like a normal terminal.
 */
export function spawnPty(wc: WebContents, id: string, command: string, cwd: string, cols: number, rows: number): void {
  killPty(id);
  const shell = process.env.SHELL || userInfo().shell || "/bin/zsh";
  const args = command.trim() ? ["-l", "-i", "-c", command] : ["-l", "-i"];
  const p = nodePty.spawn(shell, args, {
    name: "xterm-256color",
    cols,
    rows,
    cwd,
    env: { ...process.env, TERM: "xterm-256color", COLORTERM: "truecolor" } as Record<string, string>,
  });
  ptys.set(id, p);
  p.onData((data) => {
    if (!wc.isDestroyed()) wc.send("pty:data", { id, data });
  });
  p.onExit(({ exitCode }) => {
    if (ptys.get(id) === p) ptys.delete(id);
    if (!wc.isDestroyed()) wc.send("pty:exit", { id, code: exitCode });
  });
}

export function writePty(id: string, data: string): void {
  ptys.get(id)?.write(data);
}

export function resizePty(id: string, cols: number, rows: number): void {
  if (cols > 0 && rows > 0) ptys.get(id)?.resize(cols, rows);
}

export function killPty(id: string): void {
  ptys.get(id)?.kill();
  ptys.delete(id);
}

export function killAllPtys(): void {
  for (const id of [...ptys.keys()]) killPty(id);
}
