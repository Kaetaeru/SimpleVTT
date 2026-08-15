import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/phase09RealNoRollDamageAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import type { ActionVm, SceneEntity } from "../../src/app/contracts";
import { phase09ReferenceNoRollDamageFact } from "../../src/app/phase09ReferenceEffectFacts";
import { resolveNoRollDamageResolution } from "../../src/app/realNoRollDamageService";

const WAND:ActionVm = {
  id:"action.wand",
  actorId:"char.aelar",
  name:"마법 미사일 완드",
  category:"magic",
  target:"enemy",
  economy:"행동",
  resolutionKind:"no-roll-damage",
  summary:"자동 명중 · 3d4 + 3 역장",
  available:true,
  eligibleTargetIds:["combatant.goblin-a"],
  damage:[{ type:"역장", dice:"3d4+3", flat:0, average:9 }],
  itemCost:{ itemId:"item.wand.aelar", charges:1 },
  details:[],
};

const TARGET:SceneEntity = {
  id:"combatant.goblin-a",
  name:"고블린 A",
  side:"enemy",
  kind:"combatant",
  hp:12,
  maxHp:21,
  tempHp:0,
  ac:15,
  initiative:14,
  status:[],
  resistances:[],
  immunities:[],
  vulnerabilities:[],
  reactions:[],
};

test("no-roll damage service resolves structured damage dice before typed damage", () => {
  const result = resolveNoRollDamageResolution({
    action:WAND,
    target:TARGET,
    damageFact:phase09ReferenceNoRollDamageFact("action.wand"),
  });
  assert.deepEqual(result.authoritativeDice,[2,2,2]);
  assert.equal(result.raw,9);
  assert.equal(result.component.adjusted,9);
  assert.equal(result.nextHp,3);
  assert.ok(result.provenance.some((entry) => entry.includes("3d4 [2, 2, 2] => 6")));
  assert.ok(result.provenance.some((entry) => entry.includes("HP 12 -> 3")));
});

test("wand exposes its authoritative 3d4 as a visual damage stage before the atomic apply", async () => {
  const adapter = new MockAdapter();
  await adapter.resolveAction("action.wand",["combatant.goblin-a"]);
  let snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"effect-preview");
  assert.equal(snapshot.scene.entities.find((entity) => entity.id === "combatant.goblin-a")?.hp,12);
  assert.equal(snapshot.activeCharacter.items.find((item) => item.id === "item.wand.aelar")?.charges?.current,7);

  await adapter.advanceResolution();
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"damage-animation");
  assert.equal(snapshot.resolution?.rollKind,"damage");
  assert.deepEqual(snapshot.resolution?.authoritativeDice,[2,2,2]);
  assert.equal(snapshot.scene.entities.find((entity) => entity.id === "combatant.goblin-a")?.hp,12);
  assert.equal(snapshot.activeCharacter.items.find((item) => item.id === "item.wand.aelar")?.charges?.current,7);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,true);

  await adapter.advanceResolution();
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.deepEqual(snapshot.resolution?.authoritativeDice,[2,2,2]);
  assert.equal(snapshot.resolution?.damageComponents[0]?.raw,9);
  assert.match(snapshot.resolution?.damageComponents[0]?.source ?? "",/Rules Domain/);
  assert.equal(snapshot.scene.entities.find((entity) => entity.id === "combatant.goblin-a")?.hp,3);
  assert.equal(snapshot.activeCharacter.items.find((item) => item.id === "item.wand.aelar")?.charges?.current,6);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,false);
  assert.ok(snapshot.resolution?.stateChanges.includes("고블린 A HP 12 → 3"));
  assert.ok(snapshot.resolution?.stateChanges.includes("마법 미사일 완드 충전 7 → 6"));
  assert.ok(snapshot.resolution?.stateChanges.includes("행동 사용"));
  assert.ok(snapshot.resolution?.provenance.some((entry) => entry.includes("phase09:reference-damage:action.wand:d4")));
  assert.ok(snapshot.resolution?.provenance.some((entry) => entry.includes("마법 미사일 완드 충전 7 -> 6")));

  await adapter.undoLastResolution();
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.scene.entities.find((entity) => entity.id === "combatant.goblin-a")?.hp,12);
  assert.equal(snapshot.activeCharacter.items.find((item) => item.id === "item.wand.aelar")?.charges?.current,7);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,true);
});
