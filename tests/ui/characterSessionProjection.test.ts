import assert from "node:assert/strict";
import test from "node:test";
import type { CatalogEntry, CharacterSheet } from "../../src/app/contracts";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import {
  buildCharacterSessionProjectionV1,
  parseCharacterSessionProjectionV1,
} from "../../src/app/characterSessionProjection";

const SOURCE_ID="dnd.srd-5.2.1";
const CONTENT_VERSION="2024";

type ResolvedEntry=CatalogEntry & { contentId:string; sourceId:string };

function catalogEntry(
  contentId:string,
  category:CatalogEntry["category"],
  nameKo:string,
  nameEn:string,
  version=CONTENT_VERSION,
):ResolvedEntry {
  return {
    id:catalogQualifiedId(contentId,SOURCE_ID,version),
    contentId,
    sourceId:SOURCE_ID,
    category,
    nameKo,
    nameEn,
    scope:"builtin",
    source:"SRD 5.2.1",
    version,
    description:"test",
    relationships:[],
    capabilities:[],
  };
}

const catalog:CatalogEntry[]=[
  catalogEntry("dnd.srd521.class.fighter","class","파이터","Fighter"),
  catalogEntry("dnd.srd521.species.human","species","인간","Human"),
  catalogEntry("dnd.srd521.background.soldier","background","군인","Soldier"),
];

function character(overrides:Partial<CharacterSheet>={}):CharacterSheet {
  return {
    id:"char.phase13.custom",
    name:"Phase 13 Custom",
    className:"파이터",
    level:1,
    species:"인간",
    background:"군인",
    hp:12,
    maxHp:12,
    ac:17,
    saveState:"saved",
    proficiencyBonus:2,
    speed:30,
    tempHp:0,
    abilities:{str:16,dex:14,con:14,int:10,wis:12,cha:8},
    saves:["str","con"],
    skills:["운동","지각"],
    features:[],
    equipment:[],
    items:[],
    resources:[],
    attacks:[{id:"client.attack.fake",name:"Client Presented Attack",bonus:99,damage:"99d99"}],
    rulesProfileId:"dnd.srd-5.2.1",
    rulesProfileVersion:"0.1-draft",
    sourceRevision:7,
    runtimeRevision:11,
    ...overrides,
  };
}

test("Phase 13 projection carries declarative source/runtime plus source-owned max HP and qualified identities", () => {
  const projection=buildCharacterSessionProjectionV1(character(),catalog);
  assert.equal(projection.characterId,"char.phase13.custom");
  assert.equal(projection.sourceRevision,7);
  assert.equal(projection.runtimeRevision,11);
  assert.equal("materializedCache" in projection,false);
  assert.equal("ac" in projection.source,false);
  assert.equal("attacks" in projection.source,false);
  assert.equal("maxHp" in projection.source,false);
  assert.deepEqual(projection.sourceAuthority,{maxHp:12});
  assert.equal(projection.contentIdentities.length,3);
  assert.deepEqual(
    projection.contentIdentities.map((identity)=>identity.category).sort(),
    ["background","class","species"],
  );
  for (const identity of projection.contentIdentities) {
    assert.deepEqual(Object.keys(identity).sort(),["category","contentId","qualifiedId","sourceId","version"]);
  }
});

test("Phase 13 host accepts the projection only when its canonical catalog resolves the exact identities", () => {
  const projection=buildCharacterSessionProjectionV1(character(),catalog);
  const accepted=parseCharacterSessionProjectionV1(projection,catalog);
  assert.equal(accepted.status,"accepted");

  const missingBackground=catalog.filter((entry)=>entry.category!=="background");
  const missing=parseCharacterSessionProjectionV1(projection,missingBackground);
  assert.equal(missing.status,"rejected");
  if (missing.status==="rejected") assert.match(missing.error,/missing projected content|missing canonical host\/client content/);

  const mismatchedVersion=catalog.map((entry)=>entry.category==="class"
    ? catalogEntry("dnd.srd521.class.fighter","class","파이터","Fighter","2024.1")
    : entry);
  const mismatch=parseCharacterSessionProjectionV1(projection,mismatchedVersion);
  assert.equal(mismatch.status,"rejected");
  if (mismatch.status==="rejected") assert.match(mismatch.error,/missing projected content|content identity mismatch/);
});

test("Phase 13 projection rejects unsupported envelope, source-authority, or content-definition injection fields", () => {
  const projection=buildCharacterSessionProjectionV1(character(),catalog);
  const envelopeInjection={...structuredClone(projection),executableModule:{code:"return 20"}};
  const envelope=parseCharacterSessionProjectionV1(envelopeInjection,catalog);
  assert.equal(envelope.status,"rejected");
  if (envelope.status==="rejected") assert.match(envelope.error,/unsupported fields/);

  const sourceAuthorityInjection=structuredClone(projection) as unknown as {
    sourceAuthority:Record<string,unknown>;
  };
  sourceAuthorityInjection.sourceAuthority.attackBonus=99;
  const sourceAuthority=parseCharacterSessionProjectionV1(sourceAuthorityInjection,catalog);
  assert.equal(sourceAuthority.status,"rejected");
  if (sourceAuthority.status==="rejected") assert.match(sourceAuthority.error,/unsupported fields/);

  const identityInjection=structuredClone(projection) as unknown as {
    contentIdentities:Array<Record<string,unknown>>;
  };
  identityInjection.contentIdentities[0].definition={attackBonus:99,script:"execute me"};
  const identity=parseCharacterSessionProjectionV1(identityInjection,catalog);
  assert.equal(identity.status,"rejected");
  if (identity.status==="rejected") assert.match(identity.error,/unsupported fields/);
});

test("client presentation drift cannot alter Phase 13 source/runtime authority payload", () => {
  const normal=buildCharacterSessionProjectionV1(character(),catalog);
  const drifted=buildCharacterSessionProjectionV1(character({
    ac:99,
    proficiencyBonus:9,
    speed:999,
    attacks:[{id:"client.attack.injected",name:"Injected",bonus:999,damage:"999d999"}],
  }),catalog);

  assert.deepEqual(drifted.source,normal.source);
  assert.deepEqual(drifted.sourceAuthority,normal.sourceAuthority);
  assert.deepEqual(drifted.runtime,normal.runtime);
  assert.deepEqual(drifted.contentIdentities,normal.contentIdentities);
});

test("source-owned max HP is explicit and constrains projected runtime HP", () => {
  const projection=buildCharacterSessionProjectionV1(character({maxHp:27,hp:19}),catalog);
  assert.deepEqual(projection.sourceAuthority,{maxHp:27});
  assert.equal(projection.runtime.hp,19);
  assert.equal(parseCharacterSessionProjectionV1(projection,catalog).status,"accepted");

  const impossible=structuredClone(projection);
  impossible.runtime.hp=28;
  const parsed=parseCharacterSessionProjectionV1(impossible,catalog);
  assert.equal(parsed.status,"rejected");
  if (parsed.status==="rejected") assert.match(parsed.error,/outside source-owned max HP/);
});

test("presentation portrait round-trips through the bounded Character projection", () => {
  const portrait={asset:{mimeType:"image/png" as const,dataUrl:"data:image/png;base64,iVBORw0KGgo=",byteLength:8,fileName:"hero.png"},focalX:.25,focalY:.75};
  const projection=buildCharacterSessionProjectionV1(character({portrait}),catalog);
  assert.deepEqual(projection.portrait,portrait);
  const accepted=parseCharacterSessionProjectionV1(projection,catalog);
  assert.equal(accepted.status,"accepted");
  if(accepted.status==="accepted")assert.deepEqual(accepted.projection.portrait,portrait);

  const invalid=structuredClone(projection) as unknown as {portrait:{focalX:number}};
  invalid.portrait.focalX=2;
  const rejected=parseCharacterSessionProjectionV1(invalid,catalog);
  assert.equal(rejected.status,"rejected");
  if(rejected.status==="rejected")assert.match(rejected.error,/portrait is invalid/);
});
