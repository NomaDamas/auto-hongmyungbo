import type { DocId, PlatformId, SourceProject } from "@shared/types";
import { PLATFORMS, commentDoc, docFile, docLabel, docLimit, isDocId, parseDoc } from "@shared/platforms";

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
  const { platform, variant } = parseDoc(doc);
  if (!platform) return "Source draft (no platform limit)";
  const d = PLATFORMS[platform];
  if (variant === "comment") {
    const examples = platform === "linkedin"
      ? " Include the relevant link with useful context when one is available."
      : platform === "x"
        ? " Make it a concise link reply when a link is available."
        : platform === "reddit"
          ? " Add a useful TL;DR or one concrete extra detail, never a promo."
          : "";
    return `${d.label} comment (max ${docLimit(doc)} chars${platform === "x" ? ", CJK counts as 2" : ""}): a short, natural, human first comment that adds value rather than praising or promoting.${examples}`;
  }
  return `${d.label} (max ${d.limit} chars${platform === "x" ? ", CJK counts as 2" : ""}): ${d.guide}`;
}

function sourceBlock(source: SourceProject | undefined, target: Target): string[] {
  if (!source) return [];
  if (target === "harness") {
    return [
      `The source project is at ${source.path} (readable via --add-dir); read it for facts.`,
      `Project: ${source.name}`,
      ...(source.links.length ? [`Links: ${source.links.join(", ")}`] : []),
      ...(source.summary?.trim() ? [`Summary: ${source.summary.trim()}`] : []),
      "Never invent features.",
      "",
    ];
  }
  return [
    `Project: ${source.name}`,
    ...(source.links.length ? [`Links: ${source.links.join(", ")}`] : []),
    ...(source.summary?.trim() ? [`Summary: ${source.summary.trim()}`] : []),
    "Use these source-project facts only; never invent features.",
    "",
  ];
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

/** Derive or update each enabled platform post from the master draft. */
export function propagate(
  master: string,
  current: Partial<Record<PlatformId, string>>,
  platforms: PlatformId[],
  brief: string,
  target: Target,
  source?: SourceProject,
): string {
  if (target === "harness") {
    return [
      ...sourceBlock(source, target),
      `Propagate master.md to ${platforms.map(docFile).join(", ")} following AGENTS.md.`,
      "Empty files: write from scratch. Non-empty files: update to reflect master.md, keep my manual wording where the source didn't change.",
      ...(brief.trim() ? [`Standing brief: ${brief.trim()}`] : []),
      "Edit the files in place; reply with one line per file when done.",
    ].join("\n");
  }
  return [
    ...sourceBlock(source, target),
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

/** Draft one first-comment per platform in a single AI request. */
export function commentDrafts(
  master: string,
  current: Partial<Record<DocId, string>>,
  platforms: PlatformId[],
  brief: string,
  target: Target,
  source?: SourceProject,
): string {
  const docs = platforms.map(commentDoc);
  if (target === "harness") {
    return [
      ...sourceBlock(source, target),
      `Read master.md and write first-comment drafts to ${docs.map(docFile).join(", ")}.`,
      "Write exactly one short, natural, value-adding comment per file. Respect each platform's tone and comment limit:",
      ...docs.map((doc) => `- ${spec(doc)}`),
      "LinkedIn: include the relevant link with context when available. X: concise link reply. Reddit: TL;DR or a concrete extra detail. No generic praise or marketing.",
      "Edit only those comment files; do not publish anything. Reply with one line per file when done.",
      ...(brief.trim() ? [`Standing brief: ${brief.trim()}`] : []),
    ].join("\n");
  }
  return [
    ...sourceBlock(source, target),
    ...briefBlock(brief),
    "Write a short, natural first comment for my own post on each platform below. Each comment should add context or useful detail, not generic praise or marketing.",
    "Use the source draft's language. LinkedIn: link + context when available. X: a concise link reply. Reddit: TL;DR or one concrete extra detail.",
    "",
    ...docs.map((doc) => `- ${spec(doc)}`),
    "",
    ...sectionsOutput(docs),
    "",
    "Source draft:",
    '"""',
    master,
    '"""',
    "",
    "Current comment drafts (empty means write fresh):",
    ...docs.flatMap((doc) => [marker(doc), current[doc]?.trim() || "(empty)"]),
  ].join("\n");
}

/** Draft a reply to a pasted comment for one platform. */
export function commentReply(
  platform: PlatformId,
  pasted: string,
  postText: string,
  brief: string,
  target: Target,
  source?: SourceProject,
): string {
  const doc = commentDoc(platform);
  if (target === "harness") {
    return [
      ...sourceBlock(source, target),
      `Write a reply to the pasted comment below and save it to ${docFile(doc)}.`,
      `Match ${PLATFORMS[platform].label}'s tone, stay within ${docLimit(doc)} characters, answer directly, and do not publish it.`,
      ...(brief.trim() ? [`Standing brief: ${brief.trim()}`] : []),
      `My post for context:\n"""\n${postText || "(empty)"}\n"""`,
      `Comment to answer:\n"""\n${pasted.trim()}\n"""`,
    ].join("\n");
  }
  return [
    ...sourceBlock(source, target),
    ...briefBlock(brief),
    `Context: ${spec(doc)}`,
    "Write ONLY a direct, natural reply to the pasted comment. No quotes or commentary.",
    "",
    "My post for context:",
    '"""',
    postText || "(empty)",
    '"""',
    "Comment to answer:",
    '"""',
    pasted.trim(),
    '"""',
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
  source?: SourceProject;
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
    const empty = !selection && docs.every((doc) => !(texts[doc] ?? "").trim());
    return [
      ...sourceBlock(req.source, target),
      `${empty ? "Write" : "Rewrite"} ${what}`,
      ...[skill, instruction].filter(Boolean),
      ...(brief.trim() ? [`Standing brief: ${brief.trim()}`] : []),
      docs.length > 1 ? "Apply it to each file, keeping each platform's rules from AGENTS.md." : "",
      "Edit in place and change nothing else.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  const head = [
    ...sourceBlock(req.source, target),
    ...briefBlock(brief),
    ...(humanize ? [humanizeRules(korean)] : []),
    ...(instruction ? [`Instruction: ${instruction}`] : []),
  ];

  if (docs.length === 1) {
    const doc = docs[0];
    const empty = !selection && !(texts[doc] ?? "").trim();
    return [
      ...head,
      `Context: ${spec(doc)}`,
      selection
        ? "Rewrite ONLY the excerpt below. Output ONLY the rewritten excerpt, no quotes, no commentary."
        : empty
          ? "Follow the instruction and output ONLY the requested new text, no quotes or commentary."
          : "Output ONLY the rewritten text, no commentary.",
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

/** Split a chat reply into per-doc sections using `=== doc ===` markers. */
export function parseSections(reply: string): Partial<Record<DocId, string>> | null {
  const re = /^\s*[#*>`]*\s*={3,}\s*([a-z_]+(?:\.comment)?)\s*={3,}\s*[*`]*\s*$/gim;
  const hits = [...reply.matchAll(re)].filter((match) => isDocId(match[1].toLowerCase()));
  if (hits.length === 0) return null;
  const out: Partial<Record<DocId, string>> = {};
  hits.forEach((m, i) => {
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < hits.length ? (hits[i + 1].index ?? reply.length) : reply.length;
    out[m[1].toLowerCase() as DocId] = reply.slice(start, end).trim();
  });
  return out;
}
