import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { dialog, shell, safeStorage, BrowserWindow } from "electron";
import AdmZip from "adm-zip";
import { Store } from "../settings/store";
import { offlineAccount, offlineUUID } from "../accounts/offline";
import { uploadSkin, resetSkin } from "../accounts/skins";
import { MicrosoftAuth } from "../accounts/microsoft";
import {
  createInstance,
  duplicateInstance,
  instancePath,
} from "../instances/manager";
import { versions, installedVersions } from "../minecraft/manifest";
import { MinecraftInstaller } from "../minecraft/installer";
import { GameRunner } from "../minecraft/launch";
import { discoverJava } from "../java/manager";
import { installLoader, loaderVersions } from "../minecraft/loaders";
import { installMod, searchMods, localMods, MODRINTH } from "../mods/modrinth";
import { json } from "../downloads/http";
import { fileName, safeJoin, redact } from "../core/security";
import { Logs } from "../diagnostics/logs";
import { validate } from "../shared/validation";
import { Event, Instance } from "../shared/types";
export class Service {
  readonly logs: Logs;
  readonly runner: GameRunner;
  readonly auth: MicrosoftAuth;
  operation?: AbortController;
  constructor(
    readonly store: Store,
    readonly window: BrowserWindow,
  ) {
    this.logs = new Logs(path.join(store.directory, "logs"));
    this.runner = new GameRunner((e) => this.emit(e));
    this.auth = new MicrosoftAuth(
      path.join(store.directory, "accounts"),
      (text) => {
        if (
          !safeStorage.isEncryptionAvailable() ||
          (process.platform === "linux" &&
            safeStorage.getSelectedStorageBackend() === "basic_text")
        )
          throw new Error("Secure OS credential storage is unavailable");
        return safeStorage.encryptString(text);
      },
      (b) => safeStorage.decryptString(b),
    );
  }
  emit(event: Event) {
    event = { ...event, message: redact(event.message) };
    if (event.type !== "progress") this.logs.append(event.message);
    if (!this.window.isDestroyed())
      this.window.webContents.send("averiq:event", event);
  }
  selected() {
    const i = this.store.data.instances.find(
      (i) => i.id === this.store.data.selectedInstance,
    );
    if (!i) throw new Error("Select an instance first");
    return i;
  }
  instance(id: string) {
    const i = this.store.data.instances.find((i) => i.id === id);
    if (!i) throw new Error("Instance does not exist");
    return i;
  }
  async work<T>(fn: (signal: AbortSignal) => Promise<T>) {
    if (this.operation || this.runner.process || this.runner.starting)
      throw new Error("Another operation or game is running");
    const abort = new AbortController();
    this.operation = abort;
    try {
      return await fn(abort.signal);
    } finally {
      this.operation = undefined;
      this.emit({ type: "progress", message: "", progress: 0, total: 0 });
    }
  }
  async confirm(message: string) {
    return (
      (
        await dialog.showMessageBox(this.window, {
          type: "warning",
          message,
          buttons: ["Cancel", "Delete"],
          defaultId: 0,
          cancelId: 0,
        })
      ).response === 1
    );
  }
  async call(method: string, input?: unknown): Promise<unknown> {
    const a = validate(method, input) as any;
    const d = this.store.data,
      s = d.settings;
    const installer = new MinecraftInstaller(
      s.root,
      (e) => this.emit(e),
      s.parallel,
    );
    const directory = (type: string) =>
      safeJoin(
        instancePath(s.root, this.selected().id),
        type === "mod"
          ? "mods"
          : type === "shader"
            ? "shaderpacks"
            : "resourcepacks",
      );
    switch (method) {
      case "uploadSkin":
        return this.work(async () => {
          const account = d.accounts.find((v) => v.id === d.selectedAccount);
          if (account?.type !== "microsoft")
            throw new Error(
              "Skin upload requires a licensed Microsoft account",
            );
          const pick = await dialog.showOpenDialog(this.window, {
            properties: ["openFile"],
            filters: [{ name: "Minecraft skin PNG", extensions: ["png"] }],
          });
          if (pick.canceled) return false;
          const token = await this.auth.token(account, s.clientId);
          const profile = await uploadSkin(pick.filePaths[0], token, a.variant);
          account.skin = profile.skins?.find(
            (v: any) => v.state === "ACTIVE",
          )?.url;
          await this.store.save();
          return true;
        });
      case "resetSkin":
        return this.work(async () => {
          const account = d.accounts.find((v) => v.id === d.selectedAccount);
          if (account?.type !== "microsoft")
            throw new Error("Skin reset requires a licensed Microsoft account");
          await resetSkin(await this.auth.token(account, s.clientId));
          account.skin = undefined;
          await this.store.save();
          return true;
        });
      case "state":
        return {
          ...d,
          running: !!this.runner.process,
          busy: !!this.operation || this.runner.starting,
        };
      case "versions":
        return versions(s.root);
      case "installed":
        return installedVersions(s.root);
      case "java":
        return discoverJava(s.javaPath);
      case "cancel":
        this.operation?.abort();
        return true;
      case "stop":
        this.runner.stop();
        return true;
      case "createAccount": {
        const account = offlineAccount(a.name);
        d.accounts.push(account);
        d.selectedAccount = account.id;
        break;
      }
      case "renameAccount": {
        const account = d.accounts.find((v) => v.id === a.id);
        if (!account || account.type !== "offline")
          throw new Error("Only local profiles can be renamed");
        offlineAccount(a.name);
        account.name = a.name;
        account.uuid = offlineUUID(a.name);
        break;
      }
      case "removeAccount": {
        const account = d.accounts.find((v) => v.id === a.id);
        if (!account) throw new Error("Profile not found");
        await this.auth.logout(a.id);
        d.accounts = d.accounts.filter((v) => v.id !== a.id);
        if (d.selectedAccount === a.id)
          d.selectedAccount = d.accounts[0]?.id || "";
        break;
      }
      case "selectAccount":
        if (!d.accounts.some((v) => v.id === a.id))
          throw new Error("Profile not found");
        d.selectedAccount = a.id;
        break;
      case "selectInstance":
        this.instance(a.id);
        d.selectedInstance = a.id;
        break;
      case "createInstance": {
        fileName(a.version);
        const instance = await createInstance(s.root, a.name, a.version);
        d.instances.push(instance);
        d.selectedInstance = instance.id;
        break;
      }
      case "duplicateInstance": {
        if (this.runner.process || this.runner.starting || this.operation)
          throw new Error("Stop active operation first");
        d.instances.push(await duplicateInstance(s.root, this.instance(a.id)));
        break;
      }
      case "renameInstance":
        if (!a.name.trim()) throw new Error("Instance name cannot be blank");
        this.instance(a.id).name = a.name.trim();
        break;
      case "favoriteVersion": {
        d.favoriteVersions = d.favoriteVersions.includes(a.version)
          ? d.favoriteVersions.filter((v) => v !== a.version)
          : [...d.favoriteVersions, a.version];
        break;
      }
      case "favorite": {
        const i = this.instance(a.id);
        i.favorite = !i.favorite;
        break;
      }
      case "deleteInstance": {
        if (this.runner.process || this.runner.starting || this.operation)
          throw new Error("Stop active operation first");
        const i = this.instance(a.id);
        if (!(await this.confirm(`Delete “${i.name}” and all its worlds?`)))
          return false;
        await fs.rm(instancePath(s.root, i.id), {
          recursive: true,
          force: true,
        });
        d.instances = d.instances.filter((v) => v.id !== i.id);
        if (d.selectedInstance === i.id)
          d.selectedInstance = d.instances[0]?.id || "";
        break;
      }
      case "openInstance": {
        const error = await shell.openPath(
          instancePath(s.root, this.instance(a.id).id),
        );
        if (error) throw new Error(error);
        return true;
      }
      case "exportInstance": {
        const i = this.instance(a.id);
        const { filePath } = await dialog.showSaveDialog(this.window, {
          defaultPath: i.name + ".averiq.zip",
          filters: [{ name: "Averiq instance", extensions: ["zip"] }],
        });
        if (!filePath) return false;
        const zip = new AdmZip();
        zip.addFile(
          "averiq-instance.json",
          Buffer.from(JSON.stringify({ ...i, id: undefined })),
        );
        zip.addLocalFolder(instancePath(s.root, i.id), "data");
        zip.writeZip(filePath);
        return true;
      }
      case "importInstance": {
        if (this.runner.process || this.runner.starting || this.operation)
          throw new Error("Stop active operation first");
        const pick = await dialog.showOpenDialog(this.window, {
          properties: ["openFile"],
          filters: [{ name: "Averiq instance", extensions: ["zip"] }],
        });
        if (pick.canceled) return false;
        const stat = await fs.stat(pick.filePaths[0]);
        if (stat.size > 1024 ** 3) throw new Error("Archive exceeds 1 GiB");
        const zip = new AdmZip(pick.filePaths[0]);
        let total = 0;
        for (const e of zip.getEntries()) {
          for (const segment of e.entryName.split("/").filter(Boolean))
            fileName(segment);
          total += e.header.size;
          if (total > 4 * 1024 ** 3)
            throw new Error("Expanded archive exceeds 4 GiB");
          if (
            e.entryName.includes("\\") ||
            e.entryName.startsWith("/") ||
            e.entryName.split("/").includes("..") ||
            ((e.attr >>> 16) & 0xf000) === 0xa000
          )
            throw new Error("Unsafe archive entry");
          if (
            e.entryName !== "averiq-instance.json" &&
            !e.entryName.startsWith("data/")
          )
            throw new Error("Unexpected archive entry");
        }
        const metadata = JSON.parse(zip.readAsText("averiq-instance.json"));
        validate("createInstance", {
          name: metadata.name,
          version: metadata.version,
        });
        if (metadata.baseVersion !== undefined)
          validate("install", { version: metadata.baseVersion });
        const i = await createInstance(s.root, metadata.name, metadata.version);
        try {
          for (const e of zip.getEntries()) {
            if (!e.entryName.startsWith("data/") || e.isDirectory) continue;
            const file = safeJoin(
              instancePath(s.root, i.id),
              e.entryName.slice(5),
            );
            await fs.mkdir(path.dirname(file), { recursive: true });
            await fs.writeFile(file, e.getData());
          }
        } catch (e) {
          await fs.rm(instancePath(s.root, i.id), {
            recursive: true,
            force: true,
          });
          throw e;
        }
        d.instances.push({
          ...i,
          loader: ["fabric", "quilt"].includes(metadata.loader)
            ? metadata.loader
            : "vanilla",
          baseVersion: metadata.baseVersion,
        });
        d.selectedInstance = i.id;
        break;
      }
      case "install":
        return this.work((signal) =>
          installer.install(a.version, signal).then((v) => ({ id: v.id })),
        );
      case "repair":
        return this.work((signal) =>
          installer.repair(a.version, signal).then((v) => ({ id: v.id })),
        );
      case "diagnose":
        return installer.check(a.version);
      case "deleteVersion": {
        if (this.runner.process || this.runner.starting || this.operation)
          throw new Error("Stop active operation first");
        if (
          d.instances.some(
            (i) => i.version === a.version || i.baseVersion === a.version,
          )
        )
          throw new Error("Version is used by an instance");
        if (
          !(await this.confirm("Delete installed version " + a.version + "?"))
        )
          return false;
        await fs.rm(safeJoin(s.root, "versions", fileName(a.version)), {
          recursive: true,
          force: true,
        });
        return true;
      }
      case "launch": {
        const i = this.selected();
        const account = d.accounts.find((v) => v.id === d.selectedAccount);
        if (!account) throw new Error("Select an account");
        if (this.operation || this.runner.process || this.runner.starting)
          throw new Error("Another operation or game is running");
        const token =
          account.type === "microsoft"
            ? await this.auth.token(account, s.clientId)
            : "0";
        return this.runner.start(
          s,
          i,
          account,
          token,
          async (seconds, exitCode) => {
            d.history.unshift({
              instance: i.name,
              version: i.version,
              at: new Date().toISOString(),
              seconds,
              exitCode,
            });
            d.history = d.history.slice(0, 200);
            await this.store.save();
            await this.logs.persist();
          },
        );
      }
      case "settings": {
        if (this.runner.process || this.runner.starting || this.operation)
          throw new Error("Stop active operation first");
        if (!path.isAbsolute(a.root))
          throw new Error("Minecraft root must be an absolute path");
        const changed = a.root !== s.root;
        d.settings = a;
        await fs.mkdir(a.root, { recursive: true });
        if (changed)
          this.emit({
            type: "status",
            message:
              "Minecraft root changed. Existing game files remain in their original folder.",
          });
        break;
      }
      case "pickJava": {
        const pick = await dialog.showOpenDialog(this.window, {
          properties: ["openFile"],
          title: "Choose Java executable",
        });
        return pick.canceled ? null : pick.filePaths[0];
      }
      case "pickRoot": {
        const pick = await dialog.showOpenDialog(this.window, {
          properties: ["openDirectory", "createDirectory"],
        });
        return pick.canceled ? null : pick.filePaths[0];
      }
      case "loaders":
        return loaderVersions(a.loader, a.version);
      case "installLoader":
        return this.work(async (signal) => {
          const i = this.selected();
          const result = await installLoader(
            s.root,
            i,
            a.loader,
            a.version,
            installer,
            signal,
          );
          Object.assign(i, result);
          await this.store.save();
          return i;
        });
      case "searchMods": {
        const i = this.selected();
        if (a.type === "mod" && i.loader === "vanilla")
          throw new Error("Choose a Fabric or Quilt instance for mods");
        return searchMods(
          a.query,
          i.baseVersion || i.version,
          i.loader,
          a.type,
        );
      }
      case "project":
        return json(MODRINTH + "/project/" + encodeURIComponent(a.id));
      case "installMod":
        return this.work((signal) => {
          const i = this.selected();
          if (a.type === "mod" && i.loader === "vanilla")
            throw new Error("Vanilla cannot load mods");
          return installMod(
            a.id,
            i.baseVersion || i.version,
            a.type === "mod"
              ? i.loader
              : a.type === "shader"
                ? "iris"
                : "minecraft",
            directory(a.type),
            signal,
          );
        });
      case "localMods":
        return localMods(directory(a.type));
      case "removeMod": {
        if (this.runner.process || this.runner.starting || this.operation)
          throw new Error("Stop active operation first");
        const dir = directory(a.type);
        fileName(a.name);
        if (!/\.(jar|zip)$/.test(a.name))
          throw new Error("Unsupported file type");
        await fs.rm(safeJoin(dir, a.name));
        await fs.rm(safeJoin(dir, a.name + ".averiq.json"), { force: true });
        return true;
      }
      case "login":
        return this.work(async (signal) => {
          const account = await this.auth.login(
            s.clientId,
            (message, url) => {
              this.emit({ type: "status", message });
              if (
                new URL(url).hostname === "microsoft.com" ||
                new URL(url).hostname === "www.microsoft.com"
              )
                void shell.openExternal(url);
            },
            signal,
          );
          const existing = d.accounts.find(
            (v) => v.uuid === account.uuid && v.type === "microsoft",
          );
          if (existing) {
            await this.auth.logout(existing.id);
            d.accounts = d.accounts.filter((v) => v.id !== existing.id);
          }
          d.accounts.push(account);
          d.selectedAccount = account.id;
          await this.store.save();
          return account;
        });
      case "exportLogs": {
        const { filePath } = await dialog.showSaveDialog(this.window, {
          defaultPath: "averiq-diagnostics.log",
        });
        if (filePath) await this.logs.export(filePath);
        return !!filePath;
      }
      case "update": {
        const release = await json<any>(
          "https://api.github.com/repos/zaanw/averiq-launcher/releases/latest",
        );
        return { version: release.tag_name, url: release.html_url };
      }
      default:
        throw new Error("Unknown IPC method");
    }
    await this.store.save();
    return this.store.data;
  }
}
