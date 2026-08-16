import "./installedContentContracts";
import type { AppSnapshot, CatalogEntry, ContentImportPreview } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import {
  catalogQualifiedId,
  composeContentCatalog,
  installedEntryFromPreview,
  resolvedBuiltinCatalogEntry,
} from "./contentCatalogIdentity";
import { InstalledContentRepository } from "./installedContentPersistence";
import type { InstalledContentStore } from "./installedContentContracts";
import { createPlatformInstalledContentStore } from "./tauriInstalledContentStore";

const cp = <T,>(value:T):T => structuredClone(value);

type AdapterState = {
  catalog:CatalogEntry[];
  contentImport:ContentImportPreview|null;
};

type CatalogPersistenceVm = NonNullable<AppSnapshot["contentCatalogPersistence"]>;
type Context = {
  repository:InstalledContentRepository;
  hydration:Promise<void>|null;
  hydrated:boolean;
  builtin:CatalogEntry[]|null;
  vm:CatalogPersistenceVm;
};

const injectedStores=new WeakMap<MockAdapter,InstalledContentStore>();
const contexts=new WeakMap<MockAdapter,Context>();
const oldGetSnapshot=MockAdapter.prototype.getSnapshot;
const oldPreviewContentImport=MockAdapter.prototype.previewContentImport;
const oldClearContentImport=MockAdapter.prototype.clearContentImport;

function stateOf(adapter:MockAdapter) {
  return adapter as unknown as AdapterState;
}

function contextFor(adapter:MockAdapter):Context {
  const existing=contexts.get(adapter);
  if (existing) return existing;
  const store=injectedStores.get(adapter) ?? createPlatformInstalledContentStore();
  const context:Context={
    repository:new InstalledContentRepository(store),
    hydration:null,
    hydrated:false,
    builtin:null,
    vm:{durability:store.durability,status:"ready",storageRevision:0},
  };
  contexts.set(adapter,context);
  return context;
}

function applyComposition(adapter:MockAdapter) {
  const state=stateOf(adapter);
  const context=contextFor(adapter);
  const document=context.repository.snapshot();
  if (!context.builtin || !document) return;
  state.catalog=composeContentCatalog(context.builtin,document.entries);
}

async function ensureHydrated(adapter:MockAdapter) {
  const context=contextFor(adapter);
  if (context.hydrated) return;
  if (context.hydration) return context.hydration;
  context.hydration=(async()=>{
    await oldGetSnapshot.call(adapter);
    const state=stateOf(adapter);
    context.builtin=cp(state.catalog.filter((entry)=>entry.scope==="builtin"));
    try {
      const hydration=await context.repository.hydrate();
      applyComposition(adapter);
      context.vm={
        durability:context.repository.durability,
        status:hydration.recoveredFromOlderGeneration ? "recovered" : "ready",
        storageRevision:hydration.document.storageRevision,
        message:hydration.recoveredFromOlderGeneration
          ? `최신 installed-content generation을 읽지 못해 generation ${hydration.loadedGeneration ?? "—"}에서 복구했습니다.`
          : undefined,
      };
      context.hydrated=true;
    } catch(error) {
      context.vm={
        durability:context.repository.durability,
        status:"error",
        storageRevision:context.repository.snapshot()?.storageRevision ?? 0,
        message:error instanceof Error ? error.message : String(error),
      };
      throw error;
    }
  })().finally(()=>{context.hydration=null;});
  return context.hydration;
}

function addPreviewBlocking(state:AdapterState,message:string) {
  if (!state.contentImport) return;
  if (!state.contentImport.validation.some((entry)=>entry.message===message)) {
    state.contentImport.validation=[...state.contentImport.validation,{severity:"blocking",message}];
  }
}

function sourceIdFromPayload(payload:string) {
  try {
    const parsed=JSON.parse(payload) as {sourceId?:unknown};
    return typeof parsed.sourceId==="string" ? parsed.sourceId.trim() : "";
  } catch {
    return "";
  }
}

function collidesWithBuiltin(context:Context,contentId:string,sourceId:string,version:string) {
  const qualifiedId=catalogQualifiedId(contentId,sourceId,version);
  return Boolean(context.builtin?.some((entry)=>resolvedBuiltinCatalogEntry(entry).id===qualifiedId));
}

MockAdapter.prototype.getSnapshot=async function getSnapshotWithInstalledContent() {
  await ensureHydrated(this);
  const snapshot=await oldGetSnapshot.call(this);
  snapshot.contentCatalogPersistence=cp(contextFor(this).vm);
  return snapshot;
};

MockAdapter.prototype.previewContentImport=async function previewContentImportWithStableSource(payload:string) {
  await ensureHydrated(this);
  await oldPreviewContentImport.call(this,payload);
  const state=stateOf(this);
  if (state.contentImport?.entry) {
    const sourceId=sourceIdFromPayload(payload);
    if (!sourceId) addPreviewBlocking(state,"로컬 콘텐츠는 표시용 source와 별개의 안정적인 sourceId가 필요합니다.");
    else state.contentImport.entry.sourceId=sourceId;
    state.contentImport.entry.contentId=state.contentImport.entry.id;
  }
  return this.getSnapshot();
};

MockAdapter.prototype.activateContentImport=async function activateInstalledContent() {
  await ensureHydrated(this);
  const state=stateOf(this);
  const context=contextFor(this);
  const preview=state.contentImport;
  if (!preview?.entry || preview.validation.some((entry)=>entry.severity==="blocking")) return this.getSnapshot();

  let installed;
  try {
    installed=installedEntryFromPreview(preview.entry);
  } catch(error) {
    addPreviewBlocking(state,error instanceof Error ? error.message : String(error));
    return this.getSnapshot();
  }

  if (collidesWithBuiltin(context,installed.contentId,installed.sourceId,installed.version)) {
    addPreviewBlocking(
      state,
      `Builtin content qualified identity cannot be installed as local content: ${catalogQualifiedId(installed.contentId,installed.sourceId,installed.version)}`,
    );
    return this.getSnapshot();
  }

  try {
    const result=await context.repository.install(installed);
    if (result.status==="conflict") {
      addPreviewBlocking(state,result.error);
      return this.getSnapshot();
    }
    applyComposition(this);
    state.contentImport=null;
    context.vm={
      durability:context.repository.durability,
      status:"ready",
      storageRevision:result.hydration.document.storageRevision,
    };
    return this.getSnapshot();
  } catch(error) {
    const message=error instanceof Error ? error.message : String(error);
    context.vm={
      durability:context.repository.durability,
      status:"error",
      storageRevision:context.repository.snapshot()?.storageRevision ?? 0,
      message,
    };
    addPreviewBlocking(state,`콘텐츠 설치 저장 실패: ${message}`);
    return this.getSnapshot();
  }
};

MockAdapter.prototype.clearContentImport=async function clearInstalledContentPreview() {
  await ensureHydrated(this);
  return oldClearContentImport.call(this);
};

export function setInstalledContentStoreForTests(adapter:MockAdapter,store:InstalledContentStore) {
  injectedStores.set(adapter,store);
  contexts.delete(adapter);
}

export function getInstalledContentPersistenceStateForTests(adapter:MockAdapter) {
  const context=contexts.get(adapter);
  return context ? { ...cp(context.vm),document:context.repository.snapshot() } : null;
}
