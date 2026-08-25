import { CampaignLibraryRepository, CampaignStaleRevisionError, createCampaignRecordV1 } from "./campaignPersistence";
import type { CampaignCalendarDateTime, CampaignDmLibraryEntry, CampaignMealCommand, CampaignMutationContext, CampaignPartyStashItemTemplate, CampaignRationPreview, CampaignRecordV1, CampaignRosterMember, CampaignSessionSummary } from "./campaignPersistenceContracts";
import type { InstalledCampaignCalendarProfileV1, InstalledCampaignRationProfileV1 } from "./installedContentContracts";
import { HANDOUT_IMAGE_MAX_BYTES, isLocalImageAssetV1 } from "./localImageAsset";
import { campaignDateTimeToAbsoluteMinute, projectCampaignCalendar } from "./campaignCalendar";

const cp=<T,>(value:T):T=>structuredClone(value);
const bounded=<T,>(values:T[],limit=128)=>values.slice(-limit);
const DEFAULT_XP_THRESHOLDS=[0,0,300,900,2700,6500,14000,23000,34000,48000,64000,85000,100000,120000,140000,165000,195000,225000,265000,305000,355000];
export function campaignXpThresholdForLevel(level:number){return DEFAULT_XP_THRESHOLDS[Math.max(1,Math.min(20,level))];}

function assertNonNegativeInteger(value:number,label:string){if(!Number.isInteger(value)||value<0) throw new Error(`${label} must be a non-negative integer`);}
function assertPositiveInteger(value:number,label:string){if(!Number.isInteger(value)||value<=0) throw new Error(`${label} must be a positive integer`);}
function builtinCalendarProvider(providerId:string){return providerId==="builtin.simple-day"||providerId==="builtin.gregorian";}
function builtinRationProvider(providerId:string){return providerId==="builtin.tracking-only";}
function walletCopper(campaign:CampaignRecordV1){const wallet=campaign.partyStash.wallet;return wallet.gp*100+wallet.sp*10+wallet.cp;}
function setWalletCopper(campaign:CampaignRecordV1,total:number){
  assertNonNegativeInteger(total,"party wallet");
  campaign.partyStash.wallet={gp:Math.floor(total/100),sp:Math.floor(total%100/10),cp:total%10};
  campaign.partyStash.revision+=1;
}

export function previewCampaignDailyRations(campaign:CampaignRecordV1,overrideUnits?:number,profile?:InstalledCampaignRationProfileV1):CampaignRationPreview {
  const memberUnits=campaign.roster.filter((member)=>member.active&&member.countsForRations).map((member)=>({
    rosterMemberId:member.rosterMemberId,label:member.label,units:member.rationUnitsPerDay??profile?.unitsByRosterKind?.[member.kind]??profile?.defaultUnitsPerDay??1,
  }));
  memberUnits.forEach((member)=>assertNonNegativeInteger(member.units,`ration units for ${member.label}`));
  const rosterRequired=memberUnits.reduce((sum,member)=>sum+member.units,0);
  const requiredUnits=overrideUnits??rosterRequired;
  assertNonNegativeInteger(requiredUnits,"required ration units");
  const availableUnits=campaign.rations.ledger.balances.ration??0;
  const consumedUnits=Math.min(availableUnits,requiredUnits);
  return {memberCount:memberUnits.length,requiredUnits,availableUnits,consumedUnits,shortageUnits:requiredUnits-consumedUnits,memberUnits};
}

export class CampaignApplicationService {
  constructor(private readonly repository:CampaignLibraryRepository){}
  async hydrate(){return this.repository.hydrate();}
  snapshot(){return this.repository.snapshot();}
  listCampaigns(){return this.repository.snapshot()?.campaigns??[];}
  getCampaign(campaignId:string){return this.listCampaigns().find((campaign)=>campaign.campaignId===campaignId)??null;}

  async createCampaign(input:{campaignId:string;name:string;description?:string;now:string}){
    const document=this.repository.snapshot();
    if(!document) throw new Error("Campaign service must hydrate before create");
    if(document.campaigns.some((campaign)=>campaign.campaignId===input.campaignId)) throw new Error(`Campaign already exists: ${input.campaignId}`);
    const campaign=createCampaignRecordV1(input);
    await this.repository.commit({...document,activeCampaignId:input.campaignId,campaigns:[...document.campaigns,campaign]});
    return cp(campaign);
  }

  async mutateCampaign(context:CampaignMutationContext,mutator:(campaign:CampaignRecordV1)=>void){
    const document=this.repository.snapshot();
    if(!document) throw new Error("Campaign service must hydrate before mutation");
    const index=document.campaigns.findIndex((campaign)=>campaign.campaignId===context.campaignId);
    if(index<0) throw new Error(`Campaign not found: ${context.campaignId}`);
    const current=document.campaigns[index];
    if(current.recentRequestIds.includes(context.requestId)) return cp(current);
    if(current.revision!==context.expectedCampaignRevision) throw new CampaignStaleRevisionError(`stale Campaign revision: expected ${context.expectedCampaignRevision}, current ${current.revision}`);
    const next=cp(current);
    mutator(next);
    next.revision=current.revision+1;
    next.updatedAt=context.now??current.updatedAt;
    next.recentRequestIds=[...current.recentRequestIds,context.requestId].slice(-128);
    const campaigns=[...document.campaigns];campaigns[index]=next;
    await this.repository.commit({...document,campaigns});
    return this.getCampaign(context.campaignId)!;
  }

  updateCampaign(context:CampaignMutationContext&{payload:{name?:string;description?:string}}){
    return this.mutateCampaign(context,(campaign)=>{
      if(context.payload.name!==undefined){if(!context.payload.name.trim()) throw new Error("Campaign name is required");campaign.name=context.payload.name.trim();}
      if(context.payload.description!==undefined) campaign.description=context.payload.description;
    });
  }
  archiveCampaign(context:CampaignMutationContext){return this.mutateCampaign(context,(campaign)=>{campaign.status="archived";});}
  restoreCampaign(context:CampaignMutationContext){return this.mutateCampaign(context,(campaign)=>{campaign.status="active";});}

  upsertRosterMember(context:CampaignMutationContext&{member:CampaignRosterMember}){
    return this.mutateCampaign(context,(campaign)=>{
      const member=cp(context.member);
      if(!member.rosterMemberId||!member.label.trim()) throw new Error("Roster member id and label are required");
      if(member.rationUnitsPerDay!==undefined) assertNonNegativeInteger(member.rationUnitsPerDay,"rationUnitsPerDay");
      const index=campaign.roster.findIndex((item)=>item.rosterMemberId===member.rosterMemberId);
      if(index<0) campaign.roster.push(member); else campaign.roster[index]=member;
    });
  }

  removeRosterMember(context:CampaignMutationContext&{rosterMemberId:string}){
    return this.mutateCampaign(context,(campaign)=>{campaign.roster=campaign.roster.filter((member)=>member.rosterMemberId!==context.rosterMemberId);});
  }

  grantAdvancement(context:CampaignMutationContext&{rosterMemberIds:string[];kind:"xp"|"level-up-credit";amount:number;levels?:Record<string,number>}){
    assertPositiveInteger(context.amount,"advancement amount");
    const rosterMemberIds=[...new Set(context.rosterMemberIds)];
    if(!rosterMemberIds.length) throw new Error("At least one roster member is required");
    return this.mutateCampaign(context,(campaign)=>{
      const missing=rosterMemberIds.filter((id)=>!campaign.roster.some((member)=>member.rosterMemberId===id));
      if(missing.length) throw new Error("Campaign roster member not found: "+missing.join(", "));
      const state=campaign.advancement??{revision:0,members:{},history:[]};
      for(const rosterMemberId of rosterMemberIds){
        const member=campaign.roster.find((item)=>item.rosterMemberId===rosterMemberId)!;
        const level=context.levels?.[rosterMemberId]??member.level??1;
        if(member.level===undefined) member.level=level;
        const current=state.members[rosterMemberId]??{xp:campaignXpThresholdForLevel(level),levelUpCredits:0};
        state.members[rosterMemberId]=context.kind==="xp"
          ? {...current,xp:current.xp+context.amount}
          : {...current,levelUpCredits:current.levelUpCredits+context.amount};
      }
      state.revision+=1;
      state.history=bounded([...state.history,{transactionId:context.requestId,kind:context.kind,rosterMemberIds,amount:context.amount,committedAt:context.now??campaign.updatedAt,initiatedByParticipantId:context.initiatedByParticipantId}]);
      campaign.advancement=state;
    });
  }

  consumeLevelUpCredit(context:CampaignMutationContext&{rosterMemberId:string;level?:number}){
    return this.mutateCampaign(context,(campaign)=>{
      const rosterMember=campaign.roster.find((member)=>member.rosterMemberId===context.rosterMemberId);
      if(context.level!==undefined&&rosterMember) rosterMember.level=context.level;
      const current=campaign.advancement?.members[context.rosterMemberId];
      if(!current||current.levelUpCredits<1) return;
      current.levelUpCredits-=1;
      campaign.advancement!.revision+=1;
    });
  }

  transferPartyStash(context:CampaignMutationContext&(
    | {direction:"character-to-stash"|"stash-to-character";asset:"currency";amount:number}
    | {direction:"character-to-stash"|"stash-to-character";asset:"item";definitionId:string;quantity:number;itemTemplate?:CampaignPartyStashItemTemplate}
  )){
    const amount=context.asset==="currency"?context.amount:context.quantity;
    assertPositiveInteger(amount,"party stash transfer amount");
    return this.mutateCampaign(context,(campaign)=>{
      const sign=context.direction==="character-to-stash"?1:-1;
      if(context.asset==="currency"){
        const after=campaign.partyStash.wallet.gp+sign*context.amount;
        assertNonNegativeInteger(after,"party stash GP");
        campaign.partyStash.wallet.gp=after;
      }else{
        const definitionId=context.definitionId.trim();
        if(!definitionId) throw new Error("Party stash item definition is required");
        const existing=campaign.partyStash.itemReferences.find((item)=>item.definitionId===definitionId);
        const before=existing?.quantity??0;
        const after=before+sign*context.quantity;
        assertNonNegativeInteger(after,"party stash item quantity");
        if(existing){
          existing.quantity=after;
          if(context.itemTemplate&&!existing.itemTemplate)existing.itemTemplate=cp(context.itemTemplate);
          if(after===0) campaign.partyStash.itemReferences=campaign.partyStash.itemReferences.filter((item)=>item.instanceId!==existing.instanceId);
        }else{
          if(sign<0) throw new Error("Party stash item is unavailable");
          campaign.partyStash.itemReferences.push({instanceId:"stash."+definitionId,definitionId,quantity:after,...(context.itemTemplate?{itemTemplate:cp(context.itemTemplate)}:{})});
        }
      }
      campaign.partyStash.revision+=1;
    });
  }

  upsertDmLibraryEntry(context:CampaignMutationContext&{entry:CampaignDmLibraryEntry}){
    const entry=cp(context.entry);entry.entryId=entry.entryId.trim();entry.label=entry.label.trim();
    if(!entry.entryId||!entry.label)throw new Error("DM Library entry id and label are required");
    if(entry.kind==="custom-item"&&(!entry.definitionId?.trim()||!entry.itemTemplate))throw new Error("Custom item definition and template are required");
    if(entry.kind==="image"&&!isLocalImageAssetV1(entry.imageAsset,HANDOUT_IMAGE_MAX_BYTES))throw new Error("DM Library image must be PNG, JPEG, or WebP up to 4 MiB");
    if(entry.kind==="npc-definition"){
      const npc=entry.npcDefinition;
      if(!entry.definitionId?.trim()||!npc||npc.definitionId!==entry.definitionId||!npc.name.trim())throw new Error("NPC definition id and name are required");
      if(!Number.isInteger(npc.ac)||npc.ac<0||!Number.isInteger(npc.maxHp)||npc.maxHp<1)throw new Error("NPC AC and HP are invalid");
    }
    entry.tags=[...new Set((entry.tags??[]).map((tag)=>tag.trim()).filter(Boolean))];entry.updatedAt=context.now;
    return this.mutateCampaign(context,(campaign)=>{const index=campaign.dmLibrary.entries.findIndex((value)=>value.entryId===entry.entryId);if(index>=0)campaign.dmLibrary.entries[index]=entry;else campaign.dmLibrary.entries.push(entry);campaign.dmLibrary.revision+=1;});
  }

  removeDmLibraryEntry(context:CampaignMutationContext&{entryId:string}){
    return this.mutateCampaign(context,(campaign)=>{if(!campaign.dmLibrary.entries.some((entry)=>entry.entryId===context.entryId))throw new Error("DM Library entry not found");campaign.dmLibrary.entries=campaign.dmLibrary.entries.filter((entry)=>entry.entryId!==context.entryId);campaign.dmLibrary.recentEntryIds=campaign.dmLibrary.recentEntryIds.filter((id)=>id!==context.entryId);campaign.dmLibrary.revision+=1;});
  }

  touchDmLibraryEntry(context:CampaignMutationContext&{entryId:string}){
    return this.mutateCampaign(context,(campaign)=>{if(!campaign.dmLibrary.entries.some((entry)=>entry.entryId===context.entryId))throw new Error("DM Library entry not found");campaign.dmLibrary.recentEntryIds=[context.entryId,...campaign.dmLibrary.recentEntryIds.filter((id)=>id!==context.entryId)].slice(0,12);campaign.dmLibrary.revision+=1;});
  }

  configureCalendar(context:CampaignMutationContext&{enabled:boolean;providerId:string;providerVersion?:string;calendarProfile?:InstalledCampaignCalendarProfileV1}){
    return this.mutateCampaign(context,(campaign)=>{
      const providerId=context.providerId.trim();
      if(!providerId) throw new Error("Calendar provider is required");
      if(context.enabled&&!builtinCalendarProvider(providerId)&&!context.calendarProfile) throw new Error(`Installed calendar provider is unavailable: ${providerId}`);
      const providerVersion=builtinCalendarProvider(providerId)?"1":context.providerVersion?.trim()||campaign.calendar.capability.providerVersion;
      if(context.enabled&&!providerVersion) throw new Error("Calendar provider version is required");
      campaign.calendar.capability={...campaign.calendar.capability,enabled:context.enabled,providerId,providerVersion,settingsRevision:campaign.calendar.capability.settingsRevision+1};
      campaign.calendar.state.providerId=providerId;
      if(builtinCalendarProvider(providerId)||context.calendarProfile){
        const era=campaign.calendar.state.displayAnchor.era??context.calendarProfile?.defaultEra??"서력";
        campaign.calendar.state.displayAnchor=projectCampaignCalendar(providerId,campaign.calendar.state.absoluteMinute,era,context.calendarProfile);
      }
      campaign.sessionDefaults.calendarEnabled=context.enabled;
      campaign.sessionDefaults.revision+=1;
    });
  }

  advanceCalendar(context:CampaignMutationContext&{deltaMinutes:number;note?:string;calendarProfile?:InstalledCampaignCalendarProfileV1}){
    assertPositiveInteger(context.deltaMinutes,"calendar deltaMinutes");
    return this.mutateCampaign(context,(campaign)=>{
      if(!campaign.calendar.capability.enabled) throw new Error("Calendar capability is disabled");
      if(!builtinCalendarProvider(campaign.calendar.state.providerId)&&!context.calendarProfile) throw new Error(`Installed calendar provider is unavailable: ${campaign.calendar.state.providerId}`);
      const before=campaign.calendar.state.absoluteMinute;const after=before+context.deltaMinutes;
      campaign.calendar.state.absoluteMinute=after;campaign.calendar.state.revision+=1;
      campaign.calendar.state.displayAnchor=projectCampaignCalendar(campaign.calendar.state.providerId,after,campaign.calendar.state.displayAnchor.era,context.calendarProfile);
      if(context.note!==undefined) campaign.calendar.state.currentNote=context.note.trim()||undefined;
      campaign.calendar.state.history=bounded([...campaign.calendar.state.history,{transactionId:context.requestId,kind:"advance",deltaMinutes:context.deltaMinutes,beforeAbsoluteMinute:before,afterAbsoluteMinute:after,committedAt:context.now??campaign.updatedAt,note:context.note,provenance:[context.initiatedByParticipantId]}]);
    });
  }

  correctCalendar(context:CampaignMutationContext&{absoluteMinute:number;note:string;calendarProfile?:InstalledCampaignCalendarProfileV1}){
    assertNonNegativeInteger(context.absoluteMinute,"calendar absoluteMinute");
    if(!context.note.trim()) throw new Error("Calendar correction note is required");
    return this.mutateCampaign(context,(campaign)=>{
      if(!campaign.calendar.capability.enabled) throw new Error("Calendar capability is disabled");
      if(!builtinCalendarProvider(campaign.calendar.state.providerId)&&!context.calendarProfile) throw new Error(`Installed calendar provider is unavailable: ${campaign.calendar.state.providerId}`);
      const before=campaign.calendar.state.absoluteMinute;const after=context.absoluteMinute;
      campaign.calendar.state.absoluteMinute=after;campaign.calendar.state.revision+=1;campaign.calendar.state.currentNote=context.note.trim();
      campaign.calendar.state.displayAnchor=projectCampaignCalendar(campaign.calendar.state.providerId,after,campaign.calendar.state.displayAnchor.era,context.calendarProfile);
      campaign.calendar.state.history=bounded([...campaign.calendar.state.history,{transactionId:context.requestId,kind:"correction",deltaMinutes:after-before,beforeAbsoluteMinute:before,afterAbsoluteMinute:after,committedAt:context.now??campaign.updatedAt,note:context.note.trim(),provenance:[context.initiatedByParticipantId]}]);
    });
  }

  setCalendarNote(context:CampaignMutationContext&{note:string}){
    return this.mutateCampaign(context,(campaign)=>{campaign.calendar.state.currentNote=context.note.trim()||undefined;campaign.calendar.state.revision+=1;});
  }

  correctCalendarDateTime(context:CampaignMutationContext&{dateTime:CampaignCalendarDateTime;note:string;calendarProfile?:InstalledCampaignCalendarProfileV1}){
    if(!context.note.trim()) throw new Error("Calendar correction note is required");
    return this.mutateCampaign(context,(campaign)=>{
      if(!campaign.calendar.capability.enabled) throw new Error("Calendar capability is disabled");
      if(!builtinCalendarProvider(campaign.calendar.state.providerId)&&!context.calendarProfile) throw new Error(`Installed calendar provider is unavailable: ${campaign.calendar.state.providerId}`);
      const before=campaign.calendar.state.absoluteMinute;
      const after=campaignDateTimeToAbsoluteMinute(campaign.calendar.state.providerId,context.dateTime,context.calendarProfile);
      campaign.calendar.state.absoluteMinute=after;campaign.calendar.state.revision+=1;campaign.calendar.state.currentNote=context.note.trim();
      campaign.calendar.state.displayAnchor=projectCampaignCalendar(campaign.calendar.state.providerId,after,context.dateTime.era,context.calendarProfile);
      campaign.calendar.state.history=bounded([...campaign.calendar.state.history,{transactionId:context.requestId,kind:"correction",deltaMinutes:after-before,beforeAbsoluteMinute:before,afterAbsoluteMinute:after,committedAt:context.now??campaign.updatedAt,note:context.note.trim(),provenance:[context.initiatedByParticipantId]}]);
    });
  }

  undoRecentCalendar(context:CampaignMutationContext&{calendarProfile?:InstalledCampaignCalendarProfileV1}){
    return this.mutateCampaign(context,(campaign)=>{
      if(!builtinCalendarProvider(campaign.calendar.state.providerId)&&!context.calendarProfile) throw new Error(`Installed calendar provider is unavailable: ${campaign.calendar.state.providerId}`);
      const reverted=new Set(campaign.calendar.state.history.flatMap((entry)=>entry.revertsTransactionId?[entry.revertsTransactionId]:[]));
      const source=[...campaign.calendar.state.history].reverse().find((entry)=>entry.kind!=="undo"&&!reverted.has(entry.transactionId));
      if(!source) throw new Error("Undo 가능한 달력 변경이 없습니다.");
      const before=campaign.calendar.state.absoluteMinute;
      if(before!==source.afterAbsoluteMinute) throw new Error("이후 달력 변경이 있어 안전하게 되돌릴 수 없습니다.");
      const after=source.beforeAbsoluteMinute;
      campaign.calendar.state.absoluteMinute=after;campaign.calendar.state.revision+=1;campaign.calendar.state.displayAnchor=projectCampaignCalendar(campaign.calendar.state.providerId,after,campaign.calendar.state.displayAnchor.era,context.calendarProfile);
      campaign.calendar.state.history=bounded([...campaign.calendar.state.history,{transactionId:context.requestId,kind:"undo",deltaMinutes:after-before,beforeAbsoluteMinute:before,afterAbsoluteMinute:after,committedAt:context.now??campaign.updatedAt,revertsTransactionId:source.transactionId,provenance:[context.initiatedByParticipantId]}]);
    });
  }

  configureRations(context:CampaignMutationContext&{enabled:boolean;providerId:string;providerVersion?:string;rationProfile?:InstalledCampaignRationProfileV1}){
    return this.mutateCampaign(context,(campaign)=>{
      const providerId=context.providerId.trim();if(!providerId) throw new Error("Ration provider is required");
      if(context.enabled&&!builtinRationProvider(providerId)&&!context.rationProfile) throw new Error(`Installed ration provider is unavailable: ${providerId}`);
      const providerVersion=builtinRationProvider(providerId)?"1":context.providerVersion?.trim()||campaign.rations.capability.providerVersion;
      if(context.enabled&&!providerVersion) throw new Error("Ration provider version is required");
      campaign.rations.capability={...campaign.rations.capability,enabled:context.enabled,providerId,providerVersion,settingsRevision:campaign.rations.capability.settingsRevision+1};
      campaign.sessionDefaults.rationsEnabled=context.enabled;campaign.sessionDefaults.revision+=1;
    });
  }

  adjustRations(context:CampaignMutationContext&{amount:number;note?:string}){
    if(!Number.isInteger(context.amount)||context.amount===0) throw new Error("Ration adjustment must be a non-zero integer");
    return this.mutateCampaign(context,(campaign)=>{
      if(!campaign.rations.capability.enabled) throw new Error("Ration capability is disabled");
      const before=campaign.rations.ledger.balances.ration??0;const after=before+context.amount;
      assertNonNegativeInteger(after,"ration balance");
      campaign.rations.ledger.balances.ration=after;campaign.rations.ledger.revision+=1;
      campaign.rations.ledger.consumptionHistory=bounded([...campaign.rations.ledger.consumptionHistory,{transactionId:context.requestId,kind:"adjust",amount:context.amount,balanceAfter:after,committedAt:context.now??campaign.updatedAt,note:context.note,provenance:[context.initiatedByParticipantId]}]);
    });
  }

  consumeDailyRations(context:CampaignMutationContext&{requiredUnits?:number;note?:string;rationProfile?:InstalledCampaignRationProfileV1}){
    return this.mutateCampaign(context,(campaign)=>{
      if(!campaign.rations.capability.enabled) throw new Error("Ration capability is disabled");
      if(!builtinRationProvider(campaign.rations.capability.providerId)&&!context.rationProfile) throw new Error(`Installed ration provider is unavailable: ${campaign.rations.capability.providerId}`);
      const preview=previewCampaignDailyRations(campaign,context.requiredUnits,context.rationProfile);
      const after=preview.availableUnits-preview.consumedUnits;
      campaign.rations.ledger.balances.ration=after;campaign.rations.ledger.revision+=1;
      campaign.rations.ledger.lastConsumptionAtAbsoluteMinute=campaign.calendar.state.absoluteMinute;
      campaign.rations.ledger.consumptionHistory=bounded([...campaign.rations.ledger.consumptionHistory,{transactionId:context.requestId,kind:"consume",amount:-preview.consumedUnits,requiredAmount:preview.requiredUnits,shortage:preview.shortageUnits,balanceAfter:after,committedAt:context.now??campaign.updatedAt,note:context.note,provenance:[context.initiatedByParticipantId,...preview.memberUnits.map((member)=>member.rosterMemberId)]}]);
    });
  }

  serveMeals(context:CampaignMutationContext&CampaignMealCommand){
    return this.mutateCampaign(context,(campaign)=>{
      if(!campaign.rations.capability.enabled) throw new Error("Ration capability is disabled");
      const ids=[...new Set(context.rosterMemberIds)];
      if(!ids.length) throw new Error("식사를 적용할 캐릭터를 선택하세요.");
      const members=ids.map((id)=>campaign.roster.find((member)=>member.rosterMemberId===id&&member.active&&member.countsForRations)).filter((member):member is CampaignRosterMember=>Boolean(member));
      if(members.length!==ids.length) throw new Error("활성 식사 대상이 아닌 캐릭터가 포함되어 있습니다.");
      const absoluteDay=Math.floor(campaign.calendar.state.absoluteMinute/1440);
      const tracking=campaign.rations.ledger.mealTracking?.absoluteDay===absoluteDay?cp(campaign.rations.ledger.mealTracking):{absoluteDay,mealsByRosterMember:{}};
      const mealUnitsByRosterMember=Object.fromEntries(members.map((member)=>[member.rosterMemberId,Math.max(0,Math.min(context.mealUnits,2-(tracking.mealsByRosterMember[member.rosterMemberId]??0)))] as const).filter((entry)=>entry[1]>0));
      const servedIds=Object.keys(mealUnitsByRosterMember);
      if(!servedIds.length) throw new Error("선택한 캐릭터는 오늘 식사를 모두 마쳤습니다.");
      const rationCost=context.source==="ration"?servedIds.length:0;
      const beforeRations=campaign.rations.ledger.balances.ration??0;
      if(beforeRations<rationCost) throw new Error("일일 식량이 부족합니다.");
      const costSp=context.source==="tavern"?Math.max(0,Math.trunc(context.costSpPerPerson??0))*servedIds.length:0;
      const beforeCopper=walletCopper(campaign);
      if(beforeCopper<costSp*10) throw new Error("파티 보관함의 식사 비용이 부족합니다.");
      if(costSp)setWalletCopper(campaign,beforeCopper-costSp*10);
      for(const rosterMemberId of servedIds)tracking.mealsByRosterMember[rosterMemberId]=(tracking.mealsByRosterMember[rosterMemberId]??0)+mealUnitsByRosterMember[rosterMemberId];
      const afterRations=beforeRations-rationCost;
      campaign.rations.ledger.mealTracking=tracking;
      campaign.rations.ledger.balances.ration=afterRations;
      campaign.rations.ledger.revision+=1;
      campaign.rations.ledger.consumptionHistory=bounded([...campaign.rations.ledger.consumptionHistory,{transactionId:context.requestId,kind:"meal",amount:-rationCost,balanceAfter:afterRations,committedAt:context.now??campaign.updatedAt,rosterMemberIds:servedIds,mealUnits:context.mealUnits,mealUnitsByRosterMember,mealSource:context.source,costSp,campaignAbsoluteMinute:campaign.calendar.state.absoluteMinute,provenance:[context.initiatedByParticipantId,...servedIds]}]);
    });
  }

  setMemberMeals(context:CampaignMutationContext&{rosterMemberId:string;mealCount:number}){
    assertNonNegativeInteger(context.mealCount,"meal count");
    if(context.mealCount>2)throw new Error("하루 식사는 최대 2식입니다.");
    return this.mutateCampaign(context,(campaign)=>{
      if(!campaign.rations.capability.enabled)throw new Error("Ration capability is disabled");
      const member=campaign.roster.find((candidate)=>candidate.rosterMemberId===context.rosterMemberId&&candidate.active&&candidate.countsForRations);
      if(!member)throw new Error("활성 식사 대상 캐릭터를 찾지 못했습니다.");
      const absoluteDay=Math.floor(campaign.calendar.state.absoluteMinute/1440);
      const tracking=campaign.rations.ledger.mealTracking?.absoluteDay===absoluteDay?cp(campaign.rations.ledger.mealTracking):{absoluteDay,mealsByRosterMember:{}};
      const before=tracking.mealsByRosterMember[member.rosterMemberId]??0;const delta=context.mealCount-before;
      if(!delta)return;
      tracking.mealsByRosterMember[member.rosterMemberId]=context.mealCount;
      campaign.rations.ledger.mealTracking=tracking;campaign.rations.ledger.revision+=1;
      const balance=campaign.rations.ledger.balances.ration??0;
      campaign.rations.ledger.consumptionHistory=bounded([...campaign.rations.ledger.consumptionHistory,{transactionId:context.requestId,kind:"meal",amount:0,balanceAfter:balance,committedAt:context.now??campaign.updatedAt,rosterMemberIds:[member.rosterMemberId],mealUnits:delta,mealUnitsByRosterMember:{[member.rosterMemberId]:delta},mealSource:"manual",campaignAbsoluteMinute:campaign.calendar.state.absoluteMinute,provenance:[context.initiatedByParticipantId,member.rosterMemberId]}]);
    });
  }

  undoRecentMeal(context:CampaignMutationContext){
    return this.mutateCampaign(context,(campaign)=>{
      const history=campaign.rations.ledger.consumptionHistory;
      const reverted=new Set(history.flatMap((entry)=>entry.revertsTransactionId?[entry.revertsTransactionId]:[]));
      const source=[...history].reverse().find((entry)=>entry.kind==="meal"&&!reverted.has(entry.transactionId));
      if(!source) throw new Error("되돌릴 식사 기록이 없습니다.");
      const absoluteDay=Math.floor(campaign.calendar.state.absoluteMinute/1440);
      const tracking=campaign.rations.ledger.mealTracking;
      if(!tracking||tracking.absoluteDay!==absoluteDay||Math.floor((source.campaignAbsoluteMinute??-1440)/1440)!==absoluteDay) throw new Error("지난 날짜의 식사 기록은 되돌릴 수 없습니다.");
      for(const [rosterMemberId,units] of Object.entries(source.mealUnitsByRosterMember??{}))tracking.mealsByRosterMember[rosterMemberId]=Math.max(0,(tracking.mealsByRosterMember[rosterMemberId]??0)-units);
      const restoredRations=Math.abs(source.amount);const after=(campaign.rations.ledger.balances.ration??0)+restoredRations;
      campaign.rations.ledger.balances.ration=after;
      if(source.costSp)setWalletCopper(campaign,walletCopper(campaign)+source.costSp*10);
      campaign.rations.ledger.revision+=1;
      campaign.rations.ledger.consumptionHistory=bounded([...history,{transactionId:context.requestId,kind:"undo",amount:restoredRations,balanceAfter:after,committedAt:context.now??campaign.updatedAt,revertsTransactionId:source.transactionId,campaignAbsoluteMinute:campaign.calendar.state.absoluteMinute,provenance:[context.initiatedByParticipantId]}]);
    });
  }

  undoRecentRationConsumption(context:CampaignMutationContext){
    return this.mutateCampaign(context,(campaign)=>{
      const history=campaign.rations.ledger.consumptionHistory;
      const reverted=new Set(history.flatMap((entry)=>entry.revertsTransactionId?[entry.revertsTransactionId]:[]));
      const source=[...history].reverse().find((entry)=>entry.kind==="consume"&&!reverted.has(entry.transactionId));
      if(!source) throw new Error("Undo 가능한 식량 소비가 없습니다.");
      const restored=Math.abs(source.amount);const after=(campaign.rations.ledger.balances.ration??0)+restored;
      campaign.rations.ledger.balances.ration=after;campaign.rations.ledger.revision+=1;
      campaign.rations.ledger.consumptionHistory=bounded([...history,{transactionId:context.requestId,kind:"undo",amount:restored,balanceAfter:after,committedAt:context.now??campaign.updatedAt,revertsTransactionId:source.transactionId,provenance:[context.initiatedByParticipantId]}]);
    });
  }

  advanceDayWithOptionalRations(context:CampaignMutationContext&{consumeRations:boolean;requiredUnits?:number;note?:string;calendarProfile?:InstalledCampaignCalendarProfileV1;rationProfile?:InstalledCampaignRationProfileV1}){
    return this.mutateCampaign(context,(campaign)=>{
      if(!campaign.calendar.capability.enabled) throw new Error("Calendar capability is disabled");
      if(!builtinCalendarProvider(campaign.calendar.state.providerId)&&!context.calendarProfile) throw new Error(`Installed calendar provider is unavailable: ${campaign.calendar.state.providerId}`);
      if(context.consumeRations&&campaign.rations.capability.enabled&&!builtinRationProvider(campaign.rations.capability.providerId)&&!context.rationProfile) throw new Error(`Installed ration provider is unavailable: ${campaign.rations.capability.providerId}`);
      const before=campaign.calendar.state.absoluteMinute;const after=before+1440;
      campaign.calendar.state.absoluteMinute=after;campaign.calendar.state.revision+=1;campaign.calendar.state.displayAnchor=projectCampaignCalendar(campaign.calendar.state.providerId,after,campaign.calendar.state.displayAnchor.era,context.calendarProfile);
      campaign.calendar.state.history=bounded([...campaign.calendar.state.history,{transactionId:`${context.requestId}.calendar`,kind:"advance",deltaMinutes:1440,beforeAbsoluteMinute:before,afterAbsoluteMinute:after,committedAt:context.now??campaign.updatedAt,note:context.note,provenance:[context.requestId,context.initiatedByParticipantId]}]);
      if(context.consumeRations&&campaign.rations.capability.enabled){
        const preview=previewCampaignDailyRations(campaign,context.requiredUnits,context.rationProfile);const balance=preview.availableUnits-preview.consumedUnits;
        campaign.rations.ledger.balances.ration=balance;campaign.rations.ledger.revision+=1;campaign.rations.ledger.lastConsumptionAtAbsoluteMinute=after;
        campaign.rations.ledger.consumptionHistory=bounded([...campaign.rations.ledger.consumptionHistory,{transactionId:`${context.requestId}.rations`,kind:"consume",amount:-preview.consumedUnits,requiredAmount:preview.requiredUnits,shortage:preview.shortageUnits,balanceAfter:balance,committedAt:context.now??campaign.updatedAt,note:context.note,provenance:[context.requestId,context.initiatedByParticipantId,...preview.memberUnits.map((member)=>member.rosterMemberId)]}]);
      }
    });
  }

  appendSessionSummary(context:CampaignMutationContext&{summary:CampaignSessionSummary}){
    return this.mutateCampaign(context,(campaign)=>{
      const summary=cp(context.summary);if(!summary.sessionId||!summary.title.trim()) throw new Error("Session summary identity is required");
      campaign.sessionHistory=bounded([...campaign.sessionHistory.filter((item)=>item.sessionId!==summary.sessionId),summary],50);
      campaign.lastSessionId=summary.sessionId;
    });
  }

  async openCampaign(context:CampaignMutationContext){
    const document=this.repository.snapshot();
    if(!document) throw new Error("Campaign service must hydrate before open");
    const index=document.campaigns.findIndex((campaign)=>campaign.campaignId===context.campaignId);
    if(index<0) throw new Error(`Campaign not found: ${context.campaignId}`);
    const current=document.campaigns[index];
    if(current.recentRequestIds.includes(context.requestId)&&document.activeCampaignId===context.campaignId) return cp(current);
    if(current.revision!==context.expectedCampaignRevision) throw new CampaignStaleRevisionError(`stale Campaign revision: expected ${context.expectedCampaignRevision}, current ${current.revision}`);
    const next=cp(current);
    next.revision=current.revision+1;next.updatedAt=context.now??current.updatedAt;next.lastOpenedAt=context.now??current.updatedAt;
    next.recentRequestIds=[...current.recentRequestIds,context.requestId].slice(-128);
    const campaigns=[...document.campaigns];campaigns[index]=next;
    await this.repository.commit({...document,activeCampaignId:context.campaignId,campaigns});
    return cp(next);
  }

  async duplicateCampaign(context:CampaignMutationContext&{newCampaignId:string;newName:string}){
    const existing=this.getCampaign(context.newCampaignId);
    if(existing?.recentRequestIds.includes(context.requestId)) return existing;
    const source=this.getCampaign(context.campaignId);
    if(!source) throw new Error(`Campaign not found: ${context.campaignId}`);
    if(source.revision!==context.expectedCampaignRevision) throw new CampaignStaleRevisionError(`stale Campaign revision: expected ${context.expectedCampaignRevision}, current ${source.revision}`);
    if(existing) throw new Error(`Campaign already exists: ${context.newCampaignId}`);
    const document=this.repository.snapshot()!;
    const duplicate=cp(source);
    duplicate.campaignId=context.newCampaignId;duplicate.name=context.newName;duplicate.description=source.description;
    duplicate.status="active";duplicate.createdAt=context.now??source.updatedAt;duplicate.updatedAt=context.now??source.updatedAt;
    duplicate.lastOpenedAt=undefined;duplicate.lastSessionId=undefined;duplicate.revision=1;duplicate.sessionHistory=[];
    duplicate.partyStash.stashId=`${context.newCampaignId}.stash`;duplicate.dmLibrary.namespaceId=`${context.newCampaignId}.dm-library`;
    duplicate.sessionDefaults.contentLoadoutId=`${context.newCampaignId}.loadout.default`;duplicate.contentLoadout.loadoutId=`${context.newCampaignId}.loadout.default`;
    duplicate.recentRequestIds=[context.requestId];
    await this.repository.commit({...document,activeCampaignId:duplicate.campaignId,campaigns:[...document.campaigns,duplicate]});
    return cp(duplicate);
  }

  async deleteCampaign(context:CampaignMutationContext){
    const document=this.repository.snapshot();
    if(!document) throw new Error("Campaign service must hydrate before delete");
    const campaign=document.campaigns.find((item)=>item.campaignId===context.campaignId);
    if(!campaign) return;
    if(campaign.revision!==context.expectedCampaignRevision) throw new CampaignStaleRevisionError(`stale Campaign revision: expected ${context.expectedCampaignRevision}, current ${campaign.revision}`);
    const campaigns=document.campaigns.filter((item)=>item.campaignId!==context.campaignId);
    await this.repository.commit({...document,activeCampaignId:document.activeCampaignId===context.campaignId?(campaigns[0]?.campaignId??null):document.activeCampaignId,campaigns});
  }
}
