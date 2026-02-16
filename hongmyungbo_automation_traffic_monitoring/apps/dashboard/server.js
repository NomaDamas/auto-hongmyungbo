import path from "node:path";
import express from "express";

const app = express();
const port = Number(process.env.PORT || 8091);

app.use(express.static(path.resolve(process.cwd(), "public")));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "dashboard" });
});

app.listen(port, () => {
  console.log(`dashboard listening on http://localhost:${port}`);
});
