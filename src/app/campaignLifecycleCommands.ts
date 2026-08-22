import "./campaignRuntimeAdapter";
import { mockAdapter } from "./mockAdapter";

export async function duplicateCampaign(campaignId:string,input:{newCampaignId:string;newName:string}){
  return mockAdapter.duplicateCampaign(campaignId,input);
}

export async function deleteCampaign(campaignId:string){
  return mockAdapter.deleteCampaign(campaignId);
}
