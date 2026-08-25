import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import type { ConnectedResolutionPresentationV1 } from "../../src/app/connectedResolutionPresentation";
import { ClientSessionReplica, HostSessionLedger, type ConnectedSessionEvent } from "../../src/app/connectedSessionProtocol";
import {
  advanceConnectedResolutionPresentation,
  applyConnectedClientEvents,
  applyConnectedResolutionPresentation,
  connectedManifest,
} from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { MockAdapter } from "../../src/app/mockAdapter";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";

type PresentationWire={type:"resolution-presentation";sessionId:string;presentation:ConnectedResolutionPresentationV1};
type EventBatchWire={type:"event-batch";sessionId:string;afterCursor:number;events:ConnectedSessionEvent[]};
type Case={name:string;actorId:string;actionId:string;targetIds:string[];d20?:number};

const cases:Case[]=[
  {name:"attack hit and multi-die damage",actorId:"char.aelar",actionId:"action.longsword",targetIds:["combatant.goblin-a"],d20:11},
  {name:"attack miss",actorId:"char.aelar",actionId:"action.shortbow",targetIds:["combatant.goblin-a"],d20:1},
  {name:"ability check with no target",actorId:"char.aelar",actionId:"action.skill.athletics",targetIds:[],d20:13},
  {name:"self feature healing and resource",actorId:"char.aelar",actionId:"action.second-wind",targetIds:["char.aelar"]},
  {name:"consumable healing item",actorId:"char.aelar",actionId:"action.healing-potion",targetIds:["char.aelar"]},
  {name:"charged no-roll damage item",actorId:"char.aelar",actionId:"action.wand",targetIds:["combatant.goblin-a"]},
  {name:"no-roll self action",actorId:"char.aelar",actionId:"action.dash",targetIds:["char.aelar"]},
];

function prepareClient(adapter:MockAdapter,sessionId:string){
  const state=connectedStateFor(adapter);
  state.mode="client";
  state.sessionId=sessionId;
  state.replica=new ClientSessionReplica(sessionId);
}

async function drain(adapter:MockAdapter){
  const stages:string[]=[];
  while(true){
    const snapshot=await adapter.getSnapshot();
    if(snapshot.resolution)stages.push(snapshot.resolution.stage);
    if(advanceConnectedResolutionPresentation(adapter).status==="empty")return stages;
  }
}

for(const scenario of cases)test(`three-peer matrix · ${scenario.name}`,async()=>{
  const sessionId=`session.matrix.${scenario.actionId.replaceAll(".","-")}.${scenario.d20??"auto"}`;
  const host=new MockAdapter();
  await host.setReferenceRole("dm");
  await host.setSessionMode("freeform");
  await host.setCurrentActor(scenario.actorId);
  if(scenario.d20!==undefined)await host.setQueuedD20(scenario.d20);
  const state=connectedStateFor(host);
  state.mode="host";
  state.sessionId=sessionId;
  state.ledger=new HostSessionLedger(sessionId,connectedManifest(host));

  const broadcasts:string[]=[];
  const originalSend=tauriSessionTransport.send;
  tauriSessionTransport.send=async(message)=>{broadcasts.push(message);return 2;};
  try{
    let completed=await host.resolveAction(scenario.actionId,scenario.targetIds);
    assert.ok(completed.resolution,`${scenario.actionId} must start a resolution`);
    for(let step=0;step<12&&completed.resolution?.stage!=="complete";step+=1){
      completed=completed.resolution?.rollKind==="check"&&completed.resolution.stage==="effect-preview"&&completed.resolution.checkTarget===undefined
        ?await host.applyDmAdjudication({type:"ability-check-dc",value:15,scope:"resolution"})
        :completed.resolution?.stage==="interrupt"
        ?await host.respondToInterrupt(false)
        :await host.advanceResolution();
    }
    assert.equal(completed.resolution?.stage,"complete",`${scenario.actionId} must reach terminal state`);

    const messages=broadcasts.map((entry)=>JSON.parse(entry) as PresentationWire|EventBatchWire);
    const live=messages.filter((entry):entry is PresentationWire=>entry.type==="resolution-presentation");
    const batches=messages.filter((entry):entry is EventBatchWire=>entry.type==="event-batch");
    assert.ok(live.length>=1,`${scenario.actionId} must expose at least one live shared presentation stage`);
    assert.equal(batches.length,1,`${scenario.actionId} must commit exactly one event batch`);
    assert.equal(batches[0].events.length,1);
    assert.deepEqual(live.map((entry)=>entry.presentation.presentationSequence),live.map((_,index)=>index+1));

    const actorClient=new MockAdapter();
    const observerClient=new MockAdapter();
    prepareClient(actorClient,sessionId);
    prepareClient(observerClient,sessionId);
    for(const message of live){
      applyConnectedResolutionPresentation(actorClient,message.presentation);
      applyConnectedResolutionPresentation(observerClient,message.presentation);
    }
    const actorStages=await drain(actorClient);
    const observerStages=await drain(observerClient);
    assert.deepEqual(actorStages,observerStages);
    const latestDiceIndex=live.findLastIndex((entry)=>["roll-animation","save-animation","damage-animation"].includes(entry.presentation.resolution.stage)&&entry.presentation.resolution.authoritativeDice.length>0);
    assert.deepEqual(actorStages,live.slice(Math.max(0,latestDiceIndex)).map((entry)=>entry.presentation.resolution.stage));

    const actorApplied=await applyConnectedClientEvents(actorClient,batches[0].events);
    const observerApplied=await applyConnectedClientEvents(observerClient,batches[0].events);
    assert.equal(actorApplied.status,"applied");
    assert.equal(observerApplied.status,"applied");
    assert.equal(advanceConnectedResolutionPresentation(actorClient).status,"applied");
    assert.equal(advanceConnectedResolutionPresentation(observerClient).status,"applied");
    const [actorAfter,observerAfter]=await Promise.all([actorClient.getSnapshot(),observerClient.getSnapshot()]);
    assert.deepEqual(actorAfter.resolution,observerAfter.resolution);
    assert.deepEqual(actorAfter.scene.entities,observerAfter.scene.entities);
    assert.equal(actorAfter.resolution?.stage,"complete");
    assert.equal(actorAfter.resolution?.id,completed.resolution?.id);
    assert.equal(actorAfter.activity[0]?.stateChanges.join("\n"),observerAfter.activity[0]?.stateChanges.join("\n"));
  }finally{
    tauriSessionTransport.send=originalSend;
  }
});

test("client routes a mapless opportunity trigger through the authoritative action-request channel",async()=>{
  const client=new MockAdapter();
  await client.setConnectionState("connected");
  prepareClient(client,"session.opportunity");
  const sent:string[]=[];
  const originalSend=tauriSessionTransport.send;
  tauriSessionTransport.send=async(message)=>{sent.push(message);return 1;};
  try{
    await client.declareManualMovementReaction({
      kind:"opportunity-attack",provokerId:"char.aelar",reactorId:"combatant.goblin-a",attackActionId:"action.scimitar",
      distanceFeet:5,visibleAtTrigger:true,coverAtTrigger:"none",targetCanSeeReactorAtTrigger:true,
    });
    assert.equal(sent.length,1);
    const wire=JSON.parse(sent[0]);
    assert.equal(wire.type,"action-request");
    assert.equal(wire.request.actorId,"char.aelar");
    assert.equal(wire.request.manualMovementReaction.reactorId,"combatant.goblin-a");
    assert.ok(wire.request.capabilities.includes("manual-movement-reaction-v1"));
  }finally{tauriSessionTransport.send=originalSend;}
});
