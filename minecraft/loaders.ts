import fs from "node:fs/promises";
import { installFabric, installQuiltVersion } from "@xmcl/installer";
import { json, request } from "../downloads/http";
import { Instance } from "../shared/types";
import { MinecraftInstaller } from "./installer";
// Forge and NeoForge are intentionally not advertised: installer processors need separate validation.
export const availableLoaders = ["vanilla", "fabric", "quilt"] as const;
export async function loaderVersions(loader: string, game: string) {
  if (!["fabric", "quilt"].includes(loader))
    throw new Error("This loader is not available");
  const host = loader === "fabric" ? "meta.fabricmc.net" : "meta.quiltmc.org";
  const list = await json<any[]>(
    `https://${host}/v2/versions/loader/${encodeURIComponent(game)}`,
  );
  return list.map((v) => ({
    version: v.loader.version,
    stable: !!v.loader.stable,
  }));
}
export async function installLoader(
  root: string,
  instance: Instance,
  loader: "fabric" | "quilt",
  version: string,
  installer: MinecraftInstaller,
  signal: AbortSignal,
) {
  const game = instance.baseVersion || instance.version;
  const valid = await loaderVersions(loader, game);
  if (!valid.some((v) => v.version === version))
    throw new Error("Incompatible loader version");
  const options = {
    minecraftVersion: game,
    version,
    minecraft: root,
    signal,
    fetch: async (url: string) =>
      new Response(new Uint8Array(await request(url, { signal }))),
  };
  const id =
    loader === "fabric"
      ? await installFabric(options)
      : await installQuiltVersion(options);
  await installer.dependencies(id, signal);
  return { ...instance, version: id, baseVersion: game, loader };
}
