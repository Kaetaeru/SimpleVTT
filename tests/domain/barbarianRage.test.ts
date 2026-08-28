import assert from "node:assert/strict";
import test from "node:test";
import {
  BARBARIAN_RAGE_DURATION_KEY,
  BARBARIAN_RAGE_TAG,
  barbarianRageDamageBonus,
  resolveBarbarianRageEnd,
  resolveBarbarianRageExtend,
  resolveBarbarianRageStart,
} from "../../src/domain/barbarianRage";
import { BARBARIAN_RAGE_RESOURCE_ID, BERSERKER_MINDLESS_RAGE_TAG } from "../../src/domain/barbarianBerserker";
import { createEffect } from "../../src/domain/effects";
import { resolvePendingResolution } from "../../src/domain/resolution";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

function rageState() {
  const state = runtimeState();
  state.combatants.hero.resources.push({
    id:BARBARIAN_RAGE_RESOURCE_ID,
    label:"격노",
    current:3,
    maximum:3,
    recovery:{ shortRest:1, longRest:"all" },
  });
  return state;
}

test("Rage damage bonus follows the SRD 5.2.1 Barbarian table", () => {
  assert.equal(barbarianRageDamageBonus(1),2);
  assert.equal(barbarianRageDamageBonus(8),2);
  assert.equal(barbarianRageDamageBonus(9),3);
  assert.equal(barbarianRageDamageBonus(15),3);
  assert.equal(barbarianRageDamageBonus(16),4);
  assert.equal(barbarianRageDamageBonus(20),4);
  assert.throws(() => barbarianRageDamageBonus(0));
});

test("Rage start atomically spends one use, spends Bonus Action, and installs physical damage resistance", () => {
  const state = rageState();
  const result = resolveBarbarianRageStart(TEST_PROFILE,state,{
    id:"barbarian.rage.start",
    actorId:"hero",
    expectedRevision:0,
    barbarianLevel:5,
    wearingHeavyArmor:false,
  });
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.combatants.hero.resources.find((entry) => entry.id === BARBARIAN_RAGE_RESOURCE_ID)?.current,2);
  assert.equal(result.state.combatants.hero.economy.bonusAction,false);
  const rage = result.state.effects.find((effect) => effect.tags.includes(BARBARIAN_RAGE_TAG));
  assert.ok(rage);
  assert.equal(rage?.expiry.kind,"special");
  assert.equal(rage?.metadata?.attackDamageFlat,2);
  assert.equal(rage?.metadata?.attackDamageAbility,"str");
  assert.equal(rage?.metadata?.attackDamageSourceKinds,"weapon,unarmed");
  assert.equal(rage?.metadata?.rageExpiresAfterRound,2);
  assert.equal(rage?.metadata?.rageMaximumRound,101);
  assert.ok(rage?.tags.includes("damage-resistance:bludgeoning"));
  assert.ok(rage?.tags.includes("damage-resistance:piercing"));
  assert.ok(rage?.tags.includes("damage-resistance:slashing"));

  const damaged = resolvePendingResolution(TEST_PROFILE,result.state,{
    id:"barbarian.rage.damage",
    actorId:"goblin",
    sourceId:"attack:test",
    expectedRevision:result.state.revision,
    operations:[{
      id:"barbarian.rage.damage:components",
      kind:"compound-damage",
      targetId:"hero",
      creatureKind:"character",
      components:[
        { damageType:"slashing", amount:9 },
        { damageType:"fire", amount:5 },
      ],
    }],
  });
  assert.equal(damaged.status,"committed");
  if (damaged.status !== "committed") return;
  const damage = damaged.results["barbarian.rage.damage:components"] as { finalDamage:number; components:Array<{damageType:string;finalDamage:number}> };
  assert.deepEqual(damage.components.map((entry) => [entry.damageType,entry.finalDamage]),[["slashing",4],["fire",5]]);
  assert.equal(damage.finalDamage,9);
});

test("Rage grants Advantage only to Strength ability checks and saving throws", () => {
  const started = resolveBarbarianRageStart(TEST_PROFILE,rageState(),{
    id:"barbarian.rage.strength-advantage",
    actorId:"hero",
    expectedRevision:0,
    barbarianLevel:5,
    wearingHeavyArmor:false,
  });
  assert.equal(started.status,"committed");
  if (started.status !== "committed") return;

  const resolved = resolvePendingResolution(TEST_PROFILE,started.state,{
    id:"barbarian.rage.d20-scope",
    actorId:"hero",
    sourceId:"test:rage-d20-scope",
    expectedRevision:started.state.revision,
    operations:[
      {
        id:"rage:str-check",
        kind:"d20",
        condition:{ ability:"str" },
        request:{
          family:"ability-check",
          target:10,
          modifierContributions:[],
          dice:{ id:"rage:str-check", purpose:"strength check", sides:20, faces:[4,17] },
        },
      },
      {
        id:"rage:dex-check",
        kind:"d20",
        condition:{ ability:"dex" },
        request:{
          family:"ability-check",
          target:10,
          modifierContributions:[],
          dice:{ id:"rage:dex-check", purpose:"dexterity check", sides:20, faces:[4,17] },
        },
      },
      {
        id:"rage:str-save",
        kind:"d20",
        condition:{ ability:"str" },
        request:{
          family:"saving-throw",
          target:10,
          modifierContributions:[],
          dice:{ id:"rage:str-save", purpose:"strength save", sides:20, faces:[4,17] },
        },
      },
      {
        id:"rage:dex-save",
        kind:"d20",
        condition:{ ability:"dex" },
        request:{
          family:"saving-throw",
          target:10,
          modifierContributions:[],
          dice:{ id:"rage:dex-save", purpose:"dexterity save", sides:20, faces:[4,17] },
        },
      },
    ],
  });
  assert.equal(resolved.status,"committed");
  if (resolved.status !== "committed") return;
  for (const id of ["rage:str-check","rage:str-save"]) {
    const result = resolved.results[id] as { rollState:string; natural:number };
    assert.equal(result.rollState,"advantage");
    assert.equal(result.natural,17);
  }
  for (const id of ["rage:dex-check","rage:dex-save"]) {
    const result = resolved.results[id] as { rollState:string; natural:number };
    assert.equal(result.rollState,"normal");
    assert.equal(result.natural,4);
  }
});

test("Rage rejects Heavy armor and duplicate activation without spending another resource", () => {
  const heavy = rageState();
  const blocked = resolveBarbarianRageStart(TEST_PROFILE,heavy,{
    id:"barbarian.rage.heavy",
    actorId:"hero",
    expectedRevision:0,
    barbarianLevel:5,
    wearingHeavyArmor:true,
  });
  assert.equal(blocked.status,"rejected");
  assert.equal(blocked.state.combatants.hero.resources.find((entry) => entry.id === BARBARIAN_RAGE_RESOURCE_ID)?.current,3);
  assert.equal(blocked.state.combatants.hero.economy.bonusAction,true);

  const first = resolveBarbarianRageStart(TEST_PROFILE,rageState(),{
    id:"barbarian.rage.first",
    actorId:"hero",
    expectedRevision:0,
    barbarianLevel:5,
    wearingHeavyArmor:false,
  });
  assert.equal(first.status,"committed");
  if (first.status !== "committed") return;
  const duplicate = resolveBarbarianRageStart(TEST_PROFILE,first.state,{
    id:"barbarian.rage.duplicate",
    actorId:"hero",
    expectedRevision:first.state.revision,
    barbarianLevel:5,
    wearingHeavyArmor:false,
    useBonusActionEconomy:false,
  });
  assert.equal(duplicate.status,"rejected");
  assert.equal(duplicate.state.combatants.hero.resources.find((entry) => entry.id === BARBARIAN_RAGE_RESOURCE_ID)?.current,2);
});

test("Rage end clears the core marker and Rage-linked Berserker effects together", () => {
  const started = resolveBarbarianRageStart(TEST_PROFILE,rageState(),{
    id:"barbarian.rage.start-linked",
    actorId:"hero",
    expectedRevision:0,
    barbarianLevel:6,
    wearingHeavyArmor:false,
  });
  assert.equal(started.status,"committed");
  if (started.status !== "committed") return;
  const linked = createEffect({
    id:"linked-mindless-rage",
    sourceId:"dnd.srd521.feature.barbarian.berserker.mindless-rage",
    sourceActorId:"hero",
    targetId:"hero",
    kind:"marker",
    tags:[BERSERKER_MINDLESS_RAGE_TAG],
    duration:{kind:"special",key:BARBARIAN_RAGE_DURATION_KEY},
  },started.state.clock);
  const withLinked = {...started.state,effects:[...started.state.effects,linked]};
  const ended = resolveBarbarianRageEnd(TEST_PROFILE,withLinked,{
    id:"barbarian.rage.end",
    actorId:"hero",
    expectedRevision:withLinked.revision,
  });
  assert.equal(ended.status,"committed");
  if (ended.status !== "committed") return;
  assert.equal(ended.state.effects.some((effect) => effect.targetId === "hero" && (
    effect.tags.includes(BARBARIAN_RAGE_TAG)
    || (effect.expiry.kind === "special" && effect.expiry.key === BARBARIAN_RAGE_DURATION_KEY)
  )),false);
});

test("Rage expires at the end of the Barbarian's next turn when it is not extended", () => {
  const started=resolveBarbarianRageStart(TEST_PROFILE,rageState(),{
    id:"rage.duration.start",actorId:"hero",expectedRevision:0,barbarianLevel:5,wearingHeavyArmor:false,useBonusActionEconomy:false,
  });
  assert.equal(started.status,"committed");
  if(started.status!=="committed")return;
  const currentEnd=resolvePendingResolution(TEST_PROFILE,started.state,{
    id:"rage.duration.end-1",actorId:"hero",sourceId:"turn:test",expectedRevision:started.state.revision,
    operations:[{id:"rage.duration.end-1:turn",kind:"end-turn",actorId:"hero",round:1}],
  });
  assert.equal(currentEnd.status,"committed");
  if(currentEnd.status!=="committed")return;
  assert.ok(currentEnd.state.effects.some((effect)=>effect.tags.includes(BARBARIAN_RAGE_TAG)));
  const nextEnd=resolvePendingResolution(TEST_PROFILE,currentEnd.state,{
    id:"rage.duration.end-2",actorId:"hero",sourceId:"turn:test",expectedRevision:currentEnd.state.revision,
    operations:[{id:"rage.duration.end-2:turn",kind:"end-turn",actorId:"hero",round:2}],
  });
  assert.equal(nextEnd.status,"committed");
  if(nextEnd.status!=="committed")return;
  assert.equal(nextEnd.state.effects.some((effect)=>effect.targetId==="hero"&&(
    effect.tags.includes(BARBARIAN_RAGE_TAG)||(effect.expiry.kind==="special"&&effect.expiry.key===BARBARIAN_RAGE_DURATION_KEY)
  )),false);
});

test("an attack roll against an enemy extends Rage even when the attack misses", () => {
  const started=resolveBarbarianRageStart(TEST_PROFILE,rageState(),{
    id:"rage.attack.start",actorId:"hero",expectedRevision:0,barbarianLevel:5,wearingHeavyArmor:false,useBonusActionEconomy:false,
  });
  assert.equal(started.status,"committed");
  if(started.status!=="committed")return;
  const turn=resolvePendingResolution(TEST_PROFILE,started.state,{
    id:"rage.attack.turn",actorId:"hero",sourceId:"turn:test",expectedRevision:started.state.revision,
    operations:[{id:"rage.attack.turn:begin",kind:"begin-turn",actorId:"hero",round:2}],
  });
  assert.equal(turn.status,"committed");
  if(turn.status!=="committed")return;
  const attack=resolvePendingResolution(TEST_PROFILE,turn.state,{
    id:"rage.attack.roll",actorId:"hero",sourceId:"weapon:test",expectedRevision:turn.state.revision,
    operations:[
      {
        id:"rage.attack.target",kind:"targeting",sourceId:"hero",harmful:true,
        rule:{kind:"creature",rangeFeet:5,minTargets:1,maxTargets:1,allowedRelations:["enemy"],requiresSight:true,directTarget:true},
        targets:[{id:"goblin",kind:"creature",relation:"enemy",distanceFeet:5,visible:true,cover:"none"}],
      },
      {
        id:"rage.attack.d20",kind:"d20",actorId:"hero",targetId:"goblin",
        request:{family:"attack-roll",target:30,modifierContributions:[],dice:{id:"rage.attack.d20",purpose:"attack",sides:20,faces:[2]}},
      },
    ],
  });
  assert.equal(attack.status,"committed");
  if(attack.status!=="committed")return;
  const marker=attack.state.effects.find((effect)=>effect.tags.includes(BARBARIAN_RAGE_TAG));
  assert.equal(marker?.metadata?.rageExpiresAfterRound,3);
  const endRound2=resolvePendingResolution(TEST_PROFILE,attack.state,{
    id:"rage.attack.end-2",actorId:"hero",sourceId:"turn:test",expectedRevision:attack.state.revision,
    operations:[{id:"rage.attack.end-2:turn",kind:"end-turn",actorId:"hero",round:2}],
  });
  assert.equal(endRound2.status,"committed");
  if(endRound2.status!=="committed")return;
  assert.ok(endRound2.state.effects.some((effect)=>effect.tags.includes(BARBARIAN_RAGE_TAG)));
});

test("forcing an enemy saving throw on the Barbarian's turn extends Rage", () => {
  const started=resolveBarbarianRageStart(TEST_PROFILE,rageState(),{
    id:"rage.save.start",actorId:"hero",expectedRevision:0,barbarianLevel:5,wearingHeavyArmor:false,useBonusActionEconomy:false,
  });
  assert.equal(started.status,"committed");
  if(started.status!=="committed")return;
  const turn=resolvePendingResolution(TEST_PROFILE,started.state,{
    id:"rage.save.turn",actorId:"hero",sourceId:"turn:test",expectedRevision:started.state.revision,
    operations:[{id:"rage.save.turn:begin",kind:"begin-turn",actorId:"hero",round:2}],
  });
  assert.equal(turn.status,"committed");
  if(turn.status!=="committed")return;
  const save=resolvePendingResolution(TEST_PROFILE,turn.state,{
    id:"rage.save.roll",actorId:"hero",sourceId:"feature:test",expectedRevision:turn.state.revision,
    operations:[
      {
        id:"rage.save.target",kind:"targeting",sourceId:"hero",harmful:true,
        rule:{kind:"creature",rangeFeet:30,minTargets:1,maxTargets:1,allowedRelations:["enemy"],requiresSight:true,directTarget:true},
        targets:[{id:"goblin",kind:"creature",relation:"enemy",distanceFeet:10,visible:true,cover:"none"}],
      },
      {
        id:"rage.save.d20",kind:"d20",actorId:"goblin",
        request:{family:"saving-throw",target:14,modifierContributions:[],dice:{id:"rage.save.d20",purpose:"save",sides:20,faces:[18]}},
      },
    ],
  });
  assert.equal(save.status,"committed");
  if(save.status!=="committed")return;
  assert.equal(save.state.effects.find((effect)=>effect.tags.includes(BARBARIAN_RAGE_TAG))?.metadata?.rageExpiresAfterRound,3);
});

test("Rage can spend a dedicated Bonus Action to extend and cannot stack that extension", () => {
  const started=resolveBarbarianRageStart(TEST_PROFILE,rageState(),{
    id:"rage.bonus.start",actorId:"hero",expectedRevision:0,barbarianLevel:5,wearingHeavyArmor:false,useBonusActionEconomy:false,
  });
  assert.equal(started.status,"committed");
  if(started.status!=="committed")return;
  const turn=resolvePendingResolution(TEST_PROFILE,started.state,{
    id:"rage.bonus.turn",actorId:"hero",sourceId:"turn:test",expectedRevision:started.state.revision,
    operations:[{id:"rage.bonus.turn:begin",kind:"begin-turn",actorId:"hero",round:2}],
  });
  assert.equal(turn.status,"committed");
  if(turn.status!=="committed")return;
  const extended=resolveBarbarianRageExtend(TEST_PROFILE,turn.state,{
    id:"rage.bonus.extend",actorId:"hero",expectedRevision:turn.state.revision,
  });
  assert.equal(extended.status,"committed");
  if(extended.status!=="committed")return;
  assert.equal(extended.state.combatants.hero.economy.bonusAction,false);
  assert.equal(extended.state.effects.find((effect)=>effect.tags.includes(BARBARIAN_RAGE_TAG))?.metadata?.rageExpiresAfterRound,3);
  const duplicate=resolveBarbarianRageExtend(TEST_PROFILE,extended.state,{
    id:"rage.bonus.extend-again",actorId:"hero",expectedRevision:extended.state.revision,
  });
  assert.equal(duplicate.status,"rejected");
});

test("Rage and linked effects expire after the 10 minute maximum duration", () => {
  const started=resolveBarbarianRageStart(TEST_PROFILE,rageState(),{
    id:"rage.maximum.start",actorId:"hero",expectedRevision:0,barbarianLevel:5,wearingHeavyArmor:false,useBonusActionEconomy:false,
  });
  assert.equal(started.status,"committed");
  if(started.status!=="committed")return;
  const advanced=resolvePendingResolution(TEST_PROFILE,started.state,{
    id:"rage.maximum.time",actorId:"hero",sourceId:"time:test",expectedRevision:started.state.revision,
    operations:[{id:"rage.maximum.time:advance",kind:"advance-time",elapsedSeconds:600}],
  });
  assert.equal(advanced.status,"committed");
  if(advanced.status!=="committed")return;
  assert.equal(advanced.state.effects.some((effect)=>effect.targetId==="hero"&&(
    effect.tags.includes(BARBARIAN_RAGE_TAG)||(effect.expiry.kind==="special"&&effect.expiry.key===BARBARIAN_RAGE_DURATION_KEY)
  )),false);
});
