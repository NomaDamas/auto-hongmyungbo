/**
 * Sending prompts into harness TUIs (Claude Code, Codex, omp). Bracketed paste keeps
 * multi-line prompts as one message instead of submitting at the first newline.
 */
export function sendToTerminal(ptyId: string, text: string, submit: boolean): void {
  window.api.pty.write(ptyId, `\x1b[200~${text}\x1b[201~`);
  if (submit) setTimeout(() => window.api.pty.write(ptyId, "\r"), 120);
}

/** POSIX single-quote escaping for building Aside CLI commands. */
export function shellQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}
