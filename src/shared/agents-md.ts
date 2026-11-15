import { ALL_PLATFORMS, PLATFORMS } from "./platforms";

/**
 * Written into every project folder as AGENTS.md and CLAUDE.md so any harness
 * (Codex, Claude Code, omp, Aside) launched there knows the file contract.
 * The app watches these files and shows every external write as a reviewable diff.
 */
export function agentsMd(title: string): string {
  const platformLines = ALL_PLATFORMS.map((p) => `- \`${p}.md\` — ${PLATFORMS[p].label} (limit ${PLATFORMS[p].limit}): ${PLATFORMS[p].guide}`).join("\n");
  return `# ${title}

This folder is an Auto-HongMyungbo post project. The user reviews every change you make in a diff UI.

## Files
- \`master.md\` — the source draft. Edit only when asked.
${platformLines}
- \`project.json\` — app metadata. Never edit.

## Rules
- Edit the .md files in place. Do not create other files, do not print the full post back unless asked.
- Keep facts, numbers, names, links, and quotes from master.md unchanged.
- Respect each platform's character limit. X counts CJK characters as 2.
- Korean prose: if the \`humanize-korean\` skill (im-not-ai) is installed, use it for 윤문. English prose: use the \`humanizer\` skill if installed.
- Publishing is done only when the user asks, via the Aside browser (\`aside\` CLI / \`aside mcp\`).
`;
}
