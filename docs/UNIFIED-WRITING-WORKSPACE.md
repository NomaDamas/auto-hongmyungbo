# Unified Writing Workspace

> Status: approved product roadmap. Items described as future behavior are not claimed as shipped until their implementation issue is merged.

## Approved product direction

The product is a writing workspace that connects user-selected providers to a single integrated chat UI and platform-specific editable panes. It does not automatically mix several LLMs in a hidden pipeline. The user chooses which provider should perform each draft, rewrite, thread split, or polishing task.

The approved workflow is:

```text
rough source draft
  -> choose one provider
  -> send the source or selected platform drafts with an instruction
  -> run the provider in the background
  -> show the result in the affected platform pane(s) as a diff
  -> edit, regenerate, accept, or reject
  -> commit the accepted version to Git
  -> publish through Aside
```

Providers may be CLI harnesses or web writing services:

- OMP
- Claude Code
- Codex
- GJC
- OMO
- Grok CLI
- ChatGPT Web
- Claude Web
- Gemini Web
- Other user-registered writing websites

The user can configure a provider's model and effort settings through an intuitive provider settings UI. Provider credentials and MyProxy configuration are local runtime configuration and must never be committed.

## Unified chat UI

The right side of the workspace has one integrated chat UI. Separate ChatGPT, Gemini, Claude, and CLI panes are not the primary interaction model.

The chat UI contains:

- provider selector
- model selector when the provider supports models
- effort/reasoning selector when the provider supports it
- conversation history for the current writing task
- instruction composer
- drag-and-drop targets for one or more platform panes
- quick skill actions such as polishing, humanizing, shortening, translation, and hook rewriting
- background execution status
- result and error states

The user may drag one platform pane, or select multiple panes with Ctrl/Shift and drag them into the chat UI. The instruction and selected texts are sent together. Only the selected panes receive the resulting diff.

## Web response extraction

Web AI response extraction remains DOM-based. The app does not ask an LLM to interpret every response.

The default path is:

```text
provider browser session
  -> site adapter selectors and accessibility-aware DOM lookup
  -> response element innerText/text extraction
  -> normalized provider result
  -> affected platform pane diff
```

The app may use a tested open-source browser-use/Playwright-style helper when a provider is being configured or when a saved adapter no longer matches. A provider setup flow may inspect the site's DOM once, save a versioned adapter, and use the adapter first on later runs. The browser helper is a recovery and configuration layer, not an LLM-based parser for every response.

Aside owns credentials, passwords, cookies, and 2FA. Auto-HongMyungbo must not copy or persist those secrets.

## Platform panes

Platform panes are editable local UI components. They reproduce the essential visual and interaction model of each platform's composing experience without embedding the live platform DOM.

The default layout uses tabs. Users can:

- drag panes to reorder them
- drag a pane to create a split partition
- resize partitions
- combine independent platform editors into tabs
- move an editor between partitions
- keep several panes visible at once

Each writing rectangle is freely partitionable: it can be moved by dragging, resized, and placed into a different partition. The default remains a tabbed layout so the first-run experience is simple.

Platform editors must preserve the platform's relevant composing behavior and visual language:

- LinkedIn: opening hook, paragraphs, hashtags, media attachments, character state
- X: single post and ordered thread posts, per-post media, character state, reply chain
- Threads: single post and ordered thread posts, per-post media, character state, reply chain
- Reddit: title, body, link/media attachments, subreddit context
- Other platforms: the same platform-specific fields, limits, and media rules already defined in the platform registry

The editable pane is not the live website. Publishing opens the real platform through Aside and submits the structured draft through the real composer. The published result must preserve the approved text, order, line breaks, and media associations as far as the platform permits.

## Thread and multimodal model

X and Threads use ordered post collections rather than one flat text file:

```text
thread
  -> post 1: text + media[]
  -> post 2: text + media[]
  -> post 3: text + media[]
```

Every post has its own text, media list, ordering, character state, approval state, and publish state. A thread can be generated from the source or from selected platform drafts, edited post by post, diffed as a unit or per post, approved, and published in order. Aside performs the real composer operations and records the result after each post so partial failures are recoverable.

## Diff and versions

AI output never overwrites the current approved text immediately. It creates a candidate version. The user can edit the candidate, regenerate it with the same or another provider, accept it, reject it, or restore an earlier version.

If a user drags an already-approved SNS pane back into chat and regenerates it, only that pane receives a diff against its current approved version. If multiple panes are selected, each receives its own diff.

The source draft and every platform/thread version are Git-managed. Accepted changes create local commits. Rollback can target the source, one platform, one thread post, or the whole project. External Git pushes are opt-in and MyProxy secrets never enter Git.

## Project context

The user may link a project folder. CLI harnesses can read that folder using their existing add-directory mechanism. Web providers receive only the project context explicitly selected by the user or generated by the app; they do not receive unrestricted local filesystem access. Project-fact verification is not an automatic product gate. The human reviews the content and remains responsible for factual approval.

## Provider settings and private configuration

Provider configuration is local-only. It includes:

- provider type
- display name
- execution mode (CLI, web session, browser helper)
- command or URL
- model
- effort/reasoning setting
- timeout and retry policy
- enabled skills
- browser profile/provider session identifier

MyProxy model selection may be configured at runtime, for example `gpt-6.1-terra-medium`. Authentication material and local provider configuration files must be ignored by Git and must not appear in commits, issues, screenshots, or release artifacts.

## Implementation issue map

The following issues are the implementation contract. Each issue is intentionally scoped so it can be completed and verified independently while contributing to the total product goal.

### Epic UWS-00: Unified writing workspace

**Goal:** Replace the multi-tab AI interaction model with a single provider-driven chat workflow that produces reviewable platform and thread drafts, preserves versions in Git, and publishes approved structured content through Aside.

**Exit criteria:** A user can open a project, write a source draft, select one provider, drag one or more platform panes into the unified chat UI, run an instruction, review pane-specific diffs, edit or regenerate, accept a version, roll it back, and publish it through Aside. The layout remains tab-first but supports movable/resizable partitions.

### UWS-01: Resume the last project safely

- Persist the last opened project slug locally.
- Reopen it after app restart when it still exists.
- Preserve unsaved editor text before quit by flushing pending writes.
- Show a recovery state when the project or file is unavailable.
- Do not delete or truncate any project file during shutdown.
- Verify with restart and forced-close scenarios.

### UWS-02: Provider registry and settings

- Define a provider adapter contract for CLI, web, browser-helper, and custom providers.
- Add provider list, enable/disable, display name, model, effort, timeout, retry, and skill settings.
- Keep provider settings local and redact secrets from logs.
- Add runtime MyProxy configuration without committing values.
- Validate unknown models and unsupported effort settings.
- Add import/export of non-secret provider definitions.

### UWS-03: Unified chat UI

- Replace the primary multi-dock interaction with one chat surface.
- Show selected provider, model, effort, history, instruction composer, and execution state.
- Support provider switching per request.
- Persist task history locally by project.
- Show generated result metadata without exposing credentials.
- Keep advanced provider controls behind an Advanced section.

### UWS-04: DOM extraction adapter layer

- Preserve deterministic DOM response extraction for ChatGPT, Claude, and Gemini.
- Normalize innerText, line breaks, code blocks, links, and media references.
- Version selectors and adapter metadata.
- Detect adapter failure and show a repair/setup action.
- Add a browser-helper recovery path using a maintained open-source browser automation library.
- Do not send every response through an LLM parser.
- Add fixture-based tests for saved DOM samples.

### UWS-05: Provider execution broker

- Run one user-selected provider in the background.
- Route source text, selected pane text, instruction, skill, and allowed project context.
- Stream progress and final result into the unified chat UI.
- Support cancellation, timeout, retry, and partial failure.
- Normalize CLI and web results into the same result contract.
- Prevent concurrent writes to the same candidate version.

### UWS-06: Drag targets and multi-selection

- Add selectable platform panes.
- Support Ctrl/Shift multi-selection.
- Make one or many panes draggable into chat.
- Encode exact selected document/thread-post IDs in the request.
- Return results only to selected panes.
- Preserve selection through provider execution and navigation.

### UWS-07: Platform composer model

- Define a structured composer model independent of live website DOM.
- Implement LinkedIn, X, Threads, and Reddit composer components.
- Render platform-specific limits, fields, previews, line breaks, and media slots.
- Keep the default layout tabbed.
- Support movable panes, resizable partitions, tab grouping, and split views.
- Persist layout per project.

### UWS-08: Thread and multimodal drafts

- Add ordered X and Threads post collections.
- Support per-post text, media, links, character state, and approval state.
- Add AI thread split and manual post insertion/reordering.
- Support per-post and whole-thread diff.
- Preserve media associations through regeneration and approval.
- Add partial publish recovery state.

### UWS-09: Candidate versions and diff workflow

- Keep approved and candidate content separate.
- Show side-by-side or inline diff per affected pane.
- Allow direct edits to candidates.
- Support regenerate, accept, reject, and restore.
- Ensure multi-pane requests produce independent diffs.
- Preserve internal line breaks and platform-specific formatting.

### UWS-10: Git history and rollback

- Initialize or migrate project-local history safely.
- Commit accepted source, platform, thread, and media metadata changes.
- Provide history, diff, restore, and rollback UI.
- Never auto-push to a remote repository.
- Exclude secrets, provider credentials, and transient browser data.
- Verify rollback at source, pane, thread-post, and project scopes.

### UWS-11: Aside and browser publishing bridge

- Define a structured publish request for single posts and threads.
- Use Aside for credentials, real composer interaction, media upload, and ordered posting.
- Preserve approved text, line breaks, order, and media mapping.
- Record post URLs and per-step outcomes.
- Recover from partial thread failures without replaying already-published posts.
- Keep browser-use helpers behind a tested adapter boundary.

### UWS-12: Project context selection

- Keep existing CLI add-directory support.
- Let users explicitly select files/folders for web-provider context.
- Show the exact context attached to a request.
- Enforce size limits and redact ignored/private files.
- Do not add automatic fact-checking or block human approval.

### UWS-13: Design system and interaction polish

- Define reusable pane, tab, split, diff, provider, thread, and media components.
- Reproduce the essential composing visual language of each supported SNS.
- Ensure keyboard navigation, resize handles, and drag affordances.
- Keep advanced settings discoverable but out of the primary writing path.
- Add responsive behavior for narrow windows.

### UWS-14: QA and release hardening

- Add deterministic unit tests for models, routing, parsing, diff, and Git actions.
- Add DOM fixture tests for web adapters.
- Add provider mock tests for cancellation and partial failures.
- Add manual QA scripts for login, source recovery, thread publishing, and rollback.
- Run typecheck, build, package smoke test, and release checklist.
- Require an isolated GPT-6.1 Sol high code review before merge.

## Non-goals

- Do not build an automatic hidden mixture-of-experts pipeline.
- Do not make automatic project fact verification a gate.
- Do not copy Aside passwords, cookies, or 2FA data.
- Do not clone live platform DOM into the editor as the implementation mechanism.
- Do not commit MyProxy credentials or local provider secrets.

