import assert from "node:assert/strict";
import test from "node:test";
import { deriveProductionCharacterActions } from "../../src/app/productionPlayRuntimeAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";

test("production characters expose every SRD 5.2.1 base action through executable action VMs",async()=>{
  const character=(await new MockAdapter().getSnapshot()).activeCharacter;
  const actions=deriveProductionCharacterActions(character);
  const ids=new Set(actions.map((action)=>action.id));
  assert.ok(actions.some((action)=>action.resolutionKind==="attack"),"Attack is backed by character attack actions");
  assert.ok(actions.some((action)=>action.category==="magic"),"Magic is backed by character spell or magic-item actions");
  for (const id of [
    "action.dash","action.standard.disengage","action.standard.dodge","action.standard.help",
    "action.standard.hide.stealth","action.standard.ready","action.standard.utilize",
  ]) assert.ok(ids.has(id),`missing ${id}`);
  assert.equal(actions.filter((action)=>action.id.startsWith("action.standard.influence.")).length,5);
  assert.equal(actions.filter((action)=>action.id.startsWith("action.standard.search.")).length,4);
  assert.equal(actions.filter((action)=>action.id.startsWith("action.standard.study.")).length,5);
  assert.equal(actions.filter((action)=>action.id.startsWith("action.skill.")).length,18);
  assert.equal(actions.find((action)=>action.id==="action.standard.help")?.target,"ally");
  assert.equal(actions.find((action)=>action.id==="action.standard.dodge")?.economy,"행동");
});

test("created spellcasters keep every prepared spell visible in the Session hotbar",async()=>{
  const character=structuredClone((await new MockAdapter().getSnapshot()).activeCharacter);
  character.className="음유시인";
  character.cantrips=["dnd.srd521.spell.dancing-lights","dnd.srd521.spell.minor-illusion"];
  character.preparedSpells=["dnd.srd521.spell.charm-person"];
  character.spellbookSpells=["dnd.srd521.spell.alarm"];
  const spells=deriveProductionCharacterActions(character).filter((action)=>action.category==="magic"&&!action.itemCost);
  assert.deepEqual(spells.map((action)=>action.spellCast?.spellId),[
    "dnd.srd521.spell.dancing-lights",
    "dnd.srd521.spell.minor-illusion",
    "dnd.srd521.spell.charm-person",
  ]);
  assert.ok(spells.every((action)=>action.available&&!action.disabledReason));
  assert.deepEqual(spells.map((action)=>action.spellCast?.runtimeSupport),["tracked-executable","tracked-executable","combat-executable"]);
});

test("implemented spells expose real target selection without partial approval placeholders",async()=>{
  const character=structuredClone((await new MockAdapter().getSnapshot()).activeCharacter);
  character.className="음유시인";
  character.cantrips=["dnd.srd521.spell.fire-bolt","dnd.srd521.spell.poison-spray","dnd.srd521.spell.sacred-flame","dnd.srd521.spell.vicious-mockery"];
  character.preparedSpells=["dnd.srd521.spell.healing-word","dnd.srd521.spell.cure-wounds","dnd.srd521.spell.burning-hands","dnd.srd521.spell.magic-missile","dnd.srd521.spell.thunderwave"];
  const spells=deriveProductionCharacterActions(character).filter((action)=>action.category==="magic"&&!action.itemCost);
  const executable=spells.filter((action)=>action.spellCast?.runtimeSupport==="combat-executable");
  assert.equal(executable.length,9);
  assert.ok(executable.every((action)=>action.available&&action.target!=="none"));
  assert.equal(spells.find((action)=>action.spellCast?.spellId==="dnd.srd521.spell.burning-hands")?.target,"multi-enemy");
  assert.equal(spells.find((action)=>action.spellCast?.spellId==="dnd.srd521.spell.healing-word")?.target,"ally");
  const vicious=spells.find((action)=>action.spellCast?.spellId==="dnd.srd521.spell.vicious-mockery");
  assert.equal(vicious?.available,true);
  assert.equal(vicious?.spellCast?.runtimeSupport,"combat-executable");
});

test("beam spells expose per-beam multi-target attacks instead of scaling one damage roll",async()=>{
  const character=structuredClone((await new MockAdapter().getSnapshot()).activeCharacter);
  character.level=5;
  character.cantrips=["dnd.srd521.spell.eldritch-blast"];
  character.preparedSpells=["dnd.srd521.spell.scorching-ray"];
  const spells=deriveProductionCharacterActions(character).filter((action)=>action.category==="magic"&&!action.itemCost);
  const eldritch=spells.find((action)=>action.spellCast?.spellId==="dnd.srd521.spell.eldritch-blast");
  const scorching=spells.find((action)=>action.spellCast?.spellId==="dnd.srd521.spell.scorching-ray");
  assert.equal(eldritch?.target,"multi-enemy");
  assert.equal(eldritch?.maxTargets,2);
  assert.equal(eldritch?.damage?.[0].dice,"1d10");
  assert.equal(scorching?.target,"multi-enemy");
  assert.equal(scorching?.maxTargets,3);
  assert.equal(scorching?.damage?.[0].dice,"2d6");
});
