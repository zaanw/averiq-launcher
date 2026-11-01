import fs from "node:fs/promises";
import path from "node:path";
import AdmZip from "adm-zip";
const zip = new AdmZip();
const excluded = new Set([
  ".git",
  "node_modules",
  "dist",
  "dist-electron",
  "release",
  "artifacts",
  ".env",
]);
async function collect(dir = "") {
  for (const e of await fs.readdir(dir || ".", { withFileTypes: true })) {
    if (
      excluded.has(e.name) ||
      e.name.startsWith(".env") ||
      /\.(?:log|pfx|p12|key)$/.test(e.name)
    )
      continue;
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) await collect(rel);
    else if (e.isFile())
      zip.addFile(
        "averiq-launcher/" + rel.replaceAll("\\", "/"),
        await fs.readFile(rel),
      );
  }
}
await collect();
await fs.mkdir("release", { recursive: true });
zip.writeZip("release/Averiq-Launcher-0.1.0-source.zip");
console.log(
  "Source ZIP written (excludes dependencies, credentials and generated output)",
);
