import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/installedContentRuntimeAdapter";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";

const MODULE_ID="homebrew.family-a-nonactive";
const CONTENT_ID="option.family-a-nonactive";
const MECHANIC_ID="external.unknown.family-a-nonactive";
const ENTRY_POINT_ID="move-by-ac";

function payload() {
  return JSON.stringify({
    schemaVersion:"0.1-draft",moduleId:MODULE_ID,moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
    source:{document:"Family A Non-Active Profile Probe",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],
    content:[{
      id:CONTENT_ID,category:"option",
      presentation:{defaultLocale:"en",originalName:"Non-Active Profile Probe",locales:{en:{name:"Non-Active Profile Probe"}}},
      mechanics:[{kind:"common-play",config:{
        schemaVersion:"0.2-draft",id:MECHANIC_ID,
        entryPoints:[{id:ENTRY_POINT_ID,invocation:"manual",operations:[{
          kind:"movement.relocate",mode:"move",movementType:"walk",target:"actor",
          distance:{ref:"defense.ac"},
          destinationFact:{id:"nonactive-ac-destination",fact:"spatial.legal-destination",subject:"actor",authority:"actor-owner",visibility:"actor-and-dm",unknownPolicy:"request-authority"},
        }]}],
      }}],
    }],
  });
}

test("unknown stored Common Play reads a non-active runtime actor profile property",async()=>{
  const adapter=new MockAdapter();
  await adapter.setReferenceRole("dm");
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(payload());
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  const actorId="combatant.goblin-a";
  await adapter.setCurrentActor(actorId);
  const actionId=installedCommonPlayActionId({
    catalogId:catalogQualifiedId(CONTENT_ID,MODULE_ID,"1"),mechanicId:MECHANIC_ID,entryPointId:ENTRY_POINT_ID,
  });
  await adapter.configureReadyAction({actorId,actionId,trigger:"Aelar acts"});
  await adapter.setCurrentActor("char.aelar");
  const before=await adapter.getSnapshot();
  const baseAc=before.scene.entities.find((entity)=>entity.id===actorId)!.ac;
  const beforeMovement=before.scene.economyByActor[actorId]!.movement;
  const trigger=(before.scene.actionsByActor[actorId]??[]).find((action)=>action.id.startsWith("stored-invocation-common-play:"));
  assert.ok(trigger,JSON.stringify(before.scene.actionsByActor[actorId]));
  await adapter.resolveAction(trigger.id,[actorId]);
  const after=await adapter.getSnapshot();
  assert.equal(after.resolution?.stage,"complete",JSON.stringify(after.resolution));
  assert.equal(beforeMovement-after.scene.economyByActor[actorId]!.movement,baseAc);
});