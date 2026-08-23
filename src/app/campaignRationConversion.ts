import { CampaignApplicationService } from "./campaignApplicationService";
import type { CampaignMutationContext, CampaignRecordV1 } from "./campaignPersistenceContracts";
import type { InstalledCampaignRationItemConversionV1, InstalledCampaignRationProfileV1 } from "./installedContentContracts";

export const BUILTIN_TRACKING_ONLY_RATION_CONVERSIONS:readonly InstalledCampaignRationItemConversionV1[]=[
  {requiredCapability:"campaign.ration-source",rationUnitsPerItem:1},
];

export interface CampaignRationConversionInput {
  providerId:string;
  providerVersion:string;
  stashItemInstanceId:string;
  quantity:number;
  rationProfile?:InstalledCampaignRationProfileV1;
  trustedItemCapabilities?:string[];
  note?:string;
}

export interface CampaignRationConversionPreview {
  stashItemInstanceId:string;
  definitionId:string;
  itemName:string;
  quantity:number;
  requiredCapability:string;
  rationUnitsPerItem:number;
  rationUnits:number;
  rationBalanceBefore:number;
  rationBalanceAfter:number;
  stashQuantityBefore:number;
  stashQuantityAfter:number;
}

function positiveInteger(value:number,label:string){
  if(!Number.isInteger(value)||value<=0) throw new Error(`${label} must be a positive integer`);
}

function conversionRules(providerId:string,profile?:InstalledCampaignRationProfileV1):readonly InstalledCampaignRationItemConversionV1[] {
  if(providerId==="builtin.tracking-only") return BUILTIN_TRACKING_ONLY_RATION_CONVERSIONS;
  if(!profile) throw new Error(`Installed ration provider is unavailable: ${providerId}`);
  return profile.itemConversions??[];
}

function normalizedCapabilities(values:string[]|undefined){
  return [...new Set((values??[]).map((value)=>value.trim()).filter(Boolean))];
}

export function previewPartyStashItemRationConversion(
  campaign:CampaignRecordV1,
  input:CampaignRationConversionInput,
):CampaignRationConversionPreview {
  positiveInteger(input.quantity,"ration conversion quantity");
  if(!campaign.rations.capability.enabled) throw new Error("Ration capability is disabled");
  if(campaign.rations.capability.providerId!==input.providerId||campaign.rations.capability.providerVersion!==input.providerVersion){
    throw new Error(`Ration provider changed: expected ${input.providerId}@${input.providerVersion}, current ${campaign.rations.capability.providerId}@${campaign.rations.capability.providerVersion}`);
  }
  const item=campaign.partyStash.itemReferences.find((candidate)=>candidate.instanceId===input.stashItemInstanceId);
  if(!item) throw new Error("Party stash item is unavailable");
  if(item.quantity<input.quantity) throw new Error("Party stash item quantity is insufficient");
  const capabilities=normalizedCapabilities(input.trustedItemCapabilities??item.itemTemplate?.capabilities);
  const matches=conversionRules(input.providerId,input.rationProfile).filter((rule)=>capabilities.includes(rule.requiredCapability));
  if(!matches.length) throw new Error("Party stash item is not eligible for the active ration provider");
  if(matches.length>1) throw new Error("Party stash item matches multiple ration conversion rules");
  const rule=matches[0];
  positiveInteger(rule.rationUnitsPerItem,"rationUnitsPerItem");
  const rationUnits=input.quantity*rule.rationUnitsPerItem;
  if(!Number.isSafeInteger(rationUnits)||rationUnits<=0) throw new Error("Ration conversion result is outside the supported integer range");
  const rationBalanceBefore=campaign.rations.ledger.balances.ration??0;
  const rationBalanceAfter=rationBalanceBefore+rationUnits;
  if(!Number.isSafeInteger(rationBalanceAfter)||rationBalanceAfter<0) throw new Error("Ration balance is outside the supported integer range");
  return {
    stashItemInstanceId:item.instanceId,
    definitionId:item.definitionId,
    itemName:item.itemTemplate?.name??item.definitionId,
    quantity:input.quantity,
    requiredCapability:rule.requiredCapability,
    rationUnitsPerItem:rule.rationUnitsPerItem,
    rationUnits,
    rationBalanceBefore,
    rationBalanceAfter,
    stashQuantityBefore:item.quantity,
    stashQuantityAfter:item.quantity-input.quantity,
  };
}

export function convertPartyStashItemToRations(
  service:CampaignApplicationService,
  context:CampaignMutationContext&CampaignRationConversionInput,
){
  return service.mutateCampaign(context,(campaign)=>{
    const preview=previewPartyStashItemRationConversion(campaign,context);
    const item=campaign.partyStash.itemReferences.find((candidate)=>candidate.instanceId===preview.stashItemInstanceId);
    if(!item) throw new Error("Party stash item is unavailable");
    item.quantity=preview.stashQuantityAfter;
    if(item.quantity===0) campaign.partyStash.itemReferences=campaign.partyStash.itemReferences.filter((candidate)=>candidate.instanceId!==item.instanceId);
    campaign.partyStash.revision+=1;
    campaign.rations.ledger.balances.ration=preview.rationBalanceAfter;
    campaign.rations.ledger.revision+=1;
    campaign.rations.ledger.consumptionHistory=[...campaign.rations.ledger.consumptionHistory,{
      transactionId:context.requestId,
      kind:"convert" as const,
      amount:preview.rationUnits,
      balanceAfter:preview.rationBalanceAfter,
      sourceItemInstanceId:preview.stashItemInstanceId,
      sourceDefinitionId:preview.definitionId,
      sourceQuantity:preview.quantity,
      conversionCapability:preview.requiredCapability,
      committedAt:context.now??campaign.updatedAt,
      note:context.note?.trim()||undefined,
      provenance:[
        context.initiatedByParticipantId,
        `party-stash:${preview.stashItemInstanceId}`,
        `item:${preview.definitionId}`,
        `ration-provider:${context.providerId}@${context.providerVersion}`,
        `capability:${preview.requiredCapability}`,
      ],
    }].slice(-128);
  });
}
