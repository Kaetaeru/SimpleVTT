import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/phase09ManualMovementReactionAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import type { ActionVm, SceneVm } from "../../src/app/contracts";

const PROVOKER_ID="char.aelar";
const REACTOR_ID="combatant.goblin-a";

async function exerciseProjectedOpportunityAttack(actionId:string,actionName:string) {
  const adapter=new MockAdapter();
  await adapter.startInitiative();
  await adapter.setCurrentActor(PROVOKER_ID);
  await adapter.setQueuedD20(15);

  const internal=adapter as unknown as {scene:SceneVm};
  const source=(internal.scene.actionsByActor[REACTOR_ID]??[]).find((action)=>action.id==="action.scimitar");
  assert.ok(source?.runtimeAttack,"fixture melee attack must expose structural runtimeAttack facts");
  const projected:ActionVm={...structuredClone(source),id:actionId,name:actionName};
  internal.scene.actionsByActor[REACTOR_ID]=[projected];

  await adapter.declareManualMovementReaction({
    kind:"opportunity-attack",
    provokerId:PROVOKER_ID,
    reactorId:REACTOR_ID,
    attackActionId:projected.id,
    distanceFeet:projected.runtimeAttack!.rangeFeet,
    visibleAtTrigger:true,
    coverAtTrigger:"none",
    targetCanSeeReactorAtTrigger:true,
  });

  let snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"roll-animation",snapshot.activity[0]?.summary);
  assert.equal(snapshot.resolution?.actorId,REACTOR_ID);
  assert.match(snapshot.resolution?.actionName??"",new RegExp(actionName));
  assert.ok(snapshot.resolution?.provenance.some((entry)=>entry.includes(`action:${actionId}`)));
  assert.equal(snapshot.scene.economyByActor[REACTOR_ID]?.reaction,true);

  await adapter.advanceResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"attack-result");
  assert.equal(snapshot.resolution?.attackOutcome,"명중");

  await adapter.advanceResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"damage-animation");

  await adapter.advanceResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(snapshot.scene.economyByActor[REACTOR_ID]?.reaction,false);
  assert.equal(snapshot.scene.economyByActor[REACTOR_ID]?.action,true);
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id===PROVOKER_ID)?.tempHp,0);
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id===PROVOKER_ID)?.hp,30);
  assert.ok(snapshot.activity[0]?.detail.some((line)=>line.includes(`opportunity-attack:${actionId}`)));

  (adapter as unknown as {lastBefore:unknown}).lastBefore=null;
  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.economyByActor[REACTOR_ID]?.reaction,true);
  assert.equal(snapshot.scene.economyByActor[REACTOR_ID]?.action,true);
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id===PROVOKER_ID)?.tempHp,5);
  assert.equal(snapshot.resolution,null);
}

test("Opportunity Attack consumes structural projected attack facts rather than a named action identity",async()=>{
  await exerciseProjectedOpportunityAttack("action.external.family-j-opportunity","Portable Reaction Strike");
  await exerciseProjectedOpportunityAttack("action.renamed.family-j-opportunity","Renamed Portable Reaction Strike");
});
