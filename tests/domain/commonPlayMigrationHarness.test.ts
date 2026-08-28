import assert from "node:assert/strict";
import test from "node:test";
import { assertCommonPlayMigrationParity } from "./commonPlayMigrationHarness";

interface AuthoringFixture {
  schemaVersion:"0.2-draft";
  id:string;
  operations:Array<{
    kind:"resource.change";
    resource:string;
    amount:{ value:number };
  }>;
}

interface NormalizedFixture {
  schemaVersion:"0.2-draft";
  id:string;
  operations:Array<{
    kind:"resource.change";
    resource:string;
    delta:number;
  }>;
}

function fixture(id:string):AuthoringFixture {
  return {
    schemaVersion:"0.2-draft",
    id,
    operations:[{
      kind:"resource.change",
      resource:"resource.generic.test",
      amount:{ value:-1 },
    }],
  };
}

function normalize(value:AuthoringFixture):NormalizedFixture {
  assert.equal(value.schemaVersion,"0.2-draft");
  assert.equal(value.operations.length,1);
  const operation=value.operations[0];
  assert.equal(operation.kind,"resource.change");
  assert.equal(Number.isFinite(operation.amount.value),true);
  return {
    schemaVersion:value.schemaVersion,
    id:value.id,
    operations:[{
      kind:operation.kind,
      resource:operation.resource,
      delta:operation.amount.value,
    }],
  };
}

test("migration harness compares legacy behavior with canonical, external-id, and rename-only generic variants", async () => {
  const normalizedIds:string[]=[];
  const executedIds:string[]=[];
  const result=await assertCommonPlayMigrationParity({
    fixtures:{
      canonical:fixture("feature.reference"),
      external:fixture("module.third-party.feature"),
      renamed:fixture("feature.reference-renamed"),
    },
    identifyAuthoring:(value)=>value.id,
    identifyNormalized:(value)=>value.id,
    normalize:(value)=>{
      const normalized=normalize(value);
      normalizedIds.push(normalized.id);
      return normalized;
    },
    runLegacy:()=>({ resource:1, revision:4 }),
    runGeneric:(value)=>{
      executedIds.push(value.id);
      return {
        resource:2+value.operations[0].delta,
        revision:4,
        sourceId:value.id,
      };
    },
    projectLegacy:(value)=>({ resource:value.resource, revision:value.revision }),
    projectGeneric:(value)=>({ resource:value.resource, revision:value.revision }),
  });

  assert.deepEqual(normalizedIds,["feature.reference","module.third-party.feature","feature.reference-renamed"]);
  assert.deepEqual(executedIds,normalizedIds);
  assert.equal(result.variants.length,3);
});

test("migration harness rejects fixtures that do not actually vary content identity", async () => {
  await assert.rejects(
    assertCommonPlayMigrationParity({
      fixtures:{
        canonical:fixture("feature.same"),
        external:fixture("feature.same"),
        renamed:fixture("feature.same"),
      },
      identifyAuthoring:(value)=>value.id,
      identifyNormalized:(value)=>value.id,
      normalize,
      runLegacy:()=>({ resource:1 }),
      runGeneric:()=>({ resource:1 }),
      projectLegacy:(value)=>value,
      projectGeneric:(value)=>value,
    }),
    /three distinct content identities/,
  );
});
