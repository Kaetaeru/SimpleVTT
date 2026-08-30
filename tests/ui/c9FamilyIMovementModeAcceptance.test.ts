import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { snapshotAdapterTurnRuntimeState } from "../../src/app/turnRuntimeSessionRegistry";

const ACTOR_ID="char.aelar";

function destination(id:string) {
  return {
    id:`destination-${id}`,
    fact:"spatial.legal-destination",
    subject:"actor",
    authority:"actor-owner",
    visibility:"actor-and-dm",
    unknownPolicy:"request-authority",
  };
}

function movementConfig(prefix:string) {
  return {
    schemaVersion:"0.2-draft",
    id:`${prefix}.movement`,
    entryPoints:[
      {id:"walk",invocation:"manual",operations:[{kind:"movement.relocate",mode:"move",movementType:"walk",target:"actor",distance:{value:10},destinationFact:destination("walk")}]},
      {id:"climb",invocation:"manual",operations:[{kind:"movement.relocate",mode:"move",movementType:"climb",target:"actor",distance:{value:5},destinationFact:destination("climb")}]},
      {id:"swim",invocation:"manual",operations:[{kind:"movement.relocate",mode:"move",movementType:"swim",target:"actor",distance:{value:5},destinationFact:destination("swim")}]},
      {id:"fly",invocation:"manual",operations:[{kind:"movement.relocate",mode:"move",movementType:"fly",target:"actor",distance:{value:5},destinationFact:destination("fly")}]},
      {id:"crawl",invocation:"manual",operations:[{kind:"movement.relocate",mode:"move",movementType:"crawl",target:"actor",distance:{value:10},costMultiplier:{value:2},destinationFact:destination("crawl")}]},
      {id:"jump",invocation:"manual",operations:[{kind:"movement.relocate",mode:"move",movementType:"jump",target:"actor",distance:{value:5},destinationFact:destination("jump")}]},
      {id:"push",invocation:"manual",operations:[{kind:"movement.relocate",mode:"push",target:"actor",distance:{value:10},destinationFact:destination("push")}]},
      {id:"pull",invocation:"manual",operations:[{kind:"movement.relocate",mode:"pull",target:"actor",distance:{value:10},destinationFact:destination("pull")}]},
      {id:"teleport",invocation:"manual",operations:[{kind:"movement.relocate",mode:"teleport",target:"actor",distance:{value:10},destinationFact:destination("teleport")}]},
      {id:"walk-no-provoke",invocation:"manual",operations:[{kind:"movement.relocate",mode:"move",movementType:"walk",target:"actor",distance:{value:5},doesNotProvokeOpportunityAttacks:true,destinationFact:destination("walk-no-provoke")}]},
      {id:"walk-full",invocation:"manual",operations:[{kind:"movement.relocate",mode:"move",movementType:"walk",target:"actor",distance:{ref:"movement.walk"},destinationFact:destination("walk-full")}]},
    ],
  };
}

async function install(prefix:string) {
  const adapter=new MockAdapter();
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const moduleId=`${prefix}.module`;
  const contentId=`${prefix}.option`;
  const config=movementConfig(prefix);
  const json=JSON.stringify({
    schemaVersion:"0.1-draft",
    moduleId,
    moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},
    defaultLocale:"en",
    source:{document:"Unknown Family I movement probe",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],
    conflicts:[],
    capabilities:[],
    content:[{
      id:contentId,
      category:"option",
      presentation:{defaultLocale:"en",originalName:"Unknown Movement Probe",locales:{en:{name:"Unknown Movement Probe"}}},
      mechanics:[{kind:"common-play",config}],
    }],
  });
  const preview=await adapter.previewContentImport(json);
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor(ACTOR_ID);
  const action=(entryPointId:string)=>installedCommonPlayActionId({
    catalogId:catalogQualifiedId(contentId,moduleId,"1"),
    mechanicId:config.id,
    entryPointId,
  });
  return {adapter,action};
}

function runtimeMovement(adapter:MockAdapter,snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>) {
  const state=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene);
  assert.ok(state);
  return {revision:state.revision,movement:state.combatants[ACTOR_ID]!.economy.movement};
}

async function execute(prefix:string,entryPointId:string) {
  const {adapter,action}=await install(prefix);
  const beforeSnapshot=await adapter.getSnapshot();
  const before=runtimeMovement(adapter,beforeSnapshot);
  await adapter.resolveAction(action(entryPointId),[ACTOR_ID]);
  const afterSnapshot=await adapter.getSnapshot();
  const after=runtimeMovement(adapter,afterSnapshot);
  assert.equal(afterSnapshot.resolution?.stage,"complete");
  assert.doesNotMatch(afterSnapshot.resolution?.compact??"",/적용 거부/);
  await adapter.undoLastResolution();
  const undone=runtimeMovement(adapter,await adapter.getSnapshot());
  assert.equal(undone.movement,before.movement,`${entryPointId} Undo must restore regular movement`);
  return {spent:before.movement-after.movement};
}

test("unknown installed Common Play executes the portable movement mode and cost matrix",async()=>{
  const cases:Array<[string,number]>=[
    ["walk",10],
    ["climb",5],
    ["swim",5],
    ["fly",5],
    ["crawl",20],
    ["jump",5],
    ["push",0],
    ["pull",0],
    ["teleport",0],
    ["walk-no-provoke",5],
  ];
  for(const [entryPointId,expectedSpent] of cases) {
    const result=await execute(`external-family-i-${entryPointId}`,entryPointId);
    assert.equal(result.spent,expectedSpent,entryPointId);
  }
});

test("portable movement rejects a second move after authoritative movement reaches zero without advancing runtime state",async()=>{
  const {adapter,action}=await install("external-family-i-zero-speed");
  const before=runtimeMovement(adapter,await adapter.getSnapshot());
  assert.ok(before.movement>0);

  await adapter.resolveAction(action("walk-full"),[ACTOR_ID]);
  const exhaustedSnapshot=await adapter.getSnapshot();
  const exhausted=runtimeMovement(adapter,exhaustedSnapshot);
  assert.equal(exhausted.movement,0);

  await adapter.resolveAction(action("walk-full"),[ACTOR_ID]);
  const rejectedSnapshot=await adapter.getSnapshot();
  const rejected=runtimeMovement(adapter,rejectedSnapshot);
  assert.equal(rejected.movement,0);
  assert.equal(rejected.revision,exhausted.revision,"rejected movement must not commit a runtime revision");
  assert.match(rejectedSnapshot.resolution?.detail.join("\n")??"",/movement exceeds remaining speed/);
});

test("renaming external movement content leaves production movement semantics unchanged",async()=>{
  const first=await execute("external-family-i-original","crawl");
  const renamed=await execute("totally-renamed-family-i","crawl");
  assert.deepEqual(renamed,first);
});
