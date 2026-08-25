import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedActionRoutingAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import type { CharacterSheet, SceneVm } from "../../src/app/contracts";
import { PALADIN_ID, PALADIN_LAY_ON_HANDS_RESOURCE_ID } from "../../src/domain/coreClassResources";
import { applyAdapterRuntimeEffectApplication } from "../../src/app/realRuntimeEffectApplicationService";
import { buildLayOnHandsExecutionActionId } from "../../src/app/paladinLayOnHandsRuntimeContracts";
import { applyConnectedClientEvents, connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { ClientSessionReplica, HostSessionLedger, type ConnectedSessionEvent } from "../../src/app/connectedSessionProtocol";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";

async function paladin() {
  const adapter=new MockAdapter();
  const internal=adapter as unknown as {activeCharacter:CharacterSheet;scene:SceneVm};
  internal.activeCharacter={...internal.activeCharacter,className:"팔라딘",level:14,classLevels:[{classId:PALADIN_ID,className:"팔라딘",level:14}],resources:[]};
  await adapter.getSnapshot();
  await adapter.startInitiative();await adapter.setCurrentActor(internal.activeCharacter.id);await adapter.selectDmActor(internal.activeCharacter.id);
  return adapter;
}

function command(snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>,healing:number,remove:"poisoned"[]=[]){
  const action=snapshot.scene.actionsByActor[snapshot.activeCharacter.id]?.find((entry)=>entry.id==="action.paladin.lay-on-hands");
  assert.ok(action);
  return buildLayOnHandsExecutionActionId(action,healing,remove);
}

test("Lay On Hands spends an arbitrary amount, uses Bonus Action, and Undo restores exact state",async()=>{
  const adapter=await paladin();let snapshot=await adapter.getSnapshot();const target=snapshot.scene.entities.find((entry)=>entry.id==="combatant.goblin-a")!;const beforeHp=target.hp;
  await adapter.resolveAction(command(snapshot,7),[target.id]);snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id===target.id)?.hp,Math.min(target.maxHp,beforeHp+7));
  assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id===PALADIN_LAY_ON_HANDS_RESOURCE_ID)?.current,63);
  assert.equal(snapshot.scene.economyByActor[snapshot.activeCharacter.id]?.bonusAction,false);
  await adapter.undoLastResolution();snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id===target.id)?.hp,beforeHp);
  assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id===PALADIN_LAY_ON_HANDS_RESOURCE_ID)?.current,70);
  assert.equal(snapshot.scene.economyByActor[snapshot.activeCharacter.id]?.bonusAction,true);
});

test("Lay On Hands removes Poisoned for five pool points",async()=>{
  const adapter=await paladin();const seeded=await applyAdapterRuntimeEffectApplication(adapter,{resolutionId:"seed.poison",actorId:"char.aelar",sourceId:"test",operations:[{id:"poison",kind:"apply-effect",effect:{id:"poison",sourceId:"test",sourceActorId:"char.aelar",targetId:"combatant.wolf",kind:"condition",conditionId:"poisoned",duration:{kind:"permanent"}}}]});assert.equal(seeded.status,"committed");
  let snapshot=await adapter.getSnapshot();await adapter.resolveAction(command(snapshot,0,["poisoned"]),["combatant.wolf"]);snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id===PALADIN_LAY_ON_HANDS_RESOURCE_ID)?.current,65);
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id==="combatant.wolf")?.status.some((entry)=>entry.startsWith("✦ 중독")),false);
});

test("freeform Lay On Hands does not strand Bonus Action",async()=>{
  const adapter=await paladin();await adapter.setSessionMode("freeform");const snapshot=await adapter.getSnapshot();await adapter.resolveAction(command(snapshot,3),["combatant.goblin-a"]);assert.equal((await adapter.getSnapshot()).scene.economyByActor[snapshot.activeCharacter.id]?.bonusAction,true);
});

test("connected Lay On Hands converges HP and pool exactly once",async()=>{
  const sessionId="session.lay-on-hands";const host=await paladin();const hostSnapshot=await host.getSnapshot();const target=hostSnapshot.scene.entities.find((entry)=>entry.id==="combatant.goblin-a")!;const beforeHp=target.hp;
  const hostState=connectedStateFor(host);hostState.mode="host";hostState.sessionId=sessionId;hostState.ledger=new HostSessionLedger(sessionId,connectedManifest(host));const wires:string[]=[];const send=tauriSessionTransport.send;tauriSessionTransport.send=async(message)=>{wires.push(message);return 1;};
  try{await host.resolveAction(command(hostSnapshot,7),[target.id]);}finally{tauriSessionTransport.send=send;}
  const batch=wires.map((wire)=>JSON.parse(wire)).find((wire)=>wire.type==="event-batch") as {events:ConnectedSessionEvent[]}|undefined;assert.ok(batch);
  const client=await paladin();const state=connectedStateFor(client);state.mode="client";state.sessionId=sessionId;state.replica=new ClientSessionReplica(sessionId);
  const applied=await applyConnectedClientEvents(client,batch.events);assert.equal(applied.status,"applied",JSON.stringify(applied));assert.equal((await applyConnectedClientEvents(client,batch.events)).status,"duplicate");const snapshot=await client.getSnapshot();assert.equal(snapshot.scene.entities.find((entry)=>entry.id===target.id)?.hp,Math.min(target.maxHp,beforeHp+7));assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id===PALADIN_LAY_ON_HANDS_RESOURCE_ID)?.current,63);
});
