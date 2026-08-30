import fs from "node:fs";

function replaceOne(path,before,after) {
  let text=fs.readFileSync(path,"utf8");
  if(text.includes(after)) return;
  const index=text.indexOf(before);
  if(index<0) throw new Error(`pattern not found in ${path}: ${before.slice(0,120)}`);
  if(text.indexOf(before,index+before.length)>=0) throw new Error(`pattern not unique in ${path}: ${before.slice(0,120)}`);
  text=text.slice(0,index)+after+text.slice(index+before.length);
  fs.writeFileSync(path,text);
}

replaceOne(
  "src/domain/commonPlaySelectorRuntime.ts",
  'import { resolveTargeting, type TargetingFactInput, type TargetingResolution } from "./targeting";',
  'import { resolveTargeting, type TargetingFactInput, type TargetingResolution, type TargetingRule } from "./targeting";',
);
replaceOne(
  "src/domain/commonPlaySelectorRuntime.ts",
  '  selection:"manual"|"automatic";\n  authority:"actor-owner"|"dm"|"host"|"provider";\n}',
  '  selection:"manual"|"automatic";\n  authority:"actor-owner"|"dm"|"host"|"provider";\n  targetingRule?:Partial<TargetingRule>;\n}',
);
replaceOne(
  "src/domain/commonPlaySelectorRuntime.ts",
  '    const targeting=resolveTargeting(input.sourceId,{\n      kind:"any",minTargets:min,maxTargets:max,directTarget:!input.selector.area,\n    },selected.map((candidate)=>candidate.targeting!));',
  '    const targeting=resolveTargeting(input.sourceId,{\n      kind:"any",\n      ...input.targetingRule,\n      minTargets:min,\n      maxTargets:max,\n      directTarget:input.targetingRule?.directTarget??!input.selector.area,\n    },selected.map((candidate)=>candidate.targeting!));',
);

replaceOne(
  "src/domain/commonPlayOperationRuntime.ts",
  'import type { CommonPlayFactAnswer, CommonPlayFactQuery } from "./commonPlaySpatialFactRuntime";',
  'import type { CommonPlayFactAnswer, CommonPlayFactQuery } from "./commonPlaySpatialFactRuntime";\nimport { resolveCommonPlaySelector, type CommonPlaySelector } from "./commonPlaySelectorRuntime";',
);
replaceOne(
  "src/domain/commonPlayOperationRuntime.ts",
  'export interface CommonPlayTargetingSelector {\n  from:"targets";\n  min:number;\n  max:number;\n}',
  'export type CommonPlayTargetingSelector=CommonPlaySelector & {from:"targets";min:number;max:number};',
);
replaceOne(
  "src/domain/commonPlayOperationRuntime.ts",
  'const TARGETING_KEYS=new Set(["from","min","max"]);',
  'const TARGETING_KEYS=new Set(["from","where","min","max"]);',
);
replaceOne(
  "src/domain/commonPlayOperationRuntime.ts",
  'function parseTargetingSelector(value:unknown,label:string):CommonPlayTargetingSelector {\n  const selector=object(value,label);\n  supportedKeys(selector,TARGETING_KEYS,label);\n  if(selector.from!=="targets") throw new DomainEvaluationError(`${label}.from must be targets for portable Common Play targeting`);\n  if(!Number.isInteger(selector.min)||Number(selector.min)<1) throw new DomainEvaluationError(`${label}.min must be a positive integer for portable Common Play targeting`);\n  if(!Number.isInteger(selector.max)||Number(selector.max)<Number(selector.min)) throw new DomainEvaluationError(`${label}.max must be an integer >= min for portable Common Play targeting`);\n  return {from:"targets",min:Number(selector.min),max:Number(selector.max)};\n}',
  'function parseTargetingSelector(value:unknown,label:string):CommonPlayTargetingSelector {\n  const selector=object(value,label);\n  supportedKeys(selector,TARGETING_KEYS,label);\n  if(selector.from!=="targets") throw new DomainEvaluationError(`${label}.from must be targets for portable Common Play targeting`);\n  if(!Number.isInteger(selector.min)||Number(selector.min)<1) throw new DomainEvaluationError(`${label}.min must be a positive integer for portable Common Play targeting`);\n  if(!Number.isInteger(selector.max)||Number(selector.max)<Number(selector.min)) throw new DomainEvaluationError(`${label}.max must be an integer >= min for portable Common Play targeting`);\n  if(selector.where!==undefined&&typeof selector.where!=="boolean") object(selector.where,`${label}.where`);\n  return {\n    from:"targets",min:Number(selector.min),max:Number(selector.max),\n    ...(selector.where===undefined?{}:{where:structuredClone(selector.where) as CommonPlayTargetingSelector["where"]}),\n  };\n}',
);
replaceOne(
  "src/domain/commonPlayOperationRuntime.ts",
  '  if(entryPoint.targeting) {\n    if(!input.targetingTargets) throw new DomainEvaluationError(`Common Play entry point ${entryPoint.id} requires pre-resolved targeting facts`);\n    if(input.targetId!==undefined&&!input.targetingTargets.some((target)=>target.id===input.targetId)) {\n      throw new DomainEvaluationError("Common Play downstream target does not match the validated targeting selection");\n    }\n    operations.push({\n      id:`${input.resolutionId}:targeting`,\n      kind:"targeting",\n      sourceId:input.actorId,\n      rule:{kind:"creature",minTargets:entryPoint.targeting.min,maxTargets:entryPoint.targeting.max,directTarget:false},\n      targets:input.targetingTargets.map((target)=>({...target})),\n    });\n  }',
  '  if(entryPoint.targeting) {\n    if(!input.targetingTargets) throw new DomainEvaluationError(`Common Play entry point ${entryPoint.id} requires pre-resolved targeting facts`);\n    const candidates=input.targetingTargets.map((target)=>({\n      id:target.id,targeting:{...target},properties:{relation:target.relation,kind:target.kind},\n    }));\n    const selection=resolveCommonPlaySelector({\n      sourceId:input.actorId,selector:entryPoint.targeting,candidates,\n      selectedIds:input.targetingTargets.map((target)=>target.id),selection:"manual",authority:"actor-owner",\n      targetingRule:{directTarget:false},\n    });\n    if(selection.status!=="resolved") throw new DomainEvaluationError(`Common Play targeting ${selection.status}: ${selection.reason}`);\n    const targetFacts=selection.targetIds.map((id)=>{\n      const candidate=candidates.find((entry)=>entry.id===id);\n      if(!candidate?.targeting) throw new DomainEvaluationError(`Common Play targeting fact missing for selected target: ${id}`);\n      return {...candidate.targeting};\n    });\n    if(input.targetId!==undefined&&!selection.targetIds.includes(input.targetId)) {\n      throw new DomainEvaluationError("Common Play downstream target does not match the validated targeting selection");\n    }\n    operations.push({\n      id:`${input.resolutionId}:targeting`,kind:"targeting",sourceId:input.actorId,\n      rule:{kind:"creature",minTargets:entryPoint.targeting.min,maxTargets:entryPoint.targeting.max,directTarget:false},\n      targets:targetFacts,\n    });\n  }',
);

replaceOne(
  "tests/domain/commonPlayTargetingRuntime.test.ts",
  '    [{from:"targets",where:{value:true},min:1,max:1},/unsupported fields: where/],\n',
  '',
);
const targetingTest="tests/domain/commonPlayTargetingRuntime.test.ts";
let targetingText=fs.readFileSync(targetingTest,"utf8");
const insertion=`
test("Common Play relation selector filters pre-resolved targets through the generic selector runtime",()=>{
  const authored=structuredClone(AUTHORED);
  authored.entryPoints[0].targeting={from:"targets",min:1,max:2,where:{op:"relation-matches",ref:"relation",value:"enemy"}};
  authored.entryPoints[0].operations=[];
  const definition=parseManualCommonPlayOperationDefinition(authored);
  const state=runtimeState();
  state.combatants.orc=structuredClone(state.combatants.goblin);
  state.combatants.orc.id="orc";
  const committed=resolveCommonPlayEntryPointOperations(TEST_PROFILE,state,definition,{
    resolutionId:"relation-targeting",actorId:"hero",entryPointId:"mend-other",
    targetingTargets:[target("goblin","enemy"),target("orc","enemy")],
  });
  assert.equal(committed.status,"committed");
  if(committed.status==="committed") {
    assert.deepEqual((committed.results["relation-targeting:targeting"] as {targets:Array<{targetId:string}>}).targets.map((entry)=>entry.targetId),["goblin","orc"]);
  }
  const rejected=resolveCommonPlayEntryPointOperations(TEST_PROFILE,runtimeState(),definition,{
    resolutionId:"relation-targeting-reject",actorId:"hero",entryPointId:"mend-other",
    targetingTargets:[target("hero","self")],
  });
  assert.equal(rejected.status,"rejected");
  if(rejected.status==="rejected") assert.match(rejected.error,/ineligible target/);
});
`;
if(!targetingText.includes('test("Common Play relation selector filters pre-resolved targets through the generic selector runtime"')) {
  const anchor='\ntest("invalid targeting is atomic and cannot reach downstream HP mutation",()=>{';
  if(!targetingText.includes(anchor)) throw new Error("targeting test insertion anchor missing");
  targetingText=targetingText.replace(anchor,insertion+anchor);
  fs.writeFileSync(targetingTest,targetingText);
}

replaceOne(
  "tests/ui/installedCommonPlayProductionRuntime.test.ts",
  '            targeting:{from:"targets",min:1,max:1},',
  '            targeting:{\n              from:"targets",min:1,max:1,\n              where:{op:"any",args:[\n                {op:"relation-matches",ref:"relation",value:"self"},\n                {op:"relation-matches",ref:"relation",value:"enemy"},\n              ]},\n            },',
);
