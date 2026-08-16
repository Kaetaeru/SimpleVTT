import "./installedContentContracts";
import "./ruleModulePackageImport";
import type { AppSnapshot, CatalogEntry, ContentImportPreview, ValidationMessage } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import {
  catalogQualifiedId,
  composeContentCatalog,
  installedEntryFromPayload,
  resolvedBuiltinCatalogEntry,
} from "./contentCatalogIdentity";
import { activeRulesProfileCompatibility, validateInstalledContentCandidate } from "./declarativeModuleValidation";
import { validateInstalledContentPackage } from "./ruleModulePackageValidation";
import { looksLikeRuleModulePackage, parseRuleModulePackage } from "./ruleModulePackageImport";
import { ruleModulePackageReviewEntry } from "./ruleModulePackageReviewEntry";
import { InstalledContentRepository } from "./installedContentPersistence";
import type { InstalledCatalogEntryV1, InstalledContentDocumentV1, InstalledContentStore } from "./installedContentContracts";
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

function stateOf(adapter:MockAdapter) { return adapter as unknown as AdapterState; }
function contextFor(adapter:MockAdapter):Context {
  const existing=contexts.get(adapter);
  if (existing) return existing;
  const store=injectedStores.get(adapter) ?? createPlatformInstalledContentStore();
  const context:Context={repository:new InstalledContentRepository(store),hydration:null,hydrated:false,builtin:null,vm:{durability:store.durability,status:"ready",storageRevision:0}};
  contexts.set(adapter,context);
  return context;
}
function applyComposition(adapter:MockAdapter) {
  const state=stateOf(adapter), context=contextFor(adapter), document=context.repository.snapshot();
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
      context.vm={durability:context.repository.durability,status:hydration.recoveredFromOlderGeneration?"recovered":"ready",storageRevision:hydration.document.storageRevision,message:hydration.recoveredFromOlderGeneration?`최신 installed-content generation을 읽지 못해 generation ${hydration.loadedGeneration ?? "—"}에서 복구했습니다.`:undefined};
      context.hydrated=true;
    } catch(error) {
      context.vm={durability:context.repository.durability,status:"error",storageRevision:context.repository.snapshot()?.storageRevision ?? 0,message:error instanceof Error?error.message:String(error)};
      throw error;
    }
  })().finally(()=>{context.hydration=null;});
  return context.hydration;
}
function addPreviewMessage(state:AdapterState,severity:"blocking"|"warning"|"info",message:string) {
  if (!state.contentImport) return;
  if (!state.contentImport.validation.some((entry)=>entry.message===message)) state.contentImport.validation=[...state.contentImport.validation,{severity,message}];
}
function sourceIdFromPayload(payload:string) {
  try { const parsed=JSON.parse(payload) as {sourceId?:unknown}; return typeof parsed.sourceId==="string"?parsed.sourceId.trim():""; } catch { return ""; }
}
function collidesWithBuiltin(context:Context,contentId:string,sourceId:string,version:string) {
  const qualifiedId=catalogQualifiedId(contentId,sourceId,version);
  return Boolean(context.builtin?.some((entry)=>resolvedBuiltinCatalogEntry(entry).id===qualifiedId));
}
function builtinValidationEntries(context:Context):InstalledCatalogEntryV1[] {
  const profile=activeRulesProfileCompatibility();
  const module={moduleId:profile.id,moduleVersion:profile.version,rulesProfile:{id:profile.id,version:profile.version},dependencies:[],conflicts:[],capabilities:profile.capabilities,extensionPoints:[]};
  return (context.builtin ?? []).map((entry) => {
    const resolved=resolvedBuiltinCatalogEntry(entry);
    return {contentId:resolved.contentId!,category:resolved.category,nameKo:resolved.nameKo,nameEn:resolved.nameEn,sourceId:resolved.sourceId!,source:resolved.source,version:resolved.version,description:resolved.description,relationships:cp(resolved.relationships),capabilities:cp(resolved.capabilities),module:cp(module)};
  });
}
function validationDocument(context:Context):InstalledContentDocumentV1 {
  const document=context.repository.snapshot();
  if (!document) throw new Error("installed content repository is not hydrated");
  return {...document,entries:[...builtinValidationEntries(context),...document.entries]};
}
function issueMessage(issue:{code:string;message:string}) { return `${issue.code}: ${issue.message}`; }
function toValidation(issue:{severity:"blocking"|"warning"|"info";code:string;message:string}):ValidationMessage { return {severity:issue.severity,message:issueMessage(issue)}; }
function validateSinglePreview(adapter:MockAdapter) {
  const state=stateOf(adapter), context=contextFor(adapter), preview=state.contentImport;
  if (!preview?.entry || !context.repository.snapshot()) return;
  try {
    const installed=installedEntryFromPayload(preview.entry,preview.payload);
    for (const issue of validateInstalledContentCandidate(validationDocument(context),installed)) addPreviewMessage(state,issue.severity,issueMessage(issue));
  } catch(error) {
    addPreviewMessage(state,"blocking",error instanceof Error?error.message:String(error));
  }
}
function previewPackage(adapter:MockAdapter,payload:string) {
  const state=stateOf(adapter), context=contextFor(adapter);
  try {
    const parsed=parseRuleModulePackage(payload);
    const validation=validateInstalledContentPackage(validationDocument(context),parsed.entries);
    parsed.preview.entries=parsed.preview.entries.map((entry)=>({
      ...entry,
      validation:(validation.byContentId[entry.contentId] ?? []).map(toValidation),
    }));
    state.contentImport={
      payload,
      validation:validation.issues.map(toValidation),
      unsupportedCapabilities:[],
      package:parsed.preview,
      entry:ruleModulePackageReviewEntry(parsed),
    };
    for (const entry of parsed.entries) {
      if (collidesWithBuiltin(context,entry.contentId,entry.sourceId,entry.version)) {
        addPreviewMessage(state,"blocking",`Builtin content qualified identity cannot be installed as local content: ${catalogQualifiedId(entry.contentId,entry.sourceId,entry.version)}`);
      }
    }
  } catch(error) {
    state.contentImport={payload,validation:[{severity:"blocking",message:error instanceof Error?error.message:String(error)}],unsupportedCapabilities:[]};
  }
}

MockAdapter.prototype.getSnapshot=async function getSnapshotWithInstalledContent() {
  await ensureHydrated(this);
  const snapshot=await oldGetSnapshot.call(this);
  snapshot.contentCatalogPersistence=cp(contextFor(this).vm);
  return snapshot;
};
MockAdapter.prototype.previewContentImport=async function previewContentImportWithStableSource(payload:string) {
  await ensureHydrated(this);
  if (looksLikeRuleModulePackage(payload)) {
    previewPackage(this,payload);
    return this.getSnapshot();
  }
  await oldPreviewContentImport.call(this,payload);
  const state=stateOf(this);
  if (state.contentImport?.entry) {
    const sourceId=sourceIdFromPayload(payload);
    if (!sourceId) addPreviewMessage(state,"blocking","로컬 콘텐츠는 표시용 source와 별개의 안정적인 sourceId가 필요합니다.");
    else state.contentImport.entry.sourceId=sourceId;
    state.contentImport.entry.contentId=state.contentImport.entry.id;
    validateSinglePreview(this);
  }
  return this.getSnapshot();
};
MockAdapter.prototype.activateContentImport=async function activateInstalledContent() {
  await ensureHydrated(this);
  const state=stateOf(this), context=contextFor(this), preview=state.contentImport;
  if (!preview || preview.validation.some((entry)=>entry.severity==="blocking")) return this.getSnapshot();

  if (preview.package) {
    try {
      const parsed=parseRuleModulePackage(preview.payload);
      const validation=validateInstalledContentPackage(validationDocument(context),parsed.entries);
      for (const issue of validation.issues) if (issue.severity==="blocking") addPreviewMessage(state,issue.severity,issueMessage(issue));
      for (const entry of parsed.entries) if (collidesWithBuiltin(context,entry.contentId,entry.sourceId,entry.version)) addPreviewMessage(state,"blocking",`Builtin content qualified identity cannot be installed as local content: ${catalogQualifiedId(entry.contentId,entry.sourceId,entry.version)}`);
      if (state.contentImport?.validation.some((entry)=>entry.severity==="blocking")) return this.getSnapshot();
      const result=await context.repository.installMany(parsed.entries);
      if (result.status==="conflict") { addPreviewMessage(state,"blocking",result.error); return this.getSnapshot(); }
      applyComposition(this); state.contentImport=null;
      context.vm={durability:context.repository.durability,status:"ready",storageRevision:result.hydration.document.storageRevision};
      return this.getSnapshot();
    } catch(error) {
      const message=error instanceof Error?error.message:String(error);
      context.vm={durability:context.repository.durability,status:"error",storageRevision:context.repository.snapshot()?.storageRevision ?? 0,message};
      addPreviewMessage(state,"blocking",`콘텐츠 패키지 설치 실패: ${message}`);
      return this.getSnapshot();
    }
  }

  if (!preview.entry) return this.getSnapshot();
  let installed;
  try { installed=installedEntryFromPayload(preview.entry,preview.payload); }
  catch(error) { addPreviewMessage(state,"blocking",error instanceof Error?error.message:String(error)); return this.getSnapshot(); }
  const validation=validateInstalledContentCandidate(validationDocument(context),installed);
  for (const issue of validation) if (issue.severity==="blocking") addPreviewMessage(state,issue.severity,issueMessage(issue));
  if (state.contentImport?.validation.some((entry)=>entry.severity==="blocking")) return this.getSnapshot();
  if (collidesWithBuiltin(context,installed.contentId,installed.sourceId,installed.version)) {
    addPreviewMessage(state,"blocking",`Builtin content qualified identity cannot be installed as local content: ${catalogQualifiedId(installed.contentId,installed.sourceId,installed.version)}`);
    return this.getSnapshot();
  }
  try {
    const result=await context.repository.install(installed);
    if (result.status==="conflict") { addPreviewMessage(state,"blocking",result.error); return this.getSnapshot(); }
    applyComposition(this); state.contentImport=null;
    context.vm={durability:context.repository.durability,status:"ready",storageRevision:result.hydration.document.storageRevision};
    return this.getSnapshot();
  } catch(error) {
    const message=error instanceof Error?error.message:String(error);
    context.vm={durability:context.repository.durability,status:"error",storageRevision:context.repository.snapshot()?.storageRevision ?? 0,message};
    addPreviewMessage(state,"blocking",`콘텐츠 설치 저장 실패: ${message}`);
    return this.getSnapshot();
  }
};
MockAdapter.prototype.clearContentImport=async function clearInstalledContentPreview() { await ensureHydrated(this); return oldClearContentImport.call(this); };

export function setInstalledContentStoreForTests(adapter:MockAdapter,store:InstalledContentStore) { injectedStores.set(adapter,store); contexts.delete(adapter); }
export function getInstalledContentPersistenceStateForTests(adapter:MockAdapter) { const context=contexts.get(adapter); return context?{...cp(context.vm),document:context.repository.snapshot()}:null; }
