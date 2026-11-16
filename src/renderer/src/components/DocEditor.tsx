import { useEffect, useMemo, useRef } from "react";
import CodeMirror, { EditorView, type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { acceptChunk, getChunks, rejectChunk, unifiedMergeView } from "@codemirror/merge";
import { keymap } from "@codemirror/view";
import { Prec } from "@codemirror/state";
import type { DocId } from "@shared/types";
import { useStore, type Proposal } from "@/store";

const baseTheme = EditorView.theme({
  "&": { height: "100%", fontSize: "var(--type-body-size)", letterSpacing: "var(--type-body-tracking)", backgroundColor: "transparent" },
  ".cm-scroller": { fontFamily: "var(--font-prose)", lineHeight: "var(--type-body-leading)" },
  ".cm-content": { padding: "12px 18px 120px", caretColor: "var(--fg)" },
  ".cm-gutters": { display: "none" },
  ".cm-activeLine": { backgroundColor: "transparent" },
  "&.cm-focused": { outline: "none" },
  ".cm-placeholder": { color: "var(--muted)", letterSpacing: "var(--type-body-tracking)" },
});

interface Props {
  doc: DocId;
  value: string;
  proposal?: Proposal;
  placeholder: string;
}

/**
 * Plain CodeMirror while editing; switches to a unified merge view when an external
 * proposal (web AI reply, harness file write, snapshot) is pending. Chunks are accepted
 * or rejected inline; once none remain the result is committed.
 */
export function DocEditor({ doc, value, proposal, placeholder }: Props) {
  const ref = useRef<ReactCodeMirrorRef>(null);
  const setDoc = useStore((s) => s.setDoc);
  const resolveProposal = useStore((s) => s.resolveProposal);

  const extensions = useMemo(() => {
    const ext = [markdown(), EditorView.lineWrapping, baseTheme];
    if (!proposal) return ext;
    return [
      ...ext,
      unifiedMergeView({ original: proposal.baseline, mergeControls: true, highlightChanges: true, gutter: false }),
      Prec.highest(
        keymap.of([
          { key: "Mod-Enter", run: (v) => acceptChunk(v) },
          { key: "Mod-Backspace", run: (v) => rejectChunk(v) },
        ]),
      ),
      EditorView.updateListener.of((u) => {
        if (!u.docChanged && !u.transactions.some((t) => t.effects.length)) return;
        // Every chunk accepted/rejected → original equals doc → commit.
        if ((getChunks(u.state)?.chunks.length ?? 0) === 0) void resolveProposal(doc, u.state.doc.toString());
      }),
    ];
    // proposal.id keys the merge baseline; doc is stable per editor.
  }, [proposal?.id, doc, resolveProposal]);

  const editorValue = proposal ? proposal.proposed : value;

  // Track selection so actions ("윤문", "짧게"...) can target only the highlighted passage.
  const onUpdate = useMemo(
    () =>
      EditorView.updateListener.of((u) => {
        if (!u.selectionSet) return;
        const sel = u.state.selection.main;
        const text = sel.empty ? "" : u.state.sliceDoc(sel.from, sel.to);
        if (useStore.getState().selections[doc] !== text) useStore.setState((s) => ({ selections: { ...s.selections, [doc]: text } }));
      }),
    [doc],
  );

  useEffect(() => {
    if (proposal) ref.current?.view?.focus();
  }, [proposal?.id]);

  return (
    <CodeMirror
      ref={ref}
      key={proposal?.id ?? "edit"}
      value={editorValue}
      height="100%"
      className="h-full"
      theme="none"
      basicSetup={{ lineNumbers: false, foldGutter: false, highlightActiveLine: false, highlightActiveLineGutter: false }}
      placeholder={placeholder}
      extensions={[...extensions, onUpdate]}
      onCreateEditor={(view) => views.set(doc, view)}
      onChange={(text) => {
        if (!proposal) setDoc(doc, text);
      }}
      onFocus={() => useStore.setState({ activeDoc: doc })}
    />
  );
}

/** Live editor views, so bulk accept commits the text as the user edited it in the merge view. */
const views = new Map<DocId, EditorView>();

/** Accept (commit current text, including inline edits) or reject (restore baseline) every remaining chunk. */
export function resolveAll(doc: DocId, mode: "accept" | "reject"): void {
  const { proposals, resolveProposal, rejectProposal } = useStore.getState();
  const p = proposals[doc];
  if (!p) return;
  if (mode === "reject") return rejectProposal(doc);
  void resolveProposal(doc, views.get(doc)?.state.doc.toString() ?? p.proposed);
}
