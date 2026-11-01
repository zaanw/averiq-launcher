import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Store } from "../settings/store";
import { Service } from "./service";
import { redact } from "../core/security";
let window: BrowserWindow;
let service: Service;
const dev = process.env.AVERIQ_DEV === "1" && !app.isPackaged;
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => {
    window?.show();
    window?.focus();
  });
  app
    .whenReady()
    .then(async () => {
      const store = new Store(app.getPath("userData"));
      await store.load();
      window = new BrowserWindow({
        width: 1150,
        height: 720,
        minWidth: 960,
        minHeight: 640,
        backgroundColor: "#090B12",
        frame: false,
        icon: path.join(__dirname, "../../resources/icon.png"),
        webPreferences: {
          preload: path.join(__dirname, "preload.js"),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          webSecurity: true,
        },
      });
      service = new Service(store, window);
      const trusted = (event: Electron.IpcMainInvokeEvent) => {
        const url = event.senderFrame?.url || "";
        if (
          event.sender !== window.webContents ||
          event.senderFrame !== window.webContents.mainFrame ||
          !(dev
            ? url.startsWith("http://127.0.0.1:5173/")
            : url ===
              pathToFileURL(path.join(__dirname, "../../dist/index.html")).href)
        )
          throw new Error("Untrusted IPC sender");
      };
      ipcMain.handle("averiq:call", async (event, method, args) => {
        trusted(event);
        if (method === "window") {
          if (!["minimize", "maximize", "close"].includes(args))
            throw new Error("Invalid window action");
          if (args === "minimize") window.minimize();
          if (args === "maximize") {
            if (window.isMaximized()) window.unmaximize();
            else window.maximize();
          }
          if (args === "close") window.close();
          return;
        }
        try {
          return await service.call(method, args);
        } catch (e) {
          const message = redact(
            e instanceof Error ? e.message : JSON.stringify(e),
          );
          service.emit({ type: "log", message });
          throw new Error(message);
        }
      });
      window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
      window.webContents.on("will-navigate", (event, url) => {
        if (url !== window.webContents.getURL()) event.preventDefault();
      });
      window.webContents.session.setPermissionRequestHandler(
        (_wc, _permission, callback) => callback(false),
      );
      window.on("close", (event) => {
        if (service.runner.process || service.operation) {
          const choice = dialog.showMessageBoxSync(window, {
            type: "question",
            message: "Minecraft or a download is running. Stop and close?",
            buttons: ["Keep open", "Stop and close"],
            defaultId: 0,
            cancelId: 0,
          });
          if (choice === 0) {
            event.preventDefault();
            return;
          }
          service.operation?.abort();
          service.runner.process?.kill();
        }
        void service.logs.persist();
      });
      if (dev) await window.loadURL("http://127.0.0.1:5173");
      else await window.loadFile(path.join(__dirname, "../../dist/index.html"));
      if (store.data.settings.autoUpdate)
        void service
          .call("update")
          .then((r: any) => {
            if (r.version.replace(/^v/, "") !== app.getVersion())
              service.emit({
                type: "status",
                message: "Launcher update available: " + r.version,
              });
          })
          .catch((e) =>
            service.emit({
              type: "log",
              message: "Update check: " + e.message,
            }),
          );
    })
    .catch((e) => {
      dialog.showErrorBox("Averiq startup failed", String(e));
      app.quit();
    });
  app.on("window-all-closed", () => app.quit());
}
