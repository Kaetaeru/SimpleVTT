import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { discloseConnectedResolution } from "../../src/app/connectedActionRoutingAdapter";
import {
  isConnectedResolutionPresentation,
  redactConnectedResolutionPresentation,
  type ConnectedResolutionPresentationV1,
} from "../../src/app/connectedResolutionPresentation";
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
type Wire=PresentationWire|EventBatchWire;

const TARGET_ID="combatant.goblin-a";
const TARGET_LABEL="고블린 A";
// Raw values and inferable metadata of the hidden miss (d20 2 + 7 = 9 vs AC 15) that must never reach P1/P2.
const PRIVATE_MARKERS=[TARGET_ID,TARGET_LABEL,"9 vs 15","9 vs AC 15","빗나감","failure","attack-bonus","d20 2","\"faces\":[2]","공격 보너스"];

function prepareClient(adapter:MockAdapter,sessionId:string) {
  const state=connectedStateFor(adapter);
  state.mode="client";
  state.sessionId=sessionId;
  state.replica=new ClientSessionReplica(sessionId);
}

function assertNoPrivateMarkers(label:string,serialized:string) {
  for(const marker of PRIVATE_MARKERS) assert.equal(serialized.includes(marker),false,`${label} leaks hidden fact ${JSON.stringify(marker)}`);
}

async function drainPresentation(adapter:MockAdapter) {
  while(advanceConnectedResolutionPresentation(adapter).status==="applied");
}

async function hiddenMissSession() {
  const sessionId="session.hidden-resolution";
  const host=new MockAdapter();
  const hostState=connectedStateFor(host);
  hostState.mode="host";
  hostState.sessionId=sessionId;
  hostState.ledger=new HostSessionLedger(sessionId,connectedManifest(host));
  await host.setSessionMode("initiative");
  await host.setCurrentActor("char.aelar");
  await host.setQueuedD20(2);

  const broadcasts:string[]=[];
  const originalSend=tauriSessionTransport.send;
  tauriSessionTransport.send=async(message:string)=>{broadcasts.push(message);return 2;};
  const restore=()=>{tauriSessionTransport.send=originalSend;};
  try {
    await host.setNextResolutionVisibility({hidden:["roll","targets"]});
    let snapshot=await host.resolveAction("action.longsword",[TARGET_ID]);
    for(let step=0;step<8&&snapshot.resolution?.stage!=="complete";step+=1) snapshot=await host.advanceResolution();
    assert.equal(snapshot.resolution?.stage,"complete");
    const messages=broadcasts.map((entry)=>JSON.parse(entry) as Wire);
    const live=messages.filter((entry):entry is PresentationWire=>entry.type==="resolution-presentation");
    const batches=messages.filter((entry):entry is EventBatchWire=>entry.type==="event-batch");
    assert.ok(live.length>=1);
    assert.equal(batches.length,1);

    const p1=new MockAdapter();
    const p2=new MockAdapter();
    prepareClient(p1,sessionId);
    prepareClient(p2,sessionId);
    for(const message of live){
      assert.notEqual(applyConnectedResolutionPresentation(p1,message.presentation).status,"rejected");
      assert.notEqual(applyConnectedResolutionPresentation(p2,message.presentation).status,"rejected");
    }
    await drainPresentation(p1);
    await drainPresentation(p2);
    assert.equal((await applyConnectedClientEvents(p1,batches[0].events)).status,"applied");
    assert.equal((await applyConnectedClientEvents(p2,batches[0].events)).status,"applied");
    return {sessionId,host,hostState,p1,p2,live,batches,broadcasts,snapshot,restore};
  } catch(error) {
    restore();
    throw error;
  }
}

test("MP-B06: hidden roll and target facts never reach P1/P2 in live, committed, or catch-up payloads",async()=>{
  const session=await hiddenMissSession();
  try {
    const {live,batches,broadcasts,snapshot,hostState}=session;
    const resolutionId=snapshot.resolution!.id;
    for(const [index,message] of live.entries()){
      const presentation=message.presentation;
      assert.deepEqual(presentation.audience,{scope:"public-redacted",hidden:["roll","targets"]});
      assert.equal(isConnectedResolutionPresentation(presentation),true,`live presentation ${index} must validate on the Client`);
      assert.deepEqual(presentation.resolution.authoritativeDice,[]);
      assert.equal(presentation.resolution.naturalD20,undefined);
      assert.equal(presentation.resolution.attackTotal,undefined);
      assert.equal(presentation.resolution.attackOutcome,undefined);
      assert.equal(presentation.resolution.targetAc,undefined);
      assert.equal(presentation.resolution.finalOutcome,"비공개");
      assert.deepEqual(presentation.resolution.targetIds,[]);
      assert.deepEqual(presentation.targets,[]);
      assert.equal(presentation.action,undefined);
      assert.deepEqual(presentation.dice,{faces:[],selectedIndices:[],discardedIndices:[],selection:"unknown"});
      assert.equal(presentation.actor.id,"char.aelar","the acting entity itself is not a hidden fact");
    }
    const terminal=batches[0].events[0].payload;
    assert.equal(terminal.kind,"resolution");
    if(terminal.kind!=="resolution") throw new Error("expected terminal resolution event");
    assert.equal(terminal.presentation.audience.scope,"public-redacted");
    assert.equal(isConnectedResolutionPresentation(terminal.presentation),true);
    assert.deepEqual(terminal.stateChanges,[]);
    assert.deepEqual(terminal.provenance,["host-private resolution"]);
    assert.ok(terminal.resolutionEvents.length>0,"mechanical events still converge exactly once");
    for(const event of terminal.resolutionEvents){
      assert.equal(event.summary,"비공개 판정");
      assert.deepEqual(event.provenance,[]);
      assert.deepEqual(event.result,{hidden:true});
      assert.notEqual(event.targetId,TARGET_ID);
    }
    for(const [index,serialized] of broadcasts.entries()) assertNoPrivateMarkers(`broadcast ${index}`,serialized);

    // Catch-up readers replay the ledger, so the committed history itself must already be redacted.
    const catchUp=hostState.ledger!.eventsAfter(0);
    assert.equal(catchUp.length,1);
    assertNoPrivateMarkers("catch-up history",JSON.stringify(catchUp));
    assert.equal(hostState.hiddenResolutions.get(resolutionId)?.hidden.join(","),"roll,targets");
  } finally {
    session.restore();
  }
});

test("MP-B05: the Host keeps private detail while P1 and P2 hold only the identical public projection",async()=>{
  const session=await hiddenMissSession();
  try {
    const {snapshot,host,hostState,p1,p2}=session;
    const resolutionId=snapshot.resolution!.id;
    assert.deepEqual(snapshot.resolution?.authoritativeDice,[2]);
    assert.equal(snapshot.resolution?.attackOutcome,"빗나감");
    assert.deepEqual(snapshot.resolution?.targetIds,[TARGET_ID]);
    const hostActivity=snapshot.activity.find((entry)=>entry.id===resolutionId);
    assert.ok(hostActivity);
    assert.equal(hostActivity.title,`롱소드 → ${TARGET_LABEL}`);
    assert.match(hostActivity.summary,/9 vs AC 15/);
    const record=hostState.hiddenResolutions.get(resolutionId);
    assert.deepEqual(record?.presentation.dice.faces,[2]);
    assert.deepEqual(record?.presentation.targets,[{id:TARGET_ID,label:TARGET_LABEL}]);

    const [p1Snapshot,p2Snapshot]=await Promise.all([p1.getSnapshot(),p2.getSnapshot()]);
    for(const [label,client] of [["P1",p1Snapshot],["P2",p2Snapshot]] as const){
      assert.equal(client.resolution?.id,resolutionId);
      assert.deepEqual(client.resolution?.authoritativeDice,[]);
      assert.equal(client.resolution?.attackOutcome,undefined);
      assert.deepEqual(client.resolution?.targetIds,[]);
      assert.equal(client.resolutionPresentation?.action,undefined);
      const activityIndex=client.activity.findIndex((entry)=>entry.id===resolutionId);
      assert.ok(activityIndex>=0,`${label} records the ordered public Activity entry`);
      // Only entries produced by this Session are in scope; the seeded demo Activity predates it.
      assertNoPrivateMarkers(`${label} activity`,JSON.stringify(client.activity.slice(0,activityIndex+1)));
      assertNoPrivateMarkers(`${label} resolution`,JSON.stringify(client.resolution));
    }
    assert.deepEqual(p1Snapshot.resolution,p2Snapshot.resolution);
    assert.deepEqual(p1Snapshot.activity,p2Snapshot.activity);
    assert.equal(hostState.hiddenResolutions.size,1);
    await host.getSnapshot();
  } finally {
    session.restore();
  }
});

test("MP-B07: one ordered disclosure event reveals only the selected fact and is applied exactly once",async()=>{
  const session=await hiddenMissSession();
  try {
    const {host,hostState,p1,p2,broadcasts,snapshot}=session;
    const resolutionId=snapshot.resolution!.id;
    const before=broadcasts.length;
    const disclosed=await discloseConnectedResolution(host,resolutionId,["roll"]);
    assert.equal(disclosed.status,"disclosed");
    if(disclosed.status!=="disclosed") throw new Error("expected disclosure");
    assert.equal(disclosed.event.sequence,2,"disclosure is the next ordered ledger event after the hidden resolution");
    assert.equal(broadcasts.length,before+1);
    const wire=JSON.parse(broadcasts[before]) as EventBatchWire;
    assert.equal(wire.type,"event-batch");
    assert.equal(wire.events.length,1);
    const payload=wire.events[0].payload;
    assert.equal(payload.kind,"resolution-disclosure");
    if(payload.kind!=="resolution-disclosure") throw new Error("expected disclosure payload");
    assert.deepEqual(payload.disclosed,["roll"]);
    assert.deepEqual(payload.roll?.dice.faces,[2]);
    assert.equal(payload.roll?.facts.attackOutcome,"빗나감");
    assert.equal(payload.roll?.facts.attackTotal,9);
    assert.equal(payload.targets,undefined,"targets stay hidden until selected");
    const serialized=broadcasts[before];
    assert.equal(serialized.includes(TARGET_ID),false,"roll provenance must not name the still-hidden target");
    assert.equal(serialized.includes(TARGET_LABEL),false);
    assert.ok(payload.roll?.facts.provenance.some((line)=>line.includes("비공개 대상")),"target references in roll text are scrubbed, not dropped");
    assert.deepEqual(payload.roll?.facts.saveResults,[]);

    assert.equal((await applyConnectedClientEvents(p1,wire.events)).status,"applied");
    assert.equal((await applyConnectedClientEvents(p2,wire.events)).status,"applied");
    assert.equal((await applyConnectedClientEvents(p1,wire.events)).status,"duplicate");
    const [p1Snapshot,p2Snapshot]=await Promise.all([p1.getSnapshot(),p2.getSnapshot()]);
    assert.deepEqual(p1Snapshot.resolution?.authoritativeDice,[2]);
    assert.equal(p1Snapshot.resolution?.attackOutcome,"빗나감");
    assert.deepEqual(p1Snapshot.resolution?.targetIds,[],"target identity remains hidden");
    assert.equal(p1Snapshot.activity[0]?.id,payload.disclosureId);
    assert.match(p1Snapshot.activity[0]?.title??"",/^DM 공개/);
    assert.ok(p1Snapshot.activity[0]?.detail.some((line)=>line.includes("d20 2")));
    assert.equal(p1Snapshot.activity[1]?.id,resolutionId,"history stays ordered: hidden resolution then disclosure");
    assert.deepEqual(p1Snapshot.activity,p2Snapshot.activity);
    assert.equal(hostState.hiddenResolutions.get(resolutionId)?.disclosed.join(","),"roll");
    const hostSnapshot=await host.getSnapshot();
    assert.match(hostSnapshot.activity[0]?.title??"",/^DM 공개 · 롱소드/);

    const again=await discloseConnectedResolution(host,resolutionId,["roll"]);
    assert.equal(again.status,"rejected");
    const targets=await discloseConnectedResolution(host,resolutionId,["targets"]);
    assert.equal(targets.status,"disclosed");
    if(targets.status!=="disclosed") throw new Error("expected target disclosure");
    assert.equal(targets.event.sequence,3);
    assert.equal((await applyConnectedClientEvents(p1,[targets.event])).status,"applied");
    assert.deepEqual((await p1.getSnapshot()).resolution?.targetIds,[TARGET_ID]);
    assert.equal((await discloseConnectedResolution(p1,resolutionId,["roll"])).status,"rejected","a Client cannot disclose");
    assert.equal((await discloseConnectedResolution(host,"resolution.unknown",["roll"])).status,"rejected");
  } finally {
    session.restore();
  }
});

test("redaction is validated on the receiving side: a redacted envelope that still carries hidden facts is rejected",async()=>{
  const session=await hiddenMissSession();
  try {
    const full=session.hostState.hiddenResolutions.get(session.snapshot.resolution!.id)!.presentation;
    assert.equal(full.audience.scope,"public");
    assert.equal(isConnectedResolutionPresentation(full),true);
    assert.equal(redactConnectedResolutionPresentation(full,{hidden:[]}),full,"no hidden facts keeps the public envelope");
    assert.equal(redactConnectedResolutionPresentation(full,undefined),full);

    const redacted=redactConnectedResolutionPresentation(full,{hidden:["roll","roll","targets"]});
    assert.deepEqual(redacted.audience,{scope:"public-redacted",hidden:["roll","targets"]});
    assert.equal(isConnectedResolutionPresentation(redacted),true);

    const leakingDice=structuredClone(redacted);
    leakingDice.resolution.authoritativeDice=[2];
    leakingDice.dice.faces=[2];
    assert.equal(isConnectedResolutionPresentation(leakingDice),false);

    const leakingOutcome=structuredClone(redacted);
    leakingOutcome.resolution.finalOutcome="빗나감";
    assert.equal(isConnectedResolutionPresentation(leakingOutcome),false);

    const leakingTarget=structuredClone(redacted);
    leakingTarget.resolution.targetIds=[TARGET_ID];
    leakingTarget.targets=[{id:TARGET_ID,label:TARGET_LABEL}];
    assert.equal(isConnectedResolutionPresentation(leakingTarget),false);

    const leakingAction=structuredClone(redacted);
    leakingAction.action=full.action;
    assert.equal(isConnectedResolutionPresentation(leakingAction),false);

    const emptyHidden=structuredClone(redacted) as unknown as {audience:{scope:string;hidden:string[]}};
    emptyHidden.audience.hidden=[];
    assert.equal(isConnectedResolutionPresentation(emptyHidden),false);
    const duplicateHidden=structuredClone(redacted) as unknown as {audience:{scope:string;hidden:string[]}};
    duplicateHidden.audience.hidden=["roll","roll"];
    assert.equal(isConnectedResolutionPresentation(duplicateHidden),false);
  } finally {
    session.restore();
  }
});

test("visibility is armed per Resolution: an open roll after a hidden one is published in full",async()=>{
  const session=await hiddenMissSession();
  try {
    const {host,broadcasts,hostState}=session;
    await host.dismissResolution();
    await host.setQueuedD20(11);
    const before=broadcasts.length;
    let snapshot=await host.resolveAction("action.longsword",[TARGET_ID]);
    for(let step=0;step<8&&snapshot.resolution?.stage!=="complete";step+=1) snapshot=await host.advanceResolution();
    assert.equal(snapshot.resolution?.stage,"complete");
    const messages=broadcasts.slice(before).map((entry)=>JSON.parse(entry) as Wire);
    const live=messages.filter((entry):entry is PresentationWire=>entry.type==="resolution-presentation");
    assert.ok(live.length>0);
    for(const message of live) assert.deepEqual(message.presentation.audience,{scope:"public"});
    assert.deepEqual(live[0].presentation.resolution.authoritativeDice,[11]);
    assert.deepEqual(live[0].presentation.targets,[{id:TARGET_ID,label:TARGET_LABEL}]);
    assert.equal(hostState.hiddenResolutions.size,1);
    assert.equal(hostState.nextResolutionVisibility,null);
  } finally {
    session.restore();
  }
});
