import fs from "node:fs/promises";
import path from "node:path";
import { json, download } from "../downloads/http";
import { fileName, safeJoin } from "../core/security";
export const MODRINTH = "https://api.modrinth.com/v2";
export interface ModVersion {
  id: string;
  project_id: string;
  name: string;
  version_number: string;
  game_versions: string[];
  loaders: string[];
  files: {
    url: string;
    filename: string;
    primary: boolean;
    hashes: { sha512: string };
  }[];
  dependencies: {
    project_id: string | null;
    version_id: string | null;
    dependency_type: string;
  }[];
}
export async function searchMods(
  query: string,
  version: string,
  loader: string,
  type = "mod",
) {
  const facets = [[`project_type:${type}`], [`versions:${version}`]];
  if (type === "mod") facets.push([`categories:${loader}`]);
  return json(
    `${MODRINTH}/search?query=${encodeURIComponent(query)}&facets=${encodeURIComponent(JSON.stringify(facets))}&limit=20`,
  );
}
export async function installMod(
  project: string,
  version: string,
  loader: string,
  directory: string,
  signal?: AbortSignal,
  visited = new Set<string>(),
) {
  if (visited.has(project)) return;
  visited.add(project);
  const list = await json<ModVersion[]>(
    `${MODRINTH}/project/${encodeURIComponent(project)}/version?game_versions=${encodeURIComponent(JSON.stringify([version]))}&loaders=${encodeURIComponent(JSON.stringify([loader]))}`,
    { signal },
  );
  const release = list[0];
  if (!release) throw new Error("No compatible release for " + project);
  await installRelease(release, version, loader, directory, signal, visited);
}
export async function installRelease(
  release: ModVersion,
  version: string,
  loader: string,
  directory: string,
  signal?: AbortSignal,
  visited = new Set<string>(),
) {
  if (
    !release.game_versions.includes(version) ||
    !release.loaders.includes(loader)
  )
    throw new Error("Incompatible Modrinth version");
  for (const dep of release.dependencies.filter(
    (d) => d.dependency_type === "required",
  )) {
    if (dep.version_id) {
      if (visited.has(dep.version_id)) continue;
      visited.add(dep.version_id);
      await installRelease(
        await json(
          `${MODRINTH}/version/${encodeURIComponent(dep.version_id)}`,
          { signal },
        ),
        version,
        loader,
        directory,
        signal,
        visited,
      );
    } else if (dep.project_id)
      await installMod(
        dep.project_id,
        version,
        loader,
        directory,
        signal,
        visited,
      );
    else throw new Error("Required dependency cannot be resolved");
  }
  const file = release.files.find((f) => f.primary) || release.files[0];
  if (!file?.hashes.sha512) throw new Error("Missing verified mod artifact");
  fileName(file.filename);
  await download(
    file.url,
    safeJoin(directory, file.filename),
    file.hashes.sha512,
    "sha512",
    signal,
  );
  const record = safeJoin(directory, file.filename + ".averiq.json");
  await fs.writeFile(
    record,
    JSON.stringify({
      project: release.project_id,
      version: release.id,
      filename: file.filename,
      name: release.name,
    }),
  );
  // Remove only earlier files installed by this launcher for the same project, after new download succeeds.
  for (const entry of await fs.readdir(directory)) {
    if (!entry.endsWith(".averiq.json") || entry === path.basename(record))
      continue;
    const old = JSON.parse(
      await fs.readFile(safeJoin(directory, entry), "utf8"),
    );
    if (old.project === release.project_id) {
      await fs.rm(safeJoin(directory, fileName(old.filename)), { force: true });
      await fs.rm(safeJoin(directory, entry));
    }
  }
}
export async function localMods(directory: string) {
  await fs.mkdir(directory, { recursive: true });
  return (await fs.readdir(directory)).filter((n) => /\.(jar|zip)$/.test(n));
}
