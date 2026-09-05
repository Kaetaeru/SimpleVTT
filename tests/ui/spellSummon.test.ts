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

// V1.3 C1-06: a committed cast with `summons` adds catalog creatures to the scene on the caster's side.
const MODULE_ID="test.summons";
const CALL_GOBLINS="test.spell.call-goblins";
const CHARACTER_ID="char.c1-06-summoner";
const GOBLIN="dnd.srd521.monster.goblin-warrior";

function payload() {
  return JSON.stringify({
    schemaVersion:"0.1-draft",moduleId:MODULE_ID,moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"ko-KR",
    source:{document:"Test",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],
    content:[{
      id:CALL_GOBLINS,category:"spell",
      presentation:{defaultLocale:"ko-KR",originalName:"Call Goblins",locales:{"ko-KR":{name:"고블린 부르기",description:"고블린 전사 둘을 부른다."},en:{name:"Call Goblins",description:"Two goblin warriors answer."}}},
      mechanics:[
        {kind:"spell-definition",config:{level:0,school:"conjuration",ritual:false,castingTimeText:"행동",rangeText:"자신",componentsText:"V",durationText:"1시간",classes:["dnd.srd521.class.sorcerer"]}},
        {kind:"spell-mechanic",config:{
          baseLevel:0,runtimeSupport:"combat-executable",castingEconomy:"action",
          targeting:{kind:"creature",rangeFeet:0,minTargets:1,maxTargets:1,allowedRelations:["self"]},
          primary:{kind:"tracked-effect",summary:"고블린 둘이 곁에 선다.",duration:{kind:"hours",amount:1}},
          summons:{monsterId:GOBLIN,count:2},
          components:{verbal:true},
        }},
      ],
    }],
  });
}

function caster():CharacterSheet {
  return {
    id:CHARACTER_ID,name:"C1-06 Summoner",className:"소서러",level:5,species:"인간",background:"학자",
    hp:30,maxHp:30,tempHp:0,ac:12,speed:30,proficiencyBonus:3,saveState:"saved",
    abilities:{str:8,dex:14,con:14,int:12,wis:10,cha:16},saves:["CON +5","CHA +6"],skills:["비전"],features:["주문 시전"],
    equipment:[],items:[],resources:[],attacks:[],
    classLevels:[{classId:"dnd.srd521.class.sorcerer",className:"소서러",level:5}],
    cantrips:[CALL_GOBLINS],preparedSpells:[],spellSlotMaximums:{1:4,2:3,3:2},
  };
}

test("C1-06: a cast with summons adds the creatures on the caster's side and logs it",async()=>{
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
  await adapter.startInitiative();
  let snapshot=await adapter.setCurrentActor(CHARACTER_ID);
  const action=(snapshot.scene.actionsByActor[CHARACTER_ID]??[]).find((entry)=>entry.spellCast?.spellId===CALL_GOBLINS)!;
  assert.ok(action,"the summoning cantrip is on the hotbar");
  const before=snapshot.scene.entities.length;

  snapshot=await adapter.resolveAction(action.id,[CHARACTER_ID]);
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution?.compact));
  const summoned=snapshot.scene.entities.filter((entity)=>entity.id.startsWith(`${GOBLIN}.instance-`));
  assert.equal(summoned.length,2,"two goblin warriors joined the scene");
  assert.ok(summoned.every((entity)=>entity.side==="ally"),"summons stand on the caster's side");
  assert.equal(snapshot.scene.entities.length,before+2);
  const entry=snapshot.activity.find((item)=>item.title.endsWith("· 소환"));
  assert.ok(entry&&entry.stateChanges.length===2,entry?.summary);
  clearInstalledSpellEntriesForTests();
});
