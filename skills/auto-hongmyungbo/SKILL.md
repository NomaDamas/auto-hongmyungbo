---
name: auto-hongmyungbo
description: Edit an Auto-HongMyungbo post project (master.md + per-platform .md files) so the user can review your changes as diffs in the app.
---

# Auto-HongMyungbo project skill

Use this skill when the current folder contains `project.json` and `master.md` (an Auto-HongMyungbo post).
The desktop app watches these files and shows every write as an inline diff that the user accepts or rejects.

## Files
- `master.md`: the source draft. Edit only when asked.
- `<platform>.md`: one file per enabled platform. `AGENTS.md` lists each platform's file, character limit, writing guide and media rules.
- `<platform>.comment.md`: the comment/reply for that platform (first comment on our own post, or a reply on another post). Keep it short and natural, and respect the platform's comment tone.
  Platforms: linkedin, x, threads, instagram, facebook, bluesky, mastodon, reddit, hackernews, producthunt, devto, naver_cafe, okky, naver_blog, tistory, brunch, velog, medium, substack, hashnode, wordpress.
- Title platforms (every non-SNS platform): the first line is `# Title`.
- `media/`: attached images and videos. Reference them in the text only when asked.
- `project.json`: app metadata. **Never edit it.**

## Source project
If `AGENTS.md` has a "Source project" section, the code it describes is readable at that path (granted through `--add-dir`).
Read the code and README for facts. Never invent features, numbers or links.

## Rules
1. Edit files in place. Don't create new files, and don't repeat the full post in chat.
2. Keep the facts, numbers, names, links and quotes from `master.md` exactly as they are.
3. Respect each platform's character limit. X counts CJK characters as 2.
4. Korean prose: use the `humanize-korean` skill (im-not-ai) if it's installed. English prose: use `humanizer` if it's installed.
5. Publishing and scheduling are done by the app through Aside. Don't publish yourself.
