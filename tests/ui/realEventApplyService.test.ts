import assert from "node:assert/strict";
import test from "node:test";
import { MockAdapter } from "../../src/app/mockAdapter";
import { applyResolutionEvents } from "../../src/app/realEventApplyService";
import { undoResolutionEvents } from "../../src/app/realEventUndoService";
import { createTurnRuntimeSession } from "../../src/app/realTurnRuntimeService";
import type { ResolutionEvent } from "../../src/domain/resolutionTypes";

function eventWithChanges(stateChanges:ResolutionEvent["stateChanges"]):ResolutionEvent {
  return {
    id:"event.connected.forward.1",
    resolutionId:"resolution.connected.forward.1",
    operationId:"operation.connected.forward.1",
    kind:"connected-test",
    actorId:"char.aelar",
    targetId:"char.aelar",
    summary:"authoritative connected event",
    provenance:[],
    stateChanges,
    result:{ connected:true },
  };
}

test("authoritative ResolutionEvent applies HP, economy, and ItemInstance mutation forward once", async () => {
  const adapter=new MockAdapter();
  const snapshot=await adapter.getSnapshot();
  const actor=snapshot.scene.entities.find((entry)=>entry.id==="char.aelar");
  const economy=snapshot.scene.economyByActor["char.aelar"];
  const potion=snapshot.activeCharacter.items.find((entry)=>entry.id==="item.potion.aelar");
  assert.ok(actor);
  assert.ok(economy);
  assert.ok(potion && potion.quantity>0);

  const hpAfter=Math.max(0,actor.hp-3);
  const itemAfter=potion.quantity-1;
  const event=eventWithChanges([
    {
      kind:"hp",targetId:actor.id,field:"current",before:actor.hp,after:hpAfter,
      provenance:[],lifetime:"character-durable",writeBack:"character",
    },
    {
      kind:"economy",targetId:actor.id,field:"action",before:economy.action,after:false,
      provenance:[],lifetime:"session-runtime",writeBack:"session",
    },
    {
      kind:"resource",targetId:actor.id,resourceId:`phase09:item:${potion.id}:quantity`,before:potion.quantity,after:itemAfter,
      provenance:[],lifetime:"character-durable",writeBack:"character",
    },
  ]);

  const applied=applyResolutionEvents(snapshot.scene,[event],snapshot.activeCharacter.resources,snapshot.activeCharacter.items);
  assert.equal(applied.status,"committed");
  if (applied.status!=="committed") return;
  assert.equal(applied.scene.entities.find((entry)=>entry.id===actor.id)?.hp,hpAfter);
  assert.equal(applied.scene.economyByActor[actor.id]?.action,false);
  assert.equal(applied.items.find((entry)=>entry.id===potion.id)?.quantity,itemAfter);
  assert.deepEqual(applied.stateChanges,[
    `${actor.id} HP ${actor.hp} → ${hpAfter}`,
    `${actor.id} economy.action ${String(economy.action)} → false`,
    `${actor.id} item.${potion.id}.quantity ${potion.quantity} → ${itemAfter}`,
  ]);

  const duplicateMutation=applyResolutionEvents(applied.scene,[event],applied.resources,applied.items);
  assert.equal(duplicateMutation.status,"rejected");
  if (duplicateMutation.status==="rejected") assert.match(duplicateMutation.error,/event-native apply drift/);
});

test("authoritative event application is atomic when any later change has drifted", async () => {
  const adapter=new MockAdapter();
  const snapshot=await adapter.getSnapshot();
  const actor=snapshot.scene.entities.find((entry)=>entry.id==="char.aelar");
  const economy=snapshot.scene.economyByActor["char.aelar"];
  assert.ok(actor);
  assert.ok(economy);

  const event=eventWithChanges([
    {
      kind:"hp",targetId:actor.id,field:"current",before:actor.hp,after:Math.max(0,actor.hp-1),
      provenance:[],lifetime:"character-durable",writeBack:"character",
    },
    {
      kind:"economy",targetId:actor.id,field:"action",before:!economy.action,after:false,
      provenance:[],lifetime:"session-runtime",writeBack:"session",
    },
  ]);

  const rejected=applyResolutionEvents(snapshot.scene,[event],snapshot.activeCharacter.resources,snapshot.activeCharacter.items);
  assert.equal(rejected.status,"rejected");
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id===actor.id)?.hp,actor.hp,"failed apply must not partially mutate the source snapshot");
  assert.equal(snapshot.scene.economyByActor[actor.id]?.action,economy.action);
});

test("extra Action grants apply and Undo as full runtime identities", async () => {
  const snapshot=await new MockAdapter().getSnapshot();
  const runtime=createTurnRuntimeSession(snapshot.scene).state;
  const actorId=runtime.clock.activeActorId!;
  const grant={id:"surge:1",source:"feature.fighter.action-surge",allowsMagicAction:false};
  const event=eventWithChanges([{
    kind:"economy",targetId:actorId,field:"extraActions",before:[],after:[grant],
    provenance:[],lifetime:"session-runtime",writeBack:"session",
  }]);

  const applied=applyResolutionEvents(snapshot.scene,[event],[],[],runtime);
  assert.equal(applied.status,"committed");
  if (applied.status!=="committed") return;
  assert.deepEqual(applied.scene.economyByActor[actorId]?.extraActions,[grant]);
  assert.deepEqual(applied.runtimeState?.combatants[actorId]?.economy.extraActions,[grant]);

  const undone=undoResolutionEvents(applied.scene,[event],[],[],applied.runtimeState);
  assert.equal(undone.status,"committed");
  if (undone.status!=="committed") return;
  assert.equal(undone.scene.economyByActor[actorId]?.extraActions,undefined);
  assert.deepEqual(undone.runtimeState?.combatants[actorId]?.economy.extraActions,[]);
});

test("JSON-round-tripped effect removal ignores local undefined optional fields", async () => {
  const snapshot=await new MockAdapter().getSnapshot();
  const runtime=createTurnRuntimeSession(snapshot.scene).state;
  const actorId=runtime.clock.activeActorId!;
  const effect={
    id:"effect:wire-roundtrip",sourceId:"feature:test",sourceActorId:undefined,targetId:actorId,
    kind:"marker" as const,conditionId:undefined,tags:["test"],expiry:{kind:"time" as const,elapsedSeconds:3600},
    termination:undefined,turnActivity:undefined,concentrationGroupId:undefined,metadata:{publicLabel:"테스트"},
  };
  runtime.effects.push(effect);
  const event=JSON.parse(JSON.stringify(eventWithChanges([{
    kind:"effect",targetId:actorId,effectId:effect.id,operation:"removed",before:effect,after:undefined,
    provenance:[],lifetime:"session-runtime",writeBack:"session",
  }]))) as ResolutionEvent;

  const applied=applyResolutionEvents(snapshot.scene,[event],[],[],runtime);
  assert.equal(applied.status,"committed");
  if(applied.status!=="committed")return;
  assert.equal(applied.runtimeState?.effects.some((entry)=>entry.id===effect.id),false);

  const undone=undoResolutionEvents(applied.scene,[event],[],[],applied.runtimeState);
  assert.equal(undone.status,"committed");
  if(undone.status!=="committed")return;
  assert.ok(undone.runtimeState?.effects.some((entry)=>entry.id===effect.id));
});
