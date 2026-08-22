import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const runtime=readFileSync(new URL("../../src/app/connectedCampaignSystemsRuntimeAdapter.ts",import.meta.url),"utf8");
const main=readFileSync(new URL("../../src/main.tsx",import.meta.url),"utf8");

test("connected Sessions register Campaign systems after the base and history runtimes",()=>{
  const historyIndex=main.indexOf('import "./app/campaignSessionHistoryRuntimeAdapter"');
  const projectionIndex=main.indexOf('import "./app/connectedCampaignSystemsRuntimeAdapter"');
  assert.ok(historyIndex>=0);
  assert.ok(projectionIndex>historyIndex);
});

test("Campaign systems use a session-scoped revisioned projection envelope",()=>{
  assert.match(runtime,/type:"campaign-systems-projection"/);
  assert.match(runtime,/sessionId:string;revision:number/);
  assert.match(runtime,/decoded\.revision>=current\.revision/);
  assert.match(runtime,/state\.sessionId!==decoded\.sessionId/);
});

test("Host restores projection after compatible hello and broadcasts every Campaign mutation",()=>{
  assert.match(runtime,/value\?\.type==="hello-ack"/);
  assert.match(runtime,/compatibility\?\.status==="compatible"/);
  assert.match(runtime,/baseSendTo\(peer,JSON\.stringify\(envelope\)\)/);
  for(const method of ["advanceCampaignCalendar","correctCampaignCalendar","correctCampaignCalendarDateTime","setCampaignCalendarNote","undoCampaignCalendar","adjustCampaignRations","consumeCampaignDailyRations","undoCampaignRationConsumption","advanceCampaignDay"]){
    assert.match(runtime,new RegExp(`MockAdapter\\.prototype\\.${method}=broadcastAfter`));
  }
  assert.match(runtime,/connectedStateFor\(adapter\)\.peerParticipants\.keys\(\)/);
  assert.match(runtime,/baseSendTo\(peer,message\)/);
  assert.match(runtime,/upsertCampaignRosterMember=broadcastAfter/);
  assert.match(runtime,/removeCampaignRosterMember=broadcastAfter/);
  assert.match(runtime,/grantCampaignAdvancement=broadcastAfter/);
  assert.match(runtime,/transferPartyStash=broadcastAfter/);
  assert.match(runtime,/campaign-level-up-complete/);
  assert.match(runtime,/hostConsumeCampaignLevelUp/);
  assert.match(runtime,/manifest\?\.characterId===levelUpRequest\.characterId/);
});

test("connected Player snapshots cannot receive the Campaign aggregate or hidden ration amounts",()=>{
  assert.match(runtime,/if\(!copy\.rations\.visibleToPlayers\)/);
  assert.match(runtime,/copy\.rations=\{enabled:copy\.rations\.enabled,visibleToPlayers:false\}/);
  assert.match(runtime,/copy\.roster=copy\.roster\.map/);
  assert.match(runtime,/countsForRations:_/);
  assert.match(runtime,/rationUnitsPerDay:__/);
  assert.match(runtime,/campaignSessionSystems:structuredClone\(remoteProjections\.get\(this\)\?\.projection\?\?null\)/);
  assert.match(runtime,/campaignSessionSnapshot:null/);
});
