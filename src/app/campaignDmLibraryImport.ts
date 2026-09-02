import type { CampaignDmLibraryEntry, CampaignNpcActorDefinition, CampaignPartyStashItemTemplate } from "./campaignPersistenceContracts";
import { HANDOUT_IMAGE_MAX_BYTES, parseLocalImageDataUrl } from "./localImageAsset";

type RecordValue=Record<string,unknown>;

function record(value:unknown,label:string):RecordValue {
  if(!value||typeof value!=="object"||Array.isArray(value))throw new Error(`${label}은 JSON 객체여야 합니다.`);
  return value as RecordValue;
}

function assertAllowedKeys(value:RecordValue,allowed:readonly string[],label:string) {
  const allowedSet=new Set(allowed);
  const unsupported=Object.keys(value).filter((key)=>!allowedSet.has(key));
  if(unsupported.length)throw new Error(`${label}에 지원하지 않는 필드가 있습니다: ${unsupported.join(", ")}`);
}

function textValue(value:unknown,label:string,required=true) {
  if(value===undefined&&!required)return undefined;
  if(typeof value!=="string"||!value.trim())throw new Error(`${label}은 비어 있지 않은 문자열이어야 합니다.`);
  return value.trim();
}

function stringList(value:unknown,label:string) {
  if(value===undefined)return [];
  if(!Array.isArray(value)||value.some((item)=>typeof item!=="string"||!item.trim()))throw new Error(`${label}은 문자열 배열이어야 합니다.`);
  return [...new Set(value.map((item)=>String(item).trim()))];
}

function integer(value:unknown,label:string,minimum:number) {
  if(!Number.isInteger(value)||Number(value)<minimum)throw new Error(`${label}은 ${minimum} 이상의 정수여야 합니다.`);
  return Number(value);
}

const COMMON_ENTRY_KEYS=["entryId","type","kind","label","favorite","tags"] as const;
const ITEM_TEMPLATE_KEYS=["definitionId","name","nameEn","kind","attunementRequired","charges","passiveEffects","grantedActionIds","provenance"] as const;
const NPC_DEFINITION_KEYS=["definitionId","name","nameEn","ac","maxHp","actions","statusImmunities","source","version"] as const;
const IMAGE_ASSET_KEYS=["mimeType","dataUrl","byteLength","fileName"] as const;

function itemEntry(raw:RecordValue,context:CampaignDmLibraryImportContext,index:number):CampaignDmLibraryEntry {
  assertAllowedKeys(raw,[...COMMON_ENTRY_KEYS,"definitionId","itemKind","itemTemplate",...ITEM_TEMPLATE_KEYS],`항목 ${index+1}`);
  const templateRaw=raw.itemTemplate===undefined?raw:record(raw.itemTemplate,`항목 ${index+1}.itemTemplate`);
  if(raw.itemTemplate!==undefined)assertAllowedKeys(templateRaw,ITEM_TEMPLATE_KEYS,`항목 ${index+1}.itemTemplate`);
  const label=textValue(raw.label??templateRaw.name,`항목 ${index+1}.label`)!;
  const definitionId=textValue(raw.definitionId??templateRaw.definitionId,`항목 ${index+1}.definitionId`)!;
  const rawKind=templateRaw.kind??raw.itemKind??(raw.kind!=="custom-item"?raw.kind:undefined)??"equipment";
  if(rawKind!=="equipment"&&rawKind!=="consumable"&&rawKind!=="magic")throw new Error(`항목 ${index+1}.itemKind는 equipment, consumable, magic 중 하나여야 합니다.`);
  const chargesRaw=templateRaw.charges;
  let charges:CampaignPartyStashItemTemplate["charges"];
  if(chargesRaw!==undefined){const value=record(chargesRaw,`항목 ${index+1}.charges`);assertAllowedKeys(value,["current","max"],`항목 ${index+1}.charges`);const max=integer(value.max,`항목 ${index+1}.charges.max`,1);const current=integer(value.current,`항목 ${index+1}.charges.current`,0);if(current>max)throw new Error(`항목 ${index+1}.charges.current는 max를 초과할 수 없습니다.`);charges={current,max};}
  if(templateRaw.attunementRequired!==undefined&&typeof templateRaw.attunementRequired!=="boolean")throw new Error(`항목 ${index+1}.attunementRequired는 boolean이어야 합니다.`);
  const template:CampaignPartyStashItemTemplate={
    definitionId,
    name:textValue(templateRaw.name??label,`항목 ${index+1}.name`)!,
    nameEn:textValue(templateRaw.nameEn,`항목 ${index+1}.nameEn`,false),
    kind:rawKind,
    attunementRequired:templateRaw.attunementRequired as boolean|undefined,
    charges,
    passiveEffects:stringList(templateRaw.passiveEffects,`항목 ${index+1}.passiveEffects`),
    grantedActionIds:stringList(templateRaw.grantedActionIds,`항목 ${index+1}.grantedActionIds`),
    provenance:stringList(templateRaw.provenance,`항목 ${index+1}.provenance`),
  };
  if(!template.provenance.length)template.provenance=[`Campaign DM Library · ${context.campaignName} · JSON`];
  return {entryId:textValue(raw.entryId,`항목 ${index+1}.entryId`,false)??context.createEntryId(),kind:"custom-item",label,definitionId,favorite:raw.favorite===true,tags:stringList(raw.tags,`항목 ${index+1}.tags`),itemTemplate:template};
}

function npcEntry(raw:RecordValue,context:CampaignDmLibraryImportContext,index:number):CampaignDmLibraryEntry {
  assertAllowedKeys(raw,[...COMMON_ENTRY_KEYS,"definitionId","npcDefinition",...NPC_DEFINITION_KEYS],`항목 ${index+1}`);
  const definitionRaw=raw.npcDefinition===undefined?raw:record(raw.npcDefinition,`항목 ${index+1}.npcDefinition`);
  if(raw.npcDefinition!==undefined)assertAllowedKeys(definitionRaw,NPC_DEFINITION_KEYS,`항목 ${index+1}.npcDefinition`);
  const label=textValue(raw.label??definitionRaw.name,`항목 ${index+1}.label`)!;
  const definitionId=textValue(raw.definitionId??definitionRaw.definitionId,`항목 ${index+1}.definitionId`)!;
  const npcDefinition:CampaignNpcActorDefinition={definitionId,name:textValue(definitionRaw.name??label,`항목 ${index+1}.name`)!,nameEn:textValue(definitionRaw.nameEn,`항목 ${index+1}.nameEn`,false),ac:integer(definitionRaw.ac,`항목 ${index+1}.ac`,0),maxHp:integer(definitionRaw.maxHp,`항목 ${index+1}.maxHp`,1),actions:stringList(definitionRaw.actions,`항목 ${index+1}.actions`),statusImmunities:stringList(definitionRaw.statusImmunities,`항목 ${index+1}.statusImmunities`),source:textValue(definitionRaw.source,`항목 ${index+1}.source`,false)??`Campaign DM Library · ${context.campaignName} · JSON`,version:textValue(definitionRaw.version,`항목 ${index+1}.version`,false)??"1"};
  return {entryId:textValue(raw.entryId,`항목 ${index+1}.entryId`,false)??context.createEntryId(),kind:"npc-definition",label,definitionId,favorite:raw.favorite===true,tags:stringList(raw.tags,`항목 ${index+1}.tags`),npcDefinition};
}

function imageEntry(raw:RecordValue,context:CampaignDmLibraryImportContext,index:number):CampaignDmLibraryEntry {
  assertAllowedKeys(raw,[...COMMON_ENTRY_KEYS,"imageAsset",...IMAGE_ASSET_KEYS],`항목 ${index+1}`);
  const assetRaw=raw.imageAsset===undefined?raw:record(raw.imageAsset,`항목 ${index+1}.imageAsset`);
  if(raw.imageAsset!==undefined)assertAllowedKeys(assetRaw,IMAGE_ASSET_KEYS,`항목 ${index+1}.imageAsset`);
  const fileName=textValue(assetRaw.fileName,`항목 ${index+1}.fileName`,false);
  const dataUrl=textValue(assetRaw.dataUrl,`항목 ${index+1}.dataUrl`)!;
  const imageAsset=parseLocalImageDataUrl(dataUrl,fileName,HANDOUT_IMAGE_MAX_BYTES);
  if(assetRaw.mimeType!==undefined&&assetRaw.mimeType!==imageAsset.mimeType)throw new Error(`항목 ${index+1}.mimeType이 이미지 데이터와 일치하지 않습니다.`);
  if(assetRaw.byteLength!==undefined&&assetRaw.byteLength!==imageAsset.byteLength)throw new Error(`항목 ${index+1}.byteLength가 이미지 데이터와 일치하지 않습니다.`);
  const label=textValue(raw.label??fileName,`항목 ${index+1}.label`)!;
  return {entryId:textValue(raw.entryId,`항목 ${index+1}.entryId`,false)??context.createEntryId(),kind:"image",label,favorite:raw.favorite===true,tags:stringList(raw.tags,`항목 ${index+1}.tags`),imageAsset};
}

export interface CampaignDmLibraryImportContext {
  campaignId:string;
  campaignName:string;
  createEntryId():string;
}

export function parseCampaignDmLibraryJson(payload:string,context:CampaignDmLibraryImportContext) {
  let parsed:unknown;
  try{parsed=JSON.parse(payload);}catch{throw new Error("올바른 JSON 형식이 아닙니다.");}
  const values=Array.isArray(parsed)?parsed:[parsed];
  if(!values.length||values.length>100)throw new Error("한 번에 1개 이상 100개 이하의 항목을 가져올 수 있습니다.");
  const entries=values.map((value,index)=>{
    const raw=record(value,`항목 ${index+1}`);
    const kind=raw.type??raw.kind;
    if(kind==="npc"||kind==="npc-definition")return npcEntry(raw,context,index);
    if(kind==="item"||kind==="custom-item"||kind==="equipment"||kind==="consumable"||kind==="magic")return itemEntry(raw,context,index);
    if(kind==="image")return imageEntry(raw,context,index);
    throw new Error(`항목 ${index+1}.kind는 custom-item, npc-definition 또는 image여야 합니다.`);
  });
  const definitionIds=new Set<string>();
  for(const entry of entries){if(entry.definitionId&&definitionIds.has(entry.definitionId))throw new Error(`JSON 안에 중복 Definition ID가 있습니다: ${entry.definitionId}`);if(entry.definitionId)definitionIds.add(entry.definitionId);}
  return entries;
}

export const CAMPAIGN_DM_LIBRARY_JSON_EXAMPLE=JSON.stringify({
  kind:"custom-item",label:"별빛 완드",definitionId:"local.item.starlight-wand",tags:["마법","완드"],itemTemplate:{name:"별빛 완드",nameEn:"Starlight Wand",kind:"magic",attunementRequired:true,charges:{current:7,max:7},passiveEffects:["어두운 곳에서 희미한 빛"],grantedActionIds:["action.starlight-bolt"],provenance:["My Homebrew Pack"]},
},null,2);
