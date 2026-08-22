import {
  CAMPAIGN_LIBRARY_SCHEMA_ID,
  CAMPAIGN_LIBRARY_SCHEMA_VERSION,
  type CampaignDocumentV1,
  type CampaignLibraryStore,
  type CampaignRecordV1,
} from "./campaignPersistenceContracts";

const cp=<T,>(value:T):T=>structuredClone(value);
const isObject=(value:unknown):value is Record<string,unknown>=>Boolean(value)&&typeof value==="object"&&!Array.isArray(value);

function canonical(value:unknown):unknown {
  if(Array.isArray(value)) return value.map(canonical);
  if(isObject(value)) return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,canonical(item)]));
  return value;
}

function assertInteger(value:unknown,label:string,minimum=0):asserts value is number {
  if(!Number.isInteger(value)||Number(value)<minimum) throw new Error(`${label} is invalid`);
}

function assertCampaign(value:unknown):asserts value is CampaignRecordV1 {
  if(!isObject(value)) throw new Error("Campaign record must be an object");
  for(const key of ["campaignId","name","createdAt","updatedAt"] as const) if(typeof value[key]!=="string"||!value[key]) throw new Error(`Campaign ${key} is invalid`);
  if(value.status!=="active"&&value.status!=="archived") throw new Error("Campaign status is invalid");
  assertInteger(value.revision,"Campaign revision",1);
  for(const key of ["roster","sessionHistory","recentRequestIds"] as const) if(!Array.isArray(value[key])) throw new Error(`Campaign ${key} is invalid`);
  for(const key of ["sessionDefaults","calendar","rations","partyStash","dmLibrary","contentLoadout"] as const) if(!isObject(value[key])) throw new Error(`Campaign ${key} is invalid`);
  const calendar=value.calendar as Record<string,unknown>;
  const rations=value.rations as Record<string,unknown>;
  if(!isObject(calendar.capability)||!isObject(calendar.state)) throw new Error("Campaign calendar is invalid");
  if(!isObject(rations.capability)||!isObject(rations.ledger)) throw new Error("Campaign rations are invalid");
  assertInteger((calendar.state as Record<string,unknown>).absoluteMinute,"Campaign absoluteMinute");
  const balances=(rations.ledger as Record<string,unknown>).balances;
  if(!isObject(balances)||!Number.isInteger(balances.ration)||Number(balances.ration)<0) throw new Error("Campaign ration balance is invalid");
}

function sortedCampaigns(campaigns:CampaignRecordV1[]){return campaigns.map(cp).sort((a,b)=>a.campaignId.localeCompare(b.campaignId,"en"));}

export class CampaignSchemaError extends Error {}
export class CampaignMigrationRequiredError extends Error {
  constructor(readonly schemaVersion:unknown){super(`Campaign schema version ${String(schemaVersion)} requires an explicit migration`);}
}
export class CampaignCorruptError extends Error {}
export class CampaignStaleRevisionError extends Error {}

export function decodeCampaignDocumentV1(payload:string):CampaignDocumentV1 {
  const parsed:unknown=JSON.parse(payload);
  if(!isObject(parsed)) throw new Error("Campaign document must be an object");
  if(parsed.schemaId!==CAMPAIGN_LIBRARY_SCHEMA_ID) throw new CampaignSchemaError(`unsupported Campaign schema: ${String(parsed.schemaId)}`);
  if(parsed.schemaVersion!==CAMPAIGN_LIBRARY_SCHEMA_VERSION) throw new CampaignMigrationRequiredError(parsed.schemaVersion);
  assertInteger(parsed.storageRevision,"Campaign storageRevision");
  if(parsed.activeCampaignId!==null&&typeof parsed.activeCampaignId!=="string") throw new Error("Campaign activeCampaignId is invalid");
  if(!Array.isArray(parsed.campaigns)) throw new Error("Campaign collection is invalid");
  parsed.campaigns.forEach(assertCampaign);
  const ids=new Set<string>();
  for(const campaign of parsed.campaigns){if(ids.has(campaign.campaignId)) throw new Error(`duplicate Campaign id: ${campaign.campaignId}`);ids.add(campaign.campaignId);}
  if(parsed.activeCampaignId!==null&&!ids.has(parsed.activeCampaignId)) throw new Error("active Campaign does not exist");
  return {schemaId:CAMPAIGN_LIBRARY_SCHEMA_ID,schemaVersion:CAMPAIGN_LIBRARY_SCHEMA_VERSION,storageRevision:parsed.storageRevision,activeCampaignId:parsed.activeCampaignId,campaigns:sortedCampaigns(parsed.campaigns)};
}

export function decodeCampaignDocument(payload:string){
  const parsed:unknown=JSON.parse(payload);
  if(!isObject(parsed)) throw new Error("Campaign document must be an object");
  if(parsed.schemaId!==CAMPAIGN_LIBRARY_SCHEMA_ID) throw new CampaignSchemaError(`unsupported Campaign schema: ${String(parsed.schemaId)}`);
  if(parsed.schemaVersion!==CAMPAIGN_LIBRARY_SCHEMA_VERSION) throw new CampaignMigrationRequiredError(parsed.schemaVersion);
  return decodeCampaignDocumentV1(payload);
}

export function encodeCampaignDocumentV1(document:CampaignDocumentV1){
  return JSON.stringify(canonical({...document,campaigns:sortedCampaigns(document.campaigns)}),null,2);
}

function initialDocument():CampaignDocumentV1{return {schemaId:CAMPAIGN_LIBRARY_SCHEMA_ID,schemaVersion:CAMPAIGN_LIBRARY_SCHEMA_VERSION,storageRevision:0,activeCampaignId:null,campaigns:[]};}

export interface CampaignHydration {
  document:CampaignDocumentV1;
  physicalGeneration:number;
  loadedGeneration:number|null;
  recoveredFromOlderGeneration:boolean;
  changed:boolean;
}

export class CampaignLibraryRepository {
  private document:CampaignDocumentV1|null=null;
  private physicalGeneration=0;
  private loadedGeneration:number|null=null;
  constructor(private readonly store:CampaignLibraryStore){}
  get durability(){return this.store.durability;}

  private result(recovered=false,changed=false):CampaignHydration {
    if(!this.document) throw new Error("Campaign repository is not hydrated");
    return {document:cp(this.document),physicalGeneration:this.physicalGeneration,loadedGeneration:this.loadedGeneration,recoveredFromOlderGeneration:recovered,changed};
  }

  async hydrate():Promise<CampaignHydration>{
    const generations=(await this.store.readGenerations()).sort((a,b)=>b.generation-a.generation);
    this.physicalGeneration=generations[0]?.generation??0;
    for(const generation of generations){
      if(generation.payload===null) continue;
      try{
        const document=decodeCampaignDocument(generation.payload);
        if(document.storageRevision!==generation.generation) continue;
        this.document=document;this.loadedGeneration=generation.generation;
        return this.result(generation.generation<this.physicalGeneration,false);
      }catch(error){
        if(error instanceof CampaignMigrationRequiredError||error instanceof CampaignSchemaError) throw error;
      }
    }
    if(generations.length) throw new CampaignCorruptError("no valid committed Campaign generation remains");
    this.document=initialDocument();this.loadedGeneration=null;
    return this.result(false,false);
  }

  snapshot(){return this.document?cp(this.document):null;}

  async commit(candidate:CampaignDocumentV1):Promise<CampaignHydration>{
    if(!this.document) throw new Error("Campaign repository must hydrate before commit");
    const nextGeneration=this.physicalGeneration+1;
    const next=decodeCampaignDocumentV1(encodeCampaignDocumentV1({...candidate,storageRevision:nextGeneration}));
    await this.store.writeGeneration(this.physicalGeneration,nextGeneration,encodeCampaignDocumentV1(next));
    this.document=next;this.physicalGeneration=nextGeneration;this.loadedGeneration=nextGeneration;
    return this.result(false,true);
  }
}

export function createCampaignRecordV1(input:{campaignId:string;name:string;description?:string;now:string}):CampaignRecordV1 {
  const {campaignId,name,description,now}=input;
  return {
    campaignId,name,description,status:"active",createdAt:now,updatedAt:now,revision:1,roster:[],
    sessionDefaults:{revision:1,sessionNameTemplate:name,startingMode:"freeform",calendarEnabled:false,rationsEnabled:false,stashPolicy:"dm-approval",dmLibraryEnabled:true,contentLoadoutId:`${campaignId}.loadout.default`},
    calendar:{capability:{enabled:false,providerId:"builtin.simple-day",providerVersion:"1",settingsRevision:1},state:{providerId:"builtin.simple-day",revision:1,absoluteMinute:0,displayAnchor:{day:1},history:[]}},
    rations:{capability:{enabled:false,providerId:"builtin.tracking-only",providerVersion:"1",settingsRevision:1},ledger:{revision:1,balances:{ration:0},consumptionHistory:[]}},
    partyStash:{stashId:`${campaignId}.stash`,revision:1,policy:"dm-approval",wallet:{gp:0,sp:0,cp:0},itemReferences:[]},
    dmLibrary:{namespaceId:`${campaignId}.dm-library`,revision:1,entries:[],recentEntryIds:[]},
    sessionHistory:[],contentLoadout:{loadoutId:`${campaignId}.loadout.default`,revision:1,entries:[]},recentRequestIds:[],
  };
}
