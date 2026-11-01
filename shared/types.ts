export interface Account {
  id: string;
  name: string;
  uuid: string;
  type: "offline" | "microsoft";
  skin?: string;
}
export interface Instance {
  id: string;
  name: string;
  version: string;
  loader: "vanilla" | "fabric" | "forge" | "neoforge" | "quilt";
  baseVersion?: string;
  favorite?: boolean;
}
export interface Settings {
  language: "ru" | "en";
  theme: "midnight" | "light";
  root: string;
  javaPath: string;
  minRam: number;
  maxRam: number;
  width: number;
  height: number;
  fullscreen: boolean;
  jvmArgs: string[];
  parallel: number;
  verify: boolean;
  autoUpdate: boolean;
  clientId: string;
}
export interface History {
  instance: string;
  version: string;
  at: string;
  seconds: number;
  exitCode: number | null;
}
export interface State {
  accounts: Account[];
  instances: Instance[];
  selectedAccount: string;
  selectedInstance: string;
  settings: Settings;
  history: History[];
  favoriteVersions: string[];
}
export interface Version {
  id: string;
  type: string;
  url: string;
  releaseTime: string;
  sha1?: string;
}
export interface JavaInfo {
  path: string;
  version: string;
  major: number;
  arch: string;
}
export interface Event {
  type: "log" | "progress" | "status";
  message: string;
  progress?: number;
  total?: number;
}
export interface API {
  call<T = unknown>(method: string, args?: unknown): Promise<T>;
  onEvent(fn: (event: Event) => void): () => void;
}
declare global {
  interface Window {
    averiq: API;
  }
}
