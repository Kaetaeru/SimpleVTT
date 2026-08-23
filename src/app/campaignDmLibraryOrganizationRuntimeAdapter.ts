import "./campaignRuntimeAdapter";
import "./campaignDmLibraryOrganizationContracts";
import type { AppSnapshot, CombatantDefinitionVm } from "./contracts";
import { CampaignApplicationService } from "./campaignApplicationService";
import type { CampaignDmLibraryEntry } from "./campaignPersistenceContracts";
import type { CampaignDmLibraryFolder, CampaignPcActorPreset } from "./campaignDmLibraryOrganizationContracts";
import { MockAdapter } from "./mockAdapter";

const ORGANIZATION_PAYLOAD=Symbol("simplevtt.campaign-dm-library-organization");
type OrganizationPayload=
  | {kind:"upsert-folder";folder:CampaignDmLibraryFolder}
  | {kind:"remove-folder";folderId:string}
  | {kind:"touch-entry";entryId:string};
type UpdateContext=Parameters<CampaignApplicationService["updateCampaign"]>[0];
type UpdatePayload=UpdateContext["payload"]&{[ORGANIZATION_PAYLOAD]?:OrganizationPayload};

function uniqueText(values:string[]){return [...new Set(values.map((value)=>value.trim()).filter(Boolean))];}
function assertPreset(preset:CampaignPcActorPreset,definitionId:string){
  if(!preset||preset.definitionId!==definitionId||!preset.name.trim())throw new Error("PC preset definition id and name are required");
  if(!Number.isInteger(preset.level)||preset.level<1||preset.level>20)throw new Error("PC preset level must be between 1 and 20");
  if(!Number.isInteger(preset.ac)||preset.ac<0||!Number.isInteger(preset.maxHp)||preset.maxHp<1)throw new Error("PC preset AC and HP are invalid");
  preset.actions=uniqueText(preset.actions??[]);
  preset.statusImmunities=uniqueText(preset.statusImmunities??[]);
  preset.source=preset.source.trim();
  preset.version=preset.version.trim();
  if(!preset.source||!preset.version)throw new Error("PC preset source and version are required");
}

const previousUpdateCampaign=CampaignApplicationService.prototype.updateCampaign;
CampaignApplicationService.prototype.updateCampaign=function updateCampaignWithDmLibraryOrganization(context:UpdateContext){
  const payload=(context.payload as UpdatePayload)[ORGANIZATION_PAYLOAD];
  if(!payload)return previousUpdateCampaign.call(this,context);
  return this.mutateCampaign(context,(campaign)=>{
    const folders=campaign.dmLibrary.folders??[];
    if(payload.kind==="upsert-folder"){
      const folder={folderId:payload.folder.folderId.trim(),label:payload.folder.label.trim()};
      if(!folder.folderId||!folder.label)throw new Error("DM Library folder id and label are required");
      const index=folders.findIndex((candidate)=>candidate.folderId===folder.folderId);
      campaign.dmLibrary.folders=index<0?[...folders,folder]:folders.map((candidate,folderIndex)=>folderIndex===index?folder:candidate);
    }else if(payload.kind==="remove-folder"){
      const folderId=payload.folderId.trim();
      if(!folders.some((folder)=>folder.folderId===folderId))throw new Error("DM Library folder not found");
      campaign.dmLibrary.folders=folders.filter((folder)=>folder.folderId!==folderId);
      campaign.dmLibrary.entries=campaign.dmLibrary.entries.map((entry)=>entry.folderId===folderId?{...entry,folderId:undefined}:entry);
    }else{
      if(!campaign.dmLibrary.entries.some((entry)=>entry.entryId===payload.entryId))throw new Error("DM Library entry not found");
      campaign.dmLibrary.recentEntryIds=[payload.entryId,...campaign.dmLibrary.recentEntryIds.filter((id)=>id!==payload.entryId)].slice(0,12);
    }
    campaign.dmLibrary.revision+=1;
  });
};

const previousUpsertDmLibraryEntry=CampaignApplicationService.prototype.upsertDmLibraryEntry;
CampaignApplicationService.prototype.upsertDmLibraryEntry=function upsertDmLibraryEntryWithOrganization(context){
  const entry=context.entry as CampaignDmLibraryEntry;
  const campaign=this.getCampaign(context.campaignId);
  if(!campaign)throw new Error(`Campaign not found: ${context.campaignId}`);
  if(entry.folderId&&!campaign.dmLibrary.folders?.some((folder)=>folder.folderId===entry.folderId))throw new Error("DM Library folder not found");
  if(entry.kind==="pc-preset"){
    if(!entry.definitionId?.trim()||!entry.pcPreset)throw new Error("PC preset definition is required");
    assertPreset(entry.pcPreset,entry.definitionId);
  }
  return previousUpsertDmLibraryEntry.call(this,context);
};

function organizationPayload(payload:OrganizationPayload){return {[ORGANIZATION_PAYLOAD]:payload} as unknown as {name?:string;description?:string};}

declare module "./mockAdapter" {
  interface MockAdapter {
    upsertCampaignDmLibraryFolder(campaignId:string,folder:CampaignDmLibraryFolder):Promise<AppSnapshot>;
    removeCampaignDmLibraryFolder(campaignId:string,folderId:string):Promise<AppSnapshot>;
    instantiateCampaignDmLibraryPcPreset(campaignId:string,entryId:string):Promise<AppSnapshot>;
  }
}

MockAdapter.prototype.upsertCampaignDmLibraryFolder=async function upsertCampaignDmLibraryFolderRuntime(campaignId,folder){
  return this.updateCampaign(campaignId,organizationPayload({kind:"upsert-folder",folder}));
};
MockAdapter.prototype.removeCampaignDmLibraryFolder=async function removeCampaignDmLibraryFolderRuntime(campaignId,folderId){
  return this.updateCampaign(campaignId,organizationPayload({kind:"remove-folder",folderId}));
};
MockAdapter.prototype.instantiateCampaignDmLibraryPcPreset=async function instantiateCampaignDmLibraryPcPresetRuntime(campaignId,entryId){
  const snapshot=await this.getSnapshot();
  if(snapshot.session.role==="client")throw new Error("PC preset Actor 생성은 DM Campaign 권위에서만 실행할 수 있습니다.");
  const campaign=snapshot.campaigns?.find((candidate)=>candidate.campaignId===campaignId);
  if(!campaign)throw new Error(`Campaign not found: ${campaignId}`);
  const entry=campaign.dmLibrary.entries.find((candidate)=>candidate.entryId===entryId&&candidate.kind==="pc-preset");
  if(!entry?.definitionId||!entry.pcPreset)throw new Error("PC preset not found");
  const preset=structuredClone(entry.pcPreset);
  assertPreset(preset,entry.definitionId);
  const definitions=(this as unknown as {combatantDefinitions:CombatantDefinitionVm[]}).combatantDefinitions;
  const materialized:CombatantDefinitionVm={id:preset.definitionId,name:preset.name,nameEn:preset.nameEn,ac:preset.ac,maxHp:preset.maxHp,source:preset.source,version:preset.version,actions:[...preset.actions],statusImmunities:[...preset.statusImmunities]};
  const index=definitions.findIndex((candidate)=>candidate.id===materialized.id);
  if(index>=0)definitions[index]=materialized;else definitions.push(materialized);
  await this.instantiateCombatant(materialized.id);
  await this.updateCampaign(campaignId,organizationPayload({kind:"touch-entry",entryId}));
  return this.getSnapshot();
};
