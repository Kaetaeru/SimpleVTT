import assert from "node:assert/strict";
import test from "node:test";
import { parseManualCommonPlayOperationDefinition, compileCommonPlayEntryPointOperations, resolveCommonPlayEntryPointOperations } from "../../src/domain/commonPlayOperationRuntime";
import { TEST_PROFILE } from "../../src/domain/testRulesProfile";
import { createRuntimeCombatant, createRulesRuntimeState } from "../../src/domain/combatState";

const AUTHORED={
  schemaVersion:"0.2",
  id:"external.targeting",
  payments:[],
  entryPoints:[{
    id:"mend-other",
    invocation:{kind:"manual"},
    interaction:null,
    targeting:{from:"targets",min:1,max:1},
    test:null,
    operations:[{kind:"healing.apply",amount:{value:5},target:"target"}],
  }],
};

function runtimeState(){
  const hero=createRuntimeCombatant({actorId:"hero",hp:{current:10,maximum:20}});
  const goblin=createRuntimeCombatant({actorId:"goblin",hp:{current:10,maximum:20}});
  return createRulesRuntimeState([hero,goblin],"hero");
}

function target(id:string,relation:"self"|"ally"|"enemy"|"neutral"){
  return {id,kind:"creature" as const,relation};
}

test("bounded Common Play selector lowers before downstream healing through the existing targeting Resolver",()=>{
  const definition=parseManualCommonPlayOperationDefinition(AUTHORED);
  const state=runtimeState();
  state.combatants.goblin.life.hp.current=5;
  const pending=compileCommonPlayEntryPointOperations(TEST_PROFILE,state,definition,{
    resolutionId:"external-targeting",
    actorId:"hero",
    entryPointId:"mend-other",
    targetId:"goblin",
    targetingTargets:[target("goblin","enemy")],
  });
  assert.equal(pending.operations[0]?.kind,"targeting");
  assert.equal(pending.operations[1]?.kind,"healing");
  const committed=resolveCommonPlayEntryPointOperations(TEST_PROFILE,state,definition,{
    resolutionId:"external-targeting",
    actorId:"hero",
    entryPointId:"mend-other",
    targetId:"goblin",
    targetingTargets:[target("goblin","enemy")],
  });
  assert.equal(committed.status,"committed");
  if(committed.status==="committed") assert.equal(committed.state.combatants.goblin.life.hp.current,10);
});

test("bounded Common Play selector accepts the acting actor as the pre-resolved target",()=>{
  const definition=parseManualCommonPlayOperationDefinition(AUTHORED);
  const state=runtimeState();
  state.combatants.hero.life.hp.current=10;
  const committed=resolveCommonPlayEntryPointOperations(TEST_PROFILE,state,definition,{
    resolutionId:"external-self-targeting",
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

test("portable Common Play nested selector predicate evaluates authoritative target facts generically",()=>{
  const authored=structuredClone(AUTHORED);
  authored.entryPoints[0].targeting={
    from:"targets",
    where:{op:"all",args:[
      {op:"relation-matches",ref:"relation",value:"enemy"},
      {op:"eq",left:{ref:"kind"},right:{value:"creature"}},
      {op:"not",arg:{op:"eq",left:{ref:"id"},right:{value:"hero"}}},
    ]},
    min:1,max:1,
  };
  const definition=parseManualCommonPlayOperationDefinition(authored);
  assert.deepEqual(definition.entryPoints[0].targeting,authored.entryPoints[0].targeting);

  const enemyState=runtimeState();
  enemyState.combatants.goblin.life.hp.current=5;
  const enemy=resolveCommonPlayEntryPointOperations(TEST_PROFILE,enemyState,definition,{
    resolutionId:"nested-enemy",actorId:"hero",entryPointId:"mend-other",targetId:"goblin",targetingTargets:[target("goblin","enemy")],
  });
  assert.equal(enemy.status,"committed");
  if(enemy.status==="committed") assert.equal(enemy.state.combatants.goblin.life.hp.current,10);

  const selfState=runtimeState();
  selfState.combatants.hero.life.hp.current=10;
  const self=resolveCommonPlayEntryPointOperations(TEST_PROFILE,selfState,definition,{
    resolutionId:"nested-self",actorId:"hero",entryPointId:"mend-other",targetId:"hero",targetingTargets:[target("hero","self")],
  });
  assert.equal(self.status,"rejected");
  if(self.status==="rejected") assert.match(self.error,/targeting selector rejected/);
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
  assert.equal(multipleState.combatants.goblin.life.hp.current,5);

  const missingState=runtimeState();
  missingState.combatants.goblin.life.hp.current=5;
  const missing=resolveCommonPlayEntryPointOperations(TEST_PROFILE,missingState,definition,{
    resolutionId:"missing-target",
    actorId:"hero",
    entryPointId:"mend-other",
    targetId:"goblin",
    targetingTargets:[],
  });
  assert.equal(missing.status,"rejected");
  assert.equal(missingState.combatants.goblin.life.hp.current,5);
});
