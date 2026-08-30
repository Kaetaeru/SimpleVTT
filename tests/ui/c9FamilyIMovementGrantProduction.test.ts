import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/installedContentRuntimeAdapter";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { turnRuntimeSessions } from "../../src/app/turnRuntimeSessionRegistry";

function modulePayload(prefix:string) {
  const moduleId=`${prefix}.module`;
  const contentId=`${prefix}.movement-grant-content`;
  const mechanicId=`${prefix}.movement-grant`;
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
      source:{document:"Unknown Family I movement grant",version:"1",license:"CC0",srdDerived:false},
      dependencies:[],
      conflicts:[],
      capabilities:[],
      content:[{
        id:contentId,
        category:"option",
        presentation:{defaultLocale:"en",originalName:"Portable Flight Grant",locales:{en:{name:"Portable Flight Grant"}}},
        mechanics:[{
          kind:"common-play",
          config:{
            schemaVersion:"0.2-draft",
            id:mechanicId,
            entryPoints:[
              {
                id:"grant-flight",
                invocation:"manual",
                operations:[{
                  kind:"property.modify",
                  property:"movement.fly",
                  operation:"set",
                  value:{value:30},
                  target:"actor",
                  owner:"effect",
                  source:"definition",
                  duration:{kind:"elapsed",amount:{value:1},unit:"hours"},
                  lifetime:{kind:"until-duration",onEnd:"destroy"},
                  instancePolicy:"stack",
                }],
              },
              {
                id:"fly",
                invocation:"manual",
                operations:[{
                  kind:"movement.relocate",
                  mode:"move",
                  movementType:"fly",
                  target:"actor",
                  distance:{value:10},
                  destinationFact:{
                    id:"flight-destination",
                    fact:"spatial.legal-destination",
                    subject:"actor",
                    authority:"actor-owner",
                    visibility:"actor-and-dm",
                    unknownPolicy:"request-authority",
                  },
                }],
              },
            ],
          },
        }],
      }],
    }),
  };
}

async function runPortableFlightGrant(prefix:string) {
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

  const before=(await adapter.getSnapshot()).scene.economyByActor["char.aelar"]!.movement;
  await adapter.resolveAction(action("fly"),["char.aelar"]);
  let snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.movement,before,"an actor without a flight grant must not spend movement on rejected flight");
  assert.match(snapshot.resolution?.detail.join("\n")??"",/movement exceeds fly speed: 10 > 0/);

  await adapter.resolveAction(action("grant-flight"),["char.aelar"]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete","unknown portable flight grant must commit through Common Play");
  const modifier=turnRuntimeSessions.get(adapter)?.state.effects.find((effect)=>effect.propertyModifier?.property==="movement.fly")?.propertyModifier;
  assert.deepEqual(modifier,{property:"movement.fly",operation:"set",value:{value:30},source:"definition",instancePolicy:"stack"});

  await adapter.resolveAction(action("fly"),["char.aelar"]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete","flight must execute after the portable grant supplies movement.fly");
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.movement,before-10);
  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.movement,before,"flight Undo must restore movement while the grant remains active");
  return before;
}

test("unknown Common Play grants flight without named movement dispatch",async()=>{
  assert.equal(await runPortableFlightGrant("external-family-i-flight"),30);
});

test("renaming all external movement-grant identities preserves flight semantics",async()=>{
  assert.equal(await runPortableFlightGrant("renamed-family-i-flight"),30);
});
