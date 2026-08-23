import type { PartyStashTransferCommand } from "./contracts";
import { connectedStateFor } from "./connectedSessionState";
import { MockAdapter } from "./mockAdapter";

const baseTransfer=MockAdapter.prototype.transferPartyStash;

MockAdapter.prototype.transferPartyStash=async function transferPartyStashWithClientPolicy(command:PartyStashTransferCommand){
  if(connectedStateFor(this).mode!=="client")return baseTransfer.call(this,command);
  const snapshot=await this.getSnapshot();
  const campaign=snapshot.campaignSessionSystems;
  if(!campaign||campaign.campaignId!==command.campaignId)throw new Error("파티 보관함의 캠페인이 현재 세션과 일치하지 않습니다.");
  const member=campaign.roster.find((entry)=>entry.characterId===command.actorId);
  if(!member||!(member.stashPermission==="request"||member.stashPermission==="manage"))throw new Error("파티 보관함 이동 권한이 없습니다.");
  const policy=campaign.partyStash.policy;
  if(policy==="dm-managed")throw new Error("이 파티 보관함은 DM 전용 관리 정책입니다.");
  if(policy==="dm-approval"&&command.direction==="stash-to-character")throw new Error("이 파티 보관함의 출고는 DM 승인이 필요합니다.");
  return baseTransfer.call(this,command);
};

export {};
