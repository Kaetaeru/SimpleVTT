import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { MockAdapter } from "../../src/app/mockAdapter";
import { MemoryCharacterLibraryStore } from "../../src/app/memoryCharacterLibraryStore";
import { CharacterLibraryRepository } from "../../src/app/characterLibraryPersistence";
import { setCharacterLibraryStoreForTests } from "../../src/app/characterLibraryRuntimeAdapter";
import type { CharacterSheet } from "../../src/app/contracts";
import { spellRejectionMessage } from "../../src/app/sessionRefusal";

const ID="char.s1-04-cleric";
const GUIDANCE="dnd.srd521.spell.guidance";
const SACRED_FLAME="dnd.srd521.spell.sacred-flame";
const CURE_WOUNDS="dnd.srd521.spell.cure-wounds";

function cleric():CharacterSheet {
  return {
    id:ID,name:"세라",className:"클레릭",level:1,species:"인간",background:"수행자",hp:10,maxHp:10,tempHp:0,ac:14,speed:30,proficiencyBonus:2,saveState:"saved",
    abilities:{str:12,dex:10,con:14,int:10,wis:16,cha:12},saves:["WIS +5","CHA +3"],skills:["통찰","종교"],features:["주문 시전"],equipment:[],items:[],resources:[],attacks:[],
    classLevels:[{classId:"dnd.srd521.class.cleric",className:"클레릭",level:1}],
    cantrips:[GUIDANCE,SACRED_FLAME],preparedSpells:[CURE_WOUNDS],spellSlotMaximums:{1:2},
  } as unknown as CharacterSheet;
}

async function clericOnHerTurn() {
  const store=new MemoryCharacterLibraryStore();
  const repository=new CharacterLibraryRepository(store);
  const sheet=cleric();
  await repository.hydrate([sheet],ID);
  await repository.commit([sheet],ID);
  const adapter=new MockAdapter();
  setCharacterLibraryStoreForTests(adapter,store);
  await adapter.getSnapshot();
  await adapter.startProductionLocalPlay("player");
  await adapter.startInitiative();
  const snapshot=await adapter.setCurrentActor(ID);
  return {adapter,snapshot};
}

const spell=(snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>,spellId:string)=>(snapshot.scene.actionsByActor[ID]??[]).find((action)=>action.spellCast?.spellId===spellId);

test("S1-04: once the action is spent, every projected spell action of the caster reads unavailable with the table's reason", async () => {
  const {adapter}=await clericOnHerTurn();
  let snapshot=await adapter.getSnapshot();
  const guidance=spell(snapshot,GUIDANCE);
  assert.ok(guidance?.available,"인도 is available on her turn");
  snapshot=await adapter.resolveAction(guidance.id,[ID]);
  for(let step=0;step<6&&snapshot.resolution&&snapshot.resolution.stage!=="complete";step+=1)snapshot=await adapter.advanceResolution();
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(snapshot.scene.economyByActor[ID]?.action,false,"인도 spent the action");
  const flame=spell(snapshot,SACRED_FLAME);
  const cure=spell(snapshot,CURE_WOUNDS);
  assert.equal(flame?.available,false,"신성한 불길 reads unavailable");
  assert.equal(flame?.disabledReason,"행동을 이미 사용했습니다.");
  assert.equal(cure?.available,false,"상처 치료 reads unavailable");
  assert.equal(cure?.disabledReason,"행동을 이미 사용했습니다.");
});

test("S1-04: a cast the kernel rejects is a refusal in the rules' words, not a completed 시전 거부 card", async () => {
  const {adapter}=await clericOnHerTurn();
  let snapshot=await adapter.getSnapshot();
  const guidance=spell(snapshot,GUIDANCE)!;
  snapshot=await adapter.resolveAction(guidance.id,[ID]);
  for(let step=0;step<6&&snapshot.resolution&&snapshot.resolution.stage!=="complete";step+=1)snapshot=await adapter.advanceResolution();
  await adapter.dismissResolution();
  const enemy=snapshot.scene.entities.find((entry)=>entry.side==="enemy");
  assert.ok(enemy);
  const flame=spell(snapshot,SACRED_FLAME)!;
  const refused=await adapter.resolveAction(flame.id,[enemy.id]);
  assert.equal(refused.resolution,null,"no fake completed resolution");
  assert.equal(refused.refusal?.code,"spell-rejected");
  assert.equal(refused.refusal?.message,"행동을 이미 사용했습니다.");
  assert.equal(refused.refusal?.actionId,flame.id);
});

test("S1-04: kernel rejection texts read in Korean", () => {
  assert.equal(spellRejectionMessage("action is not available"),"행동을 이미 사용했습니다.");
  assert.equal(spellRejectionMessage("bonus-action is not available"),"추가 행동을 이미 사용했습니다.");
  assert.equal(spellRejectionMessage("reaction is not available"),"반응을 이미 사용했습니다.");
  assert.equal(spellRejectionMessage("caster already expended a spell slot this turn"),"이번 턴에 이미 주문 슬롯을 썼습니다.");
  assert.equal(spellRejectionMessage("no level 1 spell slot available"),"주문 슬롯이 없습니다.");
  assert.equal(spellRejectionMessage("이 주문은 유효한 주문 시전 트리거에서만 반응으로 사용할 수 있습니다."),"이 주문은 유효한 주문 시전 트리거에서만 반응으로 사용할 수 있습니다.");
  assert.equal(spellRejectionMessage("missing runtime combatant stat definition"),"시전 거부 · missing runtime combatant stat definition");
});
