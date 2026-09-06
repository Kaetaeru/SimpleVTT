import assert from "node:assert/strict";
import test from "node:test";
import { readableCastSummary } from "../../src/app/productionSpellRuntimeAdapter";

const names:Record<string,string>={ "dnd.srd521.monster.death-dog.instance-1":"죽음의 개 1", "char.p1":"C1 Cleric" };
const nameOf=(id:string)=>names[id]??id;

test("C1-08: kernel damage/heal lines read with creature names and Korean damage types", () => {
  assert.equal(readableCastSummary("dnd.srd521.monster.death-dog.instance-1 takes 10 radiant damage",nameOf),"죽음의 개 1 10 광휘 피해");
  assert.equal(readableCastSummary("char.p1 regains 7 HP",nameOf),"C1 Cleric HP 7 회복");
  assert.equal(readableCastSummary("char.p1 Temporary HP 5",nameOf),"C1 Cleric 임시 HP 5");
  assert.equal(readableCastSummary("char.p1 maximum HP 10 -> 15",nameOf),"C1 Cleric 최대 HP 10 → 15");
  assert.equal(readableCastSummary("char.p1 is stabilized",nameOf),"C1 Cleric 안정화");
  assert.equal(readableCastSummary("dnd.srd521.monster.death-dog.instance-1 takes 9 compound damage (fire 5 + cold 4)",nameOf),"죽음의 개 1 9 복합 피해 (fire 5 + cold 4)");
});

test("C1-08: effect applications name the target instead of the effect id; unknown lines pass through", () => {
  assert.equal(readableCastSummary("effect cast.1:tracked-rider:0:char.p1 applied",nameOf,"char.p1"),"C1 Cleric 효과 적용");
  assert.equal(readableCastSummary("effect cast.1:tracked-rider:0:char.p1 applied",nameOf),"효과 적용");
  assert.equal(readableCastSummary("주문 저항 성공",nameOf),"주문 저항 성공");
  assert.equal(readableCastSummary("operation skipped by predicate",nameOf),"효과 없음");
});
