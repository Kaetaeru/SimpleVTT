import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/phase09RealRuntimeAttackAdapter";
import "../../src/app/phase09RealAtomicSavingThrowAdapter";
import "../../src/app/srdMonsterTimingRuntimeAdapter";
import "../../src/app/srdMonsterMultiattackRuntimeAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import { multiattackRoutineLabel, multiattackRoutineOf } from "../../src/app/srdMonsterMultiattackRuntimeAdapter";
import { allSrdMonsters, srdMonsterCombatantDefinition } from "../../src/app/srdMonsterCatalog";

// V1.3 C1-07: "A 또는 B를 조합해 N번" multiattack lines are routines with a default attack and alternatives.
const GOBLIN_BOSS="dnd.srd521.monster.goblin-boss";

type Internal={ queuedInitiativeD20?:number|null; scene:{ entities:Array<{ id:string; name:string; side:"ally"|"enemy"; hp:number }> } };

test("C1-07: choice lines parse across the catalog and name the block's own attacks",()=>{
  const definitions=allSrdMonsters().map((monster)=>srdMonsterCombatantDefinition(monster) as unknown as { runtimeActions:Array<{ name:string }>; runtimeMonster:{ multiattackText?:string; multiattackRoutine?:Array<{ actionName:string; alternatives?:string[] }> } });
  const withText=definitions.filter((definition)=>definition.runtimeMonster.multiattackText);
  const withRoutine=withText.filter((definition)=>definition.runtimeMonster.multiattackRoutine?.length);
  assert.ok(withRoutine.length>=170,`routines cover the multiattack lines: ${withRoutine.length}/${withText.length}`);
  const choices=withRoutine.filter((definition)=>definition.runtimeMonster.multiattackRoutine!.some((step)=>(step.alternatives?.length??0)>1));
  assert.ok(choices.length>=30,`choice routines: ${choices.length}`);
  for (const definition of withRoutine) for (const step of definition.runtimeMonster.multiattackRoutine!) {
    assert.ok(definition.runtimeActions.some((action)=>action.name===step.actionName),`${step.actionName} is an attack of the block`);
    for (const alternative of step.alternatives??[]) assert.ok(definition.runtimeActions.some((action)=>action.name===alternative),`${alternative} is an attack of the block`);
  }
});

test("C1-07: the goblin boss's 시미터/단궁 routine resolves twice with the default attack",async()=>{
  const adapter=new MockAdapter();
  const internal=adapter as unknown as Internal;
  internal.queuedInitiativeD20=20;
  await adapter.instantiateCombatant(GOBLIN_BOSS);
  const boss=internal.scene.entities.find((entity)=>entity.id.startsWith(`${GOBLIN_BOSS}.instance-`))!;
  const target=internal.scene.entities.find((entity)=>entity.side!==boss.side&&entity.hp>0)!;
  await adapter.setReferenceRole("dm");
  await adapter.startInitiative();
  await adapter.setCurrentActor(boss.id);
  const routine=multiattackRoutineOf(await adapter.getSnapshot(),boss.id)!;
  assert.deepEqual(routine.map((step)=>[step.actionName,step.count,step.alternatives]),[["시미터",2,["시미터","단궁"]]]);
  assert.equal(multiattackRoutineLabel(routine),"시미터/단궁 2회");
  const after=await adapter.resolveMultiattackRoutine(boss.id,target.id);
  const entry=after.activity.find((activity)=>activity.title.startsWith("다중공격"))!;
  assert.equal(entry.title,"다중공격 · 시미터/단궁 2회");
  assert.equal(entry.detail.filter((line)=>/^시미터 [12]\/2:/.test(line)).length,2,entry.detail.join(" | "));
});
