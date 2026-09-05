import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/phase09RealRuntimeAttackAdapter";
import "../../src/app/phase09RealAtomicSavingThrowAdapter";
import "../../src/app/phase09CombatantDefinitionRuntimeAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import { generatedBuiltinCatalog } from "../../src/app/builtinCatalogRuntimeAdapter";
import {
  SRD_MONSTER_COUNT,
  SRD_MONSTER_PARSE_WARNINGS,
  allSrdMonsters,
  searchSrdMonsters,
  srdMonsterByCatalogEntryId,
  srdMonsterById,
  srdMonsterCombatantDefinition,
} from "../../src/app/srdMonsterCatalog";

type Internal={ combatantDefinitions:Array<{ id:string }>; queuedInitiativeD20?:number|null; scene:{ entities:Array<{ id:string; initiative:number; name:string; side:"ally"|"enemy"; hp:number; resistances:string[]; immunities:string[] }>; actionsByActor:Record<string,Array<{ id:string; name:string; resolutionKind:string; attacksPerAction?:number; saveDc?:number; saveAbility?:string; damage?:Array<{ dice:string; flat:number; type:string }>; saveHalf?:boolean; maxTargets?:number; target:string }>>; economyByActor:Record<string,{ movementMax:number }> } };

test("T1-01: every SRD 5.2.1 stat block is in the catalog with parsed core stats", () => {
  assert.equal(SRD_MONSTER_COUNT,329);
  assert.equal(allSrdMonsters().length,329);
  for (const monster of allSrdMonsters()) {
    assert.ok(monster.id.startsWith("dnd.srd521.monster."),monster.id);
    assert.ok(monster.ac>0 && monster.hp>0,`${monster.slug}: ac/hp`);
    assert.ok(Number.isFinite(monster.cr),`${monster.slug}: cr`);
    assert.ok(monster.abilities.str>0 && monster.abilities.cha>0,`${monster.slug}: abilities`);
    assert.ok(monster.actions.length>0 || monster.traits.length>0 || monster.reactions.length>0,`${monster.slug}: no actions, traits or reactions`);
  }
  assert.ok(SRD_MONSTER_PARSE_WARNINGS.filter((warning)=>!/spell not resolved/.test(warning)).length<=12,`parser warnings grew: ${SRD_MONSTER_PARSE_WARNINGS.length}`);
  assert.ok(SRD_MONSTER_PARSE_WARNINGS.filter((warning)=>/spell not resolved/.test(warning)).length<=2,"C1-04: only sentence fragments stay unresolved");
  const catalog=generatedBuiltinCatalog();
  const combatants=catalog.filter((entry)=>entry.category==="combatant");
  assert.equal(combatants.length,329);
  assert.ok(combatants.every((entry)=>entry.scope==="builtin" && entry.source==="SRD 5.2.1"));
  // The session catalog carries qualified ids; the Rules pane maps them back to the stat block.
  assert.equal(srdMonsterByCatalogEntryId("content:dnd.srd-5.2.1@0.1-draft#dnd.srd521.monster.ogre")?.slug,"ogre");
  assert.equal(srdMonsterByCatalogEntryId("dnd.srd521.monster.ogre")?.slug,"ogre");
});

test("T1-01: search finds monsters by Korean name, English name, type and CR bound", () => {
  const goblins=searchSrdMonsters("고블린");
  assert.ok(goblins.some((monster)=>monster.slug==="goblin-warrior"||monster.nameEn.toLowerCase().includes("goblin")),goblins.map((m)=>m.slug).join(","));
  const dragons=searchSrdMonsters("dragon",{ limit:100 });
  assert.ok(dragons.length>=20);
  assert.ok(dragons.every((monster)=>monster.nameEn.toLowerCase().includes("dragon")||monster.typeText.includes("용")));
  const lowUndead=searchSrdMonsters("",{ creatureType:"undead", maxCr:1, limit:100 });
  assert.ok(lowUndead.length>0);
  assert.ok(lowUndead.every((monster)=>monster.creatureType==="undead" && monster.cr<=1));
});

test("T1-01: ogre, goblin boss and adult red dragon parse into runtime attacks, multiattack and save actions", () => {
  const ogre=srdMonsterById("dnd.srd521.monster.ogre");
  assert.ok(ogre);
  const ogreDefinition=srdMonsterCombatantDefinition(ogre);
  assert.equal(ogreDefinition.maxHp,ogre.hp);
  assert.ok((ogreDefinition.runtimeActions??[]).length>=1);
  const greatclub=(ogreDefinition.runtimeActions??[])[0];
  assert.equal(greatclub.attackBonus,6);
  assert.equal(greatclub.damage.dice,"2d8");
  assert.equal(greatclub.damage.type,"타격");

  const dragon=srdMonsterById("dnd.srd521.monster.adult-red-dragon");
  assert.ok(dragon);
  const dragonDefinition=srdMonsterCombatantDefinition(dragon);
  assert.ok(dragonDefinition.runtimeStats?.immunities.includes("화염"));
  const rend=(dragonDefinition.runtimeActions??[]).find((action)=>action.name.includes("찢기")||action.attackBonus>=14);
  assert.ok(rend,"dragon melee attack");
  assert.equal(rend.attacksPerAction,3);
  const breath=(dragonDefinition.runtimeSaveActions??[])[0];
  assert.ok(breath,"breath weapon save action");
  assert.equal(breath.saveAbility,"dex");
  assert.equal(breath.saveDc,21);
  assert.equal(breath.damage[0]?.type,"화염");
  assert.equal(breath.successDamage,"half");
  assert.ok(breath.maxTargets>1);
  assert.equal(dragonDefinition.runtimeMonster?.legendaryActionsPerRound,3);
  assert.ok(dragonDefinition.runtimeStats?.savingThrowProficiencies.includes("dex"));
});

test("T1-01: adding an SRD monster materializes its definition, rolls initiative, and exposes save actions in play", async () => {
  const adapter=new MockAdapter();
  const internal=adapter as unknown as Internal;
  internal.queuedInitiativeD20=15;
  let snapshot=await adapter.instantiateCombatant("dnd.srd521.monster.adult-red-dragon");
  const dragon=snapshot.scene.entities.find((entity)=>entity.id.startsWith("dnd.srd521.monster.adult-red-dragon.instance-"));
  assert.ok(dragon,"dragon instantiated");
  assert.ok(internal.combatantDefinitions.some((entry)=>entry.id==="dnd.srd521.monster.adult-red-dragon"));
  assert.equal(dragon.initiative,15+srdMonsterById("dnd.srd521.monster.adult-red-dragon")!.initiativeBonus);
  assert.ok(dragon.immunities.includes("화염"));
  assert.equal(internal.scene.economyByActor[dragon.id]?.movementMax,40);
  const actions=snapshot.scene.actionsByActor[dragon.id]??[];
  const breath=actions.find((action)=>action.resolutionKind==="saving-throw");
  assert.ok(breath,"breath action projected");
  assert.equal(breath.saveAbility,"민첩");
  assert.equal(breath.saveDc,21);
  assert.equal(breath.saveHalf,true);
  assert.equal(breath.target,"multi-enemy");
  const melee=actions.find((action)=>action.resolutionKind==="attack");
  assert.ok(melee && melee.attacksPerAction===3,"multiattack attacks-per-action");

  await adapter.setCurrentActor(dragon.id);
  snapshot=await adapter.getSnapshot();
  assert.ok((snapshot.scene.actionsByActor[dragon.id]??[]).some((action)=>action.id===breath.id),"actions survive snapshot materialization");

  // Two ogres: independent instances, separate initiative rolls.
  internal.queuedInitiativeD20=3;
  await adapter.instantiateCombatant("dnd.srd521.monster.ogre");
  internal.queuedInitiativeD20=18;
  snapshot=await adapter.instantiateCombatant("dnd.srd521.monster.ogre");
  const ogres=snapshot.scene.entities.filter((entity)=>entity.id.startsWith("dnd.srd521.monster.ogre.instance-"));
  assert.equal(ogres.length,2);
  const ogreBonus=srdMonsterById("dnd.srd521.monster.ogre")!.initiativeBonus;
  assert.deepEqual(ogres.map((entity)=>entity.initiative),[3+ogreBonus,18+ogreBonus]);
});

test("T1-01: a dragon breath saving throw resolves against an SRD monster target through the real save adapter", async () => {
  const adapter=new MockAdapter();
  const internal=adapter as unknown as Internal;
  await adapter.instantiateCombatant("dnd.srd521.monster.adult-red-dragon");
  await adapter.instantiateCombatant("dnd.srd521.monster.ogre");
  const dragon=internal.scene.entities.find((entity)=>entity.id.startsWith("dnd.srd521.monster.adult-red-dragon.instance-"))!;
  const ogre=internal.scene.entities.find((entity)=>entity.id.startsWith("dnd.srd521.monster.ogre.instance-"))!;
  ogre.side="ally"; // the ogre fights beside the party in this scene
  const breath=(internal.scene.actionsByActor[dragon.id]??[]).find((action)=>action.resolutionKind==="saving-throw")!;
  await adapter.startInitiative();
  await adapter.setCurrentActor(dragon.id);
  await adapter.setQueuedD20(2);
  let snapshot=await adapter.resolveAction(breath.id,[ogre.id]);
  assert.ok(snapshot.resolution,"resolution started");
  assert.notEqual(snapshot.resolution.calculatedOutcome,"적용 거부",snapshot.resolution.finalOutcome);
  const save=snapshot.resolution.saveResults[0];
  assert.ok(save,"save result recorded");
  assert.equal(save.dc,21);
  assert.equal(save.total-save.d20,-1,"ogre dex save modifier from the SRD stat block");
  assert.equal(save.outcome,"실패");
  for (let step=0; step<8 && snapshot.resolution && snapshot.resolution.stage!=="complete"; step+=1) snapshot=await adapter.advanceResolution();
  const after=snapshot.scene.entities.find((entity)=>entity.id===ogre.id)!;
  assert.ok(after.hp<68,`breath damaged the ogre (68 → ${after.hp})`);
  assert.ok(snapshot.resolution?.damageComponents.some((component)=>component.type==="화염"),"fire damage component projected");
});
