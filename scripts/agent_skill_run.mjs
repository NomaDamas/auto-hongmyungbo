#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const FRONTEND_DIR = path.join(ROOT_DIR, "frontend");

function parseArgs(argv) {
  const out = {
    draft: "",
    draftFile: "",
    baseUrl: "http://127.0.0.1:3000",
    provider: "openrouter",
    model: "",
    platforms: ["reddit", "linkedin"],
    language: "auto",
    publish: false,
    startServer: true,
    timeoutMs: 60000,
    openaiKey: "",
    openrouterKey: "",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--draft") out.draft = argv[++i] || "";
    else if (a === "--draft-file") out.draftFile = argv[++i] || "";
    else if (a === "--base-url") out.baseUrl = argv[++i] || out.baseUrl;
    else if (a === "--provider") out.provider = (argv[++i] || out.provider).toLowerCase();
    else if (a === "--model") out.model = argv[++i] || "";
    else if (a === "--platforms") {
      const raw = argv[++i] || "";
      out.platforms = raw
        .split(",")
        .map((x) => x.trim().toLowerCase())
        .filter(Boolean);
    } else if (a === "--language") out.language = argv[++i] || "auto";
    else if (a === "--publish") out.publish = true;
    else if (a === "--no-start-server") out.startServer = false;
    else if (a === "--timeout-ms") out.timeoutMs = Number(argv[++i] || out.timeoutMs);
    else if (a === "--openai-key") out.openaiKey = argv[++i] || "";
    else if (a === "--openrouter-key") out.openrouterKey = argv[++i] || "";
  }

  return out;
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  const lines = fs.readFileSync(filePath, "utf-8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  return { ok: res.ok, status: res.status, text, data };
}

async function waitForServer(baseUrl, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${baseUrl}/api/provider`);
      if (res.ok) return true;
    } catch {}
    await sleep(1000);
  }
  return false;
}

function outputAndExit(payload, code) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  process.exit(code);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const steps = [];
  const artifacts = {
    server: { url: args.baseUrl, startedByScript: false },
    draftId: null,
    cards: [],
    publish: null,
  };

  let draftText = args.draft.trim();
  if (!draftText && args.draftFile) {
    const draftPath = path.isAbsolute(args.draftFile) ? args.draftFile : path.join(ROOT_DIR, args.draftFile);
    draftText = fs.readFileSync(draftPath, "utf-8").trim();
  }
  if (!draftText) {
    outputAndExit(
      {
        ok: false,
        command: "generate-preview-publish",
        steps,
        artifacts,
        error: { step: "input", message: "draft is required. Use --draft or --draft-file." },
      },
      1,
    );
  }

  const envFromLocal = parseEnvFile(path.join(FRONTEND_DIR, ".env.local"));
  const envFromDotEnv = parseEnvFile(path.join(FRONTEND_DIR, ".env"));
  const openaiKey =
    args.openaiKey ||
    process.env.OPENAI_API_KEY ||
    envFromLocal.OPENAI_API_KEY ||
    envFromDotEnv.OPENAI_API_KEY ||
    "";
  const openrouterKey =
    args.openrouterKey ||
    process.env.OPENROUTER_API_KEY ||
    envFromLocal.OPENROUTER_API_KEY ||
    envFromDotEnv.OPENROUTER_API_KEY ||
    "";

  const headers = { "content-type": "application/json" };
  if (openaiKey) headers["x-openai-api-key"] = openaiKey;
  if (openrouterKey) headers["x-openrouter-api-key"] = openrouterKey;

  let child = null;
  try {
    let reachable = await waitForServer(args.baseUrl, 1500);
    if (!reachable) {
      if (!args.startServer) {
        outputAndExit(
          {
            ok: false,
            command: "generate-preview-publish",
            steps,
            artifacts,
            error: { step: "server", message: `server is not reachable at ${args.baseUrl}` },
          },
          1,
        );
      }
      child = spawn("npm", ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", "3000"], {
        cwd: FRONTEND_DIR,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let exited = false;
      let exitCode = null;
      let lastServerLog = "";
      const appendLog = (chunk) => {
        const text = String(chunk || "");
        lastServerLog = `${lastServerLog}${text}`;
        if (lastServerLog.length > 4000) {
          lastServerLog = lastServerLog.slice(-4000);
        }
      };
      child.stdout?.on("data", appendLog);
      child.stderr?.on("data", appendLog);
      child.on("exit", (code) => {
        exited = true;
        exitCode = code;
      });
      artifacts.server.startedByScript = true;
      const start = Date.now();
      reachable = false;
      while (Date.now() - start < args.timeoutMs) {
        if (exited) {
          throw new Error(
            `server process exited (${exitCode ?? "unknown"}). ` +
              `Last logs: ${lastServerLog.trim().slice(-500) || "n/a"}`,
          );
        }
        try {
          const res = await fetch(`${args.baseUrl}/api/provider`);
          if (res.ok) {
            reachable = true;
            break;
          }
        } catch {}
        await sleep(1000);
      }
      if (!reachable) {
        throw new Error("server start timeout");
      }
      steps.push({ name: "server", status: "ok", message: "started local Next.js server" });
    } else {
      steps.push({ name: "server", status: "ok", message: "reused running server" });
    }

    const generatePayload = {
      draft: draftText,
      provider: args.provider,
      model: args.model || undefined,
      platforms: args.platforms,
      language: args.language,
    };
    const generated = await fetchJson(`${args.baseUrl}/api/generate`, {
      method: "POST",
      headers,
      body: JSON.stringify(generatePayload),
    });
    if (!generated.ok || !generated.data) {
      throw new Error(`generate failed: ${generated.status} ${generated.text}`);
    }

    artifacts.draftId = generated.data.draftId ?? null;
    artifacts.cards = (generated.data.cards || []).map((card) => ({
      id: card.id,
      platform: card.platform,
      status: card.status,
      title: card.title,
      charCount: (card.body || "").length,
      preview: String(card.body || "").slice(0, 200),
    }));
    steps.push({ name: "generate", status: "ok", message: `generated ${artifacts.cards.length} cards` });

    if (args.publish && artifacts.draftId) {
      for (const card of generated.data.cards || []) {
        if (!card?.id) continue;
        await fetchJson(`${args.baseUrl}/api/cards/${card.id}/status`, {
          method: "POST",
          headers,
          body: JSON.stringify({ status: "accepted" }),
        });
      }
      steps.push({ name: "accept", status: "ok", message: "accepted generated cards" });

      const publishRes = await fetchJson(`${args.baseUrl}/api/publish`, {
        method: "POST",
        headers,
        body: JSON.stringify({ draftId: artifacts.draftId, acceptedOnly: true }),
      });
      if (!publishRes.ok || !publishRes.data?.jobId) {
        throw new Error(`publish failed: ${publishRes.status} ${publishRes.text}`);
      }

      const job = await fetchJson(`${args.baseUrl}/api/jobs/${publishRes.data.jobId}`, {
        method: "GET",
        headers,
      });
      artifacts.publish = {
        jobId: publishRes.data.jobId,
        status: publishRes.data.status || "unknown",
        job: job.data || null,
      };
      steps.push({ name: "publish", status: "ok", message: `created job ${publishRes.data.jobId}` });
    } else {
      steps.push({ name: "publish", status: "skipped", message: "safe default: add --publish to enable" });
    }

    outputAndExit(
      {
        ok: true,
        command: "generate-preview-publish",
        steps,
        input: {
          provider: args.provider,
          model: args.model || null,
          platforms: args.platforms,
          language: args.language,
          publish: args.publish,
          usedOpenAIKey: Boolean(openaiKey),
          usedOpenRouterKey: Boolean(openrouterKey),
        },
        artifacts,
        error: null,
      },
      0,
    );
  } catch (err) {
    outputAndExit(
      {
        ok: false,
        command: "generate-preview-publish",
        steps,
        artifacts,
        error: {
          step: steps.length ? steps[steps.length - 1].name : "runtime",
          message: err instanceof Error ? err.message : String(err),
        },
      },
      1,
    );
  } finally {
    if (child && !child.killed) {
      try {
        child.kill("SIGTERM");
      } catch {}
    }
  }
}

void main();
