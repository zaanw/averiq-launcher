import { vi, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import AdmZip from "adm-zip";
vi.mock("electron", () => ({
  dialog: {
    showMessageBox: vi.fn(),
    showOpenDialog: vi.fn(),
    showSaveDialog: vi.fn(),
  },
  shell: { openPath: vi.fn(), openExternal: vi.fn() },
  safeStorage: { isEncryptionAvailable: () => false },
}));
import { dialog } from "electron";
import { Service } from "../electron/service";
import { Store } from "../settings/store";
import { uploadSkin } from "../accounts/skins";
let temp: string, service: Service, store: Store;
beforeEach(async () => {
  vi.clearAllMocks();
  temp = await fs.mkdtemp(path.join(os.tmpdir(), "averiq-ipc-"));
  store = new Store(temp);
  await store.load();
  service = new Service(store, {
    isDestroyed: () => false,
    webContents: { send: vi.fn() },
  } as any);
});
afterEach(async () => fs.rm(temp, { recursive: true, force: true }));
it("dispatches real profile and instance operations and persists selection", async () => {
  await service.call("createAccount", { name: "Averiq" });
  await service.call("createInstance", { name: "World", version: "1.21.1" });
  const state = (await service.call("state")) as any;
  expect(state.accounts[0].name).toBe("Averiq");
  expect(state.instances[0].name).toBe("World");
  const fresh = new Store(temp);
  await fresh.load();
  expect(fresh.data.selectedAccount).toBe(state.accounts[0].id);
  expect(fresh.data.selectedInstance).toBe(state.instances[0].id);
});
it("rejects invalid IPC before mutating persisted state", async () => {
  await expect(
    service.call("createAccount", { name: "Averiq", shell: "calc" }),
  ).rejects.toThrow();
  expect(store.data.accounts).toEqual([]);
  await expect(service.call("runCommand", {})).rejects.toThrow(
    "Unknown IPC method",
  );
});
it("requires account and instance before attempting a launch", async () => {
  await expect(service.call("launch")).rejects.toThrow("Select an instance");
  await service.call("createInstance", { name: "World", version: "1.21.1" });
  await expect(service.call("launch")).rejects.toThrow("Select an account");
});
it("does not delete a world when confirmation is declined", async () => {
  await service.call("createInstance", { name: "World", version: "1.21.1" });
  const id = store.data.selectedInstance;
  vi.mocked(dialog.showMessageBox).mockResolvedValueOnce({
    response: 0,
    checkboxChecked: false,
  });
  await service.call("deleteInstance", { id });
  expect(store.data.instances).toHaveLength(1);
});
it("requires secure storage for Microsoft tokens", () => {
  expect(() => service.auth.encrypt("never-store-me")).toThrow(
    "Secure OS credential storage",
  );
});
it("blocks overlapping operations and forwards cancellation", async () => {
  let aborted = false;
  let entered!: () => void;
  const ready = new Promise<void>((r) => (entered = r));
  const work = service.work(
    (signal) =>
      new Promise<void>((resolve) => {
        signal.addEventListener("abort", () => {
          aborted = true;
          resolve();
        });
        entered();
      }),
  );
  await ready;
  await expect(service.work(async () => true)).rejects.toThrow(
    "Another operation",
  );
  await service.call("cancel");
  await work;
  expect(aborted).toBe(true);
  expect(service.operation).toBeUndefined();
});
it("exports and imports instances with isolated worlds using real ZIP bytes", async () => {
  await service.call("createInstance", { name: "World", version: "1.21.1" });
  const id = store.data.selectedInstance;
  const source = path.join(
    store.data.settings.root,
    "instances",
    id,
    "saves",
    "world.dat",
  );
  await fs.writeFile(source, "world data");
  const zip = path.join(temp, "world.zip");
  vi.mocked(dialog.showSaveDialog).mockResolvedValueOnce({
    canceled: false,
    filePath: zip,
  });
  await service.call("exportInstance", { id });
  vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({
    canceled: false,
    filePaths: [zip],
  });
  await service.call("importInstance");
  expect(store.data.instances).toHaveLength(2);
  expect(store.data.selectedInstance).not.toBe(id);
  expect(
    await fs.readFile(
      path.join(
        store.data.settings.root,
        "instances",
        store.data.selectedInstance,
        "saves",
        "world.dat",
      ),
      "utf8",
    ),
  ).toBe("world data");
});
it("rejects archive entries outside the instance data directory", async () => {
  const zip = new AdmZip();
  zip.addFile(
    "averiq-instance.json",
    Buffer.from(JSON.stringify({ name: "World", version: "1.21.1" })),
  );
  zip.addFile("unexpected-file", Buffer.from("bad"));
  const file = path.join(temp, "bad.zip");
  zip.writeZip(file);
  vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({
    canceled: false,
    filePaths: [file],
  });
  await expect(service.call("importInstance")).rejects.toThrow(
    "Unexpected archive",
  );
  expect(store.data.instances).toEqual([]);
});
it("validates skin PNG dimensions before contacting Minecraft", async () => {
  const file = path.join(temp, "not-a-skin.png");
  await fs.writeFile(file, Buffer.alloc(30));
  await expect(uploadSkin(file, "unused", "classic")).rejects.toThrow(
    "Choose a PNG",
  );
  const b = Buffer.alloc(30);
  Buffer.from("89504e470d0a1a0a", "hex").copy(b);
  b.writeUInt32BE(1024, 16);
  b.writeUInt32BE(1024, 20);
  await fs.writeFile(file, b);
  await expect(uploadSkin(file, "unused", "classic")).rejects.toThrow("64×64");
});
