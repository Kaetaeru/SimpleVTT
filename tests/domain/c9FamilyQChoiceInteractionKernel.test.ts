import assert from "node:assert/strict";
import test from "node:test";
import {
  compileCommonPlayEntryPointOperations,
  parseManualCommonPlayOperationDefinition,
} from "../../src/domain/commonPlayOperationRuntime";
import type { CommonPlaySelectorCandidate } from "../../src/domain/commonPlaySelectorRuntime";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

const candidates:CommonPlaySelectorCandidate[]=[
  {id:"orc",targeting:{id:"orc",kind:"creature",relation:"enemy",cover:"none"},properties:{relation:"enemy",initiative:12}},
  {id:"goblin",targeting:{id:"goblin",kind:"creature",relation:"enemy",cover:"none"},properties:{relation:"enemy",initiative:18}},
  {id:"hero",targeting:{id:"hero",kind:"creature",relation:"self",cover:"none"},properties:{relation:"self",initiative:20}},
];

function definition(responder:"actor-owner"|"target-owner"="actor-owner") {
  return parseManualCommonPlayOperationDefinition({
    schemaVersion:"0.2-draft",
    id:"external.generic-choice",
    payments:[{kind:"economy",bucket:"reaction",amount:{value:1},consumeAt:"commit",refundOnCancel:true}],
    entryPoints:[{
      id:"choose",
      invocation:"manual",
      interaction:{
        id:"choose-enemies",
        kind:"choice",
        responder,
        mode:"blocking",
        input:{
          type:"choice",
          selector:{
            from:"targets",
            where:{op:"relation-matches",ref:"relation",value:"enemy"},
            min:1,
            max:2,
            orderBy:"initiative",
            selection:"manual",
          },
        },
        revalidate:"always",
      },
      operations:[{kind:"healing.apply",amount:{value:1},target:"actor"}],
    }],
  });
}

function input(selectedIds:string[], interactionId="choose-enemies") {
  return {
    resolutionId:"choice-kernel",
    actorId:"hero",
    entryPointId:"choose",
    targetingCandidates:candidates,
    interactionResponse:{interactionId,selectedIds},
  };
}

test("schema-defined manual choice parses through the portable Common Play runtime",()=>{
  const parsed=definition();
  assert.equal(parsed.entryPoints[0].interaction?.kind,"choice");
  if(parsed.entryPoints[0].interaction?.kind!=="choice") return;
  assert.equal(parsed.entryPoints[0].interaction.input.type,"choice");
  assert.deepEqual(parsed.entryPoints[0].interaction.input.selector,{from:"targets",where:{op:"relation-matches",ref:"relation",value:"enemy"},min:1,max:2,orderBy:"initiative",selection:"manual"});
});

test("valid multiple-option choice gates Reaction payment and downstream operations deterministically",()=>{
  const pending=compileCommonPlayEntryPointOperations(TEST_PROFILE,runtimeState(),definition(),input(["goblin","orc"]));
  assert.deepEqual(pending.operations.map((operation)=>operation.kind),["use-economy","healing"]);
});

test("choice rejects missing, duplicate, ineligible, excessive, and mismatched selections before commit",()=>{
  const parsed=definition();
  const state=runtimeState();
  assert.throws(()=>compileCommonPlayEntryPointOperations(TEST_PROFILE,state,parsed,{...input(["orc"]),interactionResponse:undefined}),/requires interaction authorization/);
  assert.throws(()=>compileCommonPlayEntryPointOperations(TEST_PROFILE,state,parsed,input(["orc"],"wrong")),/identity mismatch/);
  assert.throws(()=>compileCommonPlayEntryPointOperations(TEST_PROFILE,state,parsed,input(["orc","orc"])),/duplicate/);
  assert.throws(()=>compileCommonPlayEntryPointOperations(TEST_PROFILE,state,parsed,input(["hero"])),/ineligible/);
  assert.throws(()=>compileCommonPlayEntryPointOperations(TEST_PROFILE,state,parsed,input(["orc","goblin","hero"])),/ineligible|requires 1-2/);
});

test("target-owner choice records target-owner selector authority without a second execution engine",()=>{
  const pending=compileCommonPlayEntryPointOperations(TEST_PROFILE,runtimeState(),definition("target-owner"),input(["orc"]));
  assert.deepEqual(pending.operations.map((operation)=>operation.kind),["use-economy","healing"]);
});

test("automatic selector is rejected for an interactive choice while omitted selection defaults to manual execution",()=>{
  const base=JSON.parse(JSON.stringify(definition())) as any;
  base.entryPoints[0].interaction.input.selector.selection="automatic";
  assert.throws(()=>parseManualCommonPlayOperationDefinition(base),/must be manual/);
  delete base.entryPoints[0].interaction.input.selector.selection;
  const parsed=parseManualCommonPlayOperationDefinition(base);
  const pending=compileCommonPlayEntryPointOperations(TEST_PROFILE,runtimeState(),parsed,input(["orc"]));
  assert.deepEqual(pending.operations.map((operation)=>operation.kind),["use-economy","healing"]);
});
