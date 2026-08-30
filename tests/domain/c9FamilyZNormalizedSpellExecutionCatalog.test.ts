import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { NORMALIZED_SPELL_EXECUTION_COUNT, normalizedSpellDefinitionById } from "../../src/domain/spellExecutionCatalog";
import { SPELL_EXECUTION_COVERAGE, spellMechanicById } from "../../src/domain/spellMechanics";
import { advanceCastingActivity, resolveSpellComponents } from "../../src/domain/commonPlaySpellcastingMeta";

test("all spell execution data is normalized before production runtime",()=>{
  assert.equal(NORMALIZED_SPELL_EXECUTION_COUNT,339);
  assert.equal(NORMALIZED_SPELL_EXECUTION_COUNT,SPELL_EXECUTION_COVERAGE.total);
  for (const id of ["dnd.srd521.spell.fire-bolt","dnd.srd521.spell.alarm","dnd.srd521.spell.meteor-swarm"]) {
    assert.deepEqual(normalizedSpellDefinitionById(id),JSON.parse(JSON.stringify(spellMechanicById(id))));
  }
});

test("runtime callers receive independent spell definitions",()=>{
  const first=normalizedSpellDefinitionById("dnd.srd521.spell.fire-bolt")!;
  first.baseLevel=9;
  assert.equal(normalizedSpellDefinitionById("dnd.srd521.spell.fire-bolt")?.baseLevel,0);
});

test("production adapters do not select algorithms through the legacy spell authoring helper",async()=>{
  const files=["productionSpellRuntimeAdapter.ts","productionPlayRuntimeAdapter.ts","phase09AuthoritativeSpellcastingAdapter.ts","spellcastingRuntimeAdapter.ts"];
  for (const file of files) {
    const path=fileURLToPath(new URL(`../../src/app/${file}`,import.meta.url));
    assert.doesNotMatch(await readFile(path,"utf8"),/spellMechanicById/);
  }
});

test("normalized costly and per-target components use the generic component resolver",()=>{
  const revivify=normalizedSpellDefinitionById("dnd.srd521.spell.revivify")!;
  assert.deepEqual(revivify.components,{verbal:true,somatic:true,materials:[{
    id:"dnd.srd521.spell.revivify.material.1",costGp:300,consumed:true,
  }]});
  const astral=normalizedSpellDefinitionById("dnd.srd521.spell.astral-projection")!;
  assert.equal(astral.components?.materials?.length,2);
  const materials=Object.fromEntries(astral.components!.materials!.map((material)=>[material.id!,{quantity:2,unitCostGp:material.costGp}]));
  assert.deepEqual(resolveSpellComponents(astral.components!,{
    canSpeak:true,silenced:false,freeHands:1,hasFocus:false,hasComponentPouch:false,targetCount:2,materials,
  }).consumed,[
    {materialId:"dnd.srd521.spell.astral-projection.material.1",quantity:2},
    {materialId:"dnd.srd521.spell.astral-projection.material.2",quantity:2},
  ]);
});

test("component behavior is invariant under external material identity rename",()=>{
  const resolve=(id:string)=>resolveSpellComponents({materials:[{id,costGp:25,consumed:true}]},{
    canSpeak:true,silenced:false,freeHands:0,hasFocus:false,hasComponentPouch:false,materials:{[id]:{quantity:1,unitCostGp:25}},
  });
  assert.deepEqual(resolve("external.material.alpha").consumed.map(({quantity})=>quantity),resolve("renamed.material.omega").consumed.map(({quantity})=>quantity));
});

test("normalized spell data declares long-cast and ritual process without runtime identity dispatch",()=>{
  const alarm=normalizedSpellDefinitionById("dnd.srd521.spell.alarm")!;
  assert.equal(alarm.castingDurationSeconds,60);
  assert.equal(alarm.ritual,true);
  const familiar=normalizedSpellDefinitionById("dnd.srd521.spell.find-familiar")!;
  assert.equal(familiar.castingDurationSeconds,3600);
  assert.equal(familiar.ritual,true);
  assert.equal(normalizedSpellDefinitionById("dnd.srd521.spell.fire-bolt")?.castingDurationSeconds,undefined);
  const activity={id:"cast",actorId:"actor",definitionId:"external.spell",kind:"long-cast" as const,requiredSeconds:60,elapsedSeconds:6,concentrationRequired:true as const,status:"active" as const};
  assert.equal(advanceCastingActivity(activity,6,true,false).status,"interrupted");
});
