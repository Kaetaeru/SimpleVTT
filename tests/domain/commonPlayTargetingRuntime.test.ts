import assert from "node:assert/strict";
import test from "node:test";
import { parseManualCommonPlayOperationDefinition, compileCommonPlayEntryPointOperations, resolveCommonPlayEntryPointOperations } from "../../src/domain/commonPlayOperationRuntime";
import { TEST_PROFILE } from "./rulesTestState";
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
  assert.deepEqual(pending.operations.map((operation)=>operation.kind),["targeting","healing"]);
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
  const enemyState=runtimeState();
  enemyState.combatants.goblin.life.hp.current=5;
  const enemy=resolveCommonPlayEntryPointOperations(TEST_PROFILE,enemyState,definition,{
    resolutionId:"relation-enemy",actorId:"hero",entryPointId:"mend-other",targetId:"goblin",targetingTargets:[target("goblin","enemy")],
  });
  assert.equal(enemy.status,"committed");
  if(enemy.status==="committed") assert.equal(enemy.state.combatants.goblin.life.hp.current,10);
  const selfState=runtimeState();
  const self=resolveCommonPlayEntryPointOperations(TEST_PROFILE,selfState,definition,{
    resolutionId:"relation-self",actorId:"hero",entryPointId:"mend-other",targetId:"hero",targetingTargets:[target("hero","self")],
  });
  assert.equal(self.status,"rejected");
});

test("portable Common Play nested selector predicate evaluates authoritative target facts generically",()=>{
  const authored=structuredClone(AUTHORED);
  authored.entryPoints[0].targeting={from:"targets",min:1,max:1,where:{op:"all",args:[
    {op:"relation-matches",ref:"relation",value:"enemy"},
    {op:"eq",left:{ref:"visible"},right:{value:true}},
    {op:"lte",left:{ref:"distanceFeet"},right:{value:30}},
    {op:"ne",left:{ref:"cover"},right:{value:"total"}},
  ]}};
  const definition=parseManualCommonPlayOperationDefinition(authored);
  const accepted=resolveCommonPlayEntryPointOperations(TEST_PROFILE,runtimeState(),definition,{
    resolutionId:"nested-predicate-accepted",actorId:"hero",entryPointId:"mend-other",targetId:"goblin",
    targetingTargets:[{...target("goblin","enemy"),visible:true,distanceFeet:20,cover:"half"}],
  });
  assert.equal(accepted.status,"committed");
  const rejected=resolveCommonPlayEntryPointOperations(TEST_PROFILE,runtimeState(),definition,{
    resolutionId:"nested-predicate-rejected",actorId:"hero",entryPointId:"mend-other",targetId:"goblin",
    targetingTargets:[{...target("goblin","enemy"),visible:true,distanceFeet:40,cover:"half"}],
  });
  assert.equal(rejected.status,"rejected");
});

test("bounded Common Play selector preserves authored multi-target limits without fabricating spatial facts",()=>{
  const authored=structuredClone(AUTHORED);
  authored.entryPoints[0].targeting={from:"targets",min:1,max:2};
  authored.entryPoints[0].operations=[];
  const definition=parseManualCommonPlayOperationDefinition(authored);
  const pending=compileCommonPlayEntryPointOperations(TEST_PROFILE,runtimeState(),definition,{
    resolutionId:"multi-target",actorId:"hero",entryPointId:"mend-other",targetingTargets:[target("hero","self"),target("goblin","enemy")],
  });
  assert.equal(pending.operations[0]?.kind,"targeting");
  if(pending.operations[0]?.kind==="targeting") assert.deepEqual(pending.operations[0].targets,[target("hero","self"),target("goblin","enemy")]);
});

test("multi-target Common Play rejects a singular target effect until an explicit per-target contract exists",()=>{
  const authored=structuredClone(AUTHORED);
  authored.entryPoints[0].targeting={from:"targets",min:1,max:2};
  const definition=parseManualCommonPlayOperationDefinition(authored);
  assert.throws(()=>compileCommonPlayEntryPointOperations(TEST_PROFILE,runtimeState(),definition,{
    resolutionId:"ambiguous-multi-target",actorId:"hero",entryPointId:"mend-other",targetId:"goblin",targetingTargets:[target("hero","self"),target("goblin","enemy")],
  }),/multi-target Common Play cannot apply a singular target operation/);
});

test("bounded Common Play selector permits an authored zero minimum through the shared targeting Resolver",()=>{
  const authored=structuredClone(AUTHORED);
  authored.entryPoints[0].targeting={from:"targets",min:0,max:1};
  authored.entryPoints[0].operations=[];
  const definition=parseManualCommonPlayOperationDefinition(authored);
  const committed=resolveCommonPlayEntryPointOperations(TEST_PROFILE,runtimeState(),definition,{
    resolutionId:"optional-target",actorId:"hero",entryPointId:"mend-other",targetingTargets:[],
  });
  assert.equal(committed.status,"committed");
});

test("unsupported Common Play selector shapes reject explicitly",()=>{
  const cases:[unknown,RegExp][]=[
    [{from:"content",min:1,max:1},/from must be targets/],
    [{from:"actors",min:1,max:1},/from must be targets/],
    [{from:"artifacts",min:1,max:1},/from must be targets/],
    [{from:"targets",where:{value:true},min:1,max:1},/op is unsupported/],
    [{from:"targets",area:{kind:"instant"},min:1,max:1},/shape is unsupported/],
    [{from:"targets",min:-1,max:1},/min must be a non-negative integer/],
    [{from:"targets",min:2,max:1},/max must be >= min/],
  ];
  for(const [targeting,error] of cases) {
    const authored=structuredClone(AUTHORED);
    authored.entryPoints[0].targeting=targeting as any;
    assert.throws(()=>parseManualCommonPlayOperationDefinition(authored),error);
  }
});

test("invalid targeting is atomic and cannot reach downstream HP mutation",()=>{
  const authored=structuredClone(AUTHORED);
  authored.entryPoints[0].targeting={from:"targets",where:{op:"relation-matches",ref:"relation",value:"enemy"},min:1,max:1};
  const definition=parseManualCommonPlayOperationDefinition(authored);
  const state=runtimeState();
  const before=state.combatants.hero.life.hp.current;
  const rejected=resolveCommonPlayEntryPointOperations(TEST_PROFILE,state,definition,{
    resolutionId:"invalid-target",actorId:"hero",entryPointId:"mend-other",targetId:"hero",targetingTargets:[target("hero","self")],
  });
  assert.equal(rejected.status,"rejected");
  assert.equal(state.combatants.hero.life.hp.current,before);
});
