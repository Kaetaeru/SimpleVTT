import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import type { CharacterSheet } from "../../src/app/contracts";
import { MockAdapter } from "../../src/app/mockAdapter";
import type { ProgressionClassTrack } from "../../src/domain/progression";
import { BARBARIAN_CLASS_ID, BARBARIAN_RAGE_RESOURCE_ID } from "../../src/domain/barbarianBerserker";

type RageCharacter = CharacterSheet & { classLevels?: ProgressionClassTrack[] };
type Internal = { activeCharacter:RageCharacter };

function seedBarbarian(adapter:MockAdapter) {
  const internal=adapter as unknown as Internal;
  const character=internal.activeCharacter;
  const template=character.resources[0];
  assert.ok(template,"fixture Character must expose a resource template");
  character.className="바바리안";
  character.level=1;
  character.classLevels=[{classId:BARBARIAN_CLASS_ID,className:"바바리안",level:1}];
  character.resources.push({
    ...structuredClone(template),
    id:BARBARIAN_RAGE_RESOURCE_ID,
    label:"격노",
    current:2,
    max:2,
    source:"바바리안 1레벨 · Rage · SRD 5.2.1",
  });
}

test("Barbarian Rage is a player-facing Freeform action with canonical Resource, Activity, and Undo", async () => {
  const adapter=new MockAdapter();
  seedBarbarian(adapter);
  let snapshot=await adapter.startProductionLocalPlay("player");
  const rage=snapshot.scene.actionsByActor[snapshot.activeCharacter.id]?.find((action)=>action.id==="action.barbarian.rage");
  assert.ok(rage,"Barbarian Rage must be projected into the production Session action list");
  assert.equal(rage.economy,"추가 행동");
  assert.equal(rage.target,"self");

  await adapter.resolveAction(rage.id,[snapshot.activeCharacter.id]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(snapshot.resolution?.actionId,"action.barbarian.rage");
  assert.equal(snapshot.activeCharacter.resources.find((resource)=>resource.id===BARBARIAN_RAGE_RESOURCE_ID)?.current,1);
  assert.equal(snapshot.activity[0]?.title,"격노");

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.resources.find((resource)=>resource.id===BARBARIAN_RAGE_RESOURCE_ID)?.current,2);
});

test("Barbarian Rage spends Bonus Action only in Initiative and Undo restores the atomic start", async () => {
  const adapter=new MockAdapter();
  seedBarbarian(adapter);
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  let snapshot=await adapter.getSnapshot();
  const rage=snapshot.scene.actionsByActor["char.aelar"]?.find((action)=>action.id==="action.barbarian.rage");
  assert.ok(rage);

  await adapter.resolveAction(rage.id,["char.aelar"]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.bonusAction,false);
  assert.equal(snapshot.activeCharacter.resources.find((resource)=>resource.id===BARBARIAN_RAGE_RESOURCE_ID)?.current,1);
  const activeRage=snapshot.scene.actionsByActor["char.aelar"]?.find((action)=>action.id==="action.barbarian.rage");
  assert.equal(activeRage?.available,false,"active Rage must not present a second start as available");

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.bonusAction,true);
  assert.equal(snapshot.activeCharacter.resources.find((resource)=>resource.id===BARBARIAN_RAGE_RESOURCE_ID)?.current,2);
  assert.equal(snapshot.scene.actionsByActor["char.aelar"]?.find((action)=>action.id==="action.barbarian.rage")?.available,true);
});
