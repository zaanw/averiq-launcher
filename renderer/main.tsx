import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { motion, AnimatePresence } from "motion/react";
import {
  Home,
  Layers,
  Package,
  Blocks,
  Shirt,
  Users,
  Settings as SettingsIcon,
  Terminal,
  Play,
  ChevronDown,
  ArrowDownToLine,
  Plus,
  Search,
  FolderOpen,
  Trash2,
  Copy,
  Star,
  ArrowUpRight,
  Square,
  Minus,
  X,
  RefreshCw,
  ShieldCheck,
  ChevronRight,
  Check,
  Globe,
  SlidersHorizontal,
  AlertTriangle,
} from "lucide-react";
import type {
  State,
  Version,
  JavaInfo,
  Event,
  Settings,
  Instance,
} from "../shared/types";
import "./style.css";
const api = window.averiq;
const pages = [
  ["Home", Home],
  ["Versions", Layers],
  ["Modpacks", Package],
  ["Mods", Blocks],
  ["Skins", Shirt],
  ["Accounts", Users],
  ["Settings", SettingsIcon],
  ["Console", Terminal],
] as const;
const t = {
  ru: {
    ready: "Готов к приключению?",
    subtitle: "Твой мир. Твои правила. Твой следующий горизонт.",
    play: "ИГРАТЬ",
    install: "Установить",
    instance: "Активная сборка",
    account: "Профиль игрока",
    java: "Java runtime",
    recent: "Последние путешествия",
    empty: "Здесь появится история реальных запусков",
    hours: "Время в игре",
    save: "Сохранить настройки",
    create: "Создать",
    search: "Поиск",
    offline: "Локальный профиль",
    login: "Войти через Microsoft",
    choose: "Выбрать",
    noInstance: "Создай свою первую сборку",
    working: "Выполняется операция",
    stop: "Остановить игру",
  },
  en: {
    ready: "Ready for another world?",
    subtitle: "Your world. Your rules. Your next horizon.",
    play: "PLAY",
    install: "Install",
    instance: "Active instance",
    account: "Player profile",
    java: "Java runtime",
    recent: "Recent adventures",
    empty: "Your real launch history will appear here",
    hours: "Time in game",
    save: "Save settings",
    create: "Create",
    search: "Search",
    offline: "Local profile",
    login: "Sign in with Microsoft",
    choose: "Select",
    noInstance: "Create your first instance",
    working: "Operation in progress",
    stop: "Stop game",
  },
};
function App() {
  const [state, setState] = useState<
    State & { running?: boolean; busy?: boolean }
  >();
  const [page, setPage] = useState("Home");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState<Event>();
  const [status, setStatus] = useState("");
  const [allVersions, setVersions] = useState<Version[]>([]);
  const [installed, setInstalled] = useState<string[]>([]);
  const [java, setJava] = useState<JavaInfo[]>([]);
  const [query, setQuery] = useState("");
  const [versionType, setVersionType] = useState("release");
  const [name, setName] = useState("");
  const [chosenVersion, setChosenVersion] = useState("");
  const [draft, setDraft] = useState<Settings>();
  const [modResults, setModResults] = useState<any[]>([]);
  const [local, setLocal] = useState<string[]>([]);
  const [contentType, setContentType] = useState<
    "mod" | "resourcepack" | "shader"
  >("mod");
  const [loader, setLoader] = useState<"fabric" | "quilt">("fabric");
  const [loaders, setLoaders] = useState<
    { version: string; stable: boolean }[]
  >([]);
  const [loaderVersion, setLoaderVersion] = useState("");
  const [project, setProject] = useState<any>();
  const [modal, setModal] = useState<{
    title: string;
    value: string;
    submit: (v: string) => Promise<unknown>;
  } | null>(null);
  const refresh = async () => {
    const s = await api.call<State>("state");
    setState(s);
    setDraft(s.settings);
  };
  const run = async <T,>(
    fn: () => Promise<T>,
    success?: string,
  ): Promise<T | undefined> => {
    setBusy(true);
    setError("");
    try {
      const result = await fn();
      await refresh();
      if (success) setNotice(success);
      return result;
    } catch (e) {
      setError(String(e).replace(/^Error: /, ""));
    } finally {
      setBusy(false);
    }
  };
  const loadInstalled = async () =>
    setInstalled(await api.call<string[]>("installed"));
  useEffect(() => {
    if (!api) {
      setError(
        "Open this application in Electron. The browser cannot access launcher services.",
      );
      return;
    }
    void refresh().catch((e) => setError(String(e)));
    void api
      .call<JavaInfo[]>("java")
      .then(setJava)
      .catch((e) => setError(String(e)));
    void loadInstalled().catch((e) => setError(String(e)));
    return api.onEvent((e) => {
      if (e.type === "log")
        setLogs((list) => [...list, e.message].slice(-1500));
      if (e.type === "progress") setProgress(e);
      if (e.type === "status") {
        setStatus(e.message);
        setNotice(e.message);
        void refresh();
      }
    });
  }, []);
  useEffect(() => {
    setQuery("");
    if (page === "Versions" || page === "Modpacks")
      void run(async () => {
        const result = await api.call<{ versions: Version[]; cached: boolean }>(
          "versions",
        );
        setVersions(result.versions);
        if (result.cached) setNotice("Using cached manifest — offline");
        if (!chosenVersion)
          setChosenVersion(
            result.versions.find((v) => v.type === "release")?.id || "",
          );
        await loadInstalled();
      });
  }, [page]);
  useEffect(() => {
    if (page === "Mods" && state?.selectedInstance)
      void api
        .call<string[]>("localMods", { type: contentType })
        .then(setLocal)
        .catch((e) => setError(String(e)));
  }, [page, contentType, state?.selectedInstance, busy]);
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(""), 10000);
      return () => clearTimeout(timer);
    }
  }, [notice]);
  const tr = t[state?.settings.language || "ru"];
  const instance = state?.instances.find(
    (i) => i.id === state.selectedInstance,
  );
  const account = state?.accounts.find((i) => i.id === state.selectedAccount);
  const blocked = busy || state?.busy;
  const label = (ru: string, en: string) =>
    state?.settings.language === "en" ? en : ru;
  const call = (method: string, args?: unknown, success?: string) =>
    run(() => api.call(method, args), success);
  const rename = (i: Instance) =>
    setModal({
      title: "Rename instance",
      value: i.name,
      submit: (v) => call("renameInstance", { id: i.id, name: v }),
    });
  if (!state)
    return (
      <div className="boot">
        <div className="brandmark">A</div>
        <h1>Averiq Launcher</h1>
        <p>{error || "Loading your workspace…"}</p>
      </div>
    );
  const filtered = allVersions.filter(
    (v) =>
      (versionType === "favorites"
        ? state.favoriteVersions.includes(v.id)
        : versionType === "all" || versionType === "installed"
          ? versionType !== "installed" || installed.includes(v.id)
          : v.type === versionType) &&
      v.id.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className={`app ${state.settings.theme === "light" ? "light" : ""}`}>
      <header className="titlebar">
        <div className="titlebrand">
          <span className="tiny-logo">Λ</span> AVERIQ <span>LAUNCHER</span>
        </div>
        <span className="build-tag">
          JAVA EDITION · {label("ТВОЁ ПРОСТРАНСТВО", "YOUR SPACE")}
        </span>
        <div className="window-controls">
          <button
            aria-label="Minimize"
            onClick={() => void api.call("window", "minimize")}
          >
            <Minus size={15} />
          </button>
          <button
            aria-label="Maximize"
            onClick={() => void api.call("window", "maximize")}
          >
            <Square size={12} />
          </button>
          <button
            className="close"
            aria-label="Close"
            onClick={() => void api.call("window", "close")}
          >
            <X size={17} />
          </button>
        </div>
      </header>
      <aside>
        <div className="brand">
          <div className="brandmark">Λ</div>
          <div>
            <strong>
              Averiq<span>Launcher</span>
            </strong>
            <small>CREATED BY AVERIQ</small>
          </div>
        </div>
        <div className="nav-caption">WORKSPACE</div>
        <nav>
          {pages.map(([p, Icon]) => (
            <button
              key={p}
              className={page === p ? "active" : ""}
              onClick={() => setPage(p)}
            >
              <Icon size={18} />
              {p}
              {p === "Home" && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-status">
            <i />
            {state.running
              ? "Minecraft running"
              : label("Локальное хранилище", "Local workspace")}
          </div>
          <button className="profile-pill" onClick={() => setPage("Accounts")}>
            <div className="avatar">
              {account?.name.slice(0, 2).toUpperCase() || "?"}
            </div>
            <div>
              <strong>
                {account?.name || label("Нет профиля", "No profile")}
              </strong>
              <small>
                {account?.type === "microsoft"
                  ? "Microsoft account"
                  : tr.offline}
              </small>
            </div>
            <ChevronRight size={15} />
          </button>
          <small className="version-note">
            AVERIQ v0.1.0 <span>EARLY RELEASE</span>
          </small>
        </div>
      </aside>
      <main>
        <div className="page-top">
          <div>
            <span className="eyebrow">YOUR MINECRAFT, REIMAGINED</span>
            <h1>
              {page === "Home"
                ? label("Начни своё приключение", "Make yourself at home")
                : page}
            </h1>
          </div>
          <button
            className="icon-button"
            aria-label="Open settings"
            onClick={() => setPage("Settings")}
          >
            <SlidersHorizontal size={19} />
          </button>
        </div>
        {error && (
          <div role="alert" className="error">
            <AlertTriangle size={18} />
            <span>{error}</span>
            <button aria-label="Dismiss error" onClick={() => setError("")}>
              <X size={16} />
            </button>
          </div>
        )}
        <AnimatePresence mode="wait">
          <motion.div
            key={page}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.18 }}
          >
            {page === "Home" && (
              <>
                <section className="hero">
                  <div className="hero-stars" />
                  <div className="moon" />
                  <div className="mountain m-back" />
                  <div className="mountain m-mid" />
                  <div className="mountain m-front" />
                  <div className="voxel v1" />
                  <div className="voxel v2" />
                  <div className="hero-content">
                    <div className="tag">
                      <span /> A NEW WORLD AWAITS
                    </div>
                    <h2>{tr.ready}</h2>
                    <p>{tr.subtitle}</p>
                    <div className="hero-meta">
                      <span>
                        <Layers size={14} />
                        {instance?.version || "Minecraft Java Edition"}
                      </span>
                      <span>
                        <ShieldCheck size={14} />
                        {instance?.loader || "Vanilla"}
                      </span>
                    </div>
                  </div>
                  <div className="hero-number">
                    01<span>/ INFINITE POSSIBILITIES</span>
                  </div>
                </section>
                <section className="launch-panel">
                  <div className="instance-icon">
                    <Package size={27} />
                  </div>
                  <div className="launch-selection">
                    <small>{tr.instance}</small>
                    <select
                      aria-label="Active instance"
                      value={state.selectedInstance}
                      onChange={(e) =>
                        void call("selectInstance", { id: e.target.value })
                      }
                    >
                      <option value="" disabled>
                        {tr.noInstance}
                      </option>
                      {state.instances.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name}
                        </option>
                      ))}
                    </select>
                    <span>
                      {instance
                        ? `${instance.loader.toUpperCase()} · ${instance.version}`
                        : label(
                            "Modpacks → Создать сборку",
                            "Modpacks → Create instance",
                          )}
                    </span>
                  </div>
                  <div className="launch-runtime">
                    <small>{tr.java}</small>
                    <strong>
                      <i />
                      {java.length
                        ? `Java ${java[0].major}`
                        : label("Не обнаружена", "Not detected")}
                    </strong>
                    <span>
                      {(state.settings.maxRam / 1024).toFixed(1)} GB RAM
                      allocated
                    </span>
                  </div>
                  <button
                    className="play-button"
                    disabled={!!blocked || !instance || !account}
                    onClick={() => void call(state.running ? "stop" : "launch")}
                  >
                    <Play size={22} fill="currentColor" />
                    {state.running ? tr.stop : tr.play}
                    <ChevronRight size={19} />
                  </button>
                </section>
                <div className="home-grid">
                  <section className="panel">
                    <div className="section-head">
                      <h3>{tr.recent}</h3>
                      <button
                        className="text-button"
                        onClick={() => setPage("Console")}
                      >
                        {label("Консоль", "Console")}
                        <ArrowUpRight size={14} />
                      </button>
                    </div>
                    {state.history.length ? (
                      state.history.slice(0, 3).map((h, i) => (
                        <div className="history-row" key={i}>
                          <div className="history-icon">
                            <Layers size={19} />
                          </div>
                          <div>
                            <strong>{h.instance}</strong>
                            <small>
                              {h.version} ·{" "}
                              {new Date(h.at).toLocaleString(
                                state.settings.language,
                              )}
                            </small>
                          </div>
                          <span>{Math.round(h.seconds / 60)} min</span>
                          <i
                            className={h.exitCode === 0 ? "ok-dot" : "bad-dot"}
                          />
                        </div>
                      ))
                    ) : (
                      <div className="empty">
                        <Globe size={28} />
                        <p>{tr.empty}</p>
                        <button
                          className="text-button"
                          onClick={() => setPage("Modpacks")}
                        >
                          {tr.create}
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    )}
                  </section>
                  <section className="panel stats">
                    <div className="stats-icon">
                      <Globe size={22} />
                    </div>
                    <small>{tr.hours}</small>
                    <strong>
                      {(
                        state.history.reduce((v, h) => v + h.seconds, 0) / 3600
                      ).toFixed(1)}
                      <span> hrs</span>
                    </strong>
                    <div className="stats-line" />
                    <p>
                      {state.history.length}{" "}
                      {label(
                        "запусков · все твои миры",
                        "launches · across your worlds",
                      )}
                    </p>
                  </section>
                </div>
                <div className="bottom-note">
                  <ShieldCheck size={15} />
                  {label(
                    "Игровые файлы загружаются из официальных источников",
                    "Game files are downloaded from official sources",
                  )}
                  <span>MINECRAFT JAVA EDITION</span>
                </div>
              </>
            )}
            {page === "Versions" && (
              <>
                <div className="toolbar">
                  <div className="search">
                    <Search size={17} />
                    <input
                      placeholder={tr.search}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                  <select
                    value={versionType}
                    onChange={(e) => setVersionType(e.target.value)}
                  >
                    <option value="release">Release</option>
                    <option value="snapshot">Snapshot</option>
                    <option value="all">All / historical</option>
                    <option value="installed">Installed</option>
                    <option value="favorites">Favorites</option>
                  </select>
                  <button
                    onClick={() =>
                      void run(async () => {
                        setVersions(
                          (await api.call<{ versions: Version[] }>("versions"))
                            .versions,
                        );
                        await loadInstalled();
                      })
                    }
                  >
                    <RefreshCw size={16} />
                  </button>
                </div>
                <div className="panel list-scroll">
                  {filtered.slice(0, 150).map((v) => (
                    <div className="version-row" key={v.id}>
                      <button
                        title="Favorite version"
                        onClick={() =>
                          void call("favoriteVersion", { version: v.id })
                        }
                      >
                        <Star
                          size={16}
                          fill={
                            state.favoriteVersions.includes(v.id)
                              ? "currentColor"
                              : "none"
                          }
                        />
                      </button>
                      <div className={`version-icon ${v.type}`}>
                        <Layers size={19} />
                      </div>
                      <div className="grow">
                        <strong>{v.id}</strong>
                        <small>
                          {v.type} ·{" "}
                          {new Date(v.releaseTime).toLocaleDateString()}
                        </small>
                      </div>
                      {installed.includes(v.id) ? (
                        <>
                          <span className="badge">
                            <Check size={12} />
                            Installed
                          </span>
                          <button
                            disabled={!!blocked}
                            title="Diagnose files"
                            onClick={() =>
                              void run(async () => {
                                const report = await api.call<{
                                  issues: unknown[];
                                }>("diagnose", { version: v.id });
                                setNotice(
                                  report.issues.length +
                                    " missing/corrupted files",
                                );
                              })
                            }
                          >
                            <ShieldCheck size={15} />
                          </button>
                          <button
                            disabled={!!blocked}
                            title="Repair"
                            onClick={() =>
                              void run(async () => {
                                await api.call("repair", { version: v.id });
                                await loadInstalled();
                              }, "Repair complete")
                            }
                          >
                            <RefreshCw size={15} />
                          </button>
                          <button
                            title="Delete version"
                            onClick={() =>
                              void run(async () => {
                                await api.call("deleteVersion", {
                                  version: v.id,
                                });
                                await loadInstalled();
                              })
                            }
                          >
                            <Trash2 size={15} />
                          </button>
                        </>
                      ) : (
                        <button
                          disabled={!!blocked}
                          onClick={() =>
                            void run(async () => {
                              await api.call("install", { version: v.id });
                              await loadInstalled();
                            }, "Installation complete")
                          }
                        >
                          <ArrowDownToLine size={15} />
                          {tr.install}
                        </button>
                      )}
                    </div>
                  ))}
                  {!filtered.length && (
                    <div className="empty">
                      {label(
                        "Нет версий. Проверьте сообщение об ошибке или обновите список.",
                        "No versions. Check errors or refresh.",
                      )}
                    </div>
                  )}
                </div>
                {installed
                  .filter((id) => !allVersions.some((v) => v.id === id))
                  .map((id) => (
                    <div className="version-row panel" key={id}>
                      <Layers size={18} />
                      <strong className="grow">{id}</strong>
                      <button
                        onClick={() =>
                          void call("diagnose", { version: id }).then(
                            (r) => r && setNotice(JSON.stringify(r)),
                          )
                        }
                      >
                        Diagnose
                      </button>
                      <button
                        onClick={() => void call("repair", { version: id })}
                      >
                        Repair
                      </button>
                    </div>
                  ))}
              </>
            )}
            {page === "Modpacks" && (
              <>
                <p className="subheading">
                  {label(
                    "Каждая сборка — отдельные миры, моды и настройки.",
                    "Separate worlds, mods and settings for every instance.",
                  )}
                </p>
                <section className="panel form-row">
                  <input
                    aria-label="Instance name"
                    placeholder={label("Название сборки", "Instance name")}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <select
                    aria-label="Minecraft version"
                    value={chosenVersion}
                    onChange={(e) => setChosenVersion(e.target.value)}
                  >
                    {allVersions.map((v) => (
                      <option key={v.id}>{v.id}</option>
                    ))}
                  </select>
                  <button
                    className="primary"
                    disabled={!name || !chosenVersion || !!blocked}
                    onClick={() =>
                      void call(
                        "createInstance",
                        { name, version: chosenVersion },
                        "Instance created",
                      )
                    }
                  >
                    <Plus size={16} />
                    {tr.create}
                  </button>
                  <button
                    title="Import Averiq ZIP"
                    onClick={() => void call("importInstance")}
                  >
                    <ArrowDownToLine size={16} />
                    Import
                  </button>
                </section>
                <div className="instance-grid">
                  {state.instances.map((i) => (
                    <section
                      className={`panel instance-card ${i.id === instance?.id ? "selected" : ""}`}
                      key={i.id}
                    >
                      <div className="instance-art">
                        <Package size={38} />
                        <button
                          title="Favorite"
                          onClick={() => void call("favorite", { id: i.id })}
                        >
                          <Star
                            size={17}
                            fill={i.favorite ? "currentColor" : "none"}
                          />
                        </button>
                      </div>
                      <h3>{i.name}</h3>
                      <p>
                        {i.version} · {i.loader}
                      </p>
                      <div className="card-actions">
                        <button
                          className="primary"
                          onClick={() =>
                            void call("selectInstance", { id: i.id })
                          }
                        >
                          {i.id === instance?.id ? (
                            <Check size={15} />
                          ) : (
                            <Play size={15} />
                          )}{" "}
                          {tr.choose}
                        </button>
                        <button title="Rename" onClick={() => rename(i)}>
                          <SlidersHorizontal size={15} />
                        </button>
                        <button
                          title="Open folder"
                          onClick={() =>
                            void call("openInstance", { id: i.id })
                          }
                        >
                          <FolderOpen size={15} />
                        </button>
                        <button
                          title="Duplicate"
                          onClick={() =>
                            void call("duplicateInstance", { id: i.id })
                          }
                        >
                          <Copy size={15} />
                        </button>
                        <button
                          title="Export"
                          onClick={() =>
                            void call("exportInstance", { id: i.id })
                          }
                        >
                          <ArrowUpRight size={15} />
                        </button>
                        <button
                          title="Delete"
                          onClick={() =>
                            void call("deleteInstance", { id: i.id })
                          }
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </section>
                  ))}
                </div>
                {instance && (
                  <section className="panel loader-panel">
                    <div>
                      <h3>Mod loader</h3>
                      <p>
                        {label(
                          "Forge / NeoForge пока недоступны: не проверен запуск.",
                          "Forge / NeoForge unavailable: launch is not validated.",
                        )}
                      </p>
                    </div>
                    <div className="form-row">
                      <select
                        value={loader}
                        onChange={(e) => {
                          setLoader(e.target.value as any);
                          setLoaders([]);
                          setLoaderVersion("");
                        }}
                      >
                        <option value="fabric">Fabric</option>
                        <option value="quilt">Quilt</option>
                      </select>
                      <button
                        onClick={() =>
                          void run(async () => {
                            const list = await api.call<
                              { version: string; stable: boolean }[]
                            >("loaders", {
                              loader,
                              version: instance.baseVersion || instance.version,
                            });
                            setLoaders(list);
                            setLoaderVersion(list[0]?.version || "");
                          })
                        }
                      >
                        Load versions
                      </button>
                      <select
                        value={loaderVersion}
                        onChange={(e) => setLoaderVersion(e.target.value)}
                      >
                        <option value="" disabled>
                          Select loader
                        </option>
                        {loaders.map((l) => (
                          <option key={l.version}>{l.version}</option>
                        ))}
                      </select>
                      <button
                        disabled={!loaderVersion || !!blocked}
                        onClick={() =>
                          void call(
                            "installLoader",
                            { loader, version: loaderVersion },
                            "Loader installed",
                          )
                        }
                      >
                        {tr.install}
                      </button>
                    </div>
                  </section>
                )}
              </>
            )}
            {page === "Accounts" && (
              <>
                <div className="accounts-heading">
                  <h2>{tr.account}</h2>
                  <p>
                    {label(
                      "Microsoft — лицензированный аккаунт. Локальный профиль — только для совместимой установленной игры; он не даёт права владения и не авторизует на серверах.",
                      "Microsoft is a licensed account. A local profile is for compatible installed games; it does not grant ownership or authenticate to servers.",
                    )}
                  </p>
                </div>
                <section className="panel form-row">
                  <input
                    aria-label="Minecraft nickname"
                    placeholder="Minecraft nickname"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <button
                    className="primary"
                    disabled={!!blocked || !name}
                    onClick={() => void call("createAccount", { name })}
                  >
                    <Plus size={16} />
                    {tr.offline}
                  </button>
                  <button
                    disabled={!!blocked}
                    onClick={() => void call("login")}
                  >
                    <Globe size={16} />
                    {tr.login}
                  </button>
                </section>
                {state.accounts.map((a) => (
                  <div key={a.id} className="panel account-row">
                    <div className="avatar large">
                      {a.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="grow">
                      <h3>{a.name}</h3>
                      <small>
                        {a.type === "microsoft"
                          ? "MICROSOFT · MINECRAFT JAVA"
                          : tr.offline}{" "}
                        · {a.uuid}
                      </small>
                    </div>
                    <button
                      className={a.id === account?.id ? "primary" : ""}
                      onClick={() => void call("selectAccount", { id: a.id })}
                    >
                      {a.id === account?.id ? <Check size={16} /> : tr.choose}
                    </button>
                    {a.type === "offline" && (
                      <button
                        onClick={() =>
                          setModal({
                            title:
                              "Rename local profile (UUID changes with nickname)",
                            value: a.name,
                            submit: (v) =>
                              call("renameAccount", { id: a.id, name: v }),
                          })
                        }
                      >
                        Rename
                      </button>
                    )}
                    <button
                      title="Remove / sign out"
                      onClick={() => void call("removeAccount", { id: a.id })}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                ))}
              </>
            )}
            {page === "Mods" && (
              <>
                <div className="toolbar">
                  <div className="search">
                    <Search size={17} />
                    <input
                      placeholder="Search Modrinth"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                  <select
                    value={contentType}
                    onChange={(e) => {
                      setContentType(e.target.value as any);
                      setModResults([]);
                    }}
                  >
                    <option value="mod">Mods</option>
                    <option value="resourcepack">Resource packs</option>
                    <option value="shader">Shaders (requires Iris)</option>
                  </select>
                  <button
                    className="primary"
                    disabled={!instance || !!blocked}
                    onClick={() =>
                      void run(async () => {
                        const r = await api.call<{ hits: any[] }>(
                          "searchMods",
                          { query, type: contentType },
                        );
                        setModResults(r.hits);
                      })
                    }
                  >
                    {tr.search}
                  </button>
                </div>
                <p className="subheading">
                  {instance
                    ? `${instance.name} · ${instance.baseVersion || instance.version} · ${instance.loader}`
                    : tr.noInstance}
                </p>
                <div className="mods-grid">
                  {modResults.map((m) => (
                    <section className="panel mod-card" key={m.project_id}>
                      <div className="mod-heading">
                        {m.icon_url ? (
                          <img src={m.icon_url} alt="" />
                        ) : (
                          <Blocks />
                        )}
                        <div>
                          <h3>{m.title}</h3>
                          <small>
                            {m.author} · {m.downloads.toLocaleString()}{" "}
                            downloads
                          </small>
                        </div>
                      </div>
                      <p>{m.description}</p>
                      <div className="form-row">
                        <button
                          onClick={() =>
                            void run(async () =>
                              setProject(
                                await api.call("project", { id: m.project_id }),
                              ),
                            )
                          }
                        >
                          Details
                        </button>
                        <button
                          className="primary"
                          disabled={!!blocked}
                          onClick={() =>
                            void call(
                              "installMod",
                              { id: m.project_id, type: contentType },
                              "Installed with required dependencies",
                            )
                          }
                        >
                          <Plus size={15} />
                          Install / update
                        </button>
                      </div>
                    </section>
                  ))}
                </div>
                <section className="panel">
                  <h3>{label("Установленные файлы", "Installed files")}</h3>
                  {local.map((f) => (
                    <div className="version-row" key={f}>
                      <Blocks size={17} />
                      <span className="grow">{f}</span>
                      <button
                        title="Delete file"
                        onClick={() =>
                          void call("removeMod", { name: f, type: contentType })
                        }
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                  {!local.length && (
                    <p className="muted">
                      {label("Файлов пока нет", "No files yet")}
                    </p>
                  )}
                  <p className="muted">
                    {label(
                      "Обновление: найдите проект и нажмите Install / update.",
                      "To update, find the project and select Install / update.",
                    )}
                  </p>
                </section>
              </>
            )}
            {page === "Skins" && (
              <section className="panel skin-panel">
                <div className="skin-display">
                  {account?.skin ? (
                    <img
                      src={account.skin}
                      alt="Official Minecraft skin texture"
                    />
                  ) : (
                    <Shirt size={90} />
                  )}
                </div>
                <div>
                  <span className="eyebrow">PLAYER IDENTITY</span>
                  <h2>{account?.name || "No account selected"}</h2>
                  <p>
                    {label(
                      "Показан скин официального Microsoft-профиля. Загрузите PNG 64×64/64×32 или используйте официальный сайт Minecraft. Локальные профили не загружают скины на серверы.",
                      "Displays the official Microsoft profile skin. Upload a 64×64/64×32 PNG or use the official Minecraft website. Local profiles do not upload skins to servers.",
                    )}
                  </p>
                  <button onClick={() => setPage("Accounts")}>
                    {tr.account}
                    <ChevronRight size={15} />
                  </button>
                  {account?.type === "microsoft" && (
                    <div className="form-row">
                      <button
                        disabled={!!blocked}
                        onClick={() =>
                          void call(
                            "uploadSkin",
                            { variant: "classic" },
                            "Skin uploaded",
                          )
                        }
                      >
                        Upload classic PNG
                      </button>
                      <button
                        disabled={!!blocked}
                        onClick={() =>
                          void call(
                            "uploadSkin",
                            { variant: "slim" },
                            "Skin uploaded",
                          )
                        }
                      >
                        Upload slim PNG
                      </button>
                      <button
                        disabled={!!blocked}
                        onClick={() =>
                          void call("resetSkin", undefined, "Skin reset")
                        }
                      >
                        Reset
                      </button>
                    </div>
                  )}
                  <p className="muted">
                    minecraft.net → My games → Java Edition → Change skin
                  </p>
                </div>
              </section>
            )}
            {page === "Settings" && draft && (
              <>
                <div className="settings-grid">
                  <section className="panel">
                    <h3>{label("Внешний вид", "Appearance")}</h3>
                    <label>
                      Language
                      <select
                        value={draft.language}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            language: e.target.value as any,
                          })
                        }
                      >
                        <option value="ru">Русский</option>
                        <option value="en">English</option>
                      </select>
                    </label>
                    <label>
                      Theme
                      <select
                        value={draft.theme}
                        onChange={(e) =>
                          setDraft({ ...draft, theme: e.target.value as any })
                        }
                      >
                        <option value="midnight">Midnight</option>
                        <option value="light">Light</option>
                      </select>
                    </label>
                    <h3>Minecraft window</h3>
                    <div className="form-row">
                      <label>
                        Width
                        <input
                          type="number"
                          value={draft.width}
                          onChange={(e) =>
                            setDraft({ ...draft, width: +e.target.value })
                          }
                        />
                      </label>
                      <label>
                        Height
                        <input
                          type="number"
                          value={draft.height}
                          onChange={(e) =>
                            setDraft({ ...draft, height: +e.target.value })
                          }
                        />
                      </label>
                    </div>
                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={draft.fullscreen}
                        onChange={(e) =>
                          setDraft({ ...draft, fullscreen: e.target.checked })
                        }
                      />
                      Fullscreen
                    </label>
                  </section>
                  <section className="panel">
                    <h3>Java & memory</h3>
                    <label>
                      Java executable
                      <div className="form-row">
                        <input
                          value={draft.javaPath}
                          placeholder="Auto detect"
                          onChange={(e) =>
                            setDraft({ ...draft, javaPath: e.target.value })
                          }
                        />
                        <button
                          onClick={() =>
                            void api
                              .call<string | null>("pickJava")
                              .then(
                                (p) => p && setDraft({ ...draft, javaPath: p }),
                              )
                              .catch((e) => setError(String(e)))
                          }
                        >
                          <FolderOpen size={16} />
                        </button>
                      </div>
                    </label>
                    <div className="form-row">
                      <label>
                        Min RAM (MiB)
                        <input
                          type="number"
                          value={draft.minRam}
                          onChange={(e) =>
                            setDraft({ ...draft, minRam: +e.target.value })
                          }
                        />
                      </label>
                      <label>
                        Max RAM (MiB)
                        <input
                          type="number"
                          value={draft.maxRam}
                          onChange={(e) =>
                            setDraft({ ...draft, maxRam: +e.target.value })
                          }
                        />
                      </label>
                    </div>
                    <label>
                      JVM tuning arguments
                      <input
                        value={draft.jvmArgs.join(" ")}
                        placeholder="-XX:+UseG1GC"
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            jvmArgs: e.target.value
                              .split(/\s+/)
                              .filter(Boolean),
                          })
                        }
                      />
                    </label>
                    <button
                      onClick={() =>
                        void run(async () =>
                          setJava(await api.call<JavaInfo[]>("java")),
                        )
                      }
                    >
                      Discover Java
                    </button>
                    {java.map((j, i) => (
                      <small className="java-item" key={i}>
                        Java {j.version} · {j.arch}
                        <br />
                        {j.path}
                      </small>
                    ))}
                  </section>
                  <section className="panel">
                    <h3>Storage & downloads</h3>
                    <label>
                      Minecraft root
                      <div className="form-row">
                        <input
                          value={draft.root}
                          onChange={(e) =>
                            setDraft({ ...draft, root: e.target.value })
                          }
                        />
                        <button
                          onClick={() =>
                            void api
                              .call<string | null>("pickRoot")
                              .then((p) => p && setDraft({ ...draft, root: p }))
                              .catch((e) => setError(String(e)))
                          }
                        >
                          <FolderOpen size={16} />
                        </button>
                      </div>
                    </label>
                    <label>
                      Parallel downloads
                      <input
                        type="number"
                        min="1"
                        max="16"
                        value={draft.parallel}
                        onChange={(e) =>
                          setDraft({ ...draft, parallel: +e.target.value })
                        }
                      />
                    </label>
                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={draft.verify}
                        onChange={(e) =>
                          setDraft({ ...draft, verify: e.target.checked })
                        }
                      />
                      Verify files before launch
                    </label>
                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={draft.autoUpdate}
                        onChange={(e) =>
                          setDraft({ ...draft, autoUpdate: e.target.checked })
                        }
                      />
                      Check launcher updates at startup
                    </label>
                  </section>
                  <section className="panel">
                    <h3>Microsoft authentication</h3>
                    <p className="muted">
                      {label(
                        "Public Client ID зарегистрированного приложения Microsoft с разрешённым Device Code Flow и доступом к Xbox/Minecraft API. Это не пароль.",
                        "Registered Microsoft public Client ID with device code flow and Xbox/Minecraft API access. This is not a password.",
                      )}
                    </p>
                    <label>
                      Client ID
                      <input
                        value={draft.clientId}
                        onChange={(e) =>
                          setDraft({ ...draft, clientId: e.target.value })
                        }
                      />
                    </label>
                    <button
                      onClick={() =>
                        void run(async () => {
                          const r = await api.call<{ version: string }>(
                            "update",
                          );
                          setNotice("Latest release: " + r.version);
                        })
                      }
                    >
                      <RefreshCw size={15} />
                      Check launcher updates
                    </button>
                  </section>
                </div>
                <button
                  className="primary save-settings"
                  disabled={!!blocked}
                  onClick={() => void call("settings", draft, "Settings saved")}
                >
                  <Check size={17} />
                  {tr.save}
                </button>
              </>
            )}
            {page === "Console" && (
              <>
                <div className="toolbar">
                  <span className="grow">
                    {status || "Minecraft process output"}
                  </span>
                  <button onClick={() => setLogs([])}>Clear view</button>
                  <button onClick={() => void call("exportLogs")}>
                    <ArrowUpRight size={16} />
                    Export logs
                  </button>
                  {state.running && (
                    <button onClick={() => void call("stop")}>
                      <Square size={14} />
                      Stop
                    </button>
                  )}
                </div>
                <pre className="console">
                  {logs.length
                    ? logs.join("\n")
                    : label(
                        "Логи появятся после реального запуска или операции.",
                        "Logs appear after a real launch or operation.",
                      )}
                </pre>
                <div className="panel">
                  <h3>Diagnostics</h3>
                  <p className="muted">
                    {label(
                      "Для проверки SHA-1 игры, библиотек и assets откройте Versions → Diagnose. Repair загрузит повреждённые файлы заново.",
                      "Use Versions → Diagnose to verify game, library and asset SHA-1 hashes. Repair downloads damaged files again.",
                    )}
                  </p>
                  <button onClick={() => setPage("Versions")}>
                    <ShieldCheck size={15} />
                    Versions & repair
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
        {((progress?.total || 0) > 0 || blocked) && (
          <div className="operation">
            <div>
              <ArrowDownToLine size={16} />
              <strong>{tr.working}</strong>
              <span>{progress?.message}</span>
              <button
                onClick={() =>
                  void api.call("cancel").catch((e) => setError(String(e)))
                }
              >
                Cancel
              </button>
            </div>
            {!!progress?.total && (
              <>
                <progress max={progress.total} value={progress.progress || 0} />
                <small>
                  {((progress.progress || 0) / 1048576).toFixed(1)} /{" "}
                  {(progress.total / 1048576).toFixed(1)} MiB verified
                </small>
              </>
            )}
          </div>
        )}
      </main>
      <AnimatePresence>
        {notice && (
          <motion.div
            role="status"
            className="toast"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <Check size={18} />
            <span>{notice}</span>
            <button onClick={() => setNotice("")}>
              <X size={15} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      {modal && (
        <div className="modal-backdrop">
          <form
            className="panel modal"
            onSubmit={(e) => {
              e.preventDefault();
              void modal.submit(modal.value).then(() => setModal(null));
            }}
          >
            <h3>{modal.title}</h3>
            <input
              autoFocus
              value={modal.value}
              onChange={(e) => setModal({ ...modal, value: e.target.value })}
            />
            <div className="form-row">
              <button type="button" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button className="primary" type="submit">
                Save
              </button>
            </div>
          </form>
        </div>
      )}
      {project && (
        <div className="modal-backdrop">
          <section className="panel modal project-modal">
            <div className="section-head">
              <h2>{project.title}</h2>
              <button onClick={() => setProject(undefined)}>
                <X size={18} />
              </button>
            </div>
            <p>{project.description}</p>
            {project.gallery?.slice(0, 3).map((g: any) => (
              <img key={g.url} src={g.url} alt={g.title || project.title} />
            ))}
            <pre>{project.body}</pre>
          </section>
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
