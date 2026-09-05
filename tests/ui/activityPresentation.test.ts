import assert from "node:assert/strict";
import test from "node:test";
import { presentDamageFormula, presentDiceFormula, presentDiceLine, presentStateChange, presentStateChanges } from "../../src/app/activityPresentation";

const context={
  entities:[{ id:"combatant.goblin-a", name:"고블린 A" },{ id:"char.aelar", name:"Aelar" }],
  resourceLabels:new Map([["resource.second-wind","세컨드 윈드"]]),
  activeCharacterId:"char.aelar",
  activeCharacterName:"Aelar",
};

test("T1-08: engine ledger lines become table sentences with names instead of ids", () => {
  assert.equal(presentStateChange("combatant.goblin-a economy.action true → false",context),"고블린 A · 행동 사용");
  assert.equal(presentStateChange("combatant.goblin-a economy.reaction false → true",context),"고블린 A · 반응 회복");
  assert.equal(presentStateChange("char.aelar economy.movement 30 → 20",context),"Aelar · 이동 30 → 20피트");
  assert.equal(presentStateChange("char.aelar HP 42 → 31",context),"Aelar · HP 42 → 31");
  assert.equal(presentStateChange("char.aelar 임시 HP 4 → 0",context),"Aelar · 임시 HP 4 → 0");
  assert.equal(presentStateChange("char.aelar resource.resource.second-wind 3 → 2",context),"Aelar · 세컨드 윈드 3 → 2");
  assert.equal(presentStateChange("char.aelar item.item.potion-of-healing.quantity 2 → 1",context),"Aelar · potion-of-healing 수량 2 → 1");
  assert.equal(presentStateChange("combatant.goblin-a life.downed false → true",context),"고블린 A · 쓰러짐 아니오 → 예");
  assert.equal(presentStateChange("char.aelar death-save.successes 0 → 1",context),"Aelar · 죽음 내성 성공 0 → 1");
  assert.equal(presentStateChange("char.aelar effect.effect.dodge 없음 → effect.dodge:1",context),"Aelar · 효과 시작: dodge");
  assert.equal(presentStateChange("char.aelar effect.effect.dodge effect.dodge:1 → 없음",context),"Aelar · 효과 종료: dodge");
  assert.equal(presentStateChange("char.aelar concentration 없음 → bless:1",context),"Aelar · 집중 시작");
  assert.equal(presentStateChange("scene turn-clock round 1 · char.aelar · — · 0s → round 2 · combatant.goblin-a · — · 6s",context),"턴 진행 · 2라운드 · 고블린 A");
  assert.equal(presentStateChange("combatant.goblin-a combatant added",context),"고블린 A · 전투 참여");
  assert.equal(presentStateChange("char.aelar inventory-item.item.rope added",context),"Aelar · 아이템 rope 추가");
});

test("T1-08: unknown lines pass through with ids replaced and zero-count dice hidden", () => {
  assert.equal(presentStateChange("교전 시작: combatant.goblin-a ↔ char.aelar",context),"교전 시작: 고블린 A ↔ Aelar");
  assert.equal(presentStateChange("피해 0d2 + 3 타격",context),"피해 3 타격");
  assert.deepEqual(presentStateChanges(["char.aelar HP 42 → 31","char.aelar HP 42 → 31","combatant.goblin-a economy.action true → false"],context),["Aelar · HP 42 → 31","고블린 A · 행동 사용"]);
});

test("T1-08: damage formulas and the dice line read cleanly", () => {
  assert.equal(presentDiceFormula("0d2 + 3"),"3");
  assert.equal(presentDiceFormula("1d8 + 4"),"1d8 + 4");
  assert.equal(presentDamageFormula({ dice:"0d2", flat:3, type:"타격" }),"3 타격");
  assert.equal(presentDamageFormula({ dice:"1d8", flat:4, type:"참격" }),"1d8 + 4 참격");
  assert.equal(presentDamageFormula({ dice:"2d6", flat:0, type:"화염" }),"2d6 화염");
  assert.equal(presentDiceLine({ rollKind:"attack", naturalD20:15, authoritativeDice:[15], attackTotal:22, rollTotal:undefined, targetAc:15, rollStateContributions:undefined, saveResults:[], checkTarget:undefined }),"d20 15 + 7 = 22 vs AC 15");
  assert.equal(presentDiceLine({ rollKind:"attack", naturalD20:3, authoritativeDice:[15,3], attackTotal:8, rollTotal:undefined, targetAc:14, rollStateContributions:[{ source:"x", state:"disadvantage" }], saveResults:[], checkTarget:undefined }),"d20 15 / 3 (불리점) + 5 = 8 vs AC 14");
  assert.equal(presentDiceLine({ rollKind:"save", naturalD20:undefined, authoritativeDice:[11], attackTotal:undefined, rollTotal:undefined, targetAc:undefined, rollStateContributions:undefined, saveResults:[{ targetId:"x", targetName:"고블린 A", d20:11, total:13, dc:14, outcome:"실패", modifierContributions:[] }], checkTarget:undefined }),"고블린 A d20 11 + 2 = 13 vs DC 14");
});
