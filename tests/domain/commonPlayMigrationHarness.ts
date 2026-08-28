import assert from "node:assert/strict";

type Awaitable<T> = T | Promise<T>;

export interface CommonPlayMigrationFixtureSet<TAuthoring> {
  canonical:TAuthoring;
  external:TAuthoring;
  renamed:TAuthoring;
}

export interface CommonPlayMigrationHarnessInput<TAuthoring,TNormalized,TLegacyResult,TGenericResult,TProjection> {
  fixtures:CommonPlayMigrationFixtureSet<TAuthoring>;
  identifyAuthoring:(value:TAuthoring)=>string;
  identifyNormalized:(value:TNormalized)=>string;
  normalize:(value:TAuthoring)=>Awaitable<TNormalized>;
  runLegacy:()=>Awaitable<TLegacyResult>;
  runGeneric:(value:TNormalized)=>Awaitable<TGenericResult>;
  projectLegacy:(value:TLegacyResult)=>TProjection;
  projectGeneric:(value:TGenericResult)=>TProjection;
}

export interface CommonPlayMigrationHarnessResult<TNormalized,TLegacyResult,TGenericResult> {
  legacy:TLegacyResult;
  variants:Array<{
    label:keyof CommonPlayMigrationFixtureSet<unknown>;
    normalized:TNormalized;
    result:TGenericResult;
  }>;
}

export async function assertCommonPlayMigrationParity<
  TAuthoring,
  TNormalized,
  TLegacyResult,
  TGenericResult,
  TProjection,
>(input:CommonPlayMigrationHarnessInput<TAuthoring,TNormalized,TLegacyResult,TGenericResult,TProjection>) {
  const authoringIdentities=[
    input.identifyAuthoring(input.fixtures.canonical),
    input.identifyAuthoring(input.fixtures.external),
    input.identifyAuthoring(input.fixtures.renamed),
  ];
  assert.equal(new Set(authoringIdentities).size,3,"migration fixtures must use three distinct content identities");

  const legacy=await input.runLegacy();
  const expected=input.projectLegacy(legacy);
  const variants:CommonPlayMigrationHarnessResult<TNormalized,TLegacyResult,TGenericResult>["variants"]=[];

  for (const label of ["canonical","external","renamed"] as const) {
    const authoring=input.fixtures[label];
    const normalized=await input.normalize(authoring);
    assert.equal(
      input.identifyNormalized(normalized),
      input.identifyAuthoring(authoring),
      `${label} normalization must preserve content identity as data`,
    );
    const result=await input.runGeneric(normalized);
    assert.deepEqual(
      input.projectGeneric(result),
      expected,
      `${label} generic execution must match the legacy semantic projection`,
    );
    variants.push({ label, normalized, result });
  }

  return { legacy, variants } satisfies CommonPlayMigrationHarnessResult<TNormalized,TLegacyResult,TGenericResult>;
}
