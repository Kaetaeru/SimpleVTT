import type { MockAdapter } from "./mockAdapter";
import { projectedCharacterById } from "./characterSessionProjectionRegistry";
import { connectedStateFor } from "./connectedSessionState";

export interface ConnectedCampaignRosterCandidate {
  participantId:string;
  participantName:string;
  characterId:string;
  level?:number;
}

export type ConnectedCampaignRosterResult=
  | {status:"committed";campaignId:string;rosterMemberId:string}
  | {status:"ignored";reason:string}
  | {status:"rejected";error:string};

type Handler=(adapter:MockAdapter,candidate:ConnectedCampaignRosterCandidate)=>Promise<ConnectedCampaignRosterResult>;

let handler:Handler=async()=>({status:"ignored",reason:"Campaign roster integration is not mounted"});

export function registerConnectedCampaignRosterHandler(next:Handler){handler=next;}

export async function syncConnectedCampaignRoster(
  adapter:MockAdapter,
  candidate:ConnectedCampaignRosterCandidate,
){
  const state=connectedStateFor(adapter);
  const activePeer=projectedCharacterById(adapter,candidate.characterId)?.peerId;
  const stalePeers=activePeer
    ? [...state.peerManifests.entries()]
      .filter(([peer,manifest])=>peer!==activePeer&&manifest.character?.characterId===candidate.characterId)
      .map(([peer,manifest])=>({peer,manifest,participantId:state.peerParticipants.get(peer)}))
    : [];
  const restore=()=>{
    for(const {peer,manifest,participantId} of stalePeers){
      if(!state.peerManifests.has(peer))state.peerManifests.set(peer,manifest);
      if(participantId&&!state.peerParticipants.has(peer))state.peerParticipants.set(peer,participantId);
    }
  };
  for(const {peer} of stalePeers){state.peerManifests.delete(peer);state.peerParticipants.delete(peer);}
  try{
    const result=await handler(adapter,candidate);
    if(result.status==="rejected")restore();
    return result;
  }catch(error){restore();throw error;}
}
