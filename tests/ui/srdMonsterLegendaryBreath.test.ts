import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/phase09RealRuntimeAttackAdapter";
import "../../src/app/phase09RealAtomicSavingThrowAdapter";
import "../../src/app/srdMonsterTimingRuntimeAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";

// V1.3 C1-07: Legendary Resistance re-judges a stat-block saving-throw action (breath weapon) like a spell.
const DRAGON="dnd.srd521.monster.adult-red-dragon";
const ABOLETH="dnd.srd521.monster.aboleth";

type Internal={ queuedInitiativeD20?:number|null; scene:{ entities:Array<{ id:string; name:string; side:"ally"|"enemy"; hp:number; runtimeMonsterTiming?:{ legendaryResistance?:{ remaining:number; max:number } } }> } };

async function runToComplete(adapter:MockAdapter) {
  let snapshot=await adapter.getSnapshot();
  for (let step=0; step<8&&snapshot.resolution&&snapshot.resolution.stage!=="complete"; step+=1) snapshot=await adapter.advanceResolution();
  assert.equal(snapshot.resolution?.stage,"complete");
  return snapshot;
}

test("C1-07: 전설 저항 flips the aboleth's failed breath-weapon save on the card and halves the damage",async()=>{
  const adapter=new MockAdapter();
  const internal=adapter as unknown as Internal;
  internal.queuedInitiativeD20=20;
  await adapter.instantiateCombatant(DRAGON);
  internal.queuedInitiativeD20=1;
  await adapter.instantiateCombatant(ABOLETH);
  const dragon=internal.scene.entities.find((entity)=>entity.id.startsWith(`${DRAGON}.instance-`))!;
  const aboleth=internal.scene.entities.find((entity)=>entity.id.startsWith(`${ABOLETH}.instance-`))!;
  aboleth.side="ally";
  await adapter.setReferenceRole("dm");
  await adapter.startInitiative();
  let snapshot=await adapter.setCurrentActor(dragon.id);
  const breath=(snapshot.scene.actionsByActor[dragon.id]??[]).find((action)=>/화염 브레스/.test(action.name))!;
  assert.ok(breath,"the dragon's breath is on its action list");
  const hpBefore=aboleth.hp;

  await adapter.resolveAction(breath.id,[aboleth.id]);
  snapshot=await runToComplete(adapter);
  const failed=snapshot.resolution!.saveResults.find((entry)=>entry.targetId===aboleth.id);
  assert.equal(failed?.outcome,"실패",`DC 21 against the default d20: ${JSON.stringify(failed)}`);
  const fullDamage=hpBefore-snapshot.scene.entities.find((entity)=>entity.id===aboleth.id)!.hp;
  assert.ok(fullDamage>0);

  snapshot=await adapter.useLegendaryResistance(aboleth.id);
  const rejudged=snapshot.resolution!;
  assert.equal(rejudged.stage,"complete");
  const success=rejudged.saveResults.find((entry)=>entry.targetId===aboleth.id);
  assert.equal(success?.outcome,"성공","the breath is re-judged with the save as an automatic success");
  assert.ok(rejudged.detail.some((line)=>/전설 저항/.test(line)),rejudged.detail.join(" | "));
  const halfDamage=hpBefore-snapshot.scene.entities.find((entity)=>entity.id===aboleth.id)!.hp;
  assert.equal(halfDamage,Math.floor(fullDamage/2),"half damage on the re-judged success");
  const timing=(snapshot.scene.entities.find((entity)=>entity.id===aboleth.id) as Internal["scene"]["entities"][number]).runtimeMonsterTiming;
  assert.deepEqual(timing?.legendaryResistance,{ remaining:2, max:3 });
});
