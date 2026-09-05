import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import "../../src/app/connectedTurnRoutingAdapter";
import "../../src/app/productionSessionLifecycleAdapter";
import "../../src/app/connectedSceneTopologyRuntimeAdapter";
import "../../src/app/connectedTheaterOfMindRoutingAdapter";
import { buildCharacterSessionProjectionV1 } from "../../src/app/characterSessionProjection";
import { materializeCreatedWeaponAttacks } from "../../src/app/characterCreationWeaponAttackAdapter";
import { projectedCharacterById } from "../../src/app/characterSessionProjectionRegistry";
import { MockAdapter } from "../../src/app/mockAdapter";
import { ClientSessionReplica } from "../../src/app/connectedSessionProtocol";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { applyConnectedClientEvents, connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
import { encodeConnectedWireMessage, type ConnectedWireMessage } from "../../src/app/connectedSessionWire";
import { tauriSessionTransport, type SessionTransportMessage, type SessionTransportStatus } from "../../src/app/tauriSessionTransport";

const HOST_STATUS:SessionTransportStatus={role:"host",state:"connected",address:"127.0.0.1:3210",peerCount:0};
const STOPPED_STATUS:SessionTransportStatus={role:null,state:"disconnected",address:"",peerCount:0};
const GOBLIN="dnd.srd521.monster.goblin-warrior";

function installHostTransport() {
  const original={ available:tauriSessionTransport.available, startHost:tauriSessionTransport.startHost, send:tauriSessionTransport.send, sendTo:tauriSessionTransport.sendTo, stop:tauriSessionTransport.stop, onMessage:tauriSessionTransport.onMessage, onState:tauriSessionTransport.onState, onPeerLifecycle:tauriSessionTransport.onPeerLifecycle };
  let listener:((message:SessionTransportMessage)=>void)|undefined;
  const sent:string[]=[];
  tauriSessionTransport.available=()=>true;
  tauriSessionTransport.startHost=async()=>structuredClone(HOST_STATUS);
  tauriSessionTransport.send=async(message)=>{ sent.push(message); return 1; };
  tauriSessionTransport.sendTo=async(_peer,message)=>{ sent.push(message); return 1; };
  tauriSessionTransport.stop=async()=>structuredClone(STOPPED_STATUS);
  tauriSessionTransport.onMessage=async(handler)=>{ listener=handler; return ()=>{}; };
  tauriSessionTransport.onState=async()=>()=>{};
  tauriSessionTransport.onPeerLifecycle=async()=>()=>{};
  return {
    count:()=>sent.length,
    after:(index:number)=>sent.slice(index).map((entry)=>JSON.parse(entry) as ConnectedWireMessage),
    emitFrom(peer:string,message:ConnectedWireMessage) { assert.ok(listener,"host listener"); listener({ peer, message:encodeConnectedWireMessage(message) }); },
    restore() { Object.assign(tauriSessionTransport,original); },
  };
}

async function eventually(predicate:()=>boolean|Promise<boolean>,message:string) {
  for (let attempt=0; attempt<100; attempt+=1) { if (await predicate()) return; await new Promise<void>((resolve)=>setImmediate(resolve)); }
  assert.fail(message);
}

async function playerFixture(host:MockAdapter,characterId:string,name:string,revision:number) {
  const snapshot=await host.getSnapshot();
  const fighter=snapshot.catalog.find((entry)=>entry.category==="class"&&/fighter/i.test(`${entry.id} ${entry.nameEn}`))!;
  const human=snapshot.catalog.find((entry)=>entry.category==="species"&&/human/i.test(`${entry.id} ${entry.nameEn}`))!;
  const soldier=snapshot.catalog.find((entry)=>entry.category==="background"&&/soldier/i.test(`${entry.id} ${entry.nameEn}`))!;
  const sheet=structuredClone(snapshot.activeCharacter);
  sheet.id=characterId; sheet.name=name; sheet.className=fighter.nameKo; sheet.subclassName=undefined; sheet.species=human.nameKo; sheet.background=soldier.nameKo;
  sheet.classLevels=[{ classId:fighter.contentId!, level:sheet.level }];
  sheet.cantrips=[]; sheet.preparedSpells=[]; sheet.spellbookSpells=[]; sheet.masteryWeapons=[];
  sheet.sourceRevision=revision; sheet.runtimeRevision=revision;
  sheet.items=sheet.items.filter((item)=>item.definitionId==="dnd.srd521.item.weapon.longsword");
  sheet.equipment=sheet.items.map((item)=>item.name);
  sheet.attacks=materializeCreatedWeaponAttacks(sheet);
  return { characterId, revision, sheet, projection:buildCharacterSessionProjectionV1(sheet,snapshot.catalog) };
}

async function connectPlayer(host:MockAdapter,transport:ReturnType<typeof installHostTransport>,peer:string,fixture:Awaited<ReturnType<typeof playerFixture>>) {
  const manifest=connectedManifest(host);
  manifest.character={ characterId:fixture.characterId, sourceRevision:fixture.revision, runtimeRevision:fixture.revision };
  transport.emitFrom(peer,{ type:"hello", manifest, participantId:`client:${fixture.characterId}`, participantName:fixture.sheet.name, knownEventCursor:0, projection:fixture.projection });
  await eventually(()=>connectedStateFor(host).peerManifests.get(peer)?.character?.characterId===fixture.characterId,"hello must mount the projection");
  assert.equal(projectedCharacterById(host,fixture.characterId)?.peerId,peer);
}

function topologiesAfter(transport:ReturnType<typeof installHostTransport>,index:number) {
  return transport.after(index)
    .filter((message):message is Extract<ConnectedWireMessage,{type:"event-batch"}>=>message.type==="event-batch")
    .flatMap((batch)=>batch.events)
    .filter((event)=>event.payload.kind==="scene-topology")
    .map((event)=>(event.payload as Extract<typeof event.payload,{kind:"scene-topology"}>).topology);
}

async function clientReplica(host:MockAdapter,sessionId:string) {
  const client=new MockAdapter();
  const state=connectedStateFor(client);
  state.mode="client"; state.sessionId=sessionId; state.replica=new ClientSessionReplica(sessionId);
  const applied=await applyConnectedClientEvents(client,connectedStateFor(host).ledger!.eventsAfter(0));
  assert.equal(applied.status,"applied");
  return client;
}

test("C1-02: groups, badges, scene conditions and monster timing reach a player's replica through the scene topology", async () => {
  const transport=installHostTransport();
  const host=new MockAdapter();
  let stopped=false;
  try {
    await host.hostSession();
    const state=connectedStateFor(host);
    const p1=await playerFixture(host,"char.c102.p1","C1-02 P1",2101);
    await connectPlayer(host,transport,"peer.c102.p1",p1);

    let mark=transport.count();
    (host as unknown as { queuedInitiativeD20?:number }).queuedInitiativeD20=11;
    let snapshot=await host.instantiateCombatantGroup(GOBLIN,3);
    const goblins=snapshot.scene.entities.filter((entity)=>entity.id.startsWith(`${GOBLIN}.instance-`));
    assert.equal(goblins.length,3);
    let topologies=topologiesAfter(transport,mark);
    assert.ok(topologies.length>=1,"group add publishes the scene topology");
    const withGroups=topologies.at(-1)!;
    assert.ok(withGroups.groups && Object.keys(withGroups.groups).length===1,"topology carries the group");
    assert.ok(withGroups.entities.filter((entity)=>entity.groupId).length===3,"members carry their group id");

    mark=transport.count();
    await host.setCreatureBadge(goblins[0].id,"cover-half",true);
    await host.setSceneCondition("darkness",true);
    topologies=topologiesAfter(transport,mark);
    assert.ok(topologies.length>=2,"badge and scene condition each publish");
    const latest=topologies.at(-1)!;
    assert.ok(latest.entities.find((entity)=>entity.id===goblins[0].id)?.status.includes("엄폐 ½"));
    assert.deepEqual(latest.sceneConditions,["darkness"]);

    // A player's replica applies the same events and sees the same scene.
    const client=await clientReplica(host,state.sessionId!);
    const clientSnapshot=await client.getSnapshot();
    assert.equal(Object.keys(clientSnapshot.scene.groups ?? {}).length,1,"client sees the group");
    assert.ok(clientSnapshot.scene.entities.find((entity)=>entity.id===goblins[0].id)?.status.includes("엄폐 ½"),"client sees the badge");
    assert.deepEqual(clientSnapshot.scene.sceneConditions,["darkness"]);
    assert.equal(clientSnapshot.scene.entities.filter((entity)=>entity.groupId).length,3);

    await host.stopSession(); stopped=true;
  } finally { if (!stopped) await host.stopSession().catch(()=>undefined); transport.restore(); }
});

test("C1-02: a player's movement declaration is routed to the Host, and the 물러남 prompt reaches every replica", async () => {
  const transport=installHostTransport();
  const host=new MockAdapter();
  let stopped=false;
  try {
    await host.hostSession();
    const state=connectedStateFor(host);
    const p1=await playerFixture(host,"char.c102.mover","C1-02 Mover",2102);
    await connectPlayer(host,transport,"peer.c102.mover",p1);
    (host as unknown as { queuedInitiativeD20?:number }).queuedInitiativeD20=1;
    await host.instantiateCombatant(GOBLIN);
    const goblinId=(await host.getSnapshot()).scene.entities.find((entity)=>entity.id.startsWith(`${GOBLIN}.instance-`))!.id;
    await host.startInitiative();

    // The goblin engages the player in melee (host-controlled attack).
    await host.setCurrentActor(goblinId);
    const scimitar=(await host.getSnapshot()).scene.actionsByActor[goblinId].find((action)=>action.name==="시미터")!;
    await host.setQueuedD20(3);
    await host.resolveAction(scimitar.id,[p1.characterId]);
    let snapshot=await host.getSnapshot();
    for (let step=0; step<8 && snapshot.resolution && snapshot.resolution.stage!=="complete"; step+=1) snapshot=await host.advanceResolution();
    await host.dismissResolution();
    assert.ok((await host.getSnapshot()).scene.entities.find((entity)=>entity.id===p1.characterId)?.engagedWithIds?.includes(goblinId),"player is engaged");
    await host.setCurrentActor(p1.characterId);

    // The player declares 접근 then 물러남 through the wire.
    let mark=transport.count();
    transport.emitFrom("peer.c102.mover",{ type:"movement-request", request:{ sessionId:state.sessionId!, requestId:"mv-1", actorId:p1.characterId, kind:"approach", targetId:goblinId, knownEventCursor:state.ledger!.cursor } });
    await eventually(async()=>(await host.getSnapshot()).scene.entities.find((entity)=>entity.id===p1.characterId)?.movementDeclaration?.kind==="approach","host records the player's approach");
    await eventually(()=>topologiesAfter(transport,mark).at(-1)?.movementDeclarations?.[p1.characterId]?.kind==="approach","approach is published");

    mark=transport.count();
    transport.emitFrom("peer.c102.mover",{ type:"movement-request", request:{ sessionId:state.sessionId!, requestId:"mv-2", actorId:p1.characterId, kind:"withdraw", knownEventCursor:state.ledger!.cursor } });
    await eventually(async()=>Boolean((await host.getSnapshot()).scene.pendingWithdrawal),"withdraw raises the DM prompt on the host");
    await eventually(()=>topologiesAfter(transport,mark).at(-1)?.pendingWithdrawal?.actorId===p1.characterId,"the prompt is published to replicas");

    const client=await clientReplica(host,state.sessionId!);
    let clientSnapshot=await client.getSnapshot();
    assert.equal(clientSnapshot.scene.pendingWithdrawal?.actorId,p1.characterId,"the player's replica shows the waiting notice");

    // The DM lets the player go: the prompt clears everywhere and the engagement ends.
    mark=transport.count();
    await host.answerWithdrawalPrompt(null);
    assert.equal(topologiesAfter(transport,mark).at(-1)?.pendingWithdrawal,undefined);
    const applied=await applyConnectedClientEvents(client,state.ledger!.eventsAfter(connectedStateFor(client).replica!.cursor));
    assert.equal(applied.status,"applied");
    clientSnapshot=await client.getSnapshot();
    assert.equal(clientSnapshot.scene.pendingWithdrawal,undefined);
    assert.equal(clientSnapshot.scene.entities.find((entity)=>entity.id===p1.characterId)?.engagedWithIds,undefined);

    // A peer may only move its own character.
    mark=transport.count();
    transport.emitFrom("peer.c102.mover",{ type:"movement-request", request:{ sessionId:state.sessionId!, requestId:"mv-3", actorId:goblinId, kind:"stay", knownEventCursor:state.ledger!.cursor } });
    await eventually(()=>transport.after(mark).some((message)=>message.type==="error"&&message.code==="actor-projection-mismatch"),"foreign actor is refused");

    await host.stopSession(); stopped=true;
  } finally { if (!stopped) await host.stopSession().catch(()=>undefined); transport.restore(); }
});

test("C1-02: a connected client sends its own declaration as a movement request", async () => {
  const transport=installHostTransport();
  try {
    const client=new MockAdapter();
    const app=client as unknown as { connectionState:string; activeCharacter:{ id:string } };
    const state=connectedStateFor(client);
    state.mode="client"; state.sessionId="session.c102"; state.replica=new ClientSessionReplica("session.c102");
    app.connectionState="connected";
    const mark=transport.count();
    await client.declareMovement(app.activeCharacter.id,"withdraw");
    const sent=transport.after(mark);
    assert.equal(sent.length,1);
    assert.equal(sent[0].type,"movement-request");
    if (sent[0].type==="movement-request") { assert.equal(sent[0].request.actorId,app.activeCharacter.id); assert.equal(sent[0].request.kind,"withdraw"); }
    // Another creature's declaration is not sent.
    await client.declareMovement("combatant.goblin-a","stay");
    assert.equal(transport.after(mark).length,1);
  } finally { transport.restore(); }
});
