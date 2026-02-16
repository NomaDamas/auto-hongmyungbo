import path from "node:path";
import express from "express";

const app = express();
const port = Number(process.env.PORT || 8091);
const collectorBase = (process.env.COLLECTOR_URL || "http://localhost:8090").replace(/\/+$/, "");

app.use(express.static(path.resolve(process.cwd(), "public")));
app.get("/api/summary", async (req, res) => {
  try {
    const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
    const resp = await fetch(`${collectorBase}/api/summary${qs}`);
    const data = await resp.json();
    res.status(resp.status).json(data);
  } catch (err) {
    res.status(502).json({ error: "collector_unreachable", detail: String(err) });
  }
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "dashboard", collectorBase });
});

app.listen(port, () => {
  console.log(`dashboard listening on http://localhost:${port}`);
});
