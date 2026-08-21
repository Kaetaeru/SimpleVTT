import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import type { CharacterSheet, CharacterSummary } from "../../src/app/contracts";
import { MockAdapter } from "../../src/app/mockAdapter";
import { takeCommittedResolutionEvents } from "../../src/app/resolutionEventCommitRegistry";
import { runtimeResolutionEventHistory } from "../../src/app/runtimeResolutionEventHistory";

type InternalCharacterState = {
  activeCharacter: CharacterSheet;
  characters: CharacterSummary[];
};

async function installSavedProductionLongbowCharacter(adapter:MockAdapter) {
  const initial=await adapter.getSnapshot();
  const character:CharacterSheet={
    ...structuredClone(initial.activeCharacter),
    id:"char.phase12.event-capture",
    name:"Phase12 Event Capture Fighter",
    saveState:"saved",
    attacks:[{
      id:"action.longbow",
      name:"장궁",
      bonus:5,
      damage:"1d8 + 2 관통",
    }],
    items:[
      ...structuredClone(initial.activeCharacter.items),
      {
        id:"item.phase12.longbow",
        definitionId:"dnd.srd521.item.weapon.longbow",
        name:"장궁",
        nameEn:"Longbow",
        kind:"equipment",
        quantity:1,
        equipped:true,
        wielded:true,
        passiveEffects:[],
        grantedActionIds:["action.longbow"],
        provenance:["SRD 5.2.1 · production Character ItemInstance"],
      },
    ],
  };
  const internal=adapter as unknown as InternalCharacterState;
  internal.activeCharacter=structuredClone(character);
  internal.characters=[structuredClone(character)];
  let snapshot=await adapter.startProductionLocalPlay("player");
  await adapter.startInitiative();
  await adapter.setCurrentActor(character.id);
  snapshot=await adapter.getSnapshot();
  const action=(snapshot.scene.actionsByActor[character.id] ?? []).find((entry)=>entry.id==="action.longbow");
  assert.ok(action?.runtimeAttack,"saved production Character must materialize its canonical Longbow runtime attack");
  assert.equal(action.runtimeAttack.rangeFeet,150);
  return {character,action,targetId:"combatant.goblin-a"};
}

async function resolveProductionLongbow(adapter:MockAdapter) {
  const {character,action,targetId}=await installSavedProductionLongbowCharacter(adapter);
  await adapter.setQueuedD20(11);
  let snapshot=await adapter.resolveAction(action.id,[targetId]);
  const resolutionId=snapshot.resolution?.id;
  assert.ok(resolutionId);
  assert.equal(snapshot.resolution?.actorId,character.id);
  for (let step=0;step<6&&snapshot.resolution?.stage!=="complete";step+=1) {
    snapshot=snapshot.resolution?.stage==="interrupt"
      ? await adapter.respondToInterrupt(false)
      : await adapter.advanceResolution();
  }
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.doesNotMatch(snapshot.resolution?.finalOutcome ?? "",/적용 거부|beyond range|missing pairwise spatial runtime fact/i);
  return snapshot;
}

test("production Character attack retains committed domain events under the product resolution ID", async () => {
  const adapter=new MockAdapter();
  const snapshot=await resolveProductionLongbow(adapter);
  assert.ok(snapshot.resolution?.id);

  const history=runtimeResolutionEventHistory(adapter);
  assert.ok(history&&history.events.length>0,"production staged attack must retain its committed runtime event history");
  assert.equal(history!.resolutionId,snapshot.resolution!.id,"runtime event history must use the product Resolution id");

  const events=takeCommittedResolutionEvents(snapshot.resolution!.id);
  assert.ok(events&&events.length>0,"connected publication registry must receive the same committed event batch");
  assert.ok(events!.some((event)=>event.stateChanges.some((change)=>change.kind==="hp"&&change.targetId==="combatant.goblin-a")));
  assert.ok(events!.some((event)=>event.stateChanges.some((change)=>change.kind==="economy"&&change.targetId==="char.phase12.event-capture"&&change.field==="action")));
});
