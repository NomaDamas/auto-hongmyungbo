# Auto-HongMyungbo Skill

## Purpose
Use this skill to run the project end-to-end in a predictable way:
`draft -> generate platform cards -> preview artifacts -> optional publish`.

## Safe Defaults
- Non-destructive by default: publishing is **off** unless `--publish` is explicitly passed.
- Reuse an already-running local server when available.
- Output is always machine-readable JSON with `ok`, `steps`, `artifacts`, and `error`.

## Single Entry Command
Run from repository root:

```bash
./scripts/agent_skill_run.mjs --draft "your raw draft text"
```

Common options:
- `--draft-file <path>`: load draft text from file
- `--provider <openrouter|openai>`: default `openrouter`
- `--model <model_id>`: optional custom model
- `--platforms reddit,linkedin,twitter`: comma-separated list
- `--language <auto|korean|english|japanese>`
- `--publish`: explicitly enable publish step
- `--no-start-server`: fail if local server is not already running

## Expected JSON Output
```json
{
  "ok": true,
  "command": "generate-preview-publish",
  "steps": [{ "name": "generate", "status": "ok" }],
  "artifacts": {
    "draftId": 1,
    "cards": [{ "platform": "reddit", "charCount": 420 }],
    "publish": null
  },
  "error": null
}
```

Failure format stays consistent:
- `ok: false`
- `error.step`
- `error.message`

## Minimal Happy Path
1. Provide a draft (`--draft` or `--draft-file`)
2. Run the single entry command
3. Read `artifacts.cards` for preview/inspection
4. Re-run with `--publish` when ready

## Agent Prompt Template
Use this template with Codex/Ralph Loop:

```text
Use the Auto-HongMyungbo skill.
Run ./scripts/agent_skill_run.mjs with provider=openrouter, platforms=reddit,linkedin.
Input draft: "<paste draft>".
Return only the final JSON output and summarize card char counts.
```
