import assert from "node:assert/strict";
import test from "node:test";
import { resolveAttack, type AttackRequest } from "../../src/domain/attack";
import {
  FIGHTER_CHAMPION_IMPROVED_CRITICAL_SOURCE,
  FIGHTER_CHAMPION_SUBCLASS_ID,
  FIGHTER_CHAMPION_SUPERIOR_CRITICAL_SOURCE,
  fighterChampionCriticalRange,
} from "../../src/domain/fighterChampion";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

function request(face:number, criticalRange:AttackRequest["criticalRange"]):AttackRequest {
  return {
    id:`champion.${face}.${criticalRange?.threshold ?? 20}`,
    actorId:"hero",
    expectedRevision:0,
    sourceId:"weapon:greatsword",
    sourceKind:"weapon",
    target:{
      id:"goblin",
      kind:"creature",
      relation:"enemy",
      distanceFeet:5,
      visible:true,
      cover:"none",
      ac:30,
      creatureKind:"monster",
      targetCanSeeAttacker:true,
    },
    rangeFeet:5,
    attackDice:{ id:`champion-d20-${face}`, purpose:"Champion attack", sides:20, faces:[face] },
    attackModifierContributions:[],
    criticalRange,
    baseDamage:{
      sourceId:"weapon:greatsword",
      damageType:"slashing",
      dice:[{ source:"weapon:greatsword", count:1, sides:8, faces:[4,5] }],
    },
  };
}

test("Champion Improved Critical makes a natural 19 an automatic critical hit for weapon attacks", () => {
  const range = fighterChampionCriticalRange({
    fighterLevel:3,
    subclassId:FIGHTER_CHAMPION_SUBCLASS_ID,
    sourceKind:"weapon",
  });
  assert.deepEqual(range,{ threshold:19, sourceId:FIGHTER_CHAMPION_IMPROVED_CRITICAL_SOURCE });
  const result = resolveAttack(TEST_PROFILE,runtimeState(),request(19,range));
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  const attack = result.results["champion.19.19:attack"] as { outcome:string; critical:boolean; natural:number };
  assert.deepEqual({ outcome:attack.outcome, critical:attack.critical, natural:attack.natural }, { outcome:"success", critical:true, natural:19 });
  const damage = result.results["champion.19.19:damage"] as { finalDamage:number };
  assert.equal(damage.finalDamage,9,"critical doubles the 1d8 weapon die to two fixed faces");
});

test("Champion level 14 does not expand to natural 18, while level 15 Superior Critical does", () => {
  const level14 = fighterChampionCriticalRange({ fighterLevel:14, subclassId:FIGHTER_CHAMPION_SUBCLASS_ID, sourceKind:"weapon" });
  const miss = resolveAttack(TEST_PROFILE,runtimeState(),request(18,level14));
  assert.equal(miss.status,"committed");
  if (miss.status !== "committed") return;
  assert.deepEqual(miss.results["champion.18.19:damage"],{ skipped:true });

  const level15 = fighterChampionCriticalRange({ fighterLevel:15, subclassId:FIGHTER_CHAMPION_SUBCLASS_ID, sourceKind:"unarmed" });
  assert.deepEqual(level15,{ threshold:18, sourceId:FIGHTER_CHAMPION_SUPERIOR_CRITICAL_SOURCE });
  const hitRequest = request(18,level15);
  hitRequest.id = "champion.superior";
  hitRequest.sourceId = "unarmed:strike";
  hitRequest.sourceKind = "unarmed";
  const hit = resolveAttack(TEST_PROFILE,runtimeState(),hitRequest);
  assert.equal(hit.status,"committed");
  if (hit.status !== "committed") return;
  const attack = hit.results["champion.superior:attack"] as { outcome:string; critical:boolean };
  assert.deepEqual({ outcome:attack.outcome, critical:attack.critical },{ outcome:"success", critical:true });
});

test("Champion critical range does not apply before subclass level or to Wild Shape attacks, and natural 1 still misses", () => {
  assert.equal(fighterChampionCriticalRange({ fighterLevel:2, subclassId:FIGHTER_CHAMPION_SUBCLASS_ID, sourceKind:"weapon" }),undefined);
  assert.equal(fighterChampionCriticalRange({ fighterLevel:20, subclassId:FIGHTER_CHAMPION_SUBCLASS_ID, sourceKind:"wild-shape" }),undefined);

  const range = fighterChampionCriticalRange({ fighterLevel:15, subclassId:FIGHTER_CHAMPION_SUBCLASS_ID, sourceKind:"weapon" });
  const nat1 = request(1,range);
  nat1.target.ac = 0;
  nat1.attackModifierContributions = [{ source:"impossible-bonus", value:100 }];
  const result = resolveAttack(TEST_PROFILE,runtimeState(),nat1);
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  const attack = result.results["champion.1.18:attack"] as { outcome:string; critical:boolean };
  assert.deepEqual({ outcome:attack.outcome, critical:attack.critical },{ outcome:"failure", critical:false });
});
