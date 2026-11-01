import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Instance } from "../shared/types";
import { safeJoin } from "../core/security";
export function instancePath(root: string, id: string) {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Invalid instance ID");
  return safeJoin(root, "instances", id);
}
export async function createInstance(
  root: string,
  name: string,
  version: string,
): Promise<Instance> {
  if (!name.trim() || name.length > 80)
    throw new Error("Instance name must be 1–80 characters");
  const instance: Instance = {
    id: randomUUID(),
    name: name.trim(),
    version,
    loader: "vanilla",
  };
  for (const folder of [
    "mods",
    "config",
    "saves",
    "resourcepacks",
    "shaderpacks",
    "logs",
  ])
    await fs.mkdir(safeJoin(instancePath(root, instance.id), folder), {
      recursive: true,
    });
  return instance;
}
export async function duplicateInstance(root: string, source: Instance) {
  const copy = await createInstance(
    root,
    source.name + " copy",
    source.version,
  );
  await fs.cp(instancePath(root, source.id), instancePath(root, copy.id), {
    recursive: true,
  });
  return { ...source, id: copy.id, name: copy.name };
}
