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
import { spellPresentationById } from "../../src/app/spellPresentation";
import { spellOptions } from "../../src/app/characterCreationV10Data";
import { normalizedSpellDefinitionById } from "../../src/domain/spellExecutionCatalog";
import { clearInstalledSpellEntriesForTests } from "../../src/app/installedSpellRuntime";

// X1-04: an installed add-on spell (spell-definition + spell-mechanic) is presented, offered at creation, and cast
// through the production spell runtime exactly like a builtin spell.
const MODULE_ID="homebrew.frost-spells";
const FROST_LASH="homebrew.spell.frost-lash";
const CHARACTER_ID="char.x1-04-installed-caster";

function packagePayload(withMechanic=true,mechanicOverride?:Record<string,unknown>) {
  return JSON.stringify({
    schemaVersion:"0.1-draft",moduleId:MODULE_ID,moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"ko-KR",
    source:{document:"Frost Homebrew",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],
    content:[{
      id:FROST_LASH,category:"spell",
      presentation:{defaultLocale:"ko-KR",originalName:"Frost Lash",locales:{"ko-KR":{name:"서리 채찍",description:"차가운 채찍으로 원거리 주문 공격을 합니다. 명중하면 1d8 냉기 피해."},en:{name:"Frost Lash",description:"A lash of frost; ranged spell attack, 1d8 cold on a hit."}}},
      mechanics:[
        {kind:"spell-definition",config:{level:0,school:"evocation",ritual:false,castingTimeText:"행동",rangeText:"60피트",componentsText:"V, S",durationText:"즉시",classes:["wizard","dnd.srd521.class.sorcerer"]}},
        ...(withMechanic?[{kind:"spell-mechanic",config:mechanicOverride??{
          baseLevel:0,runtimeSupport:"combat-executable",castingEconomy:"action",
          targeting:{kind:"creature",rangeFeet:60,minTargets:1,maxTargets:1,requiresSight:true},
          primary:{kind:"attack-damage",damageType:"cold",dice:{count:1,sides:8,cantripScaling:true}},
          components:{verbal:true,somatic:true},
        }}]:[]),
      ],
    }],
  });
}

function persistedCaster():CharacterSheet {
  return {
    id:CHARACTER_ID,name:"X1 Installed Caster",className:"소서러",level:1,species:"인간",background:"학자",
    hp:8,maxHp:8,tempHp:0,ac:12,speed:30,proficiencyBonus:2,saveState:"saved",
    abilities:{str:8,dex:14,con:14,int:12,wis:10,cha:16},saves:["CON +4","CHA +5"],skills:["비전","설득"],features:["주문 시전"],
    equipment:[],items:[],resources:[],attacks:[],
    classLevels:[{classId:"dnd.srd521.class.sorcerer",className:"소서러",level:1}],
    cantrips:[FROST_LASH],preparedSpells:[],spellSlotMaximums:{1:2},
  };
}

async function importPackage(adapter:MockAdapter,payload:string) {
  const preview=await adapter.previewContentImport(payload);
  const blocking=preview.contentImport?.validation.filter((entry)=>entry.severity==="blocking")??[];
  return {preview,blocking,activate:async()=>adapter.activateContentImport()};
}

test("an installed spell with a spell-mechanic is presented, listed for its classes, and registered for execution",async()=>{
  clearInstalledSpellEntriesForTests();
  const adapter=new MockAdapter();
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  await adapter.getSnapshot();
  assert.equal(spellPresentationById(FROST_LASH),undefined,"unknown before the add-on is installed");
  const imported=await importPackage(adapter,packagePayload());
  assert.deepEqual(imported.blocking,[],JSON.stringify(imported.preview.contentImport?.validation));
  await imported.activate();
  const presentation=spellPresentationById(FROST_LASH);
  assert.ok(presentation,"the installed spell joins the presentation lookup");
  assert.equal(presentation.name,"서리 채찍");
  assert.equal(presentation.level,0);
  assert.equal(presentation.range,"60피트");
  assert.ok(spellOptions("dnd.srd521.class.wizard",0).some((option)=>option.id===FROST_LASH),"the wizard cantrip list offers it at creation");
  assert.ok(spellOptions("dnd.srd521.class.sorcerer",0).some((option)=>option.id===FROST_LASH),"a full class id in classes[] also matches");
  assert.equal(spellOptions("dnd.srd521.class.cleric",0).some((option)=>option.id===FROST_LASH),false,"classes not listed do not see it");
  assert.equal(spellOptions("dnd.srd521.class.wizard",1).some((option)=>option.id===FROST_LASH),false,"level filter applies");
  const definition=normalizedSpellDefinitionById(FROST_LASH);
  assert.equal(definition?.spellId,FROST_LASH,"the spell-mechanic is keyed by the content id");
  assert.equal(definition?.primary.kind,"attack-damage");
  const catalogEntry=(await adapter.getSnapshot()).catalog.find((entry)=>entry.contentId===FROST_LASH);
  assert.equal(catalogEntry?.category,"spell");
  clearInstalledSpellEntriesForTests();
});

test("a spell-mechanic without a spell-definition, or with an invalid shape, is refused at import",async()=>{
  clearInstalledSpellEntriesForTests();
  const adapter=new MockAdapter();
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  await adapter.getSnapshot();
  const invalid=await importPackage(adapter,packagePayload(true,{baseLevel:0,runtimeSupport:"combat-executable",castingEconomy:"action",targeting:{kind:"creature",rangeFeet:60,minTargets:1,maxTargets:1},primary:{kind:"attack-damage",damageType:"cold",dice:{count:1}}}));
  assert.ok(invalid.blocking.some((entry)=>/spell mechanic/.test(entry.message)&&/dice\.sides/.test(entry.message)),JSON.stringify(invalid.preview.contentImport?.validation));
  const orphan=JSON.parse(packagePayload(true)) as {content:Array<{mechanics:Array<{kind:string}>}>};
  orphan.content[0].mechanics=orphan.content[0].mechanics.filter((mechanic)=>mechanic.kind!=="spell-definition");
  const orphanImport=await importPackage(adapter,JSON.stringify(orphan));
  assert.ok(orphanImport.blocking.some((entry)=>/requires a spell-definition/.test(entry.message)),JSON.stringify(orphanImport.preview.contentImport?.validation));
  clearInstalledSpellEntriesForTests();
});

test("a persisted caster who knows the installed cantrip casts it through production authority and deals damage",async()=>{
  clearInstalledSpellEntriesForTests();
  const store=new MemoryCharacterLibraryStore();
  const repository=new CharacterLibraryRepository(store);
  await repository.hydrate([persistedCaster()],CHARACTER_ID);
  await repository.commit([persistedCaster()],CHARACTER_ID);

  const player=new MockAdapter();
  setCharacterLibraryStoreForTests(player,store);
  setInstalledContentStoreForTests(player,new MemoryInstalledContentStore());
  let snapshot=await player.getSnapshot();
  assert.equal(snapshot.activeCharacter.id,CHARACTER_ID);
  const imported=await importPackage(player,packagePayload());
  assert.deepEqual(imported.blocking,[]);
  await imported.activate();

  await player.startProductionLocalPlay("player");
  await player.startInitiative();
  snapshot=await player.setCurrentActor(CHARACTER_ID);
  const hud=snapshot.scene.spellcastingByActor?.[CHARACTER_ID];
  assert.ok(hud,"the caster owns a spellcasting HUD");
  assert.deepEqual(hud.cantripSpellIds,[FROST_LASH]);
  const action=(snapshot.scene.actionsByActor[CHARACTER_ID]??[]).find((entry)=>entry.spellCast?.spellId===FROST_LASH);
  assert.ok(action,`the installed cantrip derives a production spell action; got ${(snapshot.scene.actionsByActor[CHARACTER_ID]??[]).map((entry)=>entry.id).join("|")}`);
  assert.equal(action.name,"서리 채찍");
  assert.equal(action.spellCast?.runtimeSupport,"combat-executable");
  assert.equal(action.available,true,action.disabledReason);
  assert.equal(action.attackBonus,5);

  const target=snapshot.scene.entities.find((entry)=>entry.side==="enemy"&&Number.parseInt(entry.distance??"")<=60);
  assert.ok(target,"an enemy within 60 feet exists in production local play");
  const hpBefore=target.hp;
  await player.setQueuedD20(18);
  const cast=await player.resolveAction(action.id,[target.id]);
  assert.equal(cast.resolution?.stage,"complete",JSON.stringify(cast.resolution));
  assert.equal(cast.resolution?.actionId,action.id);
  assert.ok(cast.resolution?.provenance.some((entry)=>entry.includes(FROST_LASH)),cast.resolution?.provenance.join(" | "));
  assert.ok((cast.scene.entities.find((entry)=>entry.id===target.id)?.hp??hpBefore)<hpBefore,"the installed cantrip commits authoritative damage");
  clearInstalledSpellEntriesForTests();
});
