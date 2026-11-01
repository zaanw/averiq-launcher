import fs from "node:fs/promises";
import path from "node:path";
import { Version as XMVersion, diagnose } from "@xmcl/core";
import { versions } from "./manifest";
import { download, json, request, verify } from "../downloads/http";
import { fileName, safeJoin } from "../core/security";
import { Event } from "../shared/types";
export class MinecraftInstaller {
  constructor(
    readonly root: string,
    readonly emit: (event: Event) => void,
    readonly parallel = 6,
  ) {}
  async install(id: string, signal?: AbortSignal) {
    fileName(id);
    const entry = (await versions(this.root)).versions.find((v) => v.id === id);
    if (!entry) throw new Error("Version is absent from official manifest");
    if (!entry.sha1) throw new Error("Official metadata has no checksum");
    const target = safeJoin(this.root, "versions", id, id + ".json");
    await download(entry.url, target, entry.sha1, "sha1", signal);
    return this.dependencies(id, signal);
  }
  async dependencies(id: string, signal?: AbortSignal) {
    fileName(id);
    const resolved = await XMVersion.parse(this.root, id);
    const tasks: { url: string; file: string; sha1: string; size: number }[] =
      [];
    const client = resolved.downloads.client;
    if (client)
      tasks.push({
        ...client,
        file: safeJoin(
          this.root,
          "versions",
          resolved.minecraftVersion,
          resolved.minecraftVersion + ".jar",
        ),
      });
    for (const lib of resolved.libraries) {
      const d = lib.download;
      let hash = d.sha1;
      if (!hash) {
        const response = (await request(d.url + ".sha1", { signal }))
          .toString()
          .trim()
          .split(/\s/)[0];
        if (!/^[a-f0-9]{40}$/i.test(response))
          throw new Error("No valid checksum for " + lib.name);
        hash = response;
      }
      tasks.push({
        url: d.url,
        file: safeJoin(this.root, "libraries", d.path),
        sha1: hash,
        size: d.size || 0,
      });
    }
    if (resolved.assetIndex) {
      const index = resolved.assetIndex;
      const file = safeJoin(
        this.root,
        "assets",
        "indexes",
        fileName(index.id) + ".json",
      );
      await download(index.url, file, index.sha1, "sha1", signal);
      const assets = JSON.parse(await fs.readFile(file, "utf8")) as {
        objects: Record<string, { hash: string; size: number }>;
      };
      for (const asset of Object.values(assets.objects)) {
        if (!/^[a-f0-9]{40}$/.test(asset.hash))
          throw new Error("Invalid asset hash");
        tasks.push({
          url: `https://resources.download.minecraft.net/${asset.hash.slice(0, 2)}/${asset.hash}`,
          file: safeJoin(
            this.root,
            "assets",
            "objects",
            asset.hash.slice(0, 2),
            asset.hash,
          ),
          sha1: asset.hash,
          size: asset.size,
        });
      }
    }
    for (const log of Object.values(resolved.logging || {})) {
      const d = log.file;
      tasks.push({
        ...d,
        file: safeJoin(this.root, "assets", "log_configs", fileName(d.id)),
      });
    }
    const total = tasks.reduce((sum, t) => sum + t.size, 0);
    let complete = 0,
      cursor = 0;
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    try {
      await Promise.all(
        Array.from(
          { length: Math.min(this.parallel, tasks.length) },
          async () => {
            while (cursor < tasks.length) {
              const t = tasks[cursor++];
              await download(t.url, t.file, t.sha1, "sha1", controller.signal);
              complete += t.size;
              this.emit({
                type: "progress",
                message: path.basename(t.file),
                progress: complete,
                total,
              });
            }
          },
        ),
      );
    } catch (e) {
      controller.abort();
      throw e;
    } finally {
      signal?.removeEventListener("abort", abort);
    }
    await fs.writeFile(
      safeJoin(this.root, "versions", id, "averiq-integrity.json"),
      JSON.stringify(
        tasks.map((t) => ({
          file: path.relative(this.root, t.file),
          sha1: t.sha1,
        })),
      ),
    );
    this.emit({ type: "status", message: "Installed " + id });
    return resolved;
  }
  async check(id: string) {
    fileName(id);
    const report = await diagnose(id, this.root, { strict: true });
    try {
      const saved = JSON.parse(
        await fs.readFile(
          safeJoin(this.root, "versions", id, "averiq-integrity.json"),
          "utf8",
        ),
      ) as { file: string; sha1: string }[];
      for (const item of saved) {
        const file = safeJoin(this.root, item.file);
        if (!/^[a-f0-9]{40}$/i.test(item.sha1))
          throw new Error("Invalid integrity record");
        if (
          !(await verify(file, item.sha1)) &&
          !report.issues.some((i) => i.file === file)
        )
          report.issues.push({
            type: "corrupted",
            role: "library",
            file,
            hint: "Run repair",
            expectedChecksum: item.sha1,
            receivedChecksum: "",
          } as any);
      }
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    return report;
  }
  async repair(id: string, signal?: AbortSignal) {
    const official = (await versions(this.root)).versions.some(
      (v) => v.id === id,
    );
    if (official) return this.install(id, signal);
    return this.dependencies(id, signal);
  }
}
