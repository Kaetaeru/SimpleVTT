import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/characterCreationV10Adapter";
import type { CharacterSheet } from "../../src/app/contracts";
import { MockAdapter } from "../../src/app/mockAdapter";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MemoryCharacterLibraryStore } from "../../src/app/memoryCharacterLibraryStore";
import { CharacterLibraryRepository } from "../../src/app/characterLibraryPersistence";
import { setCharacterLibraryStoreForTests } from "../../src/app/characterLibraryRuntimeAdapter";
import { clearInstalledSpellEntriesForTests } from "../../src/app/installedSpellRuntime";

// V1.3 C1-04: Legendary Resistance flips the failed save on the result card — the cast is re-judged with that
// creature's save as an automatic success, the counter is spent, and the card says so.
const MODULE_ID="test.legendary";
const FROST_BURST="test.spell.frost-burst";
const CHARACTER_ID="char.c1-04-caster";
const DRAGON="dnd.srd521.monster.aboleth"; // DEX save −1: the default d20 face fails DC 13 without a queued roll

function payload() {
  return JSON.stringify({
    schemaVersion:"0.1-draft",moduleId:MODULE_ID,moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"ko-KR",
    source:{document:"Test",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],
    content:[{
      id:FROST_BURST,category:"spell",
      presentation:{defaultLocale:"ko-KR",originalName:"Frost Burst",locales:{"ko-KR":{name:"서리 폭발",description:"민첩 내성, 실패 시 4d8 냉기."},en:{name:"Frost Burst",description:"DEX save, 4d8 cold."}}},
      mechanics:[
        {kind:"spell-definition",config:{level:0,school:"evocation",ritual:false,castingTimeText:"행동",rangeText:"60피트",componentsText:"V, S",durationText:"즉시",classes:["dnd.srd521.class.sorcerer"]}},
        {kind:"spell-mechanic",config:{
          baseLevel:0,runtimeSupport:"combat-executable",castingEconomy:"action",
          targeting:{kind:"creature",rangeFeet:60,minTargets:1,maxTargets:1,requiresSight:true},
          primary:{kind:"save-damage",saveAbility:"dex",damageType:"cold",dice:{count:4,sides:8},successDamage:"half"},
          components:{verbal:true,somatic:true},
        }},
      ],
    }],
  });
}

function caster():CharacterSheet {
  return {
    id:CHARACTER_ID,name:"C1-04 Caster",className:"소서러",level:17,species:"인간",background:"학자",
    hp:80,maxHp:80,tempHp:0,ac:12,speed:30,proficiencyBonus:6,saveState:"saved",
    abilities:{str:8,dex:14,con:14,int:12,wis:10,cha:20},saves:["CON +8","CHA +11"],skills:["비전"],features:["주문 시전"],
    equipment:[],items:[],resources:[],attacks:[],
    classLevels:[{classId:"dnd.srd521.class.sorcerer",className:"소서러",level:17}],
    cantrips:[FROST_BURST],preparedSpells:[],spellSlotMaximums:{1:2},
  };
}

test("C1-04: 전설 저항 re-judges the dragon's failed save on the last card as a success and spends one use",async()=>{
  clearInstalledSpellEntriesForTests();
  const store=new MemoryCharacterLibraryStore();
  const repository=new CharacterLibraryRepository(store);
  await repository.hydrate([caster()],CHARACTER_ID);
  await repository.commit([caster()],CHARACTER_ID);
  const adapter=new MockAdapter();
  setCharacterLibraryStoreForTests(adapter,store);
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(payload());
  assert.deepEqual(preview.contentImport?.validation.filter((entry)=>entry.severity==="blocking")??[],[]);
  await adapter.activateContentImport();

  await adapter.startProductionLocalPlay("player");
  await adapter.instantiateCombatant(DRAGON);
  await adapter.startInitiative();
  let snapshot=await adapter.setCurrentActor(CHARACTER_ID);
  const dragon=snapshot.scene.entities.find((entity)=>entity.id.startsWith(`${DRAGON}.instance-`))!;
  const action=(snapshot.scene.actionsByActor[CHARACTER_ID]??[]).find((entry)=>entry.spellCast?.spellId===FROST_BURST)!;
  assert.ok(action,"the save cantrip is on the hotbar");

  snapshot=await adapter.resolveAction(action.id,[dragon.id]);
  const card=snapshot.resolution!;
  assert.equal(card.stage,"complete");
  const failed=card.saveResults.find((entry)=>entry.targetId===dragon.id);
  assert.ok(failed&&failed.outcome==="실패",`the card lists the dragon's failed save: ${JSON.stringify(card.saveResults)}`);
  assert.equal(failed.targetName,dragon.name);
  const hpAfterFail=snapshot.scene.entities.find((entity)=>entity.id===dragon.id)!.hp;
  const fullDamage=dragon.hp-hpAfterFail;
  assert.ok(fullDamage>0,"a failed save takes full damage");

  snapshot=await adapter.useLegendaryResistance(dragon.id);
  const rejudged=snapshot.resolution!;
  const success=rejudged.saveResults.find((entry)=>entry.targetId===dragon.id);
  assert.equal(success?.outcome,"성공","the same cast is re-judged with the save as an automatic success");
  assert.ok(rejudged.detail.some((line)=>/전설 저항/.test(line)),rejudged.detail.join(" | "));
  assert.ok(rejudged.provenance.some((line)=>/legendary-resistance/.test(line)));
  const hpAfterResist=snapshot.scene.entities.find((entity)=>entity.id===dragon.id)!.hp;
  assert.equal(dragon.hp-hpAfterResist,Math.floor(fullDamage/2),"half damage on the re-judged success");
  const timing=(snapshot.scene.entities.find((entity)=>entity.id===dragon.id) as { runtimeMonsterTiming?:{ legendaryResistance?:{ remaining:number; max:number } } }).runtimeMonsterTiming;
  assert.deepEqual(timing?.legendaryResistance,{ remaining:2, max:3 });
  assert.ok(snapshot.activity.some((entry)=>entry.title==="전설 저항 사용"&&entry.detail.some((line)=>/재판정/.test(line))));
  clearInstalledSpellEntriesForTests();
});
