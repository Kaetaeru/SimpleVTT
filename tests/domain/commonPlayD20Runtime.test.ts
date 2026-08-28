import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseManualCommonPlayOperationDefinition, resolveCommonPlayEntryPointOperations } from "../../src/domain/commonPlayOperationRuntime";
import { resolveD20Test } from "../../src/domain/d20";
import { TEST_PROFILE, runtimeState } from "./rulesTestState";

const AUTHORED=JSON.parse(readFileSync(new URL("../fixtures/play-contract/generic-d20-action.json",import.meta.url),"utf8"));

function execute(definition=AUTHORED,faces=[17,4]) {
  const state=runtimeState();
  const parsed=parseManualCommonPlayOperationDefinition(definition);
  return resolveCommonPlayEntryPointOperations(TEST_PROFILE,state,parsed,{
    resolutionId:"external-d20-resolution",
    actorId:"hero",
    entryPointId:"attempt",
    d20:{faces,modifierContributions:[{source:"external:test-modifier",value:2}]},
  });
}

test("authored Common Play d20 lowers to the existing generic Resolver semantics",()=>{
  const committed=execute();
  assert.equal(committed.status,"committed");
  if(committed.status!=="committed")return;
  const result=committed.results["external-d20-resolution:test"];
  const direct=resolveD20Test(TEST_PROFILE,{
    family:"ability-check",target:15,
    modifierContributions:[{source:"external:test-modifier",value:2}],
    dice:{id:"external-d20-resolution:d20",purpose:"common-play:external.unknown.generic-d20-action:attempt:ability-check",sides:20,faces:[17,4]},
    targetSource:"common-play:external.unknown.generic-d20-action:attempt:dc",
  });
  assert.deepEqual(result,direct);
  assert.equal(committed.events[0]?.kind,"d20");
});

test("Common Play d20 mechanics are invariant under definition rename",()=>{
  const renamed=structuredClone(AUTHORED);
  renamed.id="external.previously-unseen.renamed-d20";
  const original=execute();
  const changed=execute(renamed);
  assert.equal(original.status,"committed");
  assert.equal(changed.status,"committed");
  if(original.status!=="committed"||changed.status!=="committed")return;
  const mechanical=(value:typeof original)=>{
    const result=value.results["external-d20-resolution:test"] as {family:string;natural:number;modifier:number;total:number;target:number;outcome:string;critical:boolean};
    return {family:result.family,natural:result.natural,modifier:result.modifier,total:result.total,target:result.target,outcome:result.outcome,critical:result.critical};
  };
  assert.deepEqual(mechanical(changed),mechanical(original));
});

test("Common Play d20 lowers every existing generic test family and preserves failure outcomes",()=>{
  for(const family of ["ability-check","saving-throw","attack-roll"] as const) {
    const definition=structuredClone(AUTHORED);
    definition.entryPoints[0].test.kind=family;
    const committed=execute(definition,[2,19]);
    assert.equal(committed.status,"committed");
    if(committed.status!=="committed")continue;
    const result=committed.results["external-d20-resolution:test"] as {family:string;outcome:string;natural:number;total:number};
    assert.deepEqual({family:result.family,outcome:result.outcome,natural:result.natural,total:result.total},{family,outcome:"failure",natural:2,total:4});
  }
});

test("portable Common Play d20 rejects unsupported or malformed authored payloads",()=>{
  for(const [patch,message] of [
    [{roller:"target"},/roller must be actor/],
    [{dc:{value:15.5}},/finite integer literal/],
    [{property:"str"},/property-backed modifiers are not supported/],
  ] as const) {
    const invalid=structuredClone(AUTHORED);
    Object.assign(invalid.entryPoints[0].test,patch);
    assert.throws(()=>parseManualCommonPlayOperationDefinition(invalid),message);
  }
});

test("generic roll.modify operations recalculate one authoritative d20 result",()=>{
  const definition=structuredClone(AUTHORED);
  definition.entryPoints[0].operations=[
    {kind:"roll.modify",mode:"advantage"},
    {kind:"roll.modify",mode:"reroll",dice:"1d20"},
    {kind:"roll.modify",mode:"minimum",value:{value:10}},
    {kind:"roll.modify",mode:"replace",value:{value:12}},
    {kind:"roll.modify",mode:"add-flat",value:{value:2}},
    {kind:"roll.modify",mode:"add-die",dice:"1d4+1"},
    {kind:"roll.modify",mode:"target-add",value:{value:1}},
  ];
  const state=runtimeState();
  const parsed=parseManualCommonPlayOperationDefinition(definition);
  const committed=resolveCommonPlayEntryPointOperations(TEST_PROFILE,state,parsed,{
    resolutionId:"generic-roll-modifiers",
    actorId:"hero",
    entryPointId:"attempt",
    d20:{
      faces:[2,19],
      modifierContributions:[{source:"actor:ability",value:2}],
      modifierDiceFaces:{1:[8,18],5:[3]},
    },
  });
  assert.equal(committed.status,"committed");
  if(committed.status!=="committed") return;
  const result=committed.results["generic-roll-modifiers:test"] as {rollState:string;natural:number;modifier:number;total:number;target:number;outcome:string;provenance:Array<{source:string}>};
  assert.deepEqual(
    {rollState:result.rollState,natural:result.natural,modifier:result.modifier,total:result.total,target:result.target,outcome:result.outcome},
    {rollState:"advantage",natural:12,modifier:8,total:20,target:16,outcome:"success"},
  );
  assert.ok(result.provenance.some((entry)=>entry.source.endsWith(":operation:1")),"reroll provenance retained");
  assert.ok(result.provenance.some((entry)=>entry.source.endsWith(":operation:5")),"additional die provenance retained");
});

test("roll.modify semantics are structural and reject missing authority before commit",()=>{
  const definition=structuredClone(AUTHORED);
  definition.id="external.unknown.renamed-roll-modifier";
  definition.entryPoints[0].operations=[{kind:"roll.modify",mode:"reroll",dice:"1d20"}];
  const state=runtimeState();
  const parsed=parseManualCommonPlayOperationDefinition(definition);
  const rejected=resolveCommonPlayEntryPointOperations(TEST_PROFILE,state,parsed,{
    resolutionId:"missing-reroll-authority",actorId:"hero",entryPointId:"attempt",d20:{faces:[20]},
  });
  assert.equal(rejected.status,"rejected");
  assert.match(rejected.status==="rejected"?rejected.error:"",/requires authoritative die face/);
  assert.equal(rejected.state.revision,state.revision);
});
