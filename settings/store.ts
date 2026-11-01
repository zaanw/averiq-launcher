import fs from "node:fs/promises";
import path from "node:path";
import { State } from "../shared/types";
export class Store {
  data: State;
  private queue = Promise.resolve();
  constructor(readonly directory: string) {
    this.data = {
      accounts: [],
      instances: [],
      selectedAccount: "",
      selectedInstance: "",
      history: [],
      favoriteVersions: [],
      settings: {
        language: "ru",
        theme: "midnight",
        root: path.join(directory, "minecraft"),
        javaPath: "",
        minRam: 1024,
        maxRam: 4096,
        width: 1280,
        height: 720,
        fullscreen: false,
        jvmArgs: [],
        parallel: 6,
        verify: true,
        autoUpdate: true,
        clientId: "",
      },
    };
  }
  async load() {
    await fs.mkdir(this.directory, { recursive: true });
    try {
      const saved = JSON.parse(
        await fs.readFile(path.join(this.directory, "state.json"), "utf8"),
      );
      this.data = {
        ...this.data,
        ...saved,
        settings: { ...this.data.settings, ...saved.settings },
      };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT")
        throw new Error("Cannot read settings: " + String(e));
    }
    return this.data;
  }
  save() {
    const json = JSON.stringify(this.data, null, 2);
    this.queue = this.queue.then(async () => {
      const file = path.join(this.directory, "state.json");
      await fs.writeFile(file + ".tmp", json, { mode: 0o600 });
      await fs.rename(file + ".tmp", file);
    });
    return this.queue;
  }
}
