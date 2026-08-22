import { CampaignLibraryRepository, CampaignStaleRevisionError, createCampaignRecordV1 } from "./campaignPersistence";
import type { CampaignMutationContext, CampaignRecordV1 } from "./campaignPersistenceContracts";

const cp=<T,>(value:T):T=>structuredClone(value);

export class CampaignApplicationService {
  constructor(private readonly repository:CampaignLibraryRepository){}
  async hydrate(){return this.repository.hydrate();}
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
