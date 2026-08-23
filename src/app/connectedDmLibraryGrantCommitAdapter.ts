import { MockAdapter } from "./mockAdapter";
import { connectedStateFor } from "./connectedSessionState";

const baseGrant=MockAdapter.prototype.grantCampaignDmLibraryItem;

function itemQuantity(items:Array<{definitionId:string;quantity:number}>|undefined,definitionId:string){
  return (items??[]).filter((item)=>item.definitionId===definitionId).reduce((sum,item)=>sum+item.quantity,0);
}

MockAdapter.prototype.grantCampaignDmLibraryItem=async function grantCampaignDmLibraryItemWithCommittedOwnerOutcome(campaignId,entryId,target,quantity){
  if(target.kind!=="character"||connectedStateFor(this).mode!=="host")return baseGrant.call(this,campaignId,entryId,target,quantity);
  const before=await this.getSnapshot();
  const campaign=before.campaigns?.find((entry)=>entry.campaignId===campaignId);
  const definitionId=campaign?.dmLibrary.entries.find((entry)=>entry.entryId===entryId&&entry.kind==="custom-item")?.definitionId;
  if(!definitionId)return baseGrant.call(this,campaignId,entryId,target,quantity);
  const beforeQuantity=itemQuantity(before.sessionCharacterInventories?.[target.actorId]?.items,definitionId);
  try{return await baseGrant.call(this,campaignId,entryId,target,quantity);}
  catch(error){
    const after=await this.getSnapshot().catch(()=>null);
    if(!after)throw error;
    const afterQuantity=itemQuantity(after.sessionCharacterInventories?.[target.actorId]?.items,definitionId);
    if(afterQuantity===beforeQuantity+quantity)return after;
    throw error;
  }
};

export {};
