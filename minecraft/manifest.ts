import fs from "node:fs/promises";
import path from "node:path";
import { Version } from "../shared/types";
import { json } from "../downloads/http";
export const MANIFEST =
  "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
export async function versions(
  root: string,
): Promise<{ versions: Version[]; cached: boolean }> {
  const cache = path.join(root, "manifest.json");
  try {
    const data = await json<{ versions: Version[] }>(MANIFEST);
    if (!Array.isArray(data.versions))
      throw new Error("Invalid version manifest");
    await fs.mkdir(root, { recursive: true });
    await fs.writeFile(cache, JSON.stringify(data));
    return { ...data, cached: false };
  } catch (e) {
    try {
      return { ...JSON.parse(await fs.readFile(cache, "utf8")), cached: true };
    } catch {
      throw e;
    }
  }
}
export async function installedVersions(root: string) {
  try {
    const dirs = await fs.readdir(path.join(root, "versions"));
    const found: string[] = [];
    for (const id of dirs) {
      try {
        await fs.access(path.join(root, "versions", id, id + ".json"));
        found.push(id);
      } catch {}
    }
    return found;
  } catch {
    return [];
  }
}
