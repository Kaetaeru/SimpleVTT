import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { MockAdapter } from "../../src/app/mockAdapter";
import { setSpatialRelation } from "../../src/app/spatialRuntimeContracts";
import type { AppSnapshot, CharacterSheet, CharacterSummary } from "../../src/app/contracts";

const SCOUT_ID="combatant.phase14.live-dm-scout";
const SCOUT_PAYLOAD=JSON.stringify({
  id:SCOUT_ID,
  name:"Live DM Scout",
  ac:14,
  maxHp:20,
  speed:35,
  proficiencyBonus:2,
  abilities:{str:8,dex:16,con:12,int:10,wis:14,cha:10},
  savingThrowProficiencies:["wis"],
  resistances:[],
  immunities:[],
  vulnerabilities:[],
  runtimeActions:[{
    id:"dagger",
    name:"단검",
    category:"weapon",
    sourceKind:"weapon",
    attackBonus:5,
    rangeFeet:5,
    damage:{type:"관통",dice:"1d4",flat:3},
  }],
});

type ProductionDmAdapter=MockAdapter&{
  startProductionLocalPlay(role:"dm"|"player"):Promise<AppSnapshot>;
};

type Internal={
  activeCharacter:CharacterSheet;
  characters:CharacterSummary[];
};

async function productionDmWithNonFixtureCharacter() {
  const adapter=new MockAdapter();
  const template=await adapter.getSnapshot();
  const character={
    ...structuredClone(template.activeCharacter),
    id:"char.phase14.live-dm-player",
    name:"Phase14 Live DM Player",
    saveState:"saved" as const,
  };
  const internal=adapter as unknown as Internal;
  internal.activeCharacter=structuredClone(character);
  internal.characters=[
    ...internal.characters.filter((entry)=>entry.id!==character.id),
    structuredClone(character),
  ];
  const production=adapter as ProductionDmAdapter;
  const snapshot=await production.startProductionLocalPlay("dm");
  return {adapter,character,snapshot};
}

test("non-fixture live DM can select real actors, correct a canonical resolution, and Undo the full adjudicated result",async()=>{
  const {adapter,character}=await productionDmWithNonFixtureCharacter();
  let snapshot=await adapter.setSessionMode("freeform");
  assert.equal(snapshot.role,"dm");
  assert.equal(snapshot.session.name,"로컬 DM 세션");
  assert.ok(snapshot.scene.entities.some((entity)=>entity.id===character.id));
  assert.equal(snapshot.scene.entities.some((entity)=>entity.id==="char.aelar"||entity.id==="char.mira"),false);

  await adapter.previewCombatantImport(SCOUT_PAYLOAD);
  await adapter.activateCombatantImport();
  snapshot=await adapter.instantiateCombatant(SCOUT_ID);
  const scout=snapshot.scene.entities.find((entity)=>entity.id===`${SCOUT_ID}.instance-1`);
  assert.ok(scout);

  snapshot=await adapter.selectDmActor(character.id);
  assert.equal(snapshot.role,"dm");
  assert.equal(snapshot.scene.selectedActorId,character.id);
  snapshot=await adapter.selectDmActor(scout.id);
  assert.equal(snapshot.scene.selectedActorId,scout.id);
  snapshot=await adapter.selectDmActor(character.id);
  assert.equal(snapshot.scene.selectedActorId,character.id);

  // Spatial placement is a separate theater-of-mind/map-module concern. Supply an
  // explicit structured relation here so this regression isolates DM adjudication.
  setSpatialRelation(snapshot.scene,{
    sourceId:character.id,
    targetId:scout.id,
    distanceFeet:5,
    visible:true,
    cover:"none",
    targetCanSeeAttacker:true,
    provenance:"phase14:test:explicit-live-dm-spatial-fact",
  });
  setSpatialRelation(snapshot.scene,{
    sourceId:scout.id,
    targetId:character.id,
    distanceFeet:5,
    visible:true,
    cover:"none",
    targetCanSeeAttacker:true,
    provenance:"phase14:test:explicit-live-dm-spatial-fact",
  });

  const attack=(snapshot.scene.actionsByActor[character.id]??[]).find((action)=>action.resolutionKind==="attack"&&action.runtimeAttack);
  assert.ok(attack,"production Character must expose a canonical runtime attack");
  const hpBefore=scout.hp;

  await adapter.setCurrentActor(character.id);
  await adapter.setQueuedD20(15);
  snapshot=await adapter.resolveAction(attack.id,[scout.id]);
  const resolutionId=snapshot.resolution?.id;
  assert.ok(resolutionId);
  assert.equal(snapshot.resolution?.attackOutcome,"명중");
  for (let step=0;step<4&&snapshot.resolution?.stage!=="complete";step++) {
    snapshot=await adapter.advanceResolution();
  }
  assert.equal(snapshot.resolution?.stage,"complete");

  const committedHp=snapshot.scene.entities.find((entity)=>entity.id===scout.id)?.hp;
  assert.equal(typeof committedHp,"number");
  assert.ok(committedHp!<hpBefore,"canonical runtime attack must damage the live Combatant");
  assert.ok(snapshot.activity.some((entry)=>entry.id===resolutionId),"canonical attack must project to Activity");

  snapshot=await adapter.applyDmAdjudication({
    type:"damage-correction",
    value:2,
    targetId:scout.id,
    scope:"resolution",
    reason:"Phase14 live DM correction",
  });
  const correctedHp=snapshot.scene.entities.find((entity)=>entity.id===scout.id)?.hp;
  assert.equal(correctedHp,committedHp!-2);
  assert.equal(snapshot.resolution?.adjudicated,true);
  assert.ok(snapshot.activity.some((entry)=>entry.correction&&entry.ruling==="피해 정정 2"&&entry.detail.some((line)=>line.includes("Phase14 live DM correction"))));

  snapshot=await adapter.undoLastResolution();
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id===scout.id)?.hp,hpBefore,"Undo must reverse both the canonical attack and the DM correction");
  assert.equal(snapshot.resolution,null);
  assert.ok(snapshot.activity.some((entry)=>entry.undoOf===resolutionId&&entry.title==="Resolution 되돌림"));
});
