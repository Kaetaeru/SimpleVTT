import type { MockAdapter } from "./mockAdapter";

export interface ConnectedCampaignRosterCandidate {
  participantId:string;
  participantName:string;
  characterId:string;
}

export type ConnectedCampaignRosterResult=
  | {status:"committed";campaignId:string;rosterMemberId:string}
  | {status:"ignored";reason:string}
  | {status:"rejected";error:string};

type Handler=(adapter:MockAdapter,candidate:ConnectedCampaignRosterCandidate)=>Promise<ConnectedCampaignRosterResult>;

let handler:Handler=async()=>({status:"ignored",reason:"Campaign roster integration is not mounted"});

export function registerConnectedCampaignRosterHandler(next:Handler){handler=next;}

export function syncConnectedCampaignRoster(
  adapter:MockAdapter,
  candidate:ConnectedCampaignRosterCandidate,
){return handler(adapter,candidate);}
