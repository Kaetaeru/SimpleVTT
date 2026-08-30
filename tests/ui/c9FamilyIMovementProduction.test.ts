import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/installedContentRuntimeAdapter";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";

const MOVEMENT_TYPES=["walk","climb","swim","fly","crawl","jump"] as const;
const FREE_MODES=["push","pull","teleport"] as const;

function destinationFact(id:string) {
  return {
    id,
    fact:"spatial.legal-destination",
    subject:"actor",
    authority:"actor-owner" as const,
    visibility:"actor-and-dm" as const,
    unknownPolicy:"request-authority" as const,
  };
}

function modulePayload(prefix:string) {
  const moduleId=`${prefix}.module`;
  const contentId=`${prefix}.movement-content`;
  const mechanicId=`${prefix}.movement`;
  const entryPoints=[
    ...MOVEMENT_TYPES.map((movementType)=>({
      id:`move-${movementType}`,
      invocation:"manual" as const,
      operations:[{
        kind:"movement.relocate" as const,
        mode:"move" as const,
        movementType,
        target:"actor",
        distance:{value:5},
        ...(movementType==="crawl"?{costMultiplier:{value:2}}:{}),
        destinationFact:destinationFact(`destination-${movementType}`),
      }],
    })),
    ...FREE_MODES.map((mode)=>({
      id:mode,
      invocation:"manual" as const,
      operations:[{
        kind:"movement.relocate" as const,
        mode,
        target:"actor",
        distance:{value:10},
        destinationFact:destinationFact(`destination-${mode}`),
      }],
    })),
  ];
  const config={schemaVersion:"0.2-draft",id:mechanicId,entryPoints};
  return {
    moduleId,
    contentId,
    mechanicId,
    json:JSON.stringify({
      schemaVersion:"0.1-draft",
      moduleId,
      moduleVersion:"1",
      rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},
      defaultLocale:"en",
      source:{document:"Unknown Family I movement module",version:"1",license:"CC0",srdDerived:false},
      dependencies:[],
      conflicts:[],
      capabilities:[],
      content:[{
        id:contentId,
        category:"option",
        presentation:{defaultLocale:"en",originalName:"Unknown Portable Movement",locales:{en:{name:"Unknown Portable Movement"}}},
        mechanics:[{kind:"common-play",config}],
      }],
    }),
  };
}

async function install(prefix:string) {
  const adapter=new MockAdapter();
  const pack=modulePayload(prefix);
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(pack.json);
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  const action=(entryPointId:string)=>installedCommonPlayActionId({
    catalogId:catalogQualifiedId(pack.contentId,pack.moduleId,"1"),
    mechanicId:pack.mechanicId,
    entryPointId,
  });
  return {adapter,action};
}

async function runMovementMatrix(prefix:string) {
  const {adapter,action}=await install(prefix);

  for(const movementType of MOVEMENT_TYPES) {
    const before=(await adapter.getSnapshot()).scene.economyByActor["char.aelar"]!.movement;
    await adapter.resolveAction(action(`move-${movementType}`),["char.aelar"]);
    let snapshot=await adapter.getSnapshot();
    assert.equal(snapshot.resolution?.stage,"complete",`${movementType} must commit through production Common Play`);
    assert.equal(snapshot.scene.economyByActor["char.aelar"]?.movement,before-(movementType==="crawl"?10:5));
    await adapter.undoLastResolution();
    snapshot=await adapter.getSnapshot();
    assert.equal(snapshot.scene.economyByActor["char.aelar"]?.movement,before,`${movementType} Undo must restore movement budget`);
  }

  for(const mode of FREE_MODES) {
    const before=(await adapter.getSnapshot()).scene.economyByActor["char.aelar"]!.movement;
    await adapter.resolveAction(action(mode),["char.aelar"]);
    const snapshot=await adapter.getSnapshot();
    assert.equal(snapshot.resolution?.stage,"complete",`${mode} must commit through production Common Play`);
    assert.equal(snapshot.scene.economyByActor["char.aelar"]?.movement,before,`${mode} must not spend regular movement`);
  }

  return (await adapter.getSnapshot()).scene.economyByActor["char.aelar"]!.movement;
}

test("unknown installed Common Play executes every movement type, cost multiplier, push, pull, and teleport through production Resolver",async()=>{
  assert.equal(await runMovementMatrix("unknown-family-i"),30);
});

test("renaming every external Family I identity preserves the production movement matrix",async()=>{
  assert.equal(await runMovementMatrix("renamed-family-i"),30);
});
