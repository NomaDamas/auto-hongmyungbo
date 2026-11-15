import { PLATFORMS } from "./platforms";
import type { PlatformId, SourceProject } from "./types";

function mediaRule(platform: PlatformId): string {
  const media = PLATFORMS[platform].media;
  const rules = [`images ≤ ${media.images}`, `videos ≤ ${media.videos}`, media.mixed ? "image/video mixing allowed" : "do not mix images and videos"];
  if (media.required) rules.push("media required");
  return rules.join(", ");
}

/**
 * Written into every project folder as AGENTS.md and CLAUDE.md so any harness
 * launched there knows the document and source-project contract.
 */
export function agentsMd(title: string, platforms: PlatformId[], source?: SourceProject): string {
  const platformLines = platforms
    .map((p) => `- \`${p}.md\` — ${PLATFORMS[p].label} (limit ${PLATFORMS[p].limit}; media: ${mediaRule(p)}): ${PLATFORMS[p].guide}`)
    .join("\n");
  const sourceSection = source
    ? `\n## Source project\n- Path: \`${source.path}\`\n${source.links.map((link) => `- Link: ${link}`).join("\n")}\n${source.summary ? `- Summary: ${source.summary}\n` : ""}- Read the code at this path for facts; never invent features.\n`
    : "";
  return `# ${title}

This folder is an Auto-HongMyungbo post project. The user reviews every change you make in a diff UI.

## Files
- \`master.md\` — the source draft. Edit only when asked.
${platformLines}
- \`<platform>.comment.md\` — that platform's comment/reply (first comment on our post, or a reply elsewhere). Short, natural, platform tone.
- \`project.json\` — app metadata. Never edit.

## Rules
- Edit the .md files in place. Do not create other files, do not print the full post back unless asked.
- Keep facts, numbers, names, links, and quotes from master.md unchanged.
- Respect each platform's character and media limits. X counts CJK characters as 2.
- Korean prose: if the \`humanize-korean\` skill (im-not-ai) is installed, use it for 윤문. English prose: use the \`humanizer\` skill if installed.
- Publishing is done only when the user asks, via the Aside browser (\`aside\` CLI / \`aside mcp\`).
${sourceSection}`;
}
