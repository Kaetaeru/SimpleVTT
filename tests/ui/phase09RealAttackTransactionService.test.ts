import assert from "node:assert/strict";
import test from "node:test";
import type { ActionVm, EconomyVm, SceneEntity } from "../../src/app/contracts";
import { resolveAtomicAttackTransaction } from "../../src/app/realAttackTransactionService";
import { phase09ReferenceAttackFact, phase09ReferenceTargetingFact } from "../../src/app/phase09ReferenceRulesFacts";

const SHORTBOW:ActionVm = {
  id:"action.shortbow",
  actorId:"char.aelar",
  name:"숏보우",
  category:"weapon",
  target:"enemy",
  economy:"행동",
  resolutionKind:"attack",
  summary:"+5 · 1d6 + 2 관통",
  available:true,
  eligibleTargetIds:["combatant.goblin-a"],
  attackBonus:5,
  damage:[{ type:"관통", dice:"1d6", flat:2, average:6 }],
  details:[],
};

function entity(overrides:Partial<SceneEntity>):SceneEntity {
  return {
    id:"entity",
    name:"Entity",
    side:"ally",
    kind:"character",
    hp:20,
    maxHp:20,
    tempHp:0,
    ac:15,
    initiative:10,
    status:[],
    resistances:[],
    immunities:[],
    vulnerabilities:[],
    reactions:[],
    ...overrides,
  };
}

const ECONOMY:EconomyVm = { action:true, bonusAction:true, reaction:true, movement:30, movementMax:30 };

test("atomic shortbow transaction commits targeting, attack, damage, and Action economy in one domain resolution", () => {
  const result = resolveAtomicAttackTransaction({
    resolutionId:"phase09.atomic.shortbow",
    action:SHORTBOW,
    actor:entity({ id:"char.aelar", name:"Aelar", side:"ally", ac:18, hp:31, maxHp:42, tempHp:5 }),
    target:entity({ id:"combatant.goblin-a", name:"고블린 A", side:"enemy", kind:"combatant", hp:12, maxHp:21, ac:15 }),
    actorEconomy:ECONOMY,
    targetEconomy:ECONOMY,
    initiativeMode:true,
    attackD20Face:15,
    effectiveTargetAc:15,
    attackFact:phase09ReferenceAttackFact("action.shortbow"),
    targetingFact:phase09ReferenceTargetingFact("combatant.goblin-a"),
    expectedPreview:{ total:20, outcome:"명중", critical:false },
  });

  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  assert.equal(result.attack.total,20);
  assert.equal(result.attack.outcome,"success");
  assert.equal(result.attack.critical,false);
  assert.deepEqual(result.damageFaces,[4]);
  assert.equal(result.damage?.finalDamage,6);
  assert.equal(result.targetHp,6);
  assert.equal(result.targetTempHp,0);
  assert.equal(result.actorEconomy.action,false);
  assert.deepEqual(result.stateChanges,["행동 사용","고블린 A HP 12 → 6"]);
  assert.match(result.damageComponent?.source ?? "",/atomic resolveAttack/);
  assert.ok(result.provenance.some((entry) => entry.includes("phase09:reference-attack:action.shortbow:d6")));
  assert.ok(result.provenance.some((entry) => entry.includes("action.shortbow") && entry.includes("action spent")));
});

test("atomic attack uses real critical dice semantics: damage dice double while the flat modifier stays single", () => {
  const result = resolveAtomicAttackTransaction({
    resolutionId:"phase09.atomic.shortbow.critical",
    action:SHORTBOW,
    actor:entity({ id:"char.aelar", name:"Aelar", side:"ally", ac:18, hp:31, maxHp:42, tempHp:5 }),
    target:entity({ id:"combatant.goblin-a", name:"고블린 A", side:"enemy", kind:"combatant", hp:12, maxHp:21, ac:99 }),
    actorEconomy:ECONOMY,
    targetEconomy:ECONOMY,
    initiativeMode:true,
    attackD20Face:20,
    effectiveTargetAc:99,
    attackFact:phase09ReferenceAttackFact("action.shortbow"),
    targetingFact:phase09ReferenceTargetingFact("combatant.goblin-a"),
    expectedPreview:{ total:25, outcome:"명중", critical:true },
  });

  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  assert.equal(result.attack.critical,true);
  assert.deepEqual(result.damageFaces,[4,4]);
  assert.equal(result.damage?.finalDamage,10,"2d6 fixed faces 4+4 plus one flat +2, not (1d6+2) doubled");
  assert.equal(result.targetHp,2);
});

test("atomic attack rejects out-of-range targeting without spending Action or changing HP", () => {
  const targeting = phase09ReferenceTargetingFact("combatant.goblin-a");
  targeting.distanceFeet = 90;
  const result = resolveAtomicAttackTransaction({
    resolutionId:"phase09.atomic.shortbow.out-of-range",
    action:SHORTBOW,
    actor:entity({ id:"char.aelar", name:"Aelar", side:"ally", ac:18, hp:31, maxHp:42, tempHp:5 }),
    target:entity({ id:"combatant.goblin-a", name:"고블린 A", side:"enemy", kind:"combatant", hp:12, maxHp:21, ac:15 }),
    actorEconomy:ECONOMY,
    targetEconomy:ECONOMY,
    initiativeMode:true,
    attackD20Face:15,
    effectiveTargetAc:15,
    attackFact:phase09ReferenceAttackFact("action.shortbow"),
    targetingFact:targeting,
  });

  assert.equal(result.status,"rejected");
  if (result.status !== "rejected") return;
  assert.match(result.error,/beyond range 80 ft/);
});

test("atomic attack rejects if the staged preview drifts from the authoritative transaction", () => {
  const result = resolveAtomicAttackTransaction({
    resolutionId:"phase09.atomic.shortbow.preview-drift",
    action:SHORTBOW,
    actor:entity({ id:"char.aelar", name:"Aelar", side:"ally", ac:18, hp:31, maxHp:42, tempHp:5 }),
    target:entity({ id:"combatant.goblin-a", name:"고블린 A", side:"enemy", kind:"combatant", hp:12, maxHp:21, ac:15 }),
    actorEconomy:ECONOMY,
    targetEconomy:ECONOMY,
    initiativeMode:true,
    attackD20Face:15,
    effectiveTargetAc:15,
    attackFact:phase09ReferenceAttackFact("action.shortbow"),
    targetingFact:phase09ReferenceTargetingFact("combatant.goblin-a"),
    expectedPreview:{ total:19, outcome:"명중", critical:false },
  });

  assert.equal(result.status,"rejected");
  if (result.status !== "rejected") return;
  assert.match(result.error,/attack preview drift/);
});
