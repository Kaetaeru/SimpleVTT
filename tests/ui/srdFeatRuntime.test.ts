import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import type { AppSnapshot, CharacterSheet, SceneVm } from "../../src/app/contracts";
import { MockAdapter } from "../../src/app/mockAdapter";
import { generatedBuiltinCatalogForTests } from "../../src/app/builtinCatalogRuntimeAdapter";
import { parseCommonPlayDefinition } from "../../src/domain/commonPlayDefinitionRuntime";
import { lowerCommonPlayReactionDefinition } from "../../src/domain/commonPlayReactionDefinitionRuntime";
import { FEAT_RULE_CATALOG, featExecution } from "../../src/domain/featRuleCatalog";

// X1-03: SRD feat JSON. Archery executes through the automatic interceptor seam (X1-02) on the real generated catalog.
const ARCHERY="dnd.srd521.feat.fighting-style.archery";
const GOBLIN="combatant.goblin-a";

test("every builtin Common Play mechanic parses and lowers, so passive discovery can never throw mid-resolution",()=>{
  let mechanics=0;
  for(const entry of generatedBuiltinCatalogForTests()){
    for(const [index,mechanic] of (entry.mechanics??[]).entries()){
      if(mechanic.kind!=="common-play")continue;
      mechanics+=1;
      const canonical=parseCommonPlayDefinition(mechanic.config,`${entry.id} mechanic ${index}`);
      lowerCommonPlayReactionDefinition(canonical,{resolveResourceDie:()=>8,resolveNumericReference:()=>1});
    }
  }
  assert.ok(mechanics>0,"the builtin catalog carries Common Play mechanics");
});

test("the feat rule catalog records an execution status for every SRD feat and it agrees with the builtin catalog's mechanics",()=>{
  const builtin=new Map(generatedBuiltinCatalogForTests().filter((entry)=>entry.category==="feat").map((entry)=>[entry.contentId??entry.id,entry]));
  assert.equal(FEAT_RULE_CATALOG.feats.length,17);
  for(const feat of FEAT_RULE_CATALOG.feats){
    const execution=featExecution(feat);
    assert.ok(feat.config.execution,`${feat.id} records how it executes`);
    const hasCommonPlay=(builtin.get(feat.id)?.mechanics??[]).some((mechanic)=>mechanic.kind==="common-play");
    assert.equal(hasCommonPlay,execution.status==="common-play",`${feat.id}: common-play status must match the builtin mechanics`);
    if(execution.status!=="common-play")assert.ok(execution.reason,`${feat.id}: a non-executing feat names the missing seam`);
  }
  assert.equal(featExecution(FEAT_RULE_CATALOG.feats.find((feat)=>feat.id===ARCHERY)!).status,"common-play");
  assert.equal(featExecution(FEAT_RULE_CATALOG.feats.find((feat)=>feat.id==="dnd.srd521.feat.fighting-style.defense")!).status,"derived");
});

async function attack(adapter:MockAdapter,actorId:string,actionId:string,targetId:string,natural:number) {
  await adapter.setCurrentActor(actorId);
  await adapter.setQueuedD20(natural);
  let snapshot=await adapter.resolveAction(actionId,[targetId]);
  for(let step=0;step<4&&snapshot.resolution?.stage!=="attack-result"&&snapshot.resolution?.stage!=="complete";step+=1)snapshot=await adapter.advanceResolution();
  assert.ok(snapshot.resolution?.stage==="attack-result"||snapshot.resolution?.stage==="complete",JSON.stringify(snapshot.resolution));
  return snapshot;
}

function archeryContribution(snapshot:AppSnapshot) {
  return snapshot.resolution?.rollModifierContributions?.find((entry)=>entry.source===`common-play:${ARCHERY}`);
}

test("Archery from the real SRD catalog adds +2 to a ranged weapon attack roll and nothing to a melee attack",async()=>{
  const adapter=new MockAdapter();
  await adapter.getSnapshot();
  const internal=adapter as unknown as {activeCharacter:CharacterSheet;scene:SceneVm};
  internal.activeCharacter.fightingStyleFeatIds=[ARCHERY];
  await adapter.startInitiative();
  const hero=internal.activeCharacter.id;
  let snapshot=await attack(adapter,hero,"action.shortbow",GOBLIN,10);
  assert.equal(snapshot.resolution?.interrupt,undefined,"Archery never asks a question");
  assert.equal(snapshot.resolution?.attackTotal,10+5+2,JSON.stringify(snapshot.resolution?.rollModifierContributions));
  assert.equal(archeryContribution(snapshot)?.value,2);
  assert.ok(snapshot.resolution?.detail.some((line)=>/궁술/.test(line)),snapshot.resolution?.detail.join(" | "));
  while(snapshot.resolution&&snapshot.resolution.stage!=="complete"&&snapshot.resolution.canAdvance)snapshot=await adapter.advanceResolution();

  snapshot=await attack(adapter,hero,"action.longsword",GOBLIN,10);
  assert.equal(snapshot.resolution?.attackTotal,10+7);
  assert.equal(archeryContribution(snapshot),undefined,"a melee weapon attack gets no Archery bonus");
});

test("without the fighting style the same ranged attack has no Archery bonus",async()=>{
  const adapter=new MockAdapter();
  await adapter.getSnapshot();
  const internal=adapter as unknown as {activeCharacter:CharacterSheet};
  internal.activeCharacter.fightingStyleFeatIds=[];
  await adapter.startInitiative();
  const snapshot=await attack(adapter,internal.activeCharacter.id,"action.shortbow",GOBLIN,10);
  assert.equal(snapshot.resolution?.attackTotal,15);
  assert.equal(archeryContribution(snapshot),undefined);
});
