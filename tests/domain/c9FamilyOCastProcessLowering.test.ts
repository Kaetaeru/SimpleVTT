import assert from "node:assert/strict";
import test from "node:test";
import { lowerCommonPlay, parseCommonPlayDefinition } from "../../src/domain/commonPlayDefinitionRuntime";

test("portable cast process metadata survives structural Common Play lowering",()=>{
  const castProcess={concentrationRequired:true,requiredSeconds:60};
  const definition=parseCommonPlayDefinition({
    schemaVersion:"0.2-draft",
    id:"external.unknown.long-cast-probe",
    castProcess,
    entryPoints:[{
      id:"cast",
      invocation:"manual",
      test:{kind:"ability-check",roller:"actor",dc:{value:15}},
      operations:[],
    }],
  });

  const lowered=lowerCommonPlay(definition,"cast");
  assert.deepEqual((lowered.definition as {castProcess?:unknown}).castProcess,castProcess);

  definition.castProcess!.requiredSeconds=600;
  assert.deepEqual((lowered.definition as {castProcess?:unknown}).castProcess,{concentrationRequired:true,requiredSeconds:60});
});
