import assert from "node:assert/strict";
import test from "node:test";
import { SIMPLEVTT_APP_RULES_PROFILE } from "../../src/app/simpleVttAppRulesProfile";
import type { RulesRuntimeState } from "../../src/domain/combatState";
import {
  compileCommonPlayEntryPointOperations,
  parseManualCommonPlayOperationDefinition,
  resolveCommonPlayEntryPointOperations,
} from "../../src/domain/commonPlayOperationRuntime";
import type { TargetingFactInput } from "../../src/domain/targeting";

const TEST_PROFILE=SIMPLEVTT_APP_RULES_PROFILE;

function runtimeState():RulesRuntimeState {
  return {
    revision:0,
    sessionId:"common-play-targeting",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},
    clock:{round:1,turn:1,activeActorId:"hero"},
    combatants:{
      hero:{
        id:"hero",name:"Hero",
        life:{hp:{current:10,max:20},deathSaves:{successes:0,failures:0},defeated:false},
        conditions:[],resources:[],actionEconomy:{actionAvailable:true,bonusActionAvailable:true,reactionAvailable:true},
      },
      goblin:{
        id:"goblin",name:"Goblin",
        life:{hp:{current:5,max:10},deathSaves:{successes:0,failures:0},defeated:false},
        conditions:[],resources:[],actionEconomy:{actionAvailable:true,bonusActionAvailable:true,reactionAvailable:true},
      },
    },
    effects:[],
  };
}

function target(id:string,relation:TargetingFactInput["relation"]):TargetingFactInput {
  return {id,kind:"creature",relation};
}

const AUTHORED={
  schemaVersion:"0.2-draft" as const,
  id:"external.targeting-probe",
  entryPoints:[{
    id:"mend-other",
    invocation:"manual" as const,
    targeting:{from:"targets" as const,min:1,max:1},
    operations:[{kind:"healing.apply" as const,amount:{value:5},target:"target" as const}],
  }],
};

test("bounded Common Play selector lowers before downstream healing through the existing targeting Resolver",()=>{
  const definition=parseManualCommonPlayOperationDefinition(AUTHORED);
  const state=runtimeState();
  const committed=resolveCommonPlayEntryPointOperations(TEST_PROFILE,state,definition,{
    resolutionId:"bounded-targeting",actorId:"hero",entryPointId:"mend-other",targetId:"goblin",targetingTargets:[target("goblin","enemy")],
  });
  assert.equal(committed.status,"committed");
  if(committed.status==="committed") assert.equal(committed.state.combatants.goblin.life.hp.current,10);
});

test("bounded Common Play selector accepts the acting actor as the pre-resolved target",()=>{
  const definition=parseManualCommonPlayOperationDefinition(AUTHORED);
  const state=runtimeState();
  const committed=resolveCommonPlayEntryPointOperations(TEST_PROFILE,state,definition,{
    resolutionId:"self-targeting",actorId:"hero",entryPointId:"mend-other",targetId:"hero",targetingTargets:[target("hero","self")],
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
    from:"targets",min:1,max:1,
    where:{op:"all",args:[
      {op:"relation-matches",ref:"relation",value:"enemy"},
      {op:"eq",left:{ref:"visible"},right:{value:true}},
      {op:"lte",left:{ref:"distanceFeet"},right:{value:30}},
      {op:"ne",left:{ref:"cover"},right:{value:"total"}},
    ]},
  };
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
  unavailableState.effects.push({
    id:"unavailable-goblin",sourceId:"external:test",targetId:"goblin",kind:"marker",tags:["runtime:temporarily-unavailable-target"],
    duration:{kind:"permanent"},createdAt:{round:1,turn:1},
  });
  const unavailable=resolveCommonPlayEntryPointOperations(TEST_PROFILE,unavailableState,definition,{
    resolutionId:"unavailable-target",
    actorId:"hero",entryPointId:"mend-other",targetId:"goblin",targetingTargets:[target("goblin","enemy")],
  });
  assert.equal(unavailable.status,"rejected");
  assert.equal(unavailableState.combatants.goblin.life.hp.current,5);
});
