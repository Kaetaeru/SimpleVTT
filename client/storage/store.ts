/**
 * Client persistence: characters (source + runtime), installed RuleModule JSON and settings. IndexedDB in the
 * browser (and the Tauri webview), an in-memory store where IndexedDB is unavailable (tests, private windows).
 */
import type { StoredDocument } from "../campaign/model";
import type { RuleModuleJson } from "../catalog/types";
import type { CharacterRuntime } from "../character/runtime";
import type { CharacterSource } from "../character/types";

export interface CharacterRecord {
  id: string;
  source: CharacterSource;
  runtime: CharacterRuntime;
  savedAt: string;
}

export interface InstalledModuleRecord {
  moduleId: string;
  module: RuleModuleJson;
  installedAt: string;
  fileName?: string;
}

export interface ClientStore {
  readonly kind: "indexeddb" | "memory";
  listCharacters(): Promise<CharacterRecord[]>;
  getCharacter(id: string): Promise<CharacterRecord | undefined>;
  putCharacter(record: CharacterRecord): Promise<void>;
  deleteCharacter(id: string): Promise<void>;
  listModules(): Promise<InstalledModuleRecord[]>;
  putModule(record: InstalledModuleRecord): Promise<void>;
  deleteModule(moduleId: string): Promise<void>;
  getSetting<T>(key: string): Promise<T | undefined>;
  putSetting<T>(key: string, value: T): Promise<void>;
  /** Campaign documents (ROLL20_MODEL.md §7): campaigns, chat archives, journal entries, pages… one JSON row each. */
  listDocuments(): Promise<StoredDocument[]>;
  getDocument(id: string): Promise<StoredDocument | undefined>;
  putDocument(doc: StoredDocument): Promise<void>;
  deleteDocument(id: string): Promise<void>;
  /** Image bytes (data URLs) by content hash — the host's art files and every viewer's cache (CAMPAIGN_RESOURCES.md §3). */
  getAsset(hash: string): Promise<StoredAsset | undefined>;
  putAsset(asset: StoredAsset): Promise<void>;
  deleteAsset(hash: string): Promise<void>;
  listAssets(): Promise<Array<Omit<StoredAsset, "dataUrl">>>;
}

export interface StoredAsset { hash: string; dataUrl: string; bytes: number; savedAt: string }

export class MemoryStore implements ClientStore {
  readonly kind = "memory" as const;
  private readonly characters = new Map<string, CharacterRecord>();
  private readonly modules = new Map<string, InstalledModuleRecord>();
  private readonly settings = new Map<string, unknown>();
  private readonly documents = new Map<string, StoredDocument>();
  private readonly assets = new Map<string, StoredAsset>();

  async getAsset(hash: string) { return this.assets.get(hash); }
  async putAsset(asset: StoredAsset) { this.assets.set(asset.hash, asset); }
  async deleteAsset(hash: string) { this.assets.delete(hash); }
  async listAssets() { return [...this.assets.values()].map(({ dataUrl: _data, ...rest }) => rest); }

  async listDocuments() { return [...this.documents.values()].map((doc) => structuredClone(doc)); }
  async getDocument(id: string) { const doc = this.documents.get(id); return doc ? structuredClone(doc) : undefined; }
  async putDocument(doc: StoredDocument) { this.documents.set(doc.id, structuredClone(doc)); }
  async deleteDocument(id: string) { this.documents.delete(id); }

  async listCharacters() { return [...this.characters.values()].map((record) => structuredClone(record)).sort((a, b) => b.savedAt.localeCompare(a.savedAt)); }
  async getCharacter(id: string) { const record = this.characters.get(id); return record ? structuredClone(record) : undefined; }
  async putCharacter(record: CharacterRecord) { this.characters.set(record.id, structuredClone(record)); }
  async deleteCharacter(id: string) { this.characters.delete(id); }
  async listModules() { return [...this.modules.values()].map((record) => structuredClone(record)).sort((a, b) => a.installedAt.localeCompare(b.installedAt)); }
  async putModule(record: InstalledModuleRecord) { this.modules.set(record.moduleId, structuredClone(record)); }
  async deleteModule(moduleId: string) { this.modules.delete(moduleId); }
  async getSetting<T>(key: string) { return this.settings.has(key) ? (structuredClone(this.settings.get(key)) as T) : undefined; }
  async putSetting<T>(key: string, value: T) { this.settings.set(key, structuredClone(value)); }
}

const DB_NAME = "simplevtt-client";
const DB_VERSION = 3;
const STORES = { characters: "characters", modules: "modules", settings: "settings", documents: "documents", assets: "assets" } as const;

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
  });
}

function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const open = factory.open(DB_NAME, DB_VERSION);
    open.onupgradeneeded = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains(STORES.characters)) db.createObjectStore(STORES.characters, { keyPath: "id" });
      if (!db.objectStoreNames.contains(STORES.modules)) db.createObjectStore(STORES.modules, { keyPath: "moduleId" });
      if (!db.objectStoreNames.contains(STORES.settings)) db.createObjectStore(STORES.settings, { keyPath: "key" });
      if (!db.objectStoreNames.contains(STORES.documents)) db.createObjectStore(STORES.documents, { keyPath: "id" });
      if (!db.objectStoreNames.contains(STORES.assets)) db.createObjectStore(STORES.assets, { keyPath: "hash" });
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error ?? new Error("IndexedDB open failed"));
    open.onblocked = () => reject(new Error("IndexedDB open blocked"));
  });
}

export class IndexedDbStore implements ClientStore {
  readonly kind = "indexeddb" as const;
  private constructor(private readonly db: IDBDatabase) {}

  static async open(factory: IDBFactory): Promise<IndexedDbStore> {
    return new IndexedDbStore(await openDatabase(factory));
  }

  private tx<T>(store: string, mode: IDBTransactionMode, run: (objectStore: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const transaction = this.db.transaction(store, mode);
    const result = request(run(transaction.objectStore(store)));
    return new Promise((resolve, reject) => {
      transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed"));
      transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
      transaction.oncomplete = () => { result.then(resolve, reject); };
    });
  }

  async listCharacters() { const rows = await this.tx<CharacterRecord[]>(STORES.characters, "readonly", (store) => store.getAll()); return rows.sort((a, b) => b.savedAt.localeCompare(a.savedAt)); }
  getCharacter(id: string) { return this.tx<CharacterRecord | undefined>(STORES.characters, "readonly", (store) => store.get(id)); }
  async putCharacter(record: CharacterRecord) { await this.tx(STORES.characters, "readwrite", (store) => store.put(record)); }
  async deleteCharacter(id: string) { await this.tx(STORES.characters, "readwrite", (store) => store.delete(id)); }
  async listModules() { const rows = await this.tx<InstalledModuleRecord[]>(STORES.modules, "readonly", (store) => store.getAll()); return rows.sort((a, b) => a.installedAt.localeCompare(b.installedAt)); }
  async putModule(record: InstalledModuleRecord) { await this.tx(STORES.modules, "readwrite", (store) => store.put(record)); }
  async deleteModule(moduleId: string) { await this.tx(STORES.modules, "readwrite", (store) => store.delete(moduleId)); }
  async getSetting<T>(key: string) { const row = await this.tx<{ key: string; value: T } | undefined>(STORES.settings, "readonly", (store) => store.get(key)); return row?.value; }
  async putSetting<T>(key: string, value: T) { await this.tx(STORES.settings, "readwrite", (store) => store.put({ key, value })); }
  listDocuments() { return this.tx<StoredDocument[]>(STORES.documents, "readonly", (store) => store.getAll()); }
  getDocument(id: string) { return this.tx<StoredDocument | undefined>(STORES.documents, "readonly", (store) => store.get(id)); }
  async putDocument(doc: StoredDocument) { await this.tx(STORES.documents, "readwrite", (store) => store.put(doc)); }
  async deleteDocument(id: string) { await this.tx(STORES.documents, "readwrite", (store) => store.delete(id)); }
  getAsset(hash: string) { return this.tx<StoredAsset | undefined>(STORES.assets, "readonly", (store) => store.get(hash)); }
  async putAsset(asset: StoredAsset) { await this.tx(STORES.assets, "readwrite", (store) => store.put(asset)); }
  async deleteAsset(hash: string) { await this.tx(STORES.assets, "readwrite", (store) => store.delete(hash)); }
  async listAssets() { const rows = await this.tx<StoredAsset[]>(STORES.assets, "readonly", (store) => store.getAll()); return rows.map(({ dataUrl: _data, ...rest }) => rest); }
}

/** IndexedDB when the environment has it and it opens; otherwise memory (with a console note so it is not silent). */
export async function openClientStore(factory: IDBFactory | undefined = typeof indexedDB === "undefined" ? undefined : indexedDB): Promise<ClientStore> {
  if (factory) {
    try { return await IndexedDbStore.open(factory); } catch (error) { console.warn("IndexedDB unavailable, using memory store:", error); }
  }
  return new MemoryStore();
}
