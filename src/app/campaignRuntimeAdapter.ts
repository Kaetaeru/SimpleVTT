import type { AppSnapshot, PartyStashTransferCommand, SessionMode } from "./contracts";
import { CampaignApplicationService, previewCampaignDailyRations } from "./campaignApplicationService";
import { CampaignLibraryRepository } from "./campaignPersistence";
import type { CampaignCalendarDateTime, CampaignLibraryStore, CampaignRosterMember, CampaignSessionSnapshot, CampaignSessionSummary } from "./campaignPersistenceContracts";
import { MockAdapter } from "./mockAdapter";
import { createPlatformCampaignLibraryStore } from "./tauriCampaignLibraryStore";
import { registerConnectedCampaignRosterHandler } from "./connectedCampaignRosterPort";

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
    configureCampaignSessionDefaults(campaignId:string,input:{sessionNameTemplate:string;startingMode:SessionMode;calendarEnabled:boolean;rationsEnabled:boolean;rationsVisibleToPlayers?:boolean}):Promise<AppSnapshot>;
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
    grantCampaignAdvancement(campaignId:string,input:{rosterMemberIds:string[];kind:"xp"|"level-up-credit";amount:number;levels?:Record<string,number>}):Promise<AppSnapshot>;
    consumeCampaignLevelUpCredit(campaignId:string,rosterMemberId:string,level?:number):Promise<AppSnapshot>;
    transferPartyStash(command:PartyStashTransferCommand):Promise<AppSnapshot>;
    commitConnectedPartyStashDeposit(command:PartyStashTransferCommand):Promise<AppSnapshot>;
  }
}

const previousGetSnapshot=MockAdapter.prototype.getSnapshot;
MockAdapter.prototype.getSnapshot=async function getSnapshotWithCampaigns(){
  const service=await ensureHydrated(this);
  const snapshot=await previousGetSnapshot.call(this);
  const campaigns=service.listCampaigns();
  const activeCampaignId=service.snapshot()?.activeCampaignId??null;
  const captured=sessionSnapshots.get(this)??null;
  const campaign=campaigns.find((item)=>item.campaignId===(captured?.campaignId??activeCampaignId))??null;
  const rationPreview=campaign?previewCampaignDailyRations(campaign):null;
  const rationsVisible=captured?.rationsVisibleToPlayers??campaign?.sessionDefaults.rationsVisibleToPlayers??true;
  const mayProjectRations=snapshot.session.role!=="client"||rationsVisible;
  const campaignSessionSystems=campaign?{
    campaignId:campaign.campaignId,campaignName:campaign.name,campaignRevision:campaign.revision,
    roster:campaign.roster.map((member)=>({
      rosterMemberId:member.rosterMemberId,label:member.label,kind:member.kind,active:member.active,
      countsForRations:member.countsForRations,rationUnitsPerDay:member.rationUnitsPerDay,stashPermission:member.stashPermission,
      connectionState:member.characterRef?.ownerHint?snapshot.session.participants.find((participant)=>participant.id===member.characterRef?.ownerHint)?.state:undefined,
      characterId:member.characterRef?.characterId,
      level:member.level??(member.characterRef?.characterId===snapshot.activeCharacter.id?snapshot.activeCharacter.level:undefined),
      advancement:clone(campaign.advancement?.members[member.rosterMemberId]??{xp:0,levelUpCredits:0}),
    })),
    calendar:{enabled:captured?.calendar.enabled??campaign.calendar.capability.enabled,providerId:campaign.calendar.state.providerId,absoluteMinute:campaign.calendar.state.absoluteMinute,displayAnchor:clone(campaign.calendar.state.displayAnchor),currentNote:campaign.calendar.state.currentNote},
    rations:{enabled:captured?.rations.enabled??campaign.rations.capability.enabled,visibleToPlayers:rationsVisible,...(mayProjectRations?{balance:campaign.rations.ledger.balances.ration??0,dailyRequired:rationPreview?.requiredUnits??0,shortage:rationPreview?.shortageUnits??0}:{})},
    partyStash:clone({revision:campaign.partyStash.revision,policy:campaign.partyStash.policy,wallet:campaign.partyStash.wallet,itemReferences:campaign.partyStash.itemReferences}),
  }:null;
  return {...snapshot,campaigns,activeCampaignId,campaignSessionSnapshot:clone(captured),campaignSessionSystems:clone(campaignSessionSystems)};
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
    rationsVisibleToPlayers:campaign.sessionDefaults.rationsVisibleToPlayers??true,
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
MockAdapter.prototype.grantCampaignAdvancement=async function grantCampaignAdvancementRuntime(campaignId,input){
  const service=await ensureHydrated(this);const campaign=service.getCampaign(campaignId);if(!campaign) throw new Error("Campaign not found: "+campaignId);
  await service.grantAdvancement({...mutationContext(campaignId,"advancement-grant",campaign.revision),...input});return this.getSnapshot();
};
MockAdapter.prototype.consumeCampaignLevelUpCredit=async function consumeCampaignLevelUpCreditRuntime(campaignId,rosterMemberId,level){
  const service=await ensureHydrated(this);const campaign=service.getCampaign(campaignId);if(!campaign) throw new Error("Campaign not found: "+campaignId);
  await service.consumeLevelUpCredit({...mutationContext(campaignId,"advancement-consume",campaign.revision),rosterMemberId,level});return this.getSnapshot();
};
MockAdapter.prototype.transferPartyStash=async function transferPartyStashRuntime(command){
  const service=await ensureHydrated(this);
  let campaign=service.getCampaign(command.campaignId);
  if(!campaign) throw new Error("Campaign not found: "+command.campaignId);
  const campaignTransfer=()=>{
    const context={requestId:command.requestId,campaignId:command.campaignId,expectedCampaignRevision:campaign!.revision,initiatedByParticipantId:"dm.local",now:new Date().toISOString(),direction:command.direction};
    return command.asset==="currency"
      ? service.transferPartyStash({...context,asset:"currency",amount:command.amount})
      : service.transferPartyStash({...context,asset:"item",definitionId:command.definitionId,quantity:command.quantity,...(command.direction==="character-to-stash"&&command.itemTemplate?{itemTemplate:command.itemTemplate}:{})});
  };
  const inventoryCommand=command.asset==="currency"
    ? {requestId:command.requestId,actorId:command.actorId,operation:command.direction==="character-to-stash"?"revoke-currency" as const:"grant-currency" as const,amount:command.amount}
    : command.direction==="character-to-stash"
      ? {requestId:command.requestId,actorId:command.actorId,operation:"revoke-item" as const,itemId:command.itemId,quantity:command.quantity,forceUnequip:command.forceUnequip}
      : command.itemTemplate
        ? {requestId:command.requestId,actorId:command.actorId,operation:"grant-item-template" as const,itemTemplate:command.itemTemplate,quantity:command.quantity}
        : {requestId:command.requestId,actorId:command.actorId,operation:"grant-item" as const,catalogEntryId:command.catalogEntryId!,quantity:command.quantity};
  if(command.direction==="character-to-stash"){
    await this.adjustDmInventory(inventoryCommand);
    try{await campaignTransfer();}
    catch(error){await this.undoLastDmInventoryAdjustment();throw error;}
  }else{
    await campaignTransfer();
    try{await this.adjustDmInventory(inventoryCommand);}
    catch(error){
      campaign=service.getCampaign(command.campaignId);
      if(campaign){
        const context={requestId:command.requestId+".compensate",campaignId:command.campaignId,expectedCampaignRevision:campaign.revision,initiatedByParticipantId:"dm.local",now:new Date().toISOString(),direction:"character-to-stash" as const};
        if(command.asset==="currency") await service.transferPartyStash({...context,asset:"currency",amount:command.amount});
        else await service.transferPartyStash({...context,asset:"item",definitionId:command.definitionId,quantity:command.quantity,...(command.itemTemplate?{itemTemplate:command.itemTemplate}:{})});
      }
      throw error;
    }
  }
  return this.getSnapshot();
};
MockAdapter.prototype.commitConnectedPartyStashDeposit=async function commitConnectedPartyStashDepositRuntime(command){
  const service=await ensureHydrated(this);
  const campaign=service.getCampaign(command.campaignId);
  if(!campaign) throw new Error("Campaign not found: "+command.campaignId);
  const context={requestId:command.requestId,campaignId:command.campaignId,expectedCampaignRevision:campaign.revision,initiatedByParticipantId:command.actorId,now:new Date().toISOString(),direction:command.direction};
  if(command.asset==="currency")await service.transferPartyStash({...context,asset:"currency",amount:command.amount});
  else await service.transferPartyStash({...context,asset:"item",definitionId:command.definitionId,quantity:command.quantity,...(command.direction==="character-to-stash"&&command.itemTemplate?{itemTemplate:command.itemTemplate}:{})});
  return this.getSnapshot();
};

export function setCampaignLibraryStoreForTests(adapter:MockAdapter,store:CampaignLibraryStore){
  injectedStores.set(adapter,store);contexts.delete(adapter);
}

registerConnectedCampaignRosterHandler(async(adapter,candidate)=>{
  const captured=sessionSnapshots.get(adapter);
  if(!captured) return {status:"ignored",reason:"Host Session has no captured Campaign"};
  try{
    const service=await ensureHydrated(adapter);
    const campaign=service.getCampaign(captured.campaignId);
    if(!campaign) return {status:"rejected",error:`Captured Campaign not found: ${captured.campaignId}`};
    const existing=campaign.roster.find((member)=>member.kind==="player-character-ref"&&member.characterRef?.characterId===candidate.characterId);
    const rosterMemberId=existing?.rosterMemberId??`connected:${candidate.characterId}`;
    if(!existing&&campaign.roster.some((member)=>member.rosterMemberId===rosterMemberId)){
      return {status:"rejected",error:`Connected roster member id collides with another Campaign member: ${rosterMemberId}`};
    }
    const member:CampaignRosterMember=existing?{
      ...existing,
      label:candidate.participantName,
      characterRef:{...existing.characterRef,ownerHint:candidate.participantId,characterId:candidate.characterId},
      level:candidate.level??existing.level,
      active:true,
    }:{
      rosterMemberId,
      label:candidate.participantName,
      kind:"player-character-ref",
      characterRef:{ownerHint:candidate.participantId,characterId:candidate.characterId},
      level:candidate.level,
      active:true,
      countsForRations:true,
      rationUnitsPerDay:1,
      stashPermission:"request",
    };
    const unchanged=existing
      && existing.label===candidate.participantName
      && existing.active
      && existing.characterRef?.ownerHint===candidate.participantId;
    if(unchanged) return {status:"committed",campaignId:campaign.campaignId,rosterMemberId};
    await adapter.upsertCampaignRosterMember(campaign.campaignId,member);
    return {status:"committed",campaignId:campaign.campaignId,rosterMemberId};
  }catch(error){
    return {status:"rejected",error:error instanceof Error?error.message:String(error)};
  }
});

export function clearCampaignSessionSnapshot(adapter:MockAdapter){sessionSnapshots.delete(adapter);}
