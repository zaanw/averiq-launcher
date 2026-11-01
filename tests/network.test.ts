import { vi, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
vi.mock("../downloads/http", async (original) => ({
  ...(await original<typeof import("../downloads/http")>()),
  json: vi.fn(),
  download: vi.fn(),
}));
import { json, download } from "../downloads/http";
import { versions } from "../minecraft/manifest";
import {
  installMod,
  installRelease,
  searchMods,
  ModVersion,
} from "../mods/modrinth";
let temp: string;
beforeEach(async () => {
  vi.clearAllMocks();
  temp = await fs.mkdtemp(path.join(os.tmpdir(), "averiq-net-"));
});
afterEach(async () => fs.rm(temp, { recursive: true, force: true }));
it("fetches manifest and falls back to persisted cache on network failure", async () => {
  const data = {
    versions: [
      {
        id: "1.21.1",
        type: "release",
        url: "https://example.com/version",
        releaseTime: "2024-08-08",
      },
    ],
  };
  vi.mocked(json).mockResolvedValueOnce(data);
  expect(await versions(temp)).toEqual({ ...data, cached: false });
  vi.mocked(json).mockRejectedValueOnce(new Error("offline"));
  expect(await versions(temp)).toEqual({ ...data, cached: true });
});
it("reports failed requests without inventing a manifest", async () => {
  vi.mocked(json).mockRejectedValueOnce(new Error("HTTP 403"));
  await expect(versions(temp)).rejects.toThrow("HTTP 403");
});
it("applies game and loader filters to mod search", async () => {
  vi.mocked(json).mockResolvedValueOnce({ hits: [] });
  await searchMods("sodium", "1.21.1", "fabric");
  const url = decodeURIComponent(vi.mocked(json).mock.calls[0][0]);
  expect(url).toContain("versions:1.21.1");
  expect(url).toContain("categories:fabric");
});
const release = (id: string): ModVersion => ({
  id,
  project_id: id,
  name: id,
  version_number: "1",
  game_versions: ["1.21.1"],
  loaders: ["fabric"],
  files: [
    {
      url: `https://cdn.modrinth.com/${id}.jar`,
      filename: id + ".jar",
      primary: true,
      hashes: { sha512: "a".repeat(128) },
    },
  ],
  dependencies: [],
});
it("installs required dependencies before a mod and writes tracking metadata", async () => {
  const parent = release("parent");
  parent.dependencies = [
    { project_id: "dep", version_id: null, dependency_type: "required" },
  ];
  vi.mocked(json)
    .mockResolvedValueOnce([parent])
    .mockResolvedValueOnce([release("dep")]);
  vi.mocked(download).mockImplementation(async (_url, file) => {
    await fs.writeFile(file, "verified fixture");
  });
  await installMod("parent", "1.21.1", "fabric", temp);
  expect(
    vi.mocked(download).mock.calls.map((c) => path.basename(c[1])),
  ).toEqual(["dep.jar", "parent.jar"]);
  expect(
    JSON.parse(
      await fs.readFile(path.join(temp, "parent.jar.averiq.json"), "utf8"),
    ).project,
  ).toBe("parent");
});
it("rejects incompatible mods and malicious artifact paths", async () => {
  await expect(
    installRelease(release("mod"), "1.20", "fabric", temp),
  ).rejects.toThrow("Incompatible");
  const bad = release("bad");
  bad.files[0].filename = "../escape.jar";
  await expect(installRelease(bad, "1.21.1", "fabric", temp)).rejects.toThrow(
    "Invalid file name",
  );
  expect(download).not.toHaveBeenCalled();
});
it("propagates failed mod downloads without success metadata", async () => {
  vi.mocked(json).mockResolvedValueOnce([release("mod")]);
  vi.mocked(download).mockRejectedValueOnce(new Error("Checksum mismatch"));
  await expect(installMod("mod", "1.21.1", "fabric", temp)).rejects.toThrow(
    "Checksum mismatch",
  );
  expect(await fs.readdir(temp)).toEqual([]);
});
