import assert from "node:assert/strict";
import test from "node:test";
import type { CatalogEntry, CharacterSheet, ItemInstanceVm } from "../../src/app/contracts";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { buildCharacterSessionProjectionV1 } from "../../src/app/characterSessionProjection";
import { reconstructCharacterSessionProjectionV1 } from "../../src/app/characterSessionProjectionReconstruction";

const SOURCE_ID="dnd.srd-5.2.1";
const VERSION="2024";

type ResolvedEntry=CatalogEntry & {contentId:string;sourceId:string};

function entry(contentId:string,category:CatalogEntry["category"],nameKo:string,nameEn:string,sourceId=SOURCE_ID):ResolvedEntry {
  return {
    id:catalogQualifiedId(contentId,sourceId,VERSION),
    contentId,
    sourceId,
    category,
    nameKo,
    nameEn,
    scope:sourceId===SOURCE_ID?"builtin":"homebrew",
    source:sourceId,
    version:VERSION,
    description:"test",
    relationships:[],
    capabilities:[],
  };
}

const baseCatalog:CatalogEntry[]=[
  entry("dnd.srd521.class.fighter","class","파이터","Fighter"),
  entry("dnd.srd521.class.wizard","class","위저드","Wizard"),
  entry("dnd.srd521.species.human","species","인간","Human"),
  entry("dnd.srd521.background.soldier","background","군인","Soldier"),
];

function fighter(overrides:Partial<CharacterSheet>={}):CharacterSheet {
  return {
    id:"char.phase13.host-unknown",
    name:"Host Unknown Fighter",
    className:"파이터",
    level:3,
    species:"인간",
    background:"군인",
    hp:19,
    maxHp:27,
    ac:99,
    saveState:"saved",
    proficiencyBonus:99,
    speed:999,
    tempHp:2,
    abilities:{str:16,dex:14,con:14,int:10,wis:12,cha:8},
    saves:["fake-save"],
    skills:["운동"],
    features:["fighter.second-wind"],
    equipment:[],
    items:[],
    resources:[{id:"resource.second-wind",label:"재기의 바람",current:2,max:2,source:"SRD Fighter"}],
    attacks:[{id:"client.injected.attack",name:"Injected",bonus:999,damage:"999d999"}],
    rulesProfileId:"dnd.srd-5.2.1",
    rulesProfileVersion:"0.1-draft",
    sourceRevision:12,
    runtimeRevision:8,
    ...overrides,
  };
}

test("host reconstructs derived mechanics from trusted rules instead of client presentation values", () => {
  const portrait={asset:{mimeType:"image/png" as const,dataUrl:"data:image/png;base64,iVBORw0KGgo=",byteLength:8},focalX:.4,focalY:.6};
  const projection=buildCharacterSessionProjectionV1(fighter({portrait}),baseCatalog);
  const reconstructed=reconstructCharacterSessionProjectionV1(projection,baseCatalog);
  assert.equal(reconstructed.status,"accepted");
  if (reconstructed.status!=="accepted") return;

  assert.equal(reconstructed.sheet.id,"char.phase13.host-unknown");
  assert.equal(reconstructed.sheet.proficiencyBonus,2);
  assert.equal(reconstructed.sheet.speed,30);
  assert.equal(reconstructed.sheet.ac,12);
  assert.equal(reconstructed.sheet.maxHp,27);
  assert.equal(reconstructed.sheet.hp,19);
  assert.equal(reconstructed.sheet.tempHp,2);
  assert.deepEqual(reconstructed.sheet.portrait,portrait);
  assert.deepEqual(reconstructed.sheet.saves,["STR +5","CON +4"]);
  assert.deepEqual(reconstructed.sheet.attacks,[]);
  assert.equal(reconstructed.entity.ac,12);
  assert.equal(reconstructed.entity.maxHp,27);
  assert.equal(reconstructed.economy.movementMax,30);

  const secondWind=reconstructed.actions.find((action)=>action.id==="action.second-wind");
  assert.ok(secondWind);
  assert.equal(secondWind?.actorId,reconstructed.sheet.id);
  assert.equal(secondWind?.resourceCost?.resourceId,"resource.second-wind");
  assert.equal(secondWind?.healing?.flat,3);
});

test("host reconstruction stays stable when client-only AC/speed/proficiency/attack presentation drifts", () => {
  const normal=reconstructCharacterSessionProjectionV1(buildCharacterSessionProjectionV1(fighter({ac:11,speed:30,proficiencyBonus:2,attacks:[]}),baseCatalog),baseCatalog);
  const drifted=reconstructCharacterSessionProjectionV1(buildCharacterSessionProjectionV1(fighter({ac:1000,speed:1000,proficiencyBonus:1000,attacks:[{id:"evil",name:"evil",bonus:1000,damage:"1000d1000"}]}),baseCatalog),baseCatalog);
  assert.equal(normal.status,"accepted");
  assert.equal(drifted.status,"accepted");
  if (normal.status!=="accepted" || drifted.status!=="accepted") return;
  assert.equal(drifted.sheet.ac,normal.sheet.ac);
  assert.equal(drifted.sheet.speed,normal.sheet.speed);
  assert.equal(drifted.sheet.proficiencyBonus,normal.sheet.proficiencyBonus);
  assert.deepEqual(drifted.actions,normal.actions);
});

test("runtime resource state overlays source definition but cannot exceed source-owned maximum", () => {
  const projection=buildCharacterSessionProjectionV1(fighter(),baseCatalog);
  projection.runtime.resources[0].current=1;
  const reconstructed=reconstructCharacterSessionProjectionV1(projection,baseCatalog);
  assert.equal(reconstructed.status,"accepted");
  if (reconstructed.status==="accepted") assert.equal(reconstructed.sheet.resources[0].current,1);

  projection.runtime.resources[0].current=3;
  const invalid=reconstructCharacterSessionProjectionV1(projection,baseCatalog);
  assert.equal(invalid.status,"rejected");
  if (invalid.status==="rejected") assert.match(invalid.error,/resource state is invalid/);
});

test("multiclass projection requires every class-track identity and class features use their own class level", () => {
  const multiclass=fighter({
    className:"파이터",
    level:3,
    classLevels:[
      {classId:"dnd.srd521.class.fighter",level:1},
      {classId:"dnd.srd521.class.wizard",level:2},
    ],
  });
  const projection=buildCharacterSessionProjectionV1(multiclass,baseCatalog);
  assert.deepEqual(
    projection.contentIdentities.filter((identity)=>identity.category==="class").map((identity)=>identity.contentId).sort(),
    ["dnd.srd521.class.fighter","dnd.srd521.class.wizard"],
  );

  const reconstructed=reconstructCharacterSessionProjectionV1(projection,baseCatalog);
  assert.equal(reconstructed.status,"accepted");
  if (reconstructed.status!=="accepted") return;
  assert.deepEqual(reconstructed.sheet.saves,["STR +5","CON +4"]);
  assert.equal(reconstructed.actions.find((action)=>action.id==="action.second-wind")?.healing?.flat,1);

  const hostMissingWizard=baseCatalog.filter((catalogEntry)=>catalogEntry.nameEn!=="Wizard");
  const rejected=reconstructCharacterSessionProjectionV1(projection,hostMissingWizard);
  assert.equal(rejected.status,"rejected");
  if (rejected.status==="rejected") assert.match(rejected.error,/missing projected content|missing canonical host\/client content/);
});

test("class-track totals must match the Character total level", () => {
  const projection=buildCharacterSessionProjectionV1(fighter({
    classLevels:[
      {classId:"dnd.srd521.class.fighter",level:1},
      {classId:"dnd.srd521.class.wizard",level:2},
    ],
  }),baseCatalog);
  projection.source.build.level=4;
  const rejected=reconstructCharacterSessionProjectionV1(projection,baseCatalog);
  assert.equal(rejected.status,"rejected");
  if (rejected.status==="rejected") assert.match(rejected.error,/classLevels total does not match Character level/);
});

test("equipped item with a catalog identity but no trusted host mechanic entry rejects instead of trusting client item metadata", () => {
  const homebrewId="homebrew.item.unsafe-armor";
  const item:ItemInstanceVm={
    id:"item.unsafe",
    definitionId:homebrewId,
    name:"Client Says AC 30",
    kind:"equipment",
    quantity:1,
    equipped:true,
    passiveEffects:["AC 30"],
    grantedActionIds:["action.client.win"],
    provenance:["client"],
  };
  const catalog=[...baseCatalog,entry(homebrewId,"item","위험한 갑옷","Unsafe Armor","homebrew.local")];
  const projection=buildCharacterSessionProjectionV1(fighter({items:[item],equipment:[item.name]}),catalog);
  const reconstructed=reconstructCharacterSessionProjectionV1(projection,catalog);
  assert.equal(reconstructed.status,"rejected");
  if (reconstructed.status==="rejected") assert.match(reconstructed.error,/no trusted host mechanic entry/);
});
