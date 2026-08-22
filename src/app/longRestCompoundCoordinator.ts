import type { CharacterSheet } from "./contracts";
import type { EffectInstance } from "../domain/effects";
import type {
  InstalledCampaignCalendarProfileV1,
  InstalledCampaignRationProfileV1,
} from "./installedContentContracts";
import type { CharacterLibraryDocumentV1, CharacterLibraryStore } from "./persistenceContracts";
import type {
  CampaignDocumentV1,
  CampaignLibraryStore,
  CampaignRecordV1,
} from "./campaignPersistenceContracts";
import { CampaignApplicationService } from "./campaignApplicationService";
import {
  CampaignLibraryRepository,
  encodeCampaignDocumentV1,
} from "./campaignPersistence";
import { MemoryCampaignLibraryStore } from "./memoryCampaignLibraryStore";
import {
  prepareCampaignLibraryGeneration,
  prepareCharacterLibraryGeneration,
  type CharacterCampaignCompoundWrite,
  type CharacterCampaignCompoundWriter,
} from "./characterCampaignCompoundPersistence";
import {
  projectCharacterLongRest,
  type CharacterLongRestProjection,
} from "./characterLongRestProjection";

const cp=<T,>(value:T):T=>structuredClone(value);
const MASTER_REQUEST_LIMIT=128;

function builtinCalendarProvider(providerId:string){
  return providerId==="builtin.simple-day"||providerId==="builtin.gregorian";
}

function builtinRationProvider(providerId:string){
  return providerId==="builtin.tracking-only";
}

export interface LongRestCompoundInput {
  transactionId:string;
  campaignId:string;
  activeCharacterId:string;
  initiatedByParticipantId:string;
  now:string;
  advanceMinutes?:number;
  consumeRations?:boolean;
  /** Effective Session capability. Falls back to durable Campaign capability when omitted. */
  calendarEnabled?:boolean;
  /** Effective Session capability. Falls back to durable Campaign capability when omitted. */
  rationsEnabled?:boolean;
  note?:string;
  effects?:EffectInstance[];
  deathSaves?:{successes:number;failures:number};
  calendarProfile?:InstalledCampaignCalendarProfileV1;
  rationProfile?:InstalledCampaignRationProfileV1;
}

export interface LongRestCompoundPreviewDependencies {
  characterSheets:CharacterSheet[];
  campaignDocument:CampaignDocumentV1;
}

export interface LongRestCompoundDependencies extends LongRestCompoundPreviewDependencies {
  characterDocument:CharacterLibraryDocumentV1;
  characterStore:CharacterLibraryStore;
  campaignStore:CampaignLibraryStore;
  writer:CharacterCampaignCompoundWriter;
}

export interface LongRestCompoundPreview {
  status:"ready"|"duplicate";
  transactionId:string;
  character:CharacterLongRestProjection|null;
  campaignDocument:CampaignDocumentV1;
  applied:{calendar:boolean;rations:boolean};
  warnings:string[];
}

export interface LongRestCompoundResult {
  status:"committed"|"duplicate";
  transactionId:string;
  character:CharacterLongRestProjection|null;
  campaignDocument:CampaignDocumentV1;
  applied:{calendar:boolean;rations:boolean};
  warnings:string[];
  write?:CharacterCampaignCompoundWrite;
}

function normalizeInput(input:LongRestCompoundInput){
  const transactionId=input.transactionId.trim();
  if(!transactionId) throw new Error("Long Rest transactionId is required");
  const campaignId=input.campaignId.trim();
  if(!campaignId) throw new Error("Long Rest campaignId is required");
  const activeCharacterId=input.activeCharacterId.trim();
  if(!activeCharacterId) throw new Error("Long Rest activeCharacterId is required");
  return {...input,transactionId,campaignId,activeCharacterId};
}

function requireCampaign(document:CampaignDocumentV1,campaignId:string):CampaignRecordV1 {
  const campaign=document.campaigns.find((item)=>item.campaignId===campaignId);
  if(!campaign) throw new Error(`Campaign not found: ${campaignId}`);
  return campaign;
}

function requireActiveCharacter(sheets:CharacterSheet[],activeCharacterId:string){
  const sheet=sheets.find((item)=>item.id===activeCharacterId);
  if(!sheet) throw new Error(`Active Character not found: ${activeCharacterId}`);
  return sheet;
}

function hasMasterRequest(campaign:CampaignRecordV1,transactionId:string){
  return campaign.recentRequestIds.includes(transactionId);
}

function stampMasterRequest(
  document:CampaignDocumentV1,
  campaignId:string,
  transactionId:string,
  now:string,
  alreadyMutated:boolean,
){
  const next=cp(document);
  const campaign=requireCampaign(next,campaignId);
  if(hasMasterRequest(campaign,transactionId)) return next;
  campaign.recentRequestIds=[...campaign.recentRequestIds,transactionId].slice(-MASTER_REQUEST_LIMIT);
  if(!alreadyMutated){
    campaign.revision+=1;
    campaign.updatedAt=now;
  }
  return next;
}

async function projectCampaignCandidate(
  input:LongRestCompoundInput,
  current:CampaignDocumentV1,
):Promise<{document:CampaignDocumentV1;applied:{calendar:boolean;rations:boolean};warnings:string[]}> {
  const currentCampaign=requireCampaign(current,input.campaignId);
  const warnings:string[]=[];
  const seed=new MemoryCampaignLibraryStore([{
    generation:current.storageRevision,
    payload:encodeCampaignDocumentV1(current),
  }]);
  const repository=new CampaignLibraryRepository(seed);
  const service=new CampaignApplicationService(repository);
  await service.hydrate();

  let appliedCalendar=false;
  let appliedRations=false;
  const requestedMinutes=input.advanceMinutes??0;
  if(!Number.isInteger(requestedMinutes)||requestedMinutes<0){
    throw new Error("Long Rest calendar advanceMinutes must be a non-negative integer");
  }

  if(requestedMinutes>0){
    const sessionEnabled=input.calendarEnabled??currentCampaign.calendar.capability.enabled;
    const providerAvailable=builtinCalendarProvider(currentCampaign.calendar.capability.providerId)||Boolean(input.calendarProfile);
    if(!sessionEnabled){
      warnings.push("달력이 꺼져 있어 휴식 시간 진행은 적용하지 않았습니다.");
    }else if(!providerAvailable){
      warnings.push("현재 달력 공급자를 사용할 수 없어 휴식 시간 진행은 적용하지 않았습니다.");
    }else{
      const campaign=service.getCampaign(input.campaignId)!;
      await service.advanceCalendar({
        requestId:`${input.transactionId}.calendar`,
        campaignId:input.campaignId,
        expectedCampaignRevision:campaign.revision,
        initiatedByParticipantId:input.initiatedByParticipantId,
        now:input.now,
        deltaMinutes:requestedMinutes,
        note:input.note,
        calendarProfile:input.calendarProfile,
      });
      appliedCalendar=true;
    }
  }

  if(input.consumeRations){
    const source=service.getCampaign(input.campaignId)!;
    const sessionEnabled=input.rationsEnabled??source.rations.capability.enabled;
    const providerAvailable=builtinRationProvider(source.rations.capability.providerId)||Boolean(input.rationProfile);
    if(!sessionEnabled){
      warnings.push("식량 규칙이 꺼져 있어 휴식 식량 소비는 적용하지 않았습니다.");
    }else if(!providerAvailable){
      warnings.push("현재 식량 공급자를 사용할 수 없어 휴식 식량 소비는 적용하지 않았습니다.");
    }else{
      await service.consumeDailyRations({
        requestId:`${input.transactionId}.rations`,
        campaignId:input.campaignId,
        expectedCampaignRevision:source.revision,
        initiatedByParticipantId:input.initiatedByParticipantId,
        now:input.now,
        note:input.note,
        rationProfile:input.rationProfile,
      });
      appliedRations=true;
    }
  }

  const projected=service.snapshot();
  if(!projected) throw new Error("Long Rest Campaign candidate could not be projected");
  return {
    document:stampMasterRequest(projected,input.campaignId,input.transactionId,input.now,appliedCalendar||appliedRations),
    applied:{calendar:appliedCalendar,rations:appliedRations},
    warnings,
  };
}

/**
 * Resolves the exact Character/Campaign candidates that a commit would publish,
 * but performs no production-store writes and mutates no runtime projection.
 */
export async function previewLongRestCompound(
  input:LongRestCompoundInput,
  dependencies:LongRestCompoundPreviewDependencies,
):Promise<LongRestCompoundPreview> {
  const normalized=normalizeInput(input);
  const currentCampaign=requireCampaign(dependencies.campaignDocument,normalized.campaignId);
  if(hasMasterRequest(currentCampaign,normalized.transactionId)){
    return {
      status:"duplicate",
      transactionId:normalized.transactionId,
      character:null,
      campaignDocument:cp(dependencies.campaignDocument),
      applied:{calendar:false,rations:false},
      warnings:[],
    };
  }

  const currentSheet=requireActiveCharacter(dependencies.characterSheets,normalized.activeCharacterId);
  const character=projectCharacterLongRest(currentSheet,{
    effects:normalized.effects,
    deathSaves:normalized.deathSaves,
  });
  const campaign=await projectCampaignCandidate(normalized,dependencies.campaignDocument);
  return {
    status:"ready",
    transactionId:normalized.transactionId,
    character,
    campaignDocument:campaign.document,
    applied:campaign.applied,
    warnings:campaign.warnings,
  };
}

/**
 * Builds both durable candidates without mutating either production repository,
 * then publishes them through exactly one Character+Campaign compound writer.
 * Runtime adapters must only rehydrate/project the returned committed state after
 * this function resolves successfully.
 */
export async function executeLongRestCompound(
  input:LongRestCompoundInput,
  dependencies:LongRestCompoundDependencies,
):Promise<LongRestCompoundResult> {
  const normalized=normalizeInput(input);
  const preview=await previewLongRestCompound(normalized,dependencies);
  if(preview.status==="duplicate"){
    return {
      status:"duplicate",
      transactionId:preview.transactionId,
      character:null,
      campaignDocument:preview.campaignDocument,
      applied:preview.applied,
      warnings:preview.warnings,
    };
  }

  const character=preview.character!;
  const characterSheets=dependencies.characterSheets.map((sheet)=>sheet.id===normalized.activeCharacterId?character.sheet:sheet);
  const [characterWrite,campaignWrite]=await Promise.all([
    prepareCharacterLibraryGeneration(
      dependencies.characterDocument,
      dependencies.characterStore,
      characterSheets,
      normalized.activeCharacterId,
    ),
    prepareCampaignLibraryGeneration(
      dependencies.campaignStore,
      preview.campaignDocument,
    ),
  ]);
  const write:CharacterCampaignCompoundWrite={
    transactionId:normalized.transactionId,
    character:characterWrite,
    campaign:campaignWrite,
  };

  await dependencies.writer.write(write);

  return {
    status:"committed",
    transactionId:normalized.transactionId,
    character,
    campaignDocument:preview.campaignDocument,
    applied:preview.applied,
    warnings:preview.warnings,
    write,
  };
}
