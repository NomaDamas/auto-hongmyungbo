---
name: auto-hongmyungbo
description: Edit an Auto-HongMyungbo post project (master.md + per-platform .md files) so the user can review your changes as diffs in the app.
---

# Auto-HongMyungbo project skill

Use when the current folder contains `project.json` and `master.md` (an Auto-HongMyungbo post project).
The desktop app watches these files and shows every write as an inline diff the user accepts or rejects.

## Files
| File | Meaning | Limit |
|---|---|---|
| `master.md` | Source draft. Edit only when asked. | — |
| `linkedin.md` | LinkedIn post. Strong first two lines, short paragraphs, ≤3 hashtags. | 3000 |
| `x.md` | Single X post. CJK characters count as 2. | 280 weighted |
| `threads.md` | Casual, conversational. | 500 |
| `reddit.md` | First line `# Title` (≤300), then plain value-first body. | 40000 |
| `project.json` | App metadata. **Never edit.** | — |

## Rules
1. Edit files in place. Don't create new files. Don't repeat the full post in chat.
2. Keep facts, numbers, names, links, and quotes from `master.md` unchanged.
3. When asked to edit a selected passage, change only that passage.
4. 윤문 (humanize): use `humanize-korean` (im-not-ai) for Korean and `humanizer` for English, if installed.
5. Publish only when asked, through Aside (`aside "<task>"` or the `aside mcp` tools), and confirm before the final Post click.
