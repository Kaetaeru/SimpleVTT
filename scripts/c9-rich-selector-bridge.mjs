import { readFileSync, writeFileSync } from "node:fs";

function replaceOne(path,before,after) {
  let text=readFileSync(path,"utf8");
  if(text.includes(after)) return;
  const first=text.indexOf(before);
  if(first<0) throw new Error(`pattern not found in ${path}: ${before.slice(0,120)}`);
  if(text.indexOf(before,first+before.length)>=0) throw new Error(`pattern not unique in ${path}: ${before.slice(0,120)}`);
  text=text.slice(0,first)+after+text.slice(first+before.length);
  writeFileSync(path,text);
}

function replaceRegex(path,pattern,after) {
  let text=readFileSync(path,"utf8");
  if(text.includes(after)) return;
  if(!pattern.test(text)) throw new Error(`regex pattern not found in ${path}: ${pattern}`);
  text=text.replace(pattern,after);
  writeFileSync(path,text);
}

replaceOne(
  "src/domain/commonPlaySelectorRuntime.ts",
  'import { resolveTargeting, type TargetingFactInput, type TargetingResolution } from "./targeting";',
  'import { resolveTargeting, type TargetingFactInput, type TargetingResolution, type TargetingRule } from "./targeting";'
);
replaceOne(
  "src/domain/commonPlaySelectorRuntime.ts",
  '  selection:"manual"|"automatic";\n  authority:"actor-owner"|"dm"|"host"|"provider";\n}',
  '  selection:"manual"|"automatic";\n  authority:"actor-owner"|"dm"|"host"|"provider";\n  targetingRule?:Partial<TargetingRule>;\n}'
);
replaceOne(
  "src/domain/commonPlaySelectorRuntime.ts",
  '    const targeting=resolveTargeting(input.sourceId,{\n      kind:"any",minTargets:min,maxTargets:max,directTarget:!input.selector.area,\n    },selected.map((candidate)=>candidate.targeting!));',
  '    const targeting=resolveTargeting(input.sourceId,{\n      kind:"any",\n      ...input.targetingRule,\n      minTargets:min,\n      maxTargets:max,\n      directTarget:input.targetingRule?.directTarget??!input.selector.area,\n    },selected.map((candidate)=>candidate.targeting!));'
);

replaceOne(
  "src/domain/commonPlayOperationRuntime.ts",
  'import type { CommonPlayFactAnswer, CommonPlayFactQuery } from "./commonPlaySpatialFactRuntime";',
  'import type { CommonPlayFactAnswer, CommonPlayFactQuery } from "./commonPlaySpatialFactRuntime";\nimport { resolveCommonPlaySelector, type CommonPlaySelector } from "./commonPlaySelectorRuntime";'
);
replaceOne(
  "src/domain/commonPlayOperationRuntime.ts",
  'export interface CommonPlayTargetingSelector {\n  from:"targets";\n  min:number;\n  max:number;\n}',
  'export type CommonPlayTargetingSelector=CommonPlaySelector & {from:"targets";min:number;max:number};'
);
replaceOne(
  "src/domain/commonPlayOperationRuntime.ts",
  'const TARGETING_KEYS=new Set(["from","min","max"]);',
  'const TARGETING_KEYS=new Set(["from","where","min","max","orderBy","area"]);'
);
replaceRegex(
  "src/domain/commonPlayOperationRuntime.ts",
  /function parseTargetingSelector\(value:unknown,label:string\):CommonPlayTargetingSelector \{[\s\S]*?\n\}\n\nfunction parsePayment/,
  `function parseTargetingSelector(value:unknown,label:string):CommonPlayTargetingSelector {
  const selector=object(value,label);
  supportedKeys(selector,TARGETING_KEYS,label);
  if(selector.from!=="targets") throw new DomainEvaluationError(\`${"${label}"}.from must be targets for portable Common Play targeting\`);
  if(!Number.isInteger(selector.min)||Number(selector.min)<1) throw new DomainEvaluationError(\`${"${label}"}.min must be a positive integer for portable Common Play targeting\`);
  if(!Number.isInteger(selector.max)||Number(selector.max)<Number(selector.min)) throw new DomainEvaluationError(\`${"${label}"}.max must be an integer >= min for portable Common Play targeting\`);
  if(selector.where!==undefined&&typeof selector.where!=="boolean") object(selector.where,\`${"${label}"}.where\`);
  const orderBy=selector.orderBy===undefined?undefined:nonEmptyString(selector.orderBy,\`${"${label}"}.orderBy\`);
  const area=selector.area===undefined?undefined:structuredClone(object(selector.area,\`${"${label}"}.area\`)) as CommonPlayTargetingSelector["area"];
  return {
    from:"targets",min:Number(selector.min),max:Number(selector.max),
    ...(selector.where===undefined?{}:{where:structuredClone(selector.where) as CommonPlayTargetingSelector["where"]}),
    ...(orderBy===undefined?{}:{orderBy}),
    ...(area===undefined?{}:{area}),
  };
}

function parsePayment`
);
replaceOne(
  "src/domain/commonPlayOperationRuntime.ts",
  '  if(entryPoint.targeting) {\n    if(!input.targetingTargets) throw new DomainEvaluationError(`Common Play entry point ${entryPoint.id} requires pre-resolved targeting facts`);\n    if(input.targetId!==undefined&&!input.targetingTargets.some((target)=>target.id===input.targetId)) {\n      throw new DomainEvaluationError("Common Play downstream target does not match the validated targeting selection");\n    }\n    operations.push({\n      id:`${input.resolutionId}:targeting`,\n      kind:"targeting",\n      sourceId:input.actorId,\n      rule:{kind:"creature",minTargets:entryPoint.targeting.min,maxTargets:entryPoint.targeting.max,directTarget:false},\n      targets:input.targetingTargets.map((target)=>({...target})),\n    });\n  }',
  '  if(entryPoint.targeting) {\n    if(!input.targetingTargets) throw new DomainEvaluationError(`Common Play entry point ${entryPoint.id} requires pre-resolved targeting facts`);\n    const candidates=input.targetingTargets.map((target)=>({\n      id:target.id,targeting:{...target},properties:{relation:target.relation,kind:target.kind},\n    }));\n    const selection=resolveCommonPlaySelector({\n      sourceId:input.actorId,selector:entryPoint.targeting,candidates,\n      selectedIds:input.targetingTargets.map((target)=>target.id),selection:"manual",authority:"actor-owner",\n      targetingRule:{directTarget:false},\n    });\n    if(selection.status!=="resolved") throw new DomainEvaluationError(`Common Play targeting ${selection.status}: ${selection.reason}`);\n    const targetFacts=selection.targetIds.map((id)=>{\n      const candidate=candidates.find((entry)=>entry.id===id);\n      if(!candidate?.targeting) throw new DomainEvaluationError(`Common Play targeting fact missing for selected target: ${id}`);\n      return {...candidate.targeting};\n    });\n    if(input.targetId!==undefined&&!selection.targetIds.includes(input.targetId)) {\n      throw new DomainEvaluationError("Common Play downstream target does not match the validated targeting selection");\n    }\n    operations.push({\n      id:`${input.resolutionId}:targeting`,kind:"targeting",sourceId:input.actorId,\n      rule:{kind:"any",minTargets:entryPoint.targeting.min,maxTargets:entryPoint.targeting.max,directTarget:false},\n      targets:targetFacts,\n    });\n  }'
);

replaceOne(
  "tests/domain/commonPlayTargetingRuntime.test.ts",
  '  assert.deepEqual(targeting.rule,{kind:"creature",minTargets:1,maxTargets:2,directTarget:false});',
  '  assert.deepEqual(targeting.rule,{kind:"any",minTargets:1,maxTargets:2,directTarget:false});'
);
replaceRegex(
  "tests/domain/commonPlayTargetingRuntime.test.ts",
  /test\("unsupported Common Play selector shapes reject explicitly",\(\)=>\{[\s\S]*?\n\}\);\n\ntest\("invalid targeting is atomic/,
  `test("Common Play targeting selector rejects non-target domains and invalid bounds",()=>{
  const invalid:Array<[Record<string,unknown>,RegExp]>=[
    [{from:"actors",min:1,max:1},/from must be targets/],
    [{from:"artifacts",min:1,max:1},/from must be targets/],
    [{from:"targets",min:0,max:1},/min must be a positive integer/],
    [{from:"targets",min:2,max:1},/max must be an integer >= min/],
    [{from:"targets",min:1,max:2,orderBy:""},/orderBy must be a non-empty string/],
  ];
  for(const [selector,message] of invalid) {
    const definition=structuredClone(AUTHORED);
    definition.entryPoints[0].targeting=selector;
    assert.throws(()=>parseManualCommonPlayOperationDefinition(definition),message);
  }
});

test("rich Common Play target selector filters selected identities through the generic selector runtime",()=>{
  const authored=structuredClone(AUTHORED);
  authored.entryPoints[0].targeting={from:"targets",min:1,max:2,orderBy:"id",where:{op:"relation-matches",ref:"relation",value:"enemy"}};
  authored.entryPoints[0].operations=[];
  const definition=parseManualCommonPlayOperationDefinition(authored);
  const committed=resolveCommonPlayEntryPointOperations(TEST_PROFILE,runtimeState(),definition,{
    resolutionId:"rich-targeting",actorId:"hero",entryPointId:"mend-other",
    targetingTargets:[target("goblin","enemy")],
  });
  assert.equal(committed.status,"committed");
  if(committed.status==="committed") {
    assert.deepEqual((committed.results["rich-targeting:targeting"] as {targets:Array<{targetId:string}>}).targets.map((entry)=>entry.targetId),["goblin"]);
  }
  const rejected=resolveCommonPlayEntryPointOperations(TEST_PROFILE,runtimeState(),definition,{
    resolutionId:"rich-targeting-ineligible",actorId:"hero",entryPointId:"mend-other",
    targetingTargets:[target("hero","self")],
  });
  assert.equal(rejected.status,"rejected");
  if(rejected.status==="rejected") assert.match(rejected.error,/ineligible target/);
});

test("Common Play area selector refuses to fabricate missing membership authority",()=>{
  const authored=structuredClone(AUTHORED);
  authored.entryPoints[0].targeting={from:"targets",min:1,max:2,area:{kind:"instant",shape:"sphere",origin:"point",radiusFeet:10}};
  authored.entryPoints[0].operations=[];
  const rejected=resolveCommonPlayEntryPointOperations(TEST_PROFILE,runtimeState(),parseManualCommonPlayOperationDefinition(authored),{
    resolutionId:"area-targeting",actorId:"hero",entryPointId:"mend-other",targetingTargets:[target("goblin","enemy")],
  });
  assert.equal(rejected.status,"rejected");
  if(rejected.status==="rejected") assert.match(rejected.error,/area membership requires a spatial provider or explicit authority answer/);
});

test("invalid targeting is atomic`
);

replaceOne(
  "tests/ui/installedCommonPlayProductionRuntime.test.ts",
  '            targeting:{from:"targets",min:1,max:1},',
  '            targeting:{\n              from:"targets",min:1,max:1,orderBy:"id",\n              where:{op:"any",args:[\n                {op:"relation-matches",ref:"relation",value:"self"},\n                {op:"relation-matches",ref:"relation",value:"enemy"},\n              ]},\n            },'
);
