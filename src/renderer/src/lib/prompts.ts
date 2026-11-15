import type { DocId, PlatformId } from "@shared/types";
import { PLATFORMS, docFile, docLabel } from "@shared/platforms";

/** Where a prompt is going: a chat web UI (paste text, reply comes back) or a harness in the project folder (edits files). */
export type Target = "web" | "harness";

export type Preset = "humanize" | "shorter" | "hook" | "casual" | "professional" | "translate-en" | "translate-ko" | "fit";

export const PRESETS: Record<Preset, { label: string; instruction: string }> = {
  humanize: { label: "윤문", instruction: "" },
  shorter: { label: "짧게", instruction: "Make it about 30% shorter without losing the key point." },
  hook: { label: "훅 강화", instruction: "Rewrite the opening so the first line stops the scroll. Keep the rest." },
  casual: { label: "캐주얼", instruction: "Make the tone more casual and conversational." },
  professional: { label: "전문적", instruction: "Make the tone more professional and credible, still human." },
  "translate-en": { label: "영어로", instruction: "Translate into natural, native-sounding English." },
  "translate-ko": { label: "한국어로", instruction: "Translate into natural Korean (not translationese)." },
  fit: { label: "글자수 맞추기", instruction: "Fit within the platform's character limit. Cut, don't cram." },
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

function spec(doc: DocId): string {
  if (doc === "master") return "Source draft (no platform limit)";
  const d = PLATFORMS[doc];
  return `${d.label} (max ${d.limit} chars${doc === "x" ? ", CJK counts as 2" : ""}): ${d.guide}`;
}

/** Section markers survive markdown rendering in every chat UI and are parsed by parseSections. */
function marker(doc: DocId): string {
  return `=== ${doc} ===`;
}

function briefBlock(brief: string): string[] {
  return brief.trim() ? ["Standing brief from the author (always follow):", brief.trim(), ""] : [];
}

function sectionsOutput(docs: DocId[]): string[] {
  return [
    "Output ONLY the results, each under its own marker line exactly like this, nothing before or after:",
    ...docs.map((d) => `${marker(d)}\n<${docLabel(d)}>`),
  ];
}

/**
 * 일괄 전파: derive every platform post from the master draft. Existing posts are updated
 * (keeping the author's edits where the source didn't change); empty ones are written fresh.
 */
export function propagate(master: string, current: Partial<Record<PlatformId, string>>, platforms: PlatformId[], brief: string, target: Target): string {
  if (target === "harness") {
    return [
      `Propagate master.md to ${platforms.map(docFile).join(", ")} following AGENTS.md.`,
      "Empty files: write from scratch. Non-empty files: update to reflect master.md, keep my manual wording where the source didn't change.",
      ...(brief.trim() ? [`Standing brief: ${brief.trim()}`] : []),
      "Edit the files in place; reply with one line per file when done.",
    ].join("\n");
  }
  return [
    ...briefBlock(brief),
    "Turn my source draft into platform posts. Same language as the draft unless told otherwise.",
    "Where a current post exists, update it to reflect the draft and keep my wording where the draft didn't change. Where it's empty, write it fresh.",
    "",
    ...platforms.map((p) => `- ${spec(p)}`),
    "",
    ...sectionsOutput(platforms),
    "",
    "Source draft:",
    '"""',
    master,
    '"""',
    "",
    "Current posts:",
    ...platforms.flatMap((p) => [marker(p), current[p]?.trim() || "(empty)"]),
  ].join("\n");
}

export interface IntentRequest {
  docs: DocId[];
  texts: Partial<Record<DocId, string>>;
  /** Free-form intent from the user. Empty when a preset is used alone. */
  instruction: string;
  preset?: Preset;
  /** Selected excerpt; only honored when exactly one doc is targeted. */
  selection: string;
  brief: string;
}

/** One intent → one or many docs. Multi-doc web prompts come back as marked sections. */
export function intent(req: IntentRequest, target: Target): string {
  const { docs, texts, preset, brief } = req;
  const selection = docs.length === 1 ? req.selection : "";
  const sample = selection || docs.map((d) => texts[d] ?? "").join("\n");
  const korean = isKorean(sample);
  const humanize = preset === "humanize";
  const instruction = [preset && !humanize ? PRESETS[preset].instruction : "", req.instruction.trim()].filter(Boolean).join(" ");

  if (target === "harness") {
    const files = docs.map(docFile).join(", ");
    const what = selection ? `this passage in ${files}:\n"""\n${selection}\n"""` : files;
    const skill = humanize ? (korean ? "Use the humanize-korean skill (im-not-ai) if available." : "Use the humanizer skill if available.") : "";
    return [
      `Rewrite ${what}`,
      ...[skill, instruction].filter(Boolean),
      ...(brief.trim() ? [`Standing brief: ${brief.trim()}`] : []),
      docs.length > 1 ? "Apply it to each file, keeping each platform's rules from AGENTS.md." : "",
      "Edit in place and change nothing else.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  const head = [...briefBlock(brief), ...(humanize ? [humanizeRules(korean)] : []), ...(instruction ? [`Instruction: ${instruction}`] : [])];

  if (docs.length === 1) {
    const doc = docs[0];
    return [
      ...head,
      `Context: ${spec(doc)}`,
      selection ? "Rewrite ONLY the excerpt below. Output ONLY the rewritten excerpt, no quotes, no commentary." : "Output ONLY the rewritten text, no commentary.",
      "",
      '"""',
      selection || texts[doc] || "",
      '"""',
    ].join("\n");
  }

  return [
    ...head,
    "Apply the instruction to every text below. Keep each one's platform style and limit:",
    ...docs.map((d) => `- ${spec(d)}`),
    "",
    ...sectionsOutput(docs),
    "",
    "Texts:",
    ...docs.flatMap((d) => [marker(d), texts[d]?.trim() || "(empty)"]),
  ].join("\n");
}

/**
 * Split a chat reply into per-doc sections using `=== doc ===` markers.
 * Returns null when no markers are present (the reply is a single document).
 */
export function parseSections(reply: string): Partial<Record<DocId, string>> | null {
  const re = /^\s*[#*>`]*\s*={3,}\s*(master|linkedin|x|threads|reddit)\s*={3,}\s*[*`]*\s*$/gim;
  const hits = [...reply.matchAll(re)];
  if (hits.length === 0) return null;
  const out: Partial<Record<DocId, string>> = {};
  hits.forEach((m, i) => {
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < hits.length ? (hits[i + 1].index ?? reply.length) : reply.length;
    out[m[1].toLowerCase() as DocId] = reply.slice(start, end).trim();
  });
  return out;
}
