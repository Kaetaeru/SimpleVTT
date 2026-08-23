import type { AppSnapshot } from "./contracts";
import { CampaignApplicationService } from "./campaignApplicationService";
import type { CampaignRecordV1 } from "./campaignPersistenceContracts";
import { pinnedCampaignProviderDescriptorFromCatalog } from "./campaignProviderProfiles";
import {
  convertPartyStashItemToRations,
  previewPartyStashItemRationConversion,
  type CampaignRationConversionPreview,
} from "./campaignRationConversion";
import type { InstalledCampaignRationProfileV1 } from "./installedContentContracts";
import { MockAdapter } from "./mockAdapter";

const RATION_CONVERSION_PAYLOAD=Symbol("simplevtt.campaign-ration-conversion");

type ConversionPayload={
  requestId:string;
  providerId:string;
  providerVersion:string;
  stashItemInstanceId:string;
  quantity:number;
  rationProfile?:InstalledCampaignRationProfileV1;
  note?:string;
};

type AdjustRationsContext=Parameters<CampaignApplicationService["adjustRations"]>[0];
type AdjustRationsContextWithConversion=AdjustRationsContext&{[RATION_CONVERSION_PAYLOAD]?:ConversionPayload};

export interface CampaignRationConversionRuntimePreview extends CampaignRationConversionPreview {
  providerId:string;
  providerVersion:string;
}

export interface CampaignRationConversionRuntimeCommand {
  requestId:string;
  campaignId:string;
  providerId:string;
  providerVersion:string;
  stashItemInstanceId:string;
  quantity:number;
  note?:string;
}

function campaignFromSnapshot(snapshot:AppSnapshot,campaignId:string):CampaignRecordV1{
  const campaign=snapshot.campaigns?.find((entry)=>entry.campaignId===campaignId);
  if(!campaign)throw new Error(`Campaign not found: ${campaignId}`);
  return campaign;
}

function rationProfile(snapshot:AppSnapshot,providerId:string,providerVersion:string):InstalledCampaignRationProfileV1|undefined{
  if(providerId==="builtin.tracking-only")return undefined;
  const provider=pinnedCampaignProviderDescriptorFromCatalog(snapshot.catalog,"ration",providerId,providerVersion);
  if(!provider||provider.profile.kind!=="ration")throw new Error(`Installed ration provider is unavailable: ${providerId}@${providerVersion}`);
  return provider.profile;
}

const previousAdjustRations=CampaignApplicationService.prototype.adjustRations;
CampaignApplicationService.prototype.adjustRations=function adjustRationsWithAtomicStashConversion(context:AdjustRationsContext){
  const payload=(context as AdjustRationsContextWithConversion)[RATION_CONVERSION_PAYLOAD];
  if(!payload)return previousAdjustRations.call(this,context);
  return convertPartyStashItemToRations(this,{
    requestId:payload.requestId,
    campaignId:context.campaignId,
    sessionId:context.sessionId,
    initiatedByParticipantId:context.initiatedByParticipantId,
    expectedCampaignRevision:context.expectedCampaignRevision,
    now:context.now,
    providerId:payload.providerId,
    providerVersion:payload.providerVersion,
    stashItemInstanceId:payload.stashItemInstanceId,
    quantity:payload.quantity,
    rationProfile:payload.rationProfile,
    note:payload.note,
  });
};

declare module "./mockAdapter" {
  interface MockAdapter {
    previewCampaignPartyStashRationConversion(campaignId:string,input:{stashItemInstanceId:string;quantity:number}):Promise<CampaignRationConversionRuntimePreview>;
    convertCampaignPartyStashItemToRations(command:CampaignRationConversionRuntimeCommand):Promise<AppSnapshot>;
  }
}

MockAdapter.prototype.previewCampaignPartyStashRationConversion=async function previewCampaignPartyStashRationConversionRuntime(campaignId,input){
  const snapshot=await this.getSnapshot();
  if(snapshot.session.role==="client")throw new Error("Party Stash 식량 전환 미리보기는 DM Campaign 권위에서만 사용할 수 있습니다.");
  const campaign=campaignFromSnapshot(snapshot,campaignId);
  const providerId=campaign.rations.capability.providerId;
  const providerVersion=campaign.rations.capability.providerVersion;
  const profile=rationProfile(snapshot,providerId,providerVersion);
  return {
    ...previewPartyStashItemRationConversion(campaign,{providerId,providerVersion,stashItemInstanceId:input.stashItemInstanceId,quantity:input.quantity,rationProfile:profile}),
    providerId,
    providerVersion,
  };
};

MockAdapter.prototype.convertCampaignPartyStashItemToRations=async function convertCampaignPartyStashItemToRationsRuntime(command){
  const snapshot=await this.getSnapshot();
  if(snapshot.session.role==="client")throw new Error("Party Stash 식량 전환은 DM Campaign 권위에서만 실행할 수 있습니다.");
  const campaign=campaignFromSnapshot(snapshot,command.campaignId);
  if(campaign.rations.capability.providerId!==command.providerId||campaign.rations.capability.providerVersion!==command.providerVersion){
    throw new Error(`Ration provider changed: expected ${command.providerId}@${command.providerVersion}, current ${campaign.rations.capability.providerId}@${campaign.rations.capability.providerVersion}`);
  }
  const profile=rationProfile(snapshot,command.providerId,command.providerVersion);
  const payload:ConversionPayload={
    requestId:command.requestId,
    providerId:command.providerId,
    providerVersion:command.providerVersion,
    stashItemInstanceId:command.stashItemInstanceId,
    quantity:command.quantity,
    rationProfile:profile,
    note:command.note,
  };
  const adjustment={amount:1,note:command.note,[RATION_CONVERSION_PAYLOAD]:payload};
  return this.adjustCampaignRations(command.campaignId,adjustment as {amount:number;note?:string});
};
