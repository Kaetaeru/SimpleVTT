import type { AppSnapshot, PartyStashTransferCommand } from "./contracts";
import { MockAdapter } from "./mockAdapter";

export function trustedPartyStashCapabilities(snapshot:AppSnapshot,definitionId:string){
  const matches=snapshot.catalog.filter((entry)=>entry.category==="item"&&(entry.contentId===definitionId||entry.id===definitionId));
  if(matches.length!==1)return [];
  return [...new Set(matches[0].capabilities.map((value)=>value.trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"en"));
}

async function normalizeDepositCapabilities(adapter:MockAdapter,command:PartyStashTransferCommand):Promise<PartyStashTransferCommand>{
  if(command.asset!=="item"||command.direction!=="character-to-stash"||!command.itemTemplate)return command;
  const snapshot=await adapter.getSnapshot();
  const capabilities=trustedPartyStashCapabilities(snapshot,command.definitionId);
  return {...command,itemTemplate:{...command.itemTemplate,capabilities}};
}

const previousTransferPartyStash=MockAdapter.prototype.transferPartyStash;
MockAdapter.prototype.transferPartyStash=async function transferPartyStashWithTrustedCapabilities(command){
  return previousTransferPartyStash.call(this,await normalizeDepositCapabilities(this,command));
};

const previousCommitConnectedPartyStashDeposit=MockAdapter.prototype.commitConnectedPartyStashDeposit;
MockAdapter.prototype.commitConnectedPartyStashDeposit=async function commitConnectedPartyStashDepositWithTrustedCapabilities(command){
  return previousCommitConnectedPartyStashDeposit.call(this,await normalizeDepositCapabilities(this,command));
};

export function trustedPartyStashCapabilitiesForTests(snapshot:AppSnapshot,definitionId:string){
  return trustedPartyStashCapabilities(snapshot,definitionId);
}
