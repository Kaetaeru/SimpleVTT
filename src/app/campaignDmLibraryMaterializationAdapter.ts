import { MockAdapter } from "./mockAdapter";

const baseGrant=MockAdapter.prototype.grantCampaignDmLibraryItem;

function itemQuantity(items:Array<{definitionId:string;quantity:number}>|undefined,definitionId:string){
  return (items??[]).filter((item)=>item.definitionId===definitionId).reduce((sum,item)=>sum+item.quantity,0);
}

MockAdapter.prototype.grantCampaignDmLibraryItem=async function grantCampaignDmLibraryItemWithBestEffortRecents(campaignId,entryId,target,quantity){
  const before=await this.getSnapshot();
  const campaign=before.campaigns?.find((entry)=>entry.campaignId===campaignId);
  const libraryEntry=campaign?.dmLibrary.entries.find((entry)=>entry.entryId===entryId&&entry.kind==="custom-item");
  const definitionId=libraryEntry?.definitionId;
  if(!definitionId)return baseGrant.call(this,campaignId,entryId,target,quantity);
  const beforeQuantity=target.kind==="character"
    ? itemQuantity(before.sessionCharacterInventories?.[target.actorId]?.items,definitionId)
    : itemQuantity(before.campaignSessionSystems?.partyStash.itemReferences,definitionId);
  try{return await baseGrant.call(this,campaignId,entryId,target,quantity);}
  catch(error){
    const after=await this.getSnapshot().catch(()=>null);
    if(!after)throw error;
    const afterQuantity=target.kind==="character"
      ? itemQuantity(after.sessionCharacterInventories?.[target.actorId]?.items,definitionId)
      : itemQuantity(after.campaignSessionSystems?.partyStash.itemReferences,definitionId);
    if(afterQuantity===beforeQuantity+quantity)return after;
    throw error;
  }
};

export {};
