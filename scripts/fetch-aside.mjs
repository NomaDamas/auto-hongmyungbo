import { mkdir, open, rename, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const version = "1.0.1022.1";
const file = `Aside-${version}-arm64.dmg`;
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const vendor = join(root, "resources", "vendor");
const destination = join(vendor, file);
const temporary = `${destination}.download`;

if (await stat(destination).then((info) => info.isFile(), () => false)) {
  console.log(`Aside dmg already present: ${destination}`);
  process.exit(0);
}

await mkdir(vendor, { recursive: true });
const response = await fetch(`https://releases.aside.com/dev-updater/${file}`);
if (!response.ok || !response.body) throw new Error(`Aside download failed: HTTP ${response.status}`);

const total = Number(response.headers.get("content-length")) || 0;
const reader = response.body.getReader();
const output = await open(temporary, "w");
let received = 0;
let lastPct = -1;
try {
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    await output.writeFile(value);
    received += value.byteLength;
    const pct = total ? Math.floor((received / total) * 100) : -1;
    if (pct >= lastPct + 10) {
      console.log(total ? `Downloading Aside: ${pct}%` : `Downloading Aside: ${received} bytes`);
      lastPct = pct;
    }
  }
} catch (error) {
  await rm(temporary, { force: true });
  throw error;
} finally {
  await output.close();
}
await rename(temporary, destination);
console.log(`Downloaded ${file} to resources/vendor/`);
