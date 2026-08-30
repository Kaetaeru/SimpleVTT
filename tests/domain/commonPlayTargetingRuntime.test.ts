import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  compileCommonPlayEntryPointOperations,
  parseManualCommonPlayOperationDefinition,
  resolveCommonPlayEntryPointOperations,
} from "../../src/domain/commonPlayOperationRuntime";
import { createEffect } from "../../src/domain/effects";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

const AUTHORED=JSON.parse(readFileSync(new URL("../fixtures/play-contract/generic-targeting-action.json",import.meta.url),"utf8"));

const target=(id:string,relation:"self"|"ally"|"enemy"|"neutral")=>({id,kind:"creature" as const,relation});

test("bounded Common Play selector lowers before downstream healing through the existing targeting Resolver",()=>{
  const definition=parseManualCommonPlayOperationDefinition(AUTHORED);
  assert.deepEqual(definition.entryPoints[0].targeting,{from:"targets",min:1,max:1});
  const state=runtimeState();
  state.combatants.goblin.life.hp.current=5;
  const input={
    resolutionId:"external-targeting",
    actorId:"hero",
    entryPointId:"mend-other",
    targetId:"goblin",
    targetingTargets:[target("goblin","enemy")],
  };
  const pending=compileCommonPlayEntryPointOperations(TEST_PROFILE,state,definition,input);
  assert.deepEqual(pending.operations.map((operation)=>operation.kind),["targeting","healing"]);
  const targeting=pending.operations[0];
  assert.equal(targeting.kind,"targeting");
  if(targeting.kind!=="targeting") return;
  assert.equal(targeting.rule.directTarget,false);
  assert.deepEqual(targeting.targets,[target("goblin","enemy")],"no distance, sight, or cover fact may be fabricated");

  const committed=resolveCommonPlayEntryPointOperations(TEST_PROFILE,state,definition,input);
  assert.equal(committed.status,"committed");
  if(committed.status!=="committed") return;
  assert.equal(committed.events[0].kind,"targeting");
  assert.equal(committed.events[1].kind,"healing");
  assert.equal(committed.state.combatants.goblin.life.hp.current,10);
  assert.deepEqual((committed.results["external-targeting:targeting"] as {targets:Array<{targetId:string}>}).targets.map((entry)=>entry.targetId),["goblin"]);
});

test("bounded Common Play selector accepts the acting actor as the pre-resolved target",()=>{
  const state=runtimeState();
  state.combatants.hero.life.hp.current=10;
  const committed=resolveCommonPlayEntryPointOperations(TEST_PROFILE,state,parseManualCommonPlayOperationDefinition(AUTHORED),{
    resolutionId:"self-targeting",
    actorId:"hero",
    entryPointId:"mend-other",
    targetId:"hero",
    targetingTargets:[target("hero","self")],
  });
  assert.equal(committed.status,"committed");
  if(committed.status==="committed") assert.equal(committed.state.combatants.hero.life.hp.current,15);
});

test("portable Common Play relation selector validates authoritative relation facts without identity dispatch",()=>{
  const authored=structuredClone(AUTHORED);
  authored.entryPoints[0].targeting={from:"targets",where:{op:"relation-matches",ref:"relation",value:"enemy"},min:1,max:1};
  const definition=parseManualCommonPlayOperationDefinition(authored);
  assert.deepEqual(definition.entryPoints[0].targeting,authored.entryPoints[0].targeting);

  const enemyState=runtimeState();
  enemyState.combatants.goblin.life.hp.current=5;
  const enemy=resolveCommonPlayEntryPointOperations(TEST_PROFILE,enemyState,definition,{
    resolutionId:"relation-enemy",actorId:"hero",entryPointId:"mend-other",targetId:"goblin",targetingTargets:[target("goblin","enemy")],
  });
  assert.equal(enemy.status,"committed");
  if(enemy.status==="committed") assert.equal(enemy.state.combatants.goblin.life.hp.current,10);

  const selfState=runtimeState();
  selfState.combatants.hero.life.hp.current=10;
  const self=resolveCommonPlayEntryPointOperations(TEST_PROFILE,selfState,definition,{
    resolutionId:"relation-self",actorId:"hero",entryPointId:"mend-other",targetId:"hero",targetingTargets:[target("hero","self")],
  });
  assert.equal(self.status,"rejected");
  if(self.status==="rejected") assert.match(self.error,/targeting selector rejected: manual selection contains an ineligible target/);
  assert.equal(selfState.combatants.hero.life.hp.current,10);
});

test("bounded Common Play selector preserves authored multi-target limits without fabricating spatial facts",()=>{
  const authored=structuredClone(AUTHORED);
  authored.entryPoints[0].targeting={from:"targets",min:1,max:2};
  authored.entryPoints[0].operations=[];
  const definition=parseManualCommonPlayOperationDefinition(authored);
  const state=runtimeState();
  const selected=[target("goblin","enemy"),target("hero","self")];
  const pending=compileCommonPlayEntryPointOperations(TEST_PROFILE,state,definition,{
    resolutionId:"external-multi-targeting",
    actorId:"hero",
    entryPointId:"mend-other",
    targetingTargets:selected,
  });
  assert.equal(pending.operations.length,1);
  const targeting=pending.operations[0];
  assert.equal(targeting.kind,"targeting");
  if(targeting.kind!=="targeting") return;
  assert.deepEqual(targeting.rule,{kind:"creature",minTargets:1,maxTargets:2,directTarget:false});
  assert.deepEqual(targeting.targets,selected);

  const committed=resolveCommonPlayEntryPointOperations(TEST_PROFILE,state,definition,{
    resolutionId:"external-multi-targeting-commit",
    actorId:"hero",
    entryPointId:"mend-other",
    targetingTargets:selected,
  });
  assert.equal(committed.status,"committed");
  if(committed.status!=="committed") return;
  assert.deepEqual((committed.results["external-multi-targeting-commit:targeting"] as {targets:Array<{targetId:string}>}).targets.map((entry)=>entry.targetId),["goblin","hero"]);
});

test("multi-target Common Play rejects a singular target effect until an explicit per-target contract exists",()=>{
  const authored=structuredClone(AUTHORED);
  authored.entryPoints[0].targeting={from:"targets",min:1,max:2};
  assert.throws(()=>parseManualCommonPlayOperationDefinition(authored),/explicit per-target effect contract/);
});

test("bounded Common Play selector permits an authored zero minimum through the shared targeting Resolver",()=>{
  const authored=structuredClone(AUTHORED);
  authored.entryPoints[0].targeting={from:"targets",min:0,max:1};
  authored.entryPoints[0].operations=[];
  const definition=parseManualCommonPlayOperationDefinition(authored);
  assert.deepEqual(definition.entryPoints[0].targeting,{from:"targets",min:0,max:1});
  const committed=resolveCommonPlayEntryPointOperations(TEST_PROFILE,runtimeState(),definition,{
    resolutionId:"external-zero-min-targeting",
    actorId:"hero",
    entryPointId:"mend-other",
    targetingTargets:[],
  });
  assert.equal(committed.status,"committed");
  if(committed.status!=="committed") return;
  assert.deepEqual((committed.results["external-zero-min-targeting:targeting"] as {targets:Array<{targetId:string}>}).targets,[]);
});

test("unsupported Common Play selector shapes reject explicitly",()=>{
  const invalid:Array<[Record<string,unknown>,RegExp]>=[
    [{from:"actors",min:1,max:1},/from must be targets/],
    [{from:"artifacts",min:1,max:1},/from must be targets/],
    [{from:"targets",where:{value:true},min:1,max:1},/op is unsupported/],
    [{from:"targets",area:{kind:"instant"},min:1,max:1},/shape is unsupported/],
    [{from:"targets",min:-1,max:1},/min must be a non-negative integer/],
    [{from:"targets",min:2,max:1},/max must be >= min/],
  ];
  for(const [selector,message] of invalid) {
    const definition=structuredClone(AUTHORED);
    definition.entryPoints[0].targeting=selector;
    assert.throws(()=>parseManualCommonPlayOperationDefinition(definition),message);
  }
});

test("invalid targeting is atomic and cannot reach downstream HP mutation",()=>{
  const definition=parseManualCommonPlayOperationDefinition(AUTHORED);
  const multipleState=runtimeState();
  multipleState.combatants.goblin.life.hp.current=5;
  const multiple=resolveCommonPlayEntryPointOperations(TEST_PROFILE,multipleState,definition,{
    resolutionId:"multiple-targets",
    actorId:"hero",
    entryPointId:"mend-other",
    targetId:"goblin",
    targetingTargets:[target("goblin","enemy"),target("hero","self")],
  });
  assert.equal(multiple.status,"rejected");
  assert.equal(multiple.state,multipleState);
  assert.equal(multipleState.combatants.goblin.life.hp.current,5);
  assert.deepEqual(multiple.events,[]);

  const missing=resolveCommonPlayEntryPointOperations(TEST_PROFILE,runtimeState(),definition,{
    resolutionId:"zero-targets",
    actorId:"hero",
    entryPointId:"mend-other",
    targetingTargets:[],
  });
  assert.equal(missing.status,"rejected");
  if(missing.status==="rejected") assert.match(missing.error,/targeting selector rejected: selector requires 1-1 result/);

  const nonexistentState=runtimeState();
  const nonexistent=resolveCommonPlayEntryPointOperations(TEST_PROFILE,nonexistentState,definition,{
    resolutionId:"nonexistent-target",
    actorId:"hero",
    entryPointId:"mend-other",
    targetId:"ghost",
    targetingTargets:[target("ghost","neutral")],
  });
  assert.equal(nonexistent.status,"rejected");
  if(nonexistent.status==="rejected") assert.match(nonexistent.error,/combatant not found: ghost/);
  assert.equal(nonexistentState.revision,0);

  const unavailableState=runtimeState();
  unavailableState.combatants.goblin.life.hp.current=5;
  unavailableState.effects.push(createEffect({
    id:"unavailable-goblin",
    sourceId:"external:test",
    targetId:"goblin",
    kind:"marker",
    tags:["runtime:temporarily-unavailable-target"],
    duration:{kind:"permanent"},
  },unavailableState.clock));
  const unavailable=resolveCommonPlayEntryPointOperations(TEST_PROFILE,unavailableState,definition,{
    resolutionId:"unavailable-target",
    actorId:"hero",
    entryPointId:"mend-other",
    targetId:"goblin",
    targetingTargets:[target("goblin","enemy")],
  });
  assert.equal(unavailable.status,"rejected");
  if(unavailable.status==="rejected") assert.match(unavailable.error,/temporarily unavailable/);
  assert.equal(unavailableState.combatants.goblin.life.hp.current,5);
});
