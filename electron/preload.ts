import { contextBridge, ipcRenderer } from "electron";
import { API, Event } from "../shared/types";
const api: API = {
  call: (method, args) => ipcRenderer.invoke("averiq:call", method, args),
  onEvent: (fn) => {
    const handler = (_event: Electron.IpcRendererEvent, data: Event) =>
      fn(data);
    ipcRenderer.on("averiq:event", handler);
    return () => ipcRenderer.removeListener("averiq:event", handler);
  },
};
contextBridge.exposeInMainWorld("averiq", Object.freeze(api));
