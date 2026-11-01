import { ChildProcess, spawn } from "node:child_process";
import { Version, LaunchOption, launch, generateArguments } from "@xmcl/core";
import { Account, Instance, Settings, Event } from "../shared/types";
import { discoverJava, selectJava } from "../java/manager";
import { instancePath } from "../instances/manager";
import { MinecraftInstaller } from "./installer";
export function launchOptions(
  settings: Settings,
  instance: Instance,
  account: Account,
  javaPath: string,
  accessToken: string,
): LaunchOption {
  return {
    gamePath: instancePath(settings.root, instance.id),
    resourcePath: settings.root,
    version: instance.version,
    javaPath,
    gameProfile: { name: account.name, id: account.uuid.replaceAll("-", "") },
    accessToken,
    userType: account.type === "offline" ? "legacy" : "mojang",
    minMemory: settings.minRam,
    maxMemory: settings.maxRam,
    resolution: {
      width: settings.width,
      height: settings.height,
      ...(settings.fullscreen ? { fullscreen: true as const } : {}),
    },
    extraJVMArgs: settings.jvmArgs,
    launcherName: "Averiq",
    launcherBrand: "Averiq",
    ignoreInvalidMinecraftCertificates: false,
    ignorePatchDiscrepancies: false,
    extraExecOption: { shell: false, windowsHide: true },
  };
}
export class GameRunner {
  process?: ChildProcess;
  starting = false;
  constructor(readonly emit: (event: Event) => void) {}
  async start(
    settings: Settings,
    instance: Instance,
    account: Account,
    token: string,
    onExit: (seconds: number, code: number | null) => Promise<void>,
  ) {
    if (this.process || this.starting)
      throw new Error("Minecraft is already running or starting");
    this.starting = true;
    try {
      const version = await Version.parse(settings.root, instance.version);
      const required = version.javaVersion?.majorVersion || 8;
      const javas = await discoverJava(settings.javaPath);
      const chosen = settings.javaPath
        ? javas.find((j) => j.path === settings.javaPath)
        : selectJava(javas, required);
      if (
        !chosen ||
        chosen.major !== required ||
        !/amd64|x86_64|aarch64/.test(chosen.arch)
      )
        throw new Error(`Selected Java must be Java ${required}`);
      if (settings.verify) {
        const report = await new MinecraftInstaller(
          settings.root,
          this.emit,
        ).check(instance.version);
        if (report.issues.length)
          throw new Error(
            `${report.issues.length} missing/corrupted files. Use Versions → Repair.`,
          );
      }
      const options = launchOptions(
        settings,
        instance,
        account,
        chosen.path,
        token,
      );
      await generateArguments(options);
      let spawnResult: Promise<void> | undefined;
      options.spawn = (command, args, spawnOptions) => {
        const child = spawn(command, args ?? [], {
          ...spawnOptions,
          shell: false,
        });
        spawnResult = new Promise<void>((resolve, reject) => {
          child.once("spawn", resolve);
          child.once("error", reject);
        });
        // Attach a rejection handler immediately; launch may still be resolving.
        void spawnResult.catch(() => {});
        return child;
      };
      const child = await launch(options);
      this.process = child;
      const at = Date.now();
      child.stdout?.on("data", (b) =>
        this.emit({ type: "log", message: b.toString() }),
      );
      child.stderr?.on("data", (b) =>
        this.emit({ type: "log", message: b.toString() }),
      );
      child.once("error", (e) =>
        this.emit({ type: "log", message: e.message }),
      );
      child.once("close", (code) => {
        this.process = undefined;
        this.emit({ type: "status", message: `Minecraft exited (${code})` });
        void onExit(Math.round((Date.now() - at) / 1000), code).catch((e) =>
          this.emit({ type: "log", message: String(e) }),
        );
      });
      await spawnResult;
      this.emit({ type: "status", message: "Minecraft running" });
      return { pid: child.pid };
    } finally {
      this.starting = false;
    }
  }
  stop() {
    if (!this.process) throw new Error("Minecraft is not running");
    this.process.kill();
  }
}
