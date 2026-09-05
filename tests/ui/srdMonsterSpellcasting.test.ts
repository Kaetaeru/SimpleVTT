import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/phase09RealRuntimeAttackAdapter";
import "../../src/app/phase09RealAtomicSavingThrowAdapter";
import "../../src/app/srdMonsterTimingRuntimeAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import { srdMonsterById, srdMonsterCombatantDefinition, allSrdMonsters } from "../../src/app/srdMonsterCatalog";
import type { CombatantRuntimeAttackVm, CombatantRuntimeSaveActionVm } from "../../src/app/combatantRuntimeContracts";

// V1.3 C1-04: stat-block spellcasting resolves through the spell mechanics with the block's own DC and uses.
const MAGE="dnd.srd521.monster.mage";
const DRAGON="dnd.srd521.monster.adult-red-dragon";

type Definition={ runtimeActions:CombatantRuntimeAttackVm[]; runtimeSaveActions:CombatantRuntimeSaveActionVm[]; runtimeMonster:{ spellcasting?:{ lists:Array<{ entries?:Array<{ name:string; spellId?:string; slotLevel?:number }> }> }; multiattackRoutine?:Array<{ name:string; count:number; actionName:string }> } };

test("C1-04: the mage's Fireball and Cone of Cold are saving-throw actions with DC 14 and per-day uses",()=>{
  const mage=srdMonsterCombatantDefinition(srdMonsterById(MAGE)!) as unknown as Definition;
  const fireball=mage.runtimeSaveActions.find((action)=>/파이어볼/.test(action.name));
  assert.ok(fireball,"Fireball projects as a save action");
  assert.equal(fireball.saveAbility,"dex");
  assert.equal(fireball.saveDc,14,"the stat block's DC, not a character formula");
  assert.deepEqual(fireball.damage,[{ type:"화염", dice:"9d6", flat:0 }],"the 4th-level version adds a die");
  assert.equal(fireball.successDamage,"half");
  assert.equal(fireball.maxTargets,10);
  assert.deepEqual(fireball.timing,{ usesPerDay:2 },"2/일 list");
  const cone=mage.runtimeSaveActions.find((action)=>/냉기/.test(action.name));
  assert.deepEqual([cone?.saveAbility,cone?.saveDc,cone?.damage[0]?.dice,cone?.timing?.usesPerDay],["con",14,"8d8",1]);
  const entries=mage.runtimeMonster.spellcasting!.lists.flatMap((list)=>list.entries??[]);
  assert.ok(entries.some((entry)=>entry.spellId==="dnd.srd521.spell.fireball"&&entry.slotLevel===4),"the catalog carries the resolved spell id and upcast level");
  assert.ok(entries.some((entry)=>entry.spellId==="dnd.srd521.spell.invisibility"),"utility spells resolve but do not become actions");
  assert.equal(mage.runtimeActions.filter((action)=>/투명화|빛|마법사 손/.test(action.name)).length,0);
});

test("C1-04: the adult red dragon's Scorching Ray is three spell attacks at +12 and Fireball is 1/day at DC 20",()=>{
  const dragon=srdMonsterCombatantDefinition(srdMonsterById(DRAGON)!) as unknown as Definition;
  const ray=dragon.runtimeActions.find((action)=>/작열 광선/.test(action.name));
  assert.ok(ray);
  assert.equal(ray.attackBonus,12,"DC 20 − 8");
  assert.equal(ray.attacksPerAction,3);
  assert.deepEqual(ray.damage,{ type:"화염", dice:"2d6", flat:0 });
  assert.equal(ray.category,"magic");
  assert.equal(ray.timing,undefined,"at-will");
  const fireball=dragon.runtimeSaveActions.find((action)=>/파이어볼/.test(action.name));
  assert.deepEqual([fireball?.saveDc,fireball?.damage[0]?.dice,fireball?.timing?.usesPerDay],[20,"8d6",1]);
  const command=dragon.runtimeSaveActions.find((action)=>/명령/.test(action.name));
  assert.ok(command&&command.damage.length===0&&command.saveAbility==="wis","a save-effect spell projects without damage");
});

test("C1-04: multiattack routines name the block's own attacks",()=>{
  const dragon=srdMonsterCombatantDefinition(srdMonsterById(DRAGON)!) as unknown as Definition;
  assert.deepEqual(dragon.runtimeMonster.multiattackRoutine,[{ name:"찢기", count:3, actionName:"찢기" }]);
  const mixed=allSrdMonsters().map((monster)=>srdMonsterCombatantDefinition(monster) as unknown as Definition).filter((definition)=>(definition.runtimeMonster.multiattackRoutine?.length??0)>1);
  assert.ok(mixed.length>=15,`mixed routines parse across the catalog: ${mixed.length}`);
  for (const definition of mixed) for (const item of definition.runtimeMonster.multiattackRoutine!) {
    assert.ok(definition.runtimeActions.some((action)=>action.name===item.actionName),`${item.actionName} is an attack of the block`);
  }
});

test("C1-04: an instantiated mage exposes the spell actions with the block's DC and a 2/일 counter",async()=>{
  const adapter=new MockAdapter();
  await adapter.instantiateCombatant(MAGE);
  const snapshot=await adapter.getSnapshot();
  const mage=snapshot.scene.entities.find((entity)=>entity.id.startsWith(`${MAGE}.instance-`))!;
  const actions=snapshot.scene.actionsByActor[mage.id]??[];
  const fireball=actions.find((action)=>/파이어볼/.test(action.name));
  assert.ok(fireball,"Fireball is on the mage's action list");
  assert.equal(fireball.resolutionKind,"saving-throw");
  assert.equal(fireball.saveDc,14);
  assert.equal(fireball.maxTargets,10);
  const timing=(mage as { runtimeMonsterTiming?:{ uses:Record<string,{ remaining:number; max:number }> } }).runtimeMonsterTiming;
  const counter=Object.entries(timing?.uses??{}).find(([key])=>/fireball/.test(key));
  assert.deepEqual(counter?.[1]&&{ remaining:counter[1].remaining, max:counter[1].max },{ remaining:2, max:2 });
});
