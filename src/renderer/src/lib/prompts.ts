import type { DocId, PlatformId } from "@shared/types";
import { PLATFORMS, docFile, docLabel } from "@shared/platforms";

/** Where a prompt is going: a chat web UI (paste text, reply comes back) or a harness in the project folder (edits files). */
export type Target = "web" | "harness";

export type RewriteAction = "humanize" | "shorter" | "hook" | "casual" | "professional" | "translate-en" | "translate-ko" | "fit";

export const ACTIONS: Record<RewriteAction, { label: string; instruction: string }> = {
  humanize: { label: "윤문", instruction: "" },
  shorter: { label: "짧게", instruction: "Make it about 30% shorter without losing the key point." },
  hook: { label: "훅 강화", instruction: "Rewrite the opening so the first line stops the scroll. Keep the rest." },
  casual: { label: "캐주얼", instruction: "Make the tone more casual and conversational." },
  professional: { label: "전문적", instruction: "Make the tone more professional and credible, still human." },
  "translate-en": { label: "영어로", instruction: "Translate into natural, native-sounding English." },
  "translate-ko": { label: "한국어로", instruction: "Translate into natural Korean (not translationese)." },
  fit: { label: "글자수 맞추기", instruction: "" },
};

const HANGUL = /[\uac00-\ud7a3]/g;

function isKorean(text: string): boolean {
  return (text.match(HANGUL)?.length ?? 0) > text.length * 0.15;
}

/**
 * Condensed rulebooks from epoko77-ai/im-not-ai (Korean) and blader/humanizer (English),
 * for chat UIs that cannot load skills. Harnesses use the installed skills instead.
 */
function humanizeRules(korean: boolean): string {
  if (korean) {
    return [
      "한국어 윤문 규칙 (im-not-ai 기준):",
      "- 사실·주장·수치·고유명사·인용은 그대로 둔다. 변경률은 30% 이내.",
      "- 번역투 제거: '~를 통해', '~에 있어서', '~에 의해', '~되어진다', '가지고 있다'.",
      "- AI 관용구 삭제: '결론적으로', '시사하는 바가 크다', '주목할 만하다', '혁신적인'.",
      "- 기계적 병렬(첫째/둘째/셋째), 과한 불릿·볼드·이모지·대시를 줄이고 문장으로 푼다.",
      "- 문두 접속사(또한/따라서/즉) 연속, 다중 완곡('~할 수 있을 것으로 보인다')을 줄인다.",
      "- 문장 길이와 종결어미에 변화를 준다. 장르와 화자의 말투는 유지한다.",
    ].join("\n");
  }
  return [
    "Humanize rules (blader/humanizer, Wikipedia 'Signs of AI writing'):",
    "- Keep every claim, number, and name. Change only phrasing.",
    "- Kill: 'not X but Y', one-line dramatic closers, deep-sounding sayings, staged run-ups ('Here's the thing').",
    "- No forced triads, no em-dash chains, no decorative bold/emoji headings, no chatbot residue.",
    "- Plain words over AI vocabulary (delve, testament, landscape, pivotal, showcase). Use 'is/has' not 'serves as/boasts'.",
    "- Vary sentence length. End on the last concrete fact.",
  ].join("\n");
}

function platformSpec(p: PlatformId): string {
  const d = PLATFORMS[p];
  return `${d.label} (max ${d.limit} chars${p === "x" ? ", CJK counts as 2" : ""}): ${d.guide}`;
}

/** Section markers survive markdown rendering in every chat UI and are parsed by parseSections. */
export function sectionMarker(p: PlatformId): string {
  return `=== ${p} ===`;
}

export function generateAll(master: string, platforms: PlatformId[], target: Target): string {
  if (target === "harness") {
    return `Read master.md and write ${platforms.map(docFile).join(", ")} following AGENTS.md. Edit the files in place; reply with one line per file when done.`;
  }
  return [
    "Turn my draft into platform-specific posts. Same language as the draft unless told otherwise.",
    "",
    ...platforms.map((p) => `- ${platformSpec(p)}`),
    "",
    "Output ONLY the posts, each under its own marker line exactly like this, nothing before or after:",
    ...platforms.map((p) => `${sectionMarker(p)}\n<${PLATFORMS[p].label} post>`),
    "",
    "Draft:",
    '"""',
    master,
    '"""',
  ].join("\n");
}

export function updateFromMaster(doc: PlatformId, master: string, current: string, target: Target): string {
  if (target === "harness") {
    return `master.md changed. Update ${docFile(doc)} so it reflects the new master.md, keeping my manual edits and its ${PLATFORMS[doc].label} style. Edit in place.`;
  }
  return [
    `My source draft changed. Update my ${PLATFORMS[doc].label} post to reflect it. Keep my wording where the source did not change.`,
    platformSpec(doc),
    "Output ONLY the updated post.",
    "",
    "New source draft:",
    '"""',
    master,
    '"""',
    "",
    `Current ${PLATFORMS[doc].label} post:`,
    '"""',
    current,
    '"""',
  ].join("\n");
}

export interface RewriteRequest {
  doc: DocId;
  action: RewriteAction;
  /** Full document text. */
  text: string;
  /** Selected excerpt; empty = whole document. */
  selection: string;
  custom?: string;
}

export function rewrite(req: RewriteRequest, target: Target): string {
  const { doc, action, text, selection, custom } = req;
  const scope = selection || text;
  const korean = isKorean(scope);
  const platform = doc === "master" ? null : doc;
  let instruction = custom?.trim() || ACTIONS[action].instruction;
  if (action === "fit" && platform) instruction = `Fit within ${PLATFORMS[platform].limit} characters${platform === "x" ? " (CJK counts as 2)" : ""}. Cut, don't cram.`;

  if (target === "harness") {
    const file = docFile(doc);
    const what = selection ? `this passage in ${file}:\n"""\n${selection}\n"""` : `${file}`;
    const how =
      action === "humanize" && !custom
        ? korean
          ? "Use the humanize-korean skill (im-not-ai) if available."
          : "Use the humanizer skill if available."
        : instruction;
    return `Rewrite ${what}\n${how}\nEdit the file in place and change nothing else.`;
  }

  return [
    action === "humanize" && !custom ? humanizeRules(korean) : instruction,
    platform ? `Context: this is a ${platformSpec(platform)}` : `Context: this is my ${docLabel(doc)} draft.`,
    selection
      ? "Rewrite ONLY the excerpt below. Output ONLY the rewritten excerpt, no quotes, no commentary."
      : "Output ONLY the rewritten text, no commentary.",
    "",
    '"""',
    scope,
    '"""',
  ].join("\n");
}

/**
 * Split a chat reply into per-platform sections using `=== platform ===` markers.
 * Returns null when no markers are present (the reply is a single document).
 */
export function parseSections(reply: string): Partial<Record<PlatformId, string>> | null {
  const re = /^\s*[#*>`]*\s*={3,}\s*(linkedin|x|threads|reddit)\s*={3,}\s*[*`]*\s*$/gim;
  const hits = [...reply.matchAll(re)];
  if (hits.length === 0) return null;
  const out: Partial<Record<PlatformId, string>> = {};
  hits.forEach((m, i) => {
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < hits.length ? (hits[i + 1].index ?? reply.length) : reply.length;
    out[m[1].toLowerCase() as PlatformId] = reply.slice(start, end).trim();
  });
  return out;
}
