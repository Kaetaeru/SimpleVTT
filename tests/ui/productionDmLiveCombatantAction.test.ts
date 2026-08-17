import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { MockAdapter } from "../../src/app/mockAdapter";
import type { AppSnapshot, CharacterSheet, CharacterSummary } from "../../src/app/contracts";
import type { RuntimeCover } from "../../src/app/spatialRuntimeContracts";

const SCOUT_ID="combatant.phase14.live-action-scout";
const SCOUT_PAYLOAD=JSON.stringify({
  id:SCOUT_ID,
  name:"Live Action Scout",
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
  setTheaterOfMindSpatialRelation(command:{
    sourceId:string;
    targetId:string;
    distanceFeet:number;
    visible:boolean;
    cover:RuntimeCover;
    targetCanSeeAttacker:boolean;
  }):Promise<AppSnapshot>;
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
    id:"char.phase14.live-action-player",
    name:"Phase14 Live Action Player",
    hp:30,
    maxHp:30,
    tempHp:0,
    ac:16,
    saveState:"saved" as const,
  };
  const internal=adapter as unknown as Internal;
  internal.activeCharacter=structuredClone(character);
  internal.characters=[...internal.characters.filter((entry)=>entry.id!==character.id),structuredClone(character)];
  const production=adapter as ProductionDmAdapter;
  const snapshot=await production.startProductionLocalPlay("dm");
  return {adapter,production,character,snapshot};
}

test("production DM explicitly authors theater-of-mind relation and a non-fixture Combatant executes its imported live action",async()=>{
  const {adapter,production,character}=await productionDmWithNonFixtureCharacter();

  await adapter.previewCombatantImport(SCOUT_PAYLOAD);
  await adapter.activateCombatantImport();
  let snapshot=await adapter.instantiateCombatant(SCOUT_ID);
  const scout=snapshot.scene.entities.find((entity)=>entity.id===`${SCOUT_ID}.instance-1`);
  assert.ok(scout);

  const dagger=(snapshot.scene.actionsByActor[scout.id]??[]).find((action)=>action.name==="단검");
  assert.ok(dagger,"imported Combatant must retain its runtime action");
  assert.equal(dagger.attackBonus,5);
  assert.equal(dagger.runtimeAttack?.rangeFeet,5);
  assert.equal(dagger.damage?.[0]?.dice,"1d4");
  assert.equal(dagger.damage?.[0]?.flat,3);

  snapshot=await adapter.selectDmActor(scout.id);
  assert.equal(snapshot.scene.selectedActorId,scout.id);
  snapshot=await production.setTheaterOfMindSpatialRelation({
    sourceId:scout.id,
    targetId:character.id,
    distanceFeet:5,
    visible:true,
    cover:"none",
    targetCanSeeAttacker:true,
  });
  const relation=Object.values(snapshot.scene.spatialByPair??{}).find((entry)=>entry.sourceId===scout.id&&entry.targetId===character.id);
  assert.ok(relation,"production DM authoring must write the structured pairwise relation");
  assert.equal(relation.distanceFeet,5);
  assert.equal(relation.visible,true);
  assert.equal(relation.cover,"none");
  assert.equal(relation.targetCanSeeAttacker,true);
  assert.match(relation.provenance,/production:theater-of-mind/);

  const hpBefore=snapshot.scene.entities.find((entity)=>entity.id===character.id)?.hp;
  assert.equal(hpBefore,30);
  await adapter.setQueuedD20(20);
  snapshot=await adapter.resolveAction(dagger.id,[character.id]);
  const resolutionId=snapshot.resolution?.id;
  assert.ok(resolutionId,"canonical Combatant attack must create a Resolution");
  assert.equal(snapshot.resolution?.attackOutcome,"명중");
  for (let step=0;step<4&&snapshot.resolution?.stage!=="complete";step++) snapshot=await adapter.advanceResolution();
  assert.equal(snapshot.resolution?.stage,"complete");

  const hpAfter=snapshot.scene.entities.find((entity)=>entity.id===character.id)?.hp;
  assert.equal(typeof hpAfter,"number");
  assert.ok(hpAfter!<hpBefore!,"canonical imported Combatant attack must damage the real Character");
  assert.ok(snapshot.activity.some((entry)=>entry.id===resolutionId),"canonical Combatant attack must project to Activity");

  snapshot=await adapter.undoLastResolution();
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id===character.id)?.hp,hpBefore,"event-native Undo must restore Scene Character HP");
  assert.equal(snapshot.activeCharacter.hp,hpBefore,"event-native Undo must restore owning Character HP");
  assert.equal(snapshot.resolution,null);
  assert.ok(snapshot.activity.some((entry)=>entry.undoOf===resolutionId&&entry.title==="Resolution 되돌림"));
});

test("production Host surface exposes explicit theater-of-mind relation authoring without debug controls",()=>{
  const source=readFileSync(new URL("../../src/ProductionSessionLifecycleBridge.tsx",import.meta.url),"utf8");
  assert.match(source,/거리 관계/);
  assert.match(source,/setTheaterOfMindSpatialRelation/);
  assert.match(source,/distanceFeet/);
  assert.match(source,/visible/);
  assert.match(source,/cover/);
  assert.match(source,/targetCanSeeAttacker/);
  assert.doesNotMatch(source,/setSpatialRelation|setReferenceRole|loadReferenceScenario|Ctrl\+Shift\+D/);
});
