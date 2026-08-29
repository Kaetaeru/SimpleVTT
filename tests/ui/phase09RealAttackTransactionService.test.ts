import assert from "node:assert/strict";
import test from "node:test";
import type { ActionVm, EconomyVm, SceneEntity, SceneVm } from "../../src/app/contracts";
import { resolveAtomicAttackTransaction } from "../../src/app/realAttackTransactionService";
import { createTurnRuntimeSession } from "../../src/app/realTurnRuntimeService";
import type { Phase09AttackFact, Phase09TargetingFact } from "../../src/app/phase09ReferenceRulesFacts";
import { createEffect } from "../../src/domain/effects";

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
const attackFact=():Phase09AttackFact=>({
  sourceKind:"weapon",ability:"dex",rangeFeet:80,
  damageDice:[{source:"external:weapon:damage",sides:6,count:1,faces:[4,4]}],
  flatDamage:[{source:"external:weapon:dexterity",value:2}],
});
const targetingFact=():Phase09TargetingFact=>({distanceFeet:22,visible:true,cover:"none",targetCanSeeAttacker:true});

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

function authoritativeRuntime(actor:SceneEntity,target:SceneEntity) {
  const scene:SceneVm={
    id:"scene.attack-service",
    name:"Attack Service",
    round:1,
    currentActorId:actor.id,
    selectedActorId:actor.id,
    entities:[structuredClone(actor),structuredClone(target)],
    actionsByActor:{},
    economyByActor:{ [actor.id]:{ ...ECONOMY },[target.id]:{ ...ECONOMY } },
  };
  return createTurnRuntimeSession(scene).state;
}

function commonRequest(actor:SceneEntity,target:SceneEntity) {
  return {
    action:SHORTBOW,
    actor,
    target,
    actorEconomy:ECONOMY,
    targetEconomy:ECONOMY,
    initiativeMode:true,
    attackD20Face:15,
    effectiveTargetAc:15,
    attackFact:attackFact(),
    targetingFact:targetingFact(),
    expectedPreview:{ total:20, outcome:"명중" as const, critical:false },
  };
}

test("atomic shortbow transaction commits targeting, attack, damage, and Action economy in one domain resolution", () => {
  const result = resolveAtomicAttackTransaction({
    resolutionId:"phase09.atomic.shortbow",
    ...commonRequest(
      entity({ id:"char.aelar", name:"Aelar", side:"ally", ac:18, hp:31, maxHp:42, tempHp:5 }),
      entity({ id:"combatant.goblin-a", name:"고블린 A", side:"enemy", kind:"combatant", hp:12, maxHp:21, ac:15 }),
    ),
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
  assert.ok(result.provenance.some((entry) => entry.includes("external:weapon:damage")));
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
    attackFact:attackFact(),
    targetingFact:targetingFact(),
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
  const targeting = targetingFact();
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
    attackFact:attackFact(),
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
    attackFact:attackFact(),
    targetingFact:targetingFact(),
    expectedPreview:{ total:19, outcome:"명중", critical:false },
  });

  assert.equal(result.status,"rejected");
  if (result.status !== "rejected") return;
  assert.match(result.error,/attack preview drift/);
});

test("supplied authoritative runtime effects participate in attack damage instead of being discarded", () => {
  const actor=entity({ id:"char.aelar",name:"Aelar",side:"ally",ac:18,hp:31,maxHp:42,tempHp:5 });
  const target=entity({ id:"combatant.goblin-a",name:"고블린 A",side:"enemy",kind:"combatant",hp:12,maxHp:21,ac:15 });
  const runtimeState=authoritativeRuntime(actor,target);
  runtimeState.effects.push(createEffect({
    id:"runtime-piercing-resistance",
    sourceId:"effect:test-resistance",
    targetId:target.id,
    kind:"modifier",
    tags:["damage-resistance:관통"],
    duration:{ kind:"permanent" },
  },runtimeState.clock));

  const result=resolveAtomicAttackTransaction({
    resolutionId:"phase09.atomic.runtime-effect",
    ...commonRequest(actor,target),
    runtimeState,
  });
  assert.equal(result.status,"committed");
  if (result.status!=="committed") return;
  assert.equal(result.damage?.finalDamage,3,"runtime-only resistance halves 6 piercing damage");
  assert.equal(result.targetHp,9);
  assert.equal(result.runtimeInputRevision,0);
  assert.equal(result.runtimeState?.revision,1);
  assert.ok(result.runtimeState?.effects.some((effect)=>effect.id==="runtime-piercing-resistance"));
  assert.match(result.damageComponent?.adjustment ?? "",/런타임 효과 조정/);
});

test("authoritative runtime attack rejects damage to a concentrator without fixed save input, then breaks concentration with explicit failed save", () => {
  const actor=entity({ id:"char.aelar",name:"Aelar",side:"ally",ac:18,hp:31,maxHp:42,tempHp:5 });
  const target=entity({ id:"combatant.goblin-a",name:"고블린 A",side:"enemy",kind:"combatant",hp:12,maxHp:21,ac:15 });
  const runtimeState=authoritativeRuntime(actor,target);
  const concentration={ actorId:target.id,groupId:"goblin:focus",sourceId:"spell:focus" };
  runtimeState.concentration[target.id]=structuredClone(concentration);
  runtimeState.effects.push(createEffect({
    id:"goblin-focus-effect",
    sourceId:"spell:focus",
    sourceActorId:target.id,
    targetId:actor.id,
    kind:"marker",
    duration:{ kind:"concentration" },
    concentrationGroupId:concentration.groupId,
  },runtimeState.clock));

  const missing=resolveAtomicAttackTransaction({
    resolutionId:"phase09.atomic.concentration.missing",
    ...commonRequest(actor,target),
    runtimeState,
  });
  assert.equal(missing.status,"rejected");
  if (missing.status==="rejected") assert.match(missing.error,/requires fixed concentration-check input/);
  assert.deepEqual(runtimeState.concentration[target.id],concentration,"rejected transaction does not mutate supplied runtime");

  const failed=resolveAtomicAttackTransaction({
    resolutionId:"phase09.atomic.concentration.failed",
    ...commonRequest(actor,target),
    runtimeState,
    concentrationCheck:{
      dice:{ id:"fixed-concentration-save",purpose:"concentration",sides:20,faces:[1] },
      modifierContributions:[{ source:"test:constitution",value:0 }],
    },
  });
  assert.equal(failed.status,"committed");
  if (failed.status!=="committed") return;
  assert.equal(failed.runtimeState?.concentration[target.id],undefined);
  assert.equal(failed.runtimeState?.effects.some((effect)=>effect.id==="goblin-focus-effect"),false);
  assert.ok(failed.events.some((event)=>event.stateChanges.some((change)=>change.kind==="concentration")));
  assert.ok(failed.events.some((event)=>event.stateChanges.some((change)=>change.kind==="effect"&&change.effectId==="goblin-focus-effect")));
});
