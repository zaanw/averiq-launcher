import { z } from "zod";
const id = z.string().uuid();
const version = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[a-zA-Z0-9_.+\-]+$/);
export const schemas = {
  uploadSkin: z.object({ variant: z.enum(["classic", "slim"]) }).strict(),
  resetSkin: z.undefined(),
  state: z.undefined(),
  versions: z.undefined(),
  installed: z.undefined(),
  java: z.undefined(),
  cancel: z.undefined(),
  stop: z.undefined(),
  update: z.undefined(),
  login: z.undefined(),
  exportLogs: z.undefined(),
  pickJava: z.undefined(),
  pickRoot: z.undefined(),
  createAccount: z.object({ name: z.string().min(3).max(16) }).strict(),
  renameAccount: z.object({ id, name: z.string().min(3).max(16) }).strict(),
  removeAccount: z.object({ id }).strict(),
  selectAccount: z.object({ id }).strict(),
  selectInstance: z.object({ id }).strict(),
  createInstance: z
    .object({ name: z.string().min(1).max(80), version })
    .strict(),
  duplicateInstance: z.object({ id }).strict(),
  renameInstance: z.object({ id, name: z.string().min(1).max(80) }).strict(),
  deleteInstance: z.object({ id }).strict(),
  exportInstance: z.object({ id }).strict(),
  importInstance: z.undefined(),
  openInstance: z.object({ id }).strict(),
  favorite: z.object({ id }).strict(),
  favoriteVersion: z.object({ version }).strict(),
  install: z.object({ version }).strict(),
  repair: z.object({ version }).strict(),
  diagnose: z.object({ version }).strict(),
  deleteVersion: z.object({ version }).strict(),
  launch: z.undefined(),
  loaders: z.object({ loader: z.enum(["fabric", "quilt"]), version }).strict(),
  installLoader: z
    .object({ loader: z.enum(["fabric", "quilt"]), version })
    .strict(),
  searchMods: z
    .object({
      query: z.string().max(200),
      type: z.enum(["mod", "resourcepack", "shader"]),
    })
    .strict(),
  project: z.object({ id: z.string().regex(/^[a-zA-Z0-9_-]+$/) }).strict(),
  installMod: z
    .object({
      id: z.string().regex(/^[a-zA-Z0-9_-]+$/),
      type: z.enum(["mod", "resourcepack", "shader"]),
    })
    .strict(),
  localMods: z
    .object({ type: z.enum(["mod", "resourcepack", "shader"]) })
    .strict(),
  removeMod: z
    .object({
      name: z.string().max(200),
      type: z.enum(["mod", "resourcepack", "shader"]),
    })
    .strict(),
  settings: z
    .object({
      language: z.enum(["ru", "en"]),
      theme: z.enum(["midnight", "light"]),
      root: z.string().min(1),
      javaPath: z.string(),
      minRam: z.number().int().min(256).max(131072),
      maxRam: z.number().int().min(512).max(131072),
      width: z.number().int().min(640).max(7680),
      height: z.number().int().min(480).max(4320),
      fullscreen: z.boolean(),
      jvmArgs: z
        .array(z.string().max(300))
        .max(40)
        .refine(
          (a) =>
            a.every((s) =>
              /^-D(?:user\.language|user\.country|file\.encoding)=[A-Za-z0-9_-]+$|^-XX:[+\-](?:UseG1GC|UseZGC|UseParallelGC|UseSerialGC|AlwaysPreTouch|DisableExplicitGC|UnlockExperimentalVMOptions)$|^-XX:(?:MaxGCPauseMillis|G1NewSizePercent|G1ReservePercent|G1HeapRegionSize|InitiatingHeapOccupancyPercent)=[0-9]+[MmGg]?$/.test(
                s,
              ),
            ),
          "Only -D and -XX tuning flags are allowed",
        ),
      parallel: z.number().int().min(1).max(16),
      verify: z.boolean(),
      autoUpdate: z.boolean(),
      clientId: z.string().max(100),
    })
    .strict()
    .refine((v) => v.minRam <= v.maxRam, "Minimum RAM exceeds maximum"),
};
export function validate(method: string, args: unknown) {
  if (!Object.hasOwn(schemas, method)) throw new Error("Unknown IPC method");
  return schemas[method as keyof typeof schemas].parse(args);
}
