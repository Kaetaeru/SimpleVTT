/**
 * App state: the store (IndexedDB or memory), the catalog rebuilt from installed modules, the character list and a
 * hash router (#/, #/new, #/edit/<id>, #/sheet/<id>, #/contents) so a reload keeps the screen.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createCatalog } from "../catalog";
import type { ContentCatalog } from "../catalog/catalog";
import type { RuleModuleJson } from "../catalog/types";
import type { CharacterRuntime } from "../character/runtime";
import { resolveRuntime } from "../character/save";
import type { CharacterSource } from "../character/types";
import { openClientStore, type CharacterRecord, type ClientStore, type InstalledModuleRecord } from "../storage/store";

export type Route =
  | { screen: "library" }
  | { screen: "new" }
  | { screen: "edit"; id: string }
  | { screen: "sheet"; id: string }
  | { screen: "levelup"; id: string }
  | { screen: "campaigns" }
  | { screen: "campaign"; id: string }
  | { screen: "table" }
  | { screen: "contents" };

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, "").split("?")[0];
  const parts = path.split("/").filter(Boolean);
  if (parts[0] === "new") return { screen: "new" };
  if (parts[0] === "edit" && parts[1]) return { screen: "edit", id: decodeURIComponent(parts[1]) };
  if (parts[0] === "sheet" && parts[1]) return { screen: "sheet", id: decodeURIComponent(parts[1]) };
  if (parts[0] === "levelup" && parts[1]) return { screen: "levelup", id: decodeURIComponent(parts[1]) };
  if (parts[0] === "contents") return { screen: "contents" };
  if (parts[0] === "campaigns") return { screen: "campaigns" };
  if (parts[0] === "campaign" && parts[1]) return { screen: "campaign", id: decodeURIComponent(parts[1]) };
  if (parts[0] === "table") return { screen: "table" };
  return { screen: "library" };
}

export function routeHash(route: Route) {
  switch (route.screen) {
    case "new": return "#/new";
    case "edit": return `#/edit/${encodeURIComponent(route.id)}`;
    case "sheet": return `#/sheet/${encodeURIComponent(route.id)}`;
    case "levelup": return `#/levelup/${encodeURIComponent(route.id)}`;
    case "contents": return "#/contents";
    case "campaigns": return "#/campaigns";
    case "campaign": return `#/campaign/${encodeURIComponent(route.id)}`;
    case "table": return "#/table";
    default: return "#/";
  }
}

export interface ClientState {
  ready: boolean;
  store: ClientStore | null;
  catalog: ContentCatalog;
  modules: InstalledModuleRecord[];
  characters: CharacterRecord[];
  route: Route;
  theme: "dark" | "light";
  navigate: (route: Route) => void;
  setTheme: (theme: "dark" | "light") => void;
  /** Save a source with its runtime. Pass an updater to build the runtime from the stored one (safe after an await). */
  saveCharacter: (source: CharacterSource, runtime?: CharacterRuntime | ((current: CharacterRuntime) => CharacterRuntime)) => Promise<CharacterRecord>;
  deleteCharacter: (id: string) => Promise<void>;
  installModule: (module: RuleModuleJson, fileName?: string) => Promise<void>;
  removeModule: (moduleId: string) => Promise<void>;
  getDraft: () => Promise<CharacterSource | undefined>;
  putDraft: (source: CharacterSource | undefined) => Promise<void>;
}

const ClientContext = createContext<ClientState | null>(null);

export function ClientProvider({ children, store: presetStore, initialRoute }: { children: ReactNode; store?: ClientStore; initialRoute?: Route }) {
  const [store, setStore] = useState<ClientStore | null>(presetStore ?? null);
  const [modules, setModules] = useState<InstalledModuleRecord[]>([]);
  const [characters, setCharacters] = useState<CharacterRecord[]>([]);
  const [ready, setReady] = useState(false);
  const [theme, setThemeState] = useState<"dark" | "light">("dark");
  const [route, setRoute] = useState<Route>(() => initialRoute ?? (typeof location === "undefined" ? { screen: "library" } : parseRoute(location.hash)));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const opened = presetStore ?? (await openClientStore());
      if (cancelled) return;
      setStore(opened);
      const [moduleRows, characterRows, savedTheme] = await Promise.all([opened.listModules(), opened.listCharacters(), opened.getSetting<"dark" | "light">("theme")]);
      if (cancelled) return;
      setModules(moduleRows);
      setCharacters(characterRows);
      if (savedTheme) setThemeState(savedTheme);
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, [presetStore]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onHash = () => setRoute(parseRoute(location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const catalog = useMemo(() => createCatalog(modules.map((row) => row.module)), [modules]);

  const navigate = useCallback((next: Route) => {
    if (typeof location !== "undefined") { location.hash = routeHash(next); }
    setRoute(next);
  }, []);

  const setTheme = useCallback((next: "dark" | "light") => { setThemeState(next); void store?.putSetting("theme", next); }, [store]);

  // Saves run one after another: each reads the stored runtime after the previous write, so an updater never
  // works from a stale runtime (a roll settling while the HP box was used in the meantime).
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const saveCharacter = useCallback((source: CharacterSource, runtime?: CharacterRuntime | ((current: CharacterRuntime) => CharacterRuntime)) => {
    const run = async () => {
      if (!store) throw new Error("store not ready");
      const existing = await store.getCharacter(source.id);
      const nextRuntime = resolveRuntime(source, catalog, existing?.runtime, runtime);
      const record: CharacterRecord = { id: source.id, source, runtime: nextRuntime, savedAt: new Date().toISOString() };
      await store.putCharacter(record);
      setCharacters(await store.listCharacters());
      return record;
    };
    const next = saveQueue.current.then(run, run);
    saveQueue.current = next.catch(() => undefined);
    return next;
  }, [store, catalog]);

  const deleteCharacter = useCallback(async (id: string) => {
    if (!store) return;
    await store.deleteCharacter(id);
    setCharacters(await store.listCharacters());
  }, [store]);

  const installModule = useCallback(async (module: RuleModuleJson, fileName?: string) => {
    if (!store) return;
    await store.putModule({ moduleId: module.moduleId, module, installedAt: new Date().toISOString(), fileName });
    setModules(await store.listModules());
  }, [store]);

  const removeModule = useCallback(async (moduleId: string) => {
    if (!store) return;
    await store.deleteModule(moduleId);
    setModules(await store.listModules());
  }, [store]);

  const getDraft = useCallback(async () => store?.getSetting<CharacterSource>("creation-draft"), [store]);
  const putDraft = useCallback(async (source: CharacterSource | undefined) => { await store?.putSetting("creation-draft", source ?? null); }, [store]);

  const value = useMemo<ClientState>(() => ({ ready, store, catalog, modules, characters, route, theme, navigate, setTheme, saveCharacter, deleteCharacter, installModule, removeModule, getDraft, putDraft }),
    [ready, store, catalog, modules, characters, route, theme, navigate, setTheme, saveCharacter, deleteCharacter, installModule, removeModule, getDraft, putDraft]);
  return <ClientContext.Provider value={value}>{children}</ClientContext.Provider>;
}

export function useClient() {
  const value = useContext(ClientContext);
  if (!value) throw new Error("useClient outside ClientProvider");
  return value;
}
