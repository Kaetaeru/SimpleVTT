import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/phase09RealRuntimeAttackAdapter";
import "../../src/app/phase09RealAtomicSavingThrowAdapter";
import "../../src/app/srdMonsterTimingRuntimeAdapter";
import "../../src/app/srdMonsterMultiattackRuntimeAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import { multiattackRoutineLabel, multiattackRoutineOf } from "../../src/app/srdMonsterMultiattackRuntimeAdapter";

// V1.3 C1-04: a multiattack routine resolves as one DM action — every attack in stat-block order against one target.
const OWLBEAR="dnd.srd521.monster.owlbear";
const BROWN_BEAR="dnd.srd521.monster.brown-bear";

type Internal={ queuedInitiativeD20?:number|null; scene:{ entities:Array<{ id:string; name:string; side:"ally"|"enemy"; hp:number; ac:number }> } };

async function sceneWith(monsterId:string) {
  const adapter=new MockAdapter();
  const internal=adapter as unknown as Internal;
  internal.queuedInitiativeD20=20;
  await adapter.instantiateCombatant(monsterId);
  const monster=internal.scene.entities.find((entity)=>entity.id.startsWith(`${monsterId}.instance-`))!;
  const target=internal.scene.entities.find((entity)=>entity.side!==monster.side&&entity.hp>0)!;
  await adapter.setReferenceRole("dm");
  await adapter.startInitiative();
  await adapter.setCurrentActor(monster.id);
  return { adapter, monster, target };
}

test("C1-04: the owlbear's routine (찢기 2회) resolves both attacks against one target in one call",async()=>{
  const { adapter, monster, target }=await sceneWith(OWLBEAR);
  const snapshot=await adapter.getSnapshot();
  const routine=multiattackRoutineOf(snapshot,monster.id);
  assert.deepEqual(routine,[{ name:"찢기", count:2, actionName:"찢기" }]);
  assert.equal(multiattackRoutineLabel(routine!),"찢기 2회");
  const hpBefore=target.hp;
  const after=await adapter.resolveMultiattackRoutine(monster.id,target.id);
  const entry=after.activity.find((activity)=>activity.title.startsWith("다중공격"));
  assert.ok(entry,"one activity entry summarises the routine");
  assert.equal(entry.actor,monster.name);
  assert.equal(entry.detail.filter((line)=>/^찢기 [12]\/2:/.test(line)).length,2,entry.detail.join(" | "));
  const hpAfter=after.scene.entities.find((entity)=>entity.id===target.id)!.hp;
  assert.ok(hpAfter<hpBefore,`+7 vs AC ${target.ac} with the default d20 hits: ${hpBefore} → ${hpAfter}`);
  assert.equal(entry.summary,`${target.name} HP ${hpBefore} → ${hpAfter}`);
  assert.equal(after.resolution,null,"the last card is dismissed after the routine");
});

test("C1-04: a mixed routine (물기 1회 · 발톱 1회) resolves each named attack",async()=>{
  const { adapter, monster, target }=await sceneWith(BROWN_BEAR);
  const routine=multiattackRoutineOf(await adapter.getSnapshot(),monster.id);
  assert.deepEqual(routine?.map((step)=>[step.actionName,step.count]),[["물기",1],["발톱",1]]);
  const after=await adapter.resolveMultiattackRoutine(monster.id,target.id);
  const entry=after.activity.find((activity)=>activity.title.startsWith("다중공격"))!;
  assert.ok(entry.detail.some((line)=>line.startsWith("물기 1/1:")),entry.detail.join(" | "));
  assert.ok(entry.detail.some((line)=>line.startsWith("발톱 1/1:")),entry.detail.join(" | "));
});
