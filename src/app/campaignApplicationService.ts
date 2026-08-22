import { CampaignLibraryRepository, CampaignStaleRevisionError, createCampaignRecordV1 } from "./campaignPersistence";
import type { CampaignMutationContext, CampaignRationPreview, CampaignRecordV1, CampaignRosterMember, CampaignSessionSummary } from "./campaignPersistenceContracts";

const cp=<T,>(value:T):T=>structuredClone(value);
const bounded=<T,>(values:T[],limit=128)=>values.slice(-limit);

function assertNonNegativeInteger(value:number,label:string){if(!Number.isInteger(value)||value<0) throw new Error(`${label} must be a non-negative integer`);}
function assertPositiveInteger(value:number,label:string){if(!Number.isInteger(value)||value<=0) throw new Error(`${label} must be a positive integer`);}

export function previewCampaignDailyRations(campaign:CampaignRecordV1,overrideUnits?:number):CampaignRationPreview {
  const memberUnits=campaign.roster.filter((member)=>member.active&&member.countsForRations).map((member)=>({
    rosterMemberId:member.rosterMemberId,label:member.label,units:member.rationUnitsPerDay??1,
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
    return cp(next);
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

  configureCalendar(context:CampaignMutationContext&{enabled:boolean;providerId:string}){
    return this.mutateCampaign(context,(campaign)=>{
      const providerId=context.providerId.trim();
      if(!providerId) throw new Error("Calendar provider is required");
      campaign.calendar.capability={...campaign.calendar.capability,enabled:context.enabled,providerId,settingsRevision:campaign.calendar.capability.settingsRevision+1};
      campaign.calendar.state.providerId=providerId;
      campaign.sessionDefaults.calendarEnabled=context.enabled;
      campaign.sessionDefaults.revision+=1;
    });
  }

  advanceCalendar(context:CampaignMutationContext&{deltaMinutes:number;note?:string}){
    assertPositiveInteger(context.deltaMinutes,"calendar deltaMinutes");
    return this.mutateCampaign(context,(campaign)=>{
      if(!campaign.calendar.capability.enabled) throw new Error("Calendar capability is disabled");
      const before=campaign.calendar.state.absoluteMinute;const after=before+context.deltaMinutes;
      campaign.calendar.state.absoluteMinute=after;campaign.calendar.state.revision+=1;
      campaign.calendar.state.displayAnchor.day=Math.floor(after/1440)+1;
      if(context.note!==undefined) campaign.calendar.state.currentNote=context.note.trim()||undefined;
      campaign.calendar.state.history=bounded([...campaign.calendar.state.history,{transactionId:context.requestId,kind:"advance",deltaMinutes:context.deltaMinutes,beforeAbsoluteMinute:before,afterAbsoluteMinute:after,committedAt:context.now??campaign.updatedAt,note:context.note,provenance:[context.initiatedByParticipantId]}]);
    });
  }

  correctCalendar(context:CampaignMutationContext&{absoluteMinute:number;note:string}){
    assertNonNegativeInteger(context.absoluteMinute,"calendar absoluteMinute");
    if(!context.note.trim()) throw new Error("Calendar correction note is required");
    return this.mutateCampaign(context,(campaign)=>{
      if(!campaign.calendar.capability.enabled) throw new Error("Calendar capability is disabled");
      const before=campaign.calendar.state.absoluteMinute;const after=context.absoluteMinute;
      campaign.calendar.state.absoluteMinute=after;campaign.calendar.state.revision+=1;campaign.calendar.state.currentNote=context.note.trim();
      campaign.calendar.state.displayAnchor.day=Math.floor(after/1440)+1;
      campaign.calendar.state.history=bounded([...campaign.calendar.state.history,{transactionId:context.requestId,kind:"correction",deltaMinutes:after-before,beforeAbsoluteMinute:before,afterAbsoluteMinute:after,committedAt:context.now??campaign.updatedAt,note:context.note.trim(),provenance:[context.initiatedByParticipantId]}]);
    });
  }

  setCalendarNote(context:CampaignMutationContext&{note:string}){
    return this.mutateCampaign(context,(campaign)=>{campaign.calendar.state.currentNote=context.note.trim()||undefined;campaign.calendar.state.revision+=1;});
  }

  undoRecentCalendar(context:CampaignMutationContext){
    return this.mutateCampaign(context,(campaign)=>{
      const reverted=new Set(campaign.calendar.state.history.flatMap((entry)=>entry.revertsTransactionId?[entry.revertsTransactionId]:[]));
      const source=[...campaign.calendar.state.history].reverse().find((entry)=>entry.kind!=="undo"&&!reverted.has(entry.transactionId));
      if(!source) throw new Error("Undo 가능한 달력 변경이 없습니다.");
      const before=campaign.calendar.state.absoluteMinute;
      if(before!==source.afterAbsoluteMinute) throw new Error("이후 달력 변경이 있어 안전하게 되돌릴 수 없습니다.");
      const after=source.beforeAbsoluteMinute;
      campaign.calendar.state.absoluteMinute=after;campaign.calendar.state.revision+=1;campaign.calendar.state.displayAnchor.day=Math.floor(after/1440)+1;
      campaign.calendar.state.history=bounded([...campaign.calendar.state.history,{transactionId:context.requestId,kind:"undo",deltaMinutes:after-before,beforeAbsoluteMinute:before,afterAbsoluteMinute:after,committedAt:context.now??campaign.updatedAt,revertsTransactionId:source.transactionId,provenance:[context.initiatedByParticipantId]}]);
    });
  }

  configureRations(context:CampaignMutationContext&{enabled:boolean;providerId:string}){
    return this.mutateCampaign(context,(campaign)=>{
      const providerId=context.providerId.trim();if(!providerId) throw new Error("Ration provider is required");
      campaign.rations.capability={...campaign.rations.capability,enabled:context.enabled,providerId,settingsRevision:campaign.rations.capability.settingsRevision+1};
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

  consumeDailyRations(context:CampaignMutationContext&{requiredUnits?:number;note?:string}){
    return this.mutateCampaign(context,(campaign)=>{
      if(!campaign.rations.capability.enabled) throw new Error("Ration capability is disabled");
      const preview=previewCampaignDailyRations(campaign,context.requiredUnits);
      const after=preview.availableUnits-preview.consumedUnits;
      campaign.rations.ledger.balances.ration=after;campaign.rations.ledger.revision+=1;
      campaign.rations.ledger.lastConsumptionAtAbsoluteMinute=campaign.calendar.state.absoluteMinute;
      campaign.rations.ledger.consumptionHistory=bounded([...campaign.rations.ledger.consumptionHistory,{transactionId:context.requestId,kind:"consume",amount:-preview.consumedUnits,requiredAmount:preview.requiredUnits,shortage:preview.shortageUnits,balanceAfter:after,committedAt:context.now??campaign.updatedAt,note:context.note,provenance:[context.initiatedByParticipantId,...preview.memberUnits.map((member)=>member.rosterMemberId)]}]);
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

  advanceDayWithOptionalRations(context:CampaignMutationContext&{consumeRations:boolean;requiredUnits?:number;note?:string}){
    return this.mutateCampaign(context,(campaign)=>{
      if(!campaign.calendar.capability.enabled) throw new Error("Calendar capability is disabled");
      const before=campaign.calendar.state.absoluteMinute;const after=before+1440;
      campaign.calendar.state.absoluteMinute=after;campaign.calendar.state.revision+=1;campaign.calendar.state.displayAnchor.day=Math.floor(after/1440)+1;
      campaign.calendar.state.history=bounded([...campaign.calendar.state.history,{transactionId:`${context.requestId}.calendar`,kind:"advance",deltaMinutes:1440,beforeAbsoluteMinute:before,afterAbsoluteMinute:after,committedAt:context.now??campaign.updatedAt,note:context.note,provenance:[context.requestId,context.initiatedByParticipantId]}]);
      if(context.consumeRations&&campaign.rations.capability.enabled){
        const preview=previewCampaignDailyRations(campaign,context.requiredUnits);const balance=preview.availableUnits-preview.consumedUnits;
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
