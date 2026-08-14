import assert from "node:assert/strict";
import test from "node:test";
import { resolveCompoundDamage } from "../../src/domain/damage";
import { resolvePendingResolution } from "../../src/domain/resolution";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

test("compound damage resolves each damage type against its own defenses before touching HP once", () => {
  const result = resolveCompoundDamage({
    hp:{ current:30, maximum:30, temporary:5 },
    components:[
      {
        damageType:"slashing",
        amount:8,
        defenses:[{ source:"armor:resistance", kind:"resistance", damageType:"slashing" }],
      },
      {
        damageType:"radiant",
        amount:7,
        defenses:[{ source:"ward:immunity", kind:"immunity", damageType:"radiant" }],
      },
      { damageType:"force", amount:6 },
    ],
  });

  assert.deepEqual(result.components.map((component) => [component.damageType, component.finalDamage]), [
    ["slashing",4],
    ["radiant",0],
    ["force",6],
  ]);
  assert.equal(result.finalDamage, 10);
  assert.equal(result.temporaryHpAbsorbed, 5);
  assert.equal(result.hpDamage, 5);
  assert.deepEqual(result.nextHp, { current:25, maximum:30, temporary:0 });
});

test("compound damage makes one Concentration check from aggregate final damage after defenses", () => {
  const state = runtimeState();
  state.combatants.goblin.life.hp = { current:50, maximum:50, temporary:0 };
  state.combatants.goblin.damageDefenses = [
    { source:"target:slashing-resistance", kind:"resistance", damageType:"slashing" },
  ];
  state.concentration.goblin = {
    actorId:"goblin",
    groupId:"concentration:goblin",
    sourceId:"spell:test-concentration",
  };

  const result = resolvePendingResolution(TEST_PROFILE, state, {
    id:"compound.concentration",
    actorId:"hero",
    sourceId:"attack:test",
    expectedRevision:0,
    operations:[{
      id:"compound.concentration:damage",
      kind:"compound-damage",
      targetId:"goblin",
      creatureKind:"monster",
      components:[
        { damageType:"slashing", amount:16 },
        { damageType:"radiant", amount:20 },
      ],
      concentrationCheck:{
        dice:{ id:"compound-concentration-d20", purpose:"Concentration", sides:20, faces:[12] },
        modifierContributions:[],
      },
    }],
  });

  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  const damage = result.results["compound.concentration:damage"] as {
    finalDamage:number;
    components:Array<{ damageType:string; finalDamage:number }>;
  };
  assert.equal(damage.finalDamage, 28, "16 slashing is resisted to 8, then 20 radiant is added");
  assert.deepEqual(damage.components.map((component) => component.finalDamage), [8,20]);
  assert.equal(result.state.combatants.goblin.life.hp.current, 22);
  assert.equal(result.state.concentration.goblin, undefined, "aggregate damage 28 sets Concentration DC 14, so a 12 fails");
  const concentrationProvenance = result.events[0]?.provenance.filter((entry) => entry.source === "profile:dnd.srd-5.2.1/concentration") ?? [];
  assert.equal(concentrationProvenance.length, 1, "one compound hit must make only one Concentration check");
});

test("compound damage with no positive final damage does not require Concentration dice", () => {
  const state = runtimeState();
  state.combatants.goblin.damageDefenses = [
    { source:"target:all-immunity", kind:"immunity", damageType:"*" },
  ];
  state.concentration.goblin = {
    actorId:"goblin",
    groupId:"concentration:goblin",
    sourceId:"spell:test-concentration",
  };
  const result = resolvePendingResolution(TEST_PROFILE, state, {
    id:"compound.zero",
    actorId:"hero",
    sourceId:"attack:test",
    expectedRevision:0,
    operations:[{
      id:"compound.zero:damage",
      kind:"compound-damage",
      targetId:"goblin",
      creatureKind:"monster",
      components:[
        { damageType:"slashing", amount:9 },
        { damageType:"radiant", amount:11 },
      ],
    }],
  });
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.equal((result.results["compound.zero:damage"] as { finalDamage:number }).finalDamage, 0);
  assert.ok(result.state.concentration.goblin, "zero final damage must not force a Concentration check");
});
