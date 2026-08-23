import "./campaignRuntimeAdapter";
import type { AppSnapshot } from "./contracts";
import { CampaignApplicationService } from "./campaignApplicationService";
import type { CampaignSessionSystemsProjection } from "./campaignPersistenceContracts";
import { connectedStateFor } from "./connectedSessionState";
import { MockAdapter } from "./mockAdapter";
import { tauriSessionTransport } from "./tauriSessionTransport";

type PartyStashPolicy="shared"|"dm-approval"|"dm-managed";
type InternalPolicyPayload={__partyStashPolicy:PartyStashPolicy};

const baseServiceUpdate=CampaignApplicationService.prototype.updateCampaign;
CampaignApplicationService.prototype.updateCampaign=function updateCampaignWithPartyStashPolicy(context){
  const payload=context.payload as typeof context.payload&Partial<InternalPolicyPayload>;
  const policy=payload.__partyStashPolicy;
  if(policy!==undefined){
    if(policy!=="shared"&&policy!=="dm-approval"&&policy!=="dm-managed")throw new Error("지원하지 않는 파티 보관함 정책입니다.");
    return this.mutateCampaign(context,(campaign)=>{
      if(campaign.partyStash.policy!==policy){
        campaign.partyStash={...campaign.partyStash,policy,revision:campaign.partyStash.revision+1};
      }
      if(campaign.sessionDefaults.stashPolicy!==policy){
        campaign.sessionDefaults={...campaign.sessionDefaults,stashPolicy:policy,revision:campaign.sessionDefaults.revision+1};
      }
    });
  }
  return baseServiceUpdate.call(this,context);
};

function safeProjection(projection:CampaignSessionSystemsProjection){
  const copy=structuredClone(projection);
  if(!copy.rations.visibleToPlayers){
    copy.rations={enabled:copy.rations.enabled,visibleToPlayers:false};
    copy.roster=copy.roster.map(({countsForRations:_,rationUnitsPerDay:__,...member})=>member);
  }
  return copy;
}

async function broadcastPolicyProjection(adapter:MockAdapter,snapshot:AppSnapshot){
  const state=connectedStateFor(adapter);
  if(state.mode!=="host"||!state.sessionId||!snapshot.campaignSessionSystems)return;
  const projection=safeProjection(snapshot.campaignSessionSystems);
  const message=JSON.stringify({type:"campaign-systems-projection",sessionId:state.sessionId,revision:projection.campaignRevision,projection});
  await Promise.all([...state.peerParticipants.keys()].map((peer)=>tauriSessionTransport.sendTo(peer,message)));
}

declare module "./mockAdapter" {
  interface MockAdapter {
    configureCampaignPartyStashPolicy(campaignId:string,policy:PartyStashPolicy):Promise<AppSnapshot>;
  }
}

MockAdapter.prototype.configureCampaignPartyStashPolicy=async function configureCampaignPartyStashPolicyRuntime(campaignId,policy){
  if(policy!=="shared"&&policy!=="dm-approval"&&policy!=="dm-managed")throw new Error("지원하지 않는 파티 보관함 정책입니다.");
  const update=this.updateCampaign as unknown as (campaignId:string,payload:InternalPolicyPayload)=>Promise<AppSnapshot>;
  const snapshot=await update.call(this,campaignId,{__partyStashPolicy:policy});
  await broadcastPolicyProjection(this,snapshot).catch(()=>undefined);
  return snapshot;
};

export {};
