import fs from "node:fs";
import path from "node:path";
import express from "express";
import cors from "cors";

const app = express();
const port = Number(process.env.PORT || 8090);
const dataPath = path.resolve(process.cwd(), "data/events.json");

app.use(cors());
app.use(express.json());

function ensureFile() {
  const dir = path.dirname(dataPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(dataPath)) fs.writeFileSync(dataPath, "[]", "utf-8");
}

function readEvents() {
  ensureFile();
  return JSON.parse(fs.readFileSync(dataPath, "utf-8"));
}

function writeEvents(events) {
  fs.writeFileSync(dataPath, JSON.stringify(events), "utf-8");
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "collector" });
});

app.post("/api/events", (req, res) => {
  const body = req.body || {};
  const eventType = String(body.eventType || "").trim().toLowerCase();
  if (!eventType) {
    return res.status(400).json({ error: "eventType is required" });
  }

  const events = readEvents();
  const event = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    eventType,
    sessionId: body.sessionId || null,
    platform: body.platform || null,
    path: body.path || null,
    referrer: body.referrer || null,
    meta: body.meta || {},
  };
  events.push(event);
  writeEvents(events);
  return res.json({ ok: true, eventId: event.id });
});

app.get("/api/summary", (req, res) => {
  const days = Math.max(1, Number(req.query.days || 14));
  const cpm = Math.max(0, Number(req.query.cpm || 1.8));
  const ctr = Math.max(0, Math.min(1, Number(req.query.ctr || 0.012)));
  const cpc = Math.max(0, Number(req.query.cpc || 0.18));
  const fillRate = Math.max(0, Math.min(1, Number(req.query.fillRate || 0.65)));
  const slotsPerPage = Math.max(1, Number(req.query.slotsPerPage || 2));

  const startMs = Date.now() - days * 24 * 60 * 60 * 1000;
  const events = readEvents().filter((e) => new Date(e.createdAt).getTime() >= startMs);

  const dailyMap = new Map();
  const totals = {
    totalEvents: 0,
    pageViews: 0,
    generateCount: 0,
    refineCount: 0,
    acceptCount: 0,
    rejectCount: 0,
    publishCount: 0,
  };

  for (const e of events) {
    const day = String(e.createdAt).slice(0, 10);
    if (!dailyMap.has(day)) {
      dailyMap.set(day, {
        day,
        totalEvents: 0,
        pageViews: 0,
        generateCount: 0,
        refineCount: 0,
        acceptCount: 0,
        rejectCount: 0,
        publishCount: 0,
      });
    }

    const row = dailyMap.get(day);
    row.totalEvents += 1;
    totals.totalEvents += 1;

    if (e.eventType === "page_view") {
      row.pageViews += 1;
      totals.pageViews += 1;
    }
    if (e.eventType === "generate") {
      row.generateCount += 1;
      totals.generateCount += 1;
    }
    if (e.eventType === "refine") {
      row.refineCount += 1;
      totals.refineCount += 1;
    }
    if (e.eventType === "accept") {
      row.acceptCount += 1;
      totals.acceptCount += 1;
    }
    if (e.eventType === "reject") {
      row.rejectCount += 1;
      totals.rejectCount += 1;
    }
    if (e.eventType === "publish") {
      row.publishCount += 1;
      totals.publishCount += 1;
    }
  }

  const daily = [...dailyMap.values()].sort((a, b) => a.day.localeCompare(b.day));
  const impressions = Math.round(totals.pageViews * slotsPerPage * fillRate);
  const estimatedClicks = Math.round(impressions * ctr);
  const cpmBasedRevenue = Number(((impressions / 1000) * cpm).toFixed(4));
  const cpcBasedRevenue = Number((estimatedClicks * cpc).toFixed(4));
  const estimatedRevenue = Number(Math.max(cpmBasedRevenue, cpcBasedRevenue).toFixed(4));
  const avgDailyRevenue = Number((estimatedRevenue / days).toFixed(4));
  const projectedMonthlyRevenue = Number((avgDailyRevenue * 30).toFixed(4));

  res.json({
    windowDays: days,
    totals,
    daily,
    revenueEstimate: {
      impressions,
      estimatedClicks,
      cpmBasedRevenue,
      cpcBasedRevenue,
      estimatedRevenue,
      avgDailyRevenue,
      projectedMonthlyRevenue,
      assumptions: {
        cpm,
        ctr,
        cpc,
        fillRate,
        slotsPerPage,
      },
    },
  });
});

app.listen(port, () => {
  console.log(`collector listening on http://localhost:${port}`);
});
