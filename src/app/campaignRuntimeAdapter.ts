import type { AppSnapshot, SessionMode } from "./contracts";
import { CampaignApplicationService } from "./campaignApplicationService";
import { CampaignLibraryRepository } from "./campaignPersistence";
import type { CampaignCalendarDateTime, CampaignLibraryStore, CampaignRosterMember, CampaignSessionSnapshot, CampaignSessionSummary } from "./campaignPersistenceContracts";
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

function mutationContext(campaignId:string,kind:string,revision:number){return {requestId:requestId(kind),campaignId,expectedCampaignRevision:revision,initiatedByParticipantId:"dm.local",now:new Date().toISOString()};}

declare module "./mockAdapter" {
  interface MockAdapter {
    createCampaign(input:{campaignId:string;name:string;description?:string}):Promise<AppSnapshot>;
    openCampaign(campaignId:string):Promise<AppSnapshot>;
    updateCampaign(campaignId:string,payload:{name?:string;description?:string}):Promise<AppSnapshot>;
    archiveCampaign(campaignId:string):Promise<AppSnapshot>;
    restoreCampaign(campaignId:string):Promise<AppSnapshot>;
    configureCampaignSessionDefaults(campaignId:string,input:{sessionNameTemplate:string;startingMode:SessionMode;calendarEnabled:boolean;rationsEnabled:boolean}):Promise<AppSnapshot>;
    prepareCampaignSessionSnapshot(campaignId:string,input?:{sessionName?:string;startingMode?:SessionMode}):Promise<AppSnapshot>;
    upsertCampaignRosterMember(campaignId:string,member:CampaignRosterMember):Promise<AppSnapshot>;
    removeCampaignRosterMember(campaignId:string,rosterMemberId:string):Promise<AppSnapshot>;
    configureCampaignCalendar(campaignId:string,input:{enabled:boolean;providerId:string}):Promise<AppSnapshot>;
    advanceCampaignCalendar(campaignId:string,input:{deltaMinutes:number;note?:string}):Promise<AppSnapshot>;
    correctCampaignCalendar(campaignId:string,input:{absoluteMinute:number;note:string}):Promise<AppSnapshot>;
    correctCampaignCalendarDateTime(campaignId:string,input:{dateTime:CampaignCalendarDateTime;note:string}):Promise<AppSnapshot>;
    setCampaignCalendarNote(campaignId:string,note:string):Promise<AppSnapshot>;
    undoCampaignCalendar(campaignId:string):Promise<AppSnapshot>;
    configureCampaignRations(campaignId:string,input:{enabled:boolean;providerId:string}):Promise<AppSnapshot>;
    adjustCampaignRations(campaignId:string,input:{amount:number;note?:string}):Promise<AppSnapshot>;
    consumeCampaignDailyRations(campaignId:string,input?:{requiredUnits?:number;note?:string}):Promise<AppSnapshot>;
    undoCampaignRationConsumption(campaignId:string):Promise<AppSnapshot>;
    advanceCampaignDay(campaignId:string,input:{consumeRations:boolean;requiredUnits?:number;note?:string}):Promise<AppSnapshot>;
    appendCampaignSessionSummary(campaignId:string,summary:CampaignSessionSummary):Promise<AppSnapshot>;
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
    calendarAbsoluteMinuteAtStart:campaign.calendar.state.absoluteMinute,
    calendarEraAtStart:campaign.calendar.state.displayAnchor.era,
    rationBalanceAtStart:campaign.rations.ledger.balances.ration??0,
    stashRevisionAtStart:campaign.partyStash.revision,
    startedAt:now,
  }));
  return this.getSnapshot();
};

MockAdapter.prototype.upsertCampaignRosterMember=async function upsertCampaignRosterMemberRuntime(campaignId,member){
  const service=await ensureHydrated(this);const campaign=service.getCampaign(campaignId);if(!campaign) throw new Error(`Campaign not found: ${campaignId}`);
  await service.upsertRosterMember({...mutationContext(campaignId,"roster-upsert",campaign.revision),member});return this.getSnapshot();
};
MockAdapter.prototype.removeCampaignRosterMember=async function removeCampaignRosterMemberRuntime(campaignId,rosterMemberId){
  const service=await ensureHydrated(this);const campaign=service.getCampaign(campaignId);if(!campaign) throw new Error(`Campaign not found: ${campaignId}`);
  await service.removeRosterMember({...mutationContext(campaignId,"roster-remove",campaign.revision),rosterMemberId});return this.getSnapshot();
};
MockAdapter.prototype.configureCampaignCalendar=async function configureCampaignCalendarRuntime(campaignId,input){
  const service=await ensureHydrated(this);const campaign=service.getCampaign(campaignId);if(!campaign) throw new Error(`Campaign not found: ${campaignId}`);
  await service.configureCalendar({...mutationContext(campaignId,"calendar-configure",campaign.revision),...input});return this.getSnapshot();
};
MockAdapter.prototype.advanceCampaignCalendar=async function advanceCampaignCalendarRuntime(campaignId,input){
  const service=await ensureHydrated(this);const campaign=service.getCampaign(campaignId);if(!campaign) throw new Error(`Campaign not found: ${campaignId}`);
  await service.advanceCalendar({...mutationContext(campaignId,"calendar-advance",campaign.revision),...input});return this.getSnapshot();
};
MockAdapter.prototype.correctCampaignCalendar=async function correctCampaignCalendarRuntime(campaignId,input){
  const service=await ensureHydrated(this);const campaign=service.getCampaign(campaignId);if(!campaign) throw new Error(`Campaign not found: ${campaignId}`);
  await service.correctCalendar({...mutationContext(campaignId,"calendar-correct",campaign.revision),...input});return this.getSnapshot();
};
MockAdapter.prototype.correctCampaignCalendarDateTime=async function correctCampaignCalendarDateTimeRuntime(campaignId,input){
  const service=await ensureHydrated(this);const campaign=service.getCampaign(campaignId);if(!campaign) throw new Error(`Campaign not found: ${campaignId}`);
  await service.correctCalendarDateTime({...mutationContext(campaignId,"calendar-correct-date-time",campaign.revision),...input});return this.getSnapshot();
};
MockAdapter.prototype.setCampaignCalendarNote=async function setCampaignCalendarNoteRuntime(campaignId,note){
  const service=await ensureHydrated(this);const campaign=service.getCampaign(campaignId);if(!campaign) throw new Error(`Campaign not found: ${campaignId}`);
  await service.setCalendarNote({...mutationContext(campaignId,"calendar-note",campaign.revision),note});return this.getSnapshot();
};
MockAdapter.prototype.undoCampaignCalendar=async function undoCampaignCalendarRuntime(campaignId){
  const service=await ensureHydrated(this);const campaign=service.getCampaign(campaignId);if(!campaign) throw new Error(`Campaign not found: ${campaignId}`);
  await service.undoRecentCalendar(mutationContext(campaignId,"calendar-undo",campaign.revision));return this.getSnapshot();
};
MockAdapter.prototype.configureCampaignRations=async function configureCampaignRationsRuntime(campaignId,input){
  const service=await ensureHydrated(this);const campaign=service.getCampaign(campaignId);if(!campaign) throw new Error(`Campaign not found: ${campaignId}`);
  await service.configureRations({...mutationContext(campaignId,"rations-configure",campaign.revision),...input});return this.getSnapshot();
};
MockAdapter.prototype.adjustCampaignRations=async function adjustCampaignRationsRuntime(campaignId,input){
  const service=await ensureHydrated(this);const campaign=service.getCampaign(campaignId);if(!campaign) throw new Error(`Campaign not found: ${campaignId}`);
  await service.adjustRations({...mutationContext(campaignId,"rations-adjust",campaign.revision),...input});return this.getSnapshot();
};
MockAdapter.prototype.consumeCampaignDailyRations=async function consumeCampaignDailyRationsRuntime(campaignId,input={}){
  const service=await ensureHydrated(this);const campaign=service.getCampaign(campaignId);if(!campaign) throw new Error(`Campaign not found: ${campaignId}`);
  await service.consumeDailyRations({...mutationContext(campaignId,"rations-consume",campaign.revision),...input});return this.getSnapshot();
};
MockAdapter.prototype.undoCampaignRationConsumption=async function undoCampaignRationConsumptionRuntime(campaignId){
  const service=await ensureHydrated(this);const campaign=service.getCampaign(campaignId);if(!campaign) throw new Error(`Campaign not found: ${campaignId}`);
  await service.undoRecentRationConsumption(mutationContext(campaignId,"rations-undo",campaign.revision));return this.getSnapshot();
};
MockAdapter.prototype.advanceCampaignDay=async function advanceCampaignDayRuntime(campaignId,input){
  const service=await ensureHydrated(this);const campaign=service.getCampaign(campaignId);if(!campaign) throw new Error(`Campaign not found: ${campaignId}`);
  await service.advanceDayWithOptionalRations({...mutationContext(campaignId,"day-advance",campaign.revision),...input});return this.getSnapshot();
};
MockAdapter.prototype.appendCampaignSessionSummary=async function appendCampaignSessionSummaryRuntime(campaignId,summary){
  const service=await ensureHydrated(this);const campaign=service.getCampaign(campaignId);if(!campaign) throw new Error(`Campaign not found: ${campaignId}`);
  await service.appendSessionSummary({...mutationContext(campaignId,"session-summary",campaign.revision),summary});return this.getSnapshot();
};

export function setCampaignLibraryStoreForTests(adapter:MockAdapter,store:CampaignLibraryStore){
  injectedStores.set(adapter,store);contexts.delete(adapter);
}

export function clearCampaignSessionSnapshot(adapter:MockAdapter){sessionSnapshots.delete(adapter);}
