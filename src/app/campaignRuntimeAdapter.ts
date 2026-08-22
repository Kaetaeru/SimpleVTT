import type { AppSnapshot, SessionMode } from "./contracts";
import { CampaignApplicationService } from "./campaignApplicationService";
import { CampaignLibraryRepository } from "./campaignPersistence";
import type { CampaignLibraryStore, CampaignSessionSnapshot } from "./campaignPersistenceContracts";
import { MockAdapter } from "./mockAdapter";
import { createPlatformCampaignLibraryStore } from "./tauriCampaignLibraryStore";

interface CampaignRuntimeContext {
  service:CampaignApplicationService;
  hydrated:boolean;
}

const injectedStores=new WeakMap<MockAdapter,CampaignLibraryStore>();
const contexts=new WeakMap<MockAdapter,CampaignRuntimeContext>();
const sessionSnapshots=new WeakMap<MockAdapter,CampaignSessionSnapshot>();

function clone<T>(value:T):T{return structuredClone(value);}

function contextFor(adapter:MockAdapter){
  let context=contexts.get(adapter);
  if(!context){
    context={service:new CampaignApplicationService(new CampaignLibraryRepository(injectedStores.get(adapter)??createPlatformCampaignLibraryStore())),hydrated:false};
    contexts.set(adapter,context);
  }
  return context;
}

async function ensureHydrated(adapter:MockAdapter){
  const context=contextFor(adapter);
  if(!context.hydrated){await context.service.hydrate();context.hydrated=true;}
  return context.service;
}

function requestId(kind:string){
  const id=globalThis.crypto?.randomUUID?.()??`${Date.now()}.${Math.floor(Math.random()*1_000_000)}`;
  return `campaign.${kind}.${id}`;
}

declare module "./mockAdapter" {
  interface MockAdapter {
    createCampaign(input:{campaignId:string;name:string;description?:string}):Promise<AppSnapshot>;
    openCampaign(campaignId:string):Promise<AppSnapshot>;
    updateCampaign(campaignId:string,payload:{name?:string;description?:string}):Promise<AppSnapshot>;
    archiveCampaign(campaignId:string):Promise<AppSnapshot>;
    restoreCampaign(campaignId:string):Promise<AppSnapshot>;
    configureCampaignSessionDefaults(campaignId:string,input:{sessionNameTemplate:string;startingMode:SessionMode;calendarEnabled:boolean;rationsEnabled:boolean}):Promise<AppSnapshot>;
    prepareCampaignSessionSnapshot(campaignId:string,input?:{sessionName?:string;startingMode?:SessionMode}):Promise<AppSnapshot>;
  }
}

const previousGetSnapshot=MockAdapter.prototype.getSnapshot;
MockAdapter.prototype.getSnapshot=async function getSnapshotWithCampaigns(){
  const service=await ensureHydrated(this);
  const snapshot=await previousGetSnapshot.call(this);
  const campaigns=service.listCampaigns();
  return {...snapshot,campaigns,activeCampaignId:service.snapshot()?.activeCampaignId??null,campaignSessionSnapshot:clone(sessionSnapshots.get(this)??null)};
};

MockAdapter.prototype.createCampaign=async function createCampaignRuntime(input){
  const service=await ensureHydrated(this);
  await service.createCampaign({...input,now:new Date().toISOString()});
  return this.getSnapshot();
};

MockAdapter.prototype.openCampaign=async function openCampaignRuntime(campaignId){
  const service=await ensureHydrated(this);const campaign=service.getCampaign(campaignId);
  if(!campaign) throw new Error(`Campaign not found: ${campaignId}`);
  await service.openCampaign({requestId:requestId("open"),campaignId,expectedCampaignRevision:campaign.revision,initiatedByParticipantId:"dm.local",now:new Date().toISOString()});
  return this.getSnapshot();
};

MockAdapter.prototype.updateCampaign=async function updateCampaignRuntime(campaignId,payload){
  const service=await ensureHydrated(this);const campaign=service.getCampaign(campaignId);
  if(!campaign) throw new Error(`Campaign not found: ${campaignId}`);
  await service.updateCampaign({requestId:requestId("update"),campaignId,expectedCampaignRevision:campaign.revision,initiatedByParticipantId:"dm.local",now:new Date().toISOString(),payload});
  return this.getSnapshot();
};

MockAdapter.prototype.archiveCampaign=async function archiveCampaignRuntime(campaignId){
  const service=await ensureHydrated(this);const campaign=service.getCampaign(campaignId);
  if(!campaign) throw new Error(`Campaign not found: ${campaignId}`);
  await service.archiveCampaign({requestId:requestId("archive"),campaignId,expectedCampaignRevision:campaign.revision,initiatedByParticipantId:"dm.local",now:new Date().toISOString()});
  return this.getSnapshot();
};

MockAdapter.prototype.restoreCampaign=async function restoreCampaignRuntime(campaignId){
  const service=await ensureHydrated(this);const campaign=service.getCampaign(campaignId);
  if(!campaign) throw new Error(`Campaign not found: ${campaignId}`);
  await service.restoreCampaign({requestId:requestId("restore"),campaignId,expectedCampaignRevision:campaign.revision,initiatedByParticipantId:"dm.local",now:new Date().toISOString()});
  return this.getSnapshot();
};

MockAdapter.prototype.configureCampaignSessionDefaults=async function configureCampaignSessionDefaultsRuntime(campaignId,input){
  const service=await ensureHydrated(this);const campaign=service.getCampaign(campaignId);
  if(!campaign) throw new Error(`Campaign not found: ${campaignId}`);
  await service.mutateCampaign({requestId:requestId("session-defaults"),campaignId,expectedCampaignRevision:campaign.revision,initiatedByParticipantId:"dm.local",now:new Date().toISOString()},(next)=>{
    next.sessionDefaults={...next.sessionDefaults,...input,revision:next.sessionDefaults.revision+1};
    next.calendar.capability={...next.calendar.capability,enabled:input.calendarEnabled,settingsRevision:next.calendar.capability.settingsRevision+1};
    next.rations.capability={...next.rations.capability,enabled:input.rationsEnabled,settingsRevision:next.rations.capability.settingsRevision+1};
  });
  return this.getSnapshot();
};

MockAdapter.prototype.prepareCampaignSessionSnapshot=async function prepareCampaignSessionSnapshotRuntime(campaignId,input={}){
  const service=await ensureHydrated(this);const campaign=service.getCampaign(campaignId);
  if(!campaign) throw new Error(`Campaign not found: ${campaignId}`);
  const now=new Date().toISOString();
  const id=globalThis.crypto?.randomUUID?.()??`${Date.now()}.${Math.floor(Math.random()*1_000_000)}`;
  sessionSnapshots.set(this,clone({
    sessionId:`session.${id}`,
    campaignId:campaign.campaignId,
    campaignName:campaign.name,
    campaignRevisionAtStart:campaign.revision,
    settingsRevision:campaign.sessionDefaults.revision,
    sessionName:input.sessionName?.trim()||campaign.sessionDefaults.sessionNameTemplate,
    startingMode:input.startingMode??campaign.sessionDefaults.startingMode,
    calendar:campaign.calendar.capability,
    rations:campaign.rations.capability,
    stashPolicy:campaign.sessionDefaults.stashPolicy,
    contentLoadoutId:campaign.sessionDefaults.contentLoadoutId,
    spatialProviderId:campaign.contentLoadout.spatialProviderId,
    spatialProviderVersion:campaign.contentLoadout.spatialProviderVersion,
    startedAt:now,
  }));
  return this.getSnapshot();
};

export function setCampaignLibraryStoreForTests(adapter:MockAdapter,store:CampaignLibraryStore){
  injectedStores.set(adapter,store);contexts.delete(adapter);
}
