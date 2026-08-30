import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/installedContentRuntimeAdapter";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { ensureAdapterTurnRuntimeState, turnRuntimeSessions } from "../../src/app/turnRuntimeSessionRegistry";

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
    {
      id:"move-no-provoke",
      invocation:"manual" as const,
      operations:[{
        kind:"movement.relocate" as const,
        mode:"move" as const,
        movementType:"walk" as const,
        target:"actor",
        distance:{value:5},
        doesNotProvokeOpportunityAttacks:true,
        destinationFact:destinationFact("destination-no-provoke"),
      }],
    },
    {
      id:"apply-difficult-terrain",
      invocation:"manual" as const,
      operations:[{
        kind:"property.modify" as const,
        property:"movement.cost.multiplier",
        operation:"set" as const,
        value:{value:2},
        target:"actor",
        owner:"effect" as const,
        source:"definition" as const,
        duration:{kind:"elapsed" as const,amount:{value:1},unit:"minutes" as const},
        lifetime:{kind:"until-duration" as const,onEnd:"destroy" as const},
        instancePolicy:"stack" as const,
      }],
    },
    {
      id:"move-full",
      invocation:"manual" as const,
      operations:[{
        kind:"movement.relocate" as const,
        mode:"move" as const,
        movementType:"walk" as const,
        target:"actor",
        distance:{ref:"movement.walk"},
        destinationFact:destinationFact("destination-full"),
      }],
    },
    {id:"stand",invocation:"manual" as const,operations:[{kind:"movement.stand" as const,target:"actor" as const}]},
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

function seedMovementProperty(adapter:MockAdapter,property:string,value:number) {
  const session=turnRuntimeSessions.get(adapter);
  assert.ok(session,"turn runtime session must exist");
  const actor=session.state.combatants["char.aelar"];
  assert.ok(actor,"active movement actor must exist");
  actor.baseProperties={...(actor.baseProperties??{}),[property]:value};
}

async function seedProne(adapter:MockAdapter){const snapshot=await adapter.getSnapshot();ensureAdapterTurnRuntimeState(adapter,snapshot.scene);const session=turnRuntimeSessions.get(adapter);assert.ok(session,"turn runtime session must exist");session.state.effects.push({id:"effect.external.prone",sourceId:"external.unknown.prone-source",targetId:"char.aelar",kind:"condition",conditionId:"prone",tags:[],expiry:{kind:"permanent"}});}
async function runPortableStand(prefix:string){const {adapter,action}=await install(prefix);await seedProne(adapter);const before=(await adapter.getSnapshot()).scene.economyByActor["char.aelar"]!.movement;await adapter.resolveAction(action("stand"),["char.aelar"]);let snapshot=await adapter.getSnapshot();assert.equal(snapshot.resolution?.stage,"complete","portable stand must commit through production Common Play");assert.equal(snapshot.scene.economyByActor["char.aelar"]?.movement,before-15);assert.equal(turnRuntimeSessions.get(adapter)?.state.effects.some((effect)=>effect.conditionId==="prone"&&effect.targetId==="char.aelar"),false);await adapter.undoLastResolution();snapshot=await adapter.getSnapshot();assert.equal(snapshot.scene.economyByActor["char.aelar"]?.movement,before,"stand Undo must restore movement budget");assert.equal(turnRuntimeSessions.get(adapter)?.state.effects.some((effect)=>effect.conditionId==="prone"&&effect.targetId==="char.aelar"),true,"stand Undo must restore Prone");return before;}

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

  const beforeNoProvoke=(await adapter.getSnapshot()).scene.economyByActor["char.aelar"]!.movement;
  await adapter.resolveAction(action("move-no-provoke"),["char.aelar"]);
  let snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete","no-provoke movement must commit through production Common Play");
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.movement,beforeNoProvoke-5);
  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.movement,beforeNoProvoke,"no-provoke movement Undo must restore movement budget");

  return snapshot.scene.economyByActor["char.aelar"]!.movement;
}

async function runRulesDerivedDifficultTerrain(prefix:string) {
  const {adapter,action}=await install(prefix);
  await adapter.resolveAction(action("apply-difficult-terrain"),["char.aelar"]);
  let snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete","portable difficult-terrain rule must commit through production Common Play");
  const effect=turnRuntimeSessions.get(adapter)?.state.effects.find((candidate)=>candidate.propertyModifier?.property==="movement.cost.multiplier");
  assert.deepEqual(effect?.propertyModifier,{property:"movement.cost.multiplier",operation:"set",value:{value:2},source:"definition",instancePolicy:"stack"});

  const before=snapshot.scene.economyByActor["char.aelar"]!.movement;
  await adapter.resolveAction(action("move-walk"),["char.aelar"]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.movement,before-10,"RulesProfile-derived difficult terrain must double movement budget cost");
  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.movement,before,"movement Undo must restore the exact budget while the rules effect remains active");
  return before;
}

test("unknown installed Common Play executes every movement type, cost multiplier, push, pull, teleport, and no-provoke move through production Resolver",async()=>{
  assert.equal(await runMovementMatrix("unknown-family-i"),30);
});

test("rules-derived Difficult Terrain cost is authoritative for unknown installed Common Play",async()=>{
  assert.equal(await runRulesDerivedDifficultTerrain("unknown-family-i-rules-cost"),30);
});

test("renaming external Difficult Terrain identities preserves rules-derived movement cost",async()=>{
  assert.equal(await runRulesDerivedDifficultTerrain("renamed-family-i-rules-cost"),30);
});

test("rules-derived alternate speed bounds unknown installed Common Play movement",async()=>{
  const {adapter,action}=await install("unknown-family-i-alternate-speed");
  seedMovementProperty(adapter,"movement.fly",0);
  const before=(await adapter.getSnapshot()).scene.economyByActor["char.aelar"]!.movement;
  await adapter.resolveAction(action("move-fly"),["char.aelar"]);
  let snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.movement,before);
  assert.match(snapshot.resolution?.detail.join("\n")??"",/movement exceeds fly speed/);

  seedMovementProperty(adapter,"movement.fly",10);
  await adapter.resolveAction(action("move-fly"),["char.aelar"]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.movement,before-5,"authoritative alternate speed must permit bounded fly movement");
});

test("portable movement rejects another regular move after movement reaches zero",async()=>{
  const {adapter,action}=await install("unknown-family-i-zero-speed");
  const before=(await adapter.getSnapshot()).scene.economyByActor["char.aelar"]!.movement;
  assert.ok(before>0);

  await adapter.resolveAction(action("move-full"),["char.aelar"]);
  let snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.movement,0);

  await adapter.resolveAction(action("move-full"),["char.aelar"]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.movement,0);
  assert.match(snapshot.resolution?.detail.join("\n")??"",/movement exceeds remaining speed/);
});

test("unknown installed Common Play stands from Prone through production Resolver and Undo",async()=>{assert.equal(await runPortableStand("unknown-family-i-stand"),30);});
test("renaming the external movement.stand identities preserves production semantics",async()=>{assert.equal(await runPortableStand("renamed-family-i-stand"),30);});

test("renaming every external Family I identity preserves the production movement matrix",async()=>{
  assert.equal(await runMovementMatrix("renamed-family-i"),30);
});
