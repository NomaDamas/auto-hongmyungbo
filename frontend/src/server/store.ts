import fs from "node:fs";
import path from "node:path";

export type StoredCard = {
  id: number;
  draftId: number;
  platform: string;
  title: string;
  body: string;
  suggestions: string[];
  status: "draft" | "accepted" | "rejected";
  createdAt: string;
  updatedAt: string;
};

type StoredJob = {
  id: number;
  type: string;
  status: "queued" | "running" | "done" | "failed" | "scheduled";
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

type PublishLog = {
  id: number;
  draftId?: number;
  cardId?: number;
  platform: string;
  title?: string;
  body?: string;
  postId?: string;
  postUrl?: string;
  status: string;
  errorText?: string;
  createdAt: string;
};

type LocalState = {
  counters: Record<string, number>;
  drafts: Array<{ id: number; rawText: string; createdAt: string }>;
  cards: StoredCard[];
  jobs: StoredJob[];
  publishLogs: PublishLog[];
  oauthTokens: Record<string, { accessToken: string; updatedAt: string }>;
};

const STORE_PATH = process.env.STORE_PATH || path.join(process.cwd(), "local_store.json");

const initialState: LocalState = {
  counters: {},
  drafts: [],
  cards: [],
  jobs: [],
  publishLogs: [],
  oauthTokens: {},
};

let cache: LocalState | null = null;

function nowIso(): string {
  return new Date().toISOString();
}

function nextId(state: LocalState, key: string): number {
  const next = (state.counters[key] || 0) + 1;
  state.counters[key] = next;
  return next;
}

function ensureLoaded(): LocalState {
  if (cache) return cache;
  try {
    if (!fs.existsSync(STORE_PATH)) {
      cache = structuredClone(initialState);
      save();
      return cache;
    }
    const raw = fs.readFileSync(STORE_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<LocalState>;
    cache = {
      ...structuredClone(initialState),
      ...parsed,
      counters: { ...(parsed.counters || {}) },
      drafts: [...(parsed.drafts || [])],
      cards: [...(parsed.cards || [])],
      jobs: [...(parsed.jobs || [])],
      publishLogs: [...(parsed.publishLogs || [])],
      oauthTokens: { ...(parsed.oauthTokens || {}) },
    };
  } catch {
    cache = structuredClone(initialState);
  }
  return cache;
}

function save(): void {
  const state = ensureLoaded();
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(state, null, 2), "utf-8");
}

export function createDraft(rawText: string): number {
  const state = ensureLoaded();
  const id = nextId(state, "drafts");
  state.drafts.push({ id, rawText, createdAt: nowIso() });
  save();
  return id;
}

export function createCard(input: {
  draftId: number;
  platform: string;
  title: string;
  body: string;
  suggestions: string[];
  status?: "draft" | "accepted" | "rejected";
}): number {
  const state = ensureLoaded();
  const id = nextId(state, "cards");
  const now = nowIso();
  state.cards.push({
    id,
    draftId: input.draftId,
    platform: input.platform,
    title: input.title,
    body: input.body,
    suggestions: input.suggestions,
    status: input.status || "draft",
    createdAt: now,
    updatedAt: now,
  });
  save();
  return id;
}

export function getCard(cardId: number): StoredCard | null {
  const state = ensureLoaded();
  return state.cards.find((c) => c.id === cardId) || null;
}

export function listCardsForDraft(draftId: number): StoredCard[] {
  const state = ensureLoaded();
  return state.cards.filter((c) => c.draftId === draftId).sort((a, b) => a.id - b.id);
}

export function updateCardStatus(cardId: number, status: "draft" | "accepted" | "rejected"): StoredCard | null {
  const state = ensureLoaded();
  const card = state.cards.find((c) => c.id === cardId);
  if (!card) return null;
  card.status = status;
  card.updatedAt = nowIso();
  save();
  return card;
}

export function updateCardContent(
  cardId: number,
  payload: { title: string; body: string; suggestions: string[]; status?: "draft" | "accepted" | "rejected" },
): StoredCard | null {
  const state = ensureLoaded();
  const card = state.cards.find((c) => c.id === cardId);
  if (!card) return null;
  card.title = payload.title;
  card.body = payload.body;
  card.suggestions = payload.suggestions;
  if (payload.status) card.status = payload.status;
  card.updatedAt = nowIso();
  save();
  return card;
}

export function createJob(type: string, payload: Record<string, unknown>, status: StoredJob["status"] = "queued"): StoredJob {
  const state = ensureLoaded();
  const now = nowIso();
  const job: StoredJob = {
    id: nextId(state, "jobs"),
    type,
    status,
    payload,
    result: null,
    error: null,
    createdAt: now,
    updatedAt: now,
  };
  state.jobs.push(job);
  save();
  return job;
}

export function updateJob(jobId: number, patch: Partial<StoredJob>): StoredJob | null {
  const state = ensureLoaded();
  const job = state.jobs.find((j) => j.id === jobId);
  if (!job) return null;
  Object.assign(job, patch, { updatedAt: nowIso() });
  save();
  return job;
}

export function getJob(jobId: number): StoredJob | null {
  const state = ensureLoaded();
  return state.jobs.find((j) => j.id === jobId) || null;
}

export function addPublishLog(row: Omit<PublishLog, "id" | "createdAt">): PublishLog {
  const state = ensureLoaded();
  const created: PublishLog = {
    id: nextId(state, "publishLogs"),
    createdAt: nowIso(),
    ...row,
  };
  state.publishLogs.push(created);
  save();
  return created;
}

export function listPublishLogs(limit = 100): PublishLog[] {
  const state = ensureLoaded();
  return [...state.publishLogs].sort((a, b) => b.id - a.id).slice(0, limit);
}

export function listThreadsByPlatform(limitPerPlatform = 20): Record<string, PublishLog[]> {
  const grouped: Record<string, PublishLog[]> = {};
  for (const log of listPublishLogs(1000)) {
    const p = log.platform;
    grouped[p] ||= [];
    if (grouped[p].length < limitPerPlatform) grouped[p].push(log);
  }
  return grouped;
}

export function upsertOAuthToken(platform: string, accessToken: string): void {
  const state = ensureLoaded();
  state.oauthTokens[platform] = { accessToken, updatedAt: nowIso() };
  save();
}

export function getOAuthToken(platform: string): string | null {
  const state = ensureLoaded();
  return state.oauthTokens[platform]?.accessToken || null;
}
