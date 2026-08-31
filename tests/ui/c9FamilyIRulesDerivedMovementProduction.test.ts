import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";

function destinationFact(id:string){
  return {id,fact:"spatial.legal-destination",subject:"actor",authority:"actor-owner" as const,visibility:"actor-and-dm" as const,unknownPolicy:"request-authority" as const};
}

function packagePayload(prefix:string){
  const moduleId=`${prefix}.module`;
  const contentId=`${prefix}.movement-rules`;
  const mechanicId=`${prefix}.movement-rules`;
  return {
    moduleId,contentId,mechanicId,
    json:JSON.stringify({
      schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",
      rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
      source:{document:"Family I rules-derived movement probe",version:"1",license:"CC0",srdDerived:false},
      dependencies:[],conflicts:[],capabilities:[],
      content:[{
        id:contentId,category:"option",
        presentation:{defaultLocale:"en",originalName:"Portable Movement Rules",locales:{en:{name:"Portable Movement Rules"}}},
        mechanics:[{kind:"common-play",config:{
          schemaVersion:"0.2-draft",id:mechanicId,
          entryPoints:[
            {id:"difficult-terrain",invocation:"manual",operations:[{
              kind:"property.modify",property:"movement.cost.multiplier",operation:"set",value:{value:2},target:"actor",owner:"effect",source:"definition",
              duration:{kind:"elapsed",amount:{value:1},unit:"hours"},lifetime:{kind:"until-duration",onEnd:"destroy"},instancePolicy:"unique-by-source",
            }]},
            {id:"drag-carry",invocation:"manual",operations:[{
              kind:"property.modify",property:"movement.drag-carry.multiplier",operation:"set",value:{value:2},target:"actor",owner:"effect",source:"definition",
              duration:{kind:"elapsed",amount:{value:1},unit:"hours"},lifetime:{kind:"until-duration",onEnd:"destroy"},instancePolicy:"unique-by-source",
            }]},
            {id:"ground-flight",invocation:"manual",operations:[{
              kind:"property.modify",property:"movement.fly",operation:"set",value:{value:0},target:"actor",owner:"effect",source:"definition",
              duration:{kind:"elapsed",amount:{value:1},unit:"hours"},lifetime:{kind:"until-duration",onEnd:"destroy"},instancePolicy:"unique-by-source",
            }]},
            {id:"grant-flight",invocation:"manual",operations:[{
              kind:"property.modify",property:"movement.fly",operation:"set",value:{value:10},target:"actor",owner:"effect",source:"definition",
              duration:{kind:"elapsed",amount:{value:1},unit:"hours"},lifetime:{kind:"until-duration",onEnd:"destroy"},instancePolicy:"unique-by-source",
            }]},
            {id:"walk",invocation:"manual",operations:[{
              kind:"movement.relocate",mode:"move",movementType:"walk",target:"actor",distance:{value:5},destinationFact:destinationFact("destination-walk"),
            }]},
            {id:"fly",invocation:"manual",operations:[{
              kind:"movement.relocate",mode:"move",movementType:"fly",target:"actor",distance:{value:5},destinationFact:destinationFact("destination-fly"),
            }]},
          ],
        }}],
      }],
    }),
  };
}

async function install(prefix:string){
  const adapter=new MockAdapter();
  const pack=packagePayload(prefix);
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(pack.json);
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  const action=(entryPointId:string)=>installedCommonPlayActionId({
    catalogId:catalogQualifiedId(pack.contentId,pack.moduleId,"1"),mechanicId:pack.mechanicId,entryPointId,
  });
  return {adapter,action};
}

async function exercise(prefix:string){
  const {adapter,action}=await install(prefix);
  const initial=(await adapter.getSnapshot()).scene.economyByActor["char.aelar"]!.movement;

  await adapter.resolveAction(action("difficult-terrain"),["char.aelar"]);
  let snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");
  await adapter.resolveAction(action("walk"),["char.aelar"]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.movement,initial-10,"rules-derived movement.cost.multiplier must govern production movement cost");
  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.movement,initial,"movement Undo must restore the exact budget while the rules effect remains active");

  await adapter.resolveAction(action("drag-carry"),["char.aelar"]);
  await adapter.resolveAction(action("walk"),["char.aelar"]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.movement,initial-20,"drag/carry cost must compose with active Difficult Terrain through generic movement properties");
  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.movement,initial,"drag/carry movement Undo must restore the exact budget while both rules effects remain active");

  await adapter.resolveAction(action("ground-flight"),["char.aelar"]);
  await adapter.resolveAction(action("fly"),["char.aelar"]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.movement,initial,"zero rules-derived fly speed must reject regular fly movement");
  assert.match(snapshot.resolution?.detail.join("\n")??"",/movement exceeds fly speed/);

  await adapter.resolveAction(action("grant-flight"),["char.aelar"]);
  await adapter.resolveAction(action("fly"),["char.aelar"]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.movement,initial-20,"active terrain and drag/carry multipliers must combine with the rules-derived alternate fly speed");
  return snapshot.scene.economyByActor["char.aelar"]!.movement;
}

test("unknown external Common Play derives movement cost, drag/carry cost, and alternate speed from generic RulesProfile modifiers",async()=>{
  assert.equal(await exercise("unknown-family-i-rules-derived"),10);
});

test("rules-derived movement remains invariant after external module/content/mechanic identity rename",async()=>{
  assert.equal(await exercise("renamed-family-i-rules-derived"),10);
});
