import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  compileCommonPlayEntryPointOperations,
  parseManualCommonPlayOperationDefinition,
  resolveCommonPlayEntryPointOperations,
} from "../../src/domain/commonPlayOperationRuntime";
import { resolvePendingResolution } from "../../src/domain/resolution";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

const AUTHORED=JSON.parse(readFileSync(new URL("../fixtures/play-contract/generic-hp-action.json",import.meta.url),"utf8"));

test("authored Common Play damage and healing lower to the existing generic Resolver HP operations",()=>{
  const definition=parseManualCommonPlayOperationDefinition(AUTHORED);
  const damageState=runtimeState();
  const damageInput={
    resolutionId:"external-hp-damage",
    actorId:"hero",
    entryPointId:"harm",
    targetId:"goblin",
    creatureKinds:{goblin:"monster" as const},
    damageDiceFaces:{0:[4]},
  };
  const pending=compileCommonPlayEntryPointOperations(TEST_PROFILE,damageState,definition,damageInput);
  assert.deepEqual(pending.operations.map((operation)=>operation.kind),["damage-roll","damage"]);
  const direct=resolvePendingResolution(TEST_PROFILE,damageState,pending);
  const damage=resolveCommonPlayEntryPointOperations(TEST_PROFILE,damageState,definition,damageInput);
  assert.deepEqual(damage,direct);
  assert.equal(damage.status,"committed");
  if(damage.status!=="committed") return;
  assert.equal(damage.state.combatants.goblin.life.hp.current,9);
  assert.equal((damage.results["external-hp-damage:operation:0:roll"] as {total:number}).total,6);
  assert.equal((damage.results["external-hp-damage:operation:0"] as {finalDamage:number}).finalDamage,6);

  const healingState=runtimeState();
  healingState.combatants.hero.life.hp.current=10;
  const healing=resolveCommonPlayEntryPointOperations(TEST_PROFILE,healingState,definition,{
    resolutionId:"external-hp-healing",
    actorId:"hero",
    entryPointId:"mend",
  });
  assert.equal(healing.status,"committed");
  if(healing.status!=="committed") return;
  assert.equal(healing.state.combatants.hero.life.hp.current,15);
  assert.equal((healing.results["external-hp-healing:operation:0"] as {restored:number}).restored,5);
});

test("Common Play HP semantics are invariant under definition and entry-point rename",()=>{
  const execute=(definition:typeof AUTHORED,entryPointId:string)=>resolveCommonPlayEntryPointOperations(
    TEST_PROFILE,
    runtimeState(),
    parseManualCommonPlayOperationDefinition(definition),
    {
      resolutionId:"renamed-hp",
      actorId:"hero",
      entryPointId,
      targetId:"goblin",
      creatureKinds:{goblin:"monster"},
      damageDiceFaces:{0:[3]},
    },
  );
  const renamed=structuredClone(AUTHORED);
  renamed.id="external.previously-unseen.renamed-hp";
  renamed.entryPoints[0].id="renamed-harm";
  const original=execute(AUTHORED,"harm");
  const changed=execute(renamed,"renamed-harm");
  assert.equal(original.status,"committed");
  assert.equal(changed.status,"committed");
  if(original.status!=="committed"||changed.status!=="committed") return;
  const result=(commit:typeof original)=>commit.results["renamed-hp:operation:0"] as {raw:number;finalDamage:number;nextHp:{current:number}};
  assert.deepEqual(result(changed),result(original));
});

test("portable Common Play HP rejects unsupported targets, healing dice, temporary HP, and unsupported damage fields",()=>{
  const invalidCases:Array<[unknown,RegExp]>=[
    [(()=>{const value=structuredClone(AUTHORED);value.entryPoints[0].operations[0].target="every-target";return value;})(),/target must be actor, self, or target/],
    [(()=>{const value=structuredClone(AUTHORED);value.entryPoints[1].operations[0].amount="1d8";return value;})(),/healing dice are not supported/],
    [(()=>{const value=structuredClone(AUTHORED);value.entryPoints[0].operations[0]={kind:"temp-hp.grant",amount:{value:5},target:"self"};return value;})(),/unsupported Common Play operation/],
    [(()=>{const value=structuredClone(AUTHORED);value.entryPoints[0].operations[0].multiplier=2;return value;})(),/unsupported fields: multiplier/],
  ];
  for(const [definition,message] of invalidCases) {
    assert.throws(()=>parseManualCommonPlayOperationDefinition(definition),message);
  }

  const parsed=parseManualCommonPlayOperationDefinition(AUTHORED);
  const rejected=resolveCommonPlayEntryPointOperations(TEST_PROFILE,runtimeState(),parsed,{
    resolutionId:"missing-target",
    actorId:"hero",
    entryPointId:"harm",
    creatureKinds:{},
    damageDiceFaces:{0:[3]},
  });
  assert.equal(rejected.status,"rejected");
  if(rejected.status==="rejected") assert.match(rejected.error,/pre-resolved target/);
});
