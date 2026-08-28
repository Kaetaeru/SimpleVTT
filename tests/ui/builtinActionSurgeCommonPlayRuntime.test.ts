import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId, parseInstalledCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import {
  FIGHTER_ACTION_SURGE_RESOURCE_ID,
  FIGHTER_ACTION_SURGE_TURN_RESOURCE_ID,
} from "../../src/domain/coreClassResources";

const ACTOR_ID="char.aelar";
const RENAMED_MODULE_ID="homebrew.renamed-economy-probe";
const RENAMED_MODULE_VERSION="9";
const RENAMED_CONTENT_ID="option.completely-different-name";
const RENAMED_MECHANIC_ID="mechanic.unrelated-identity";
const RENAMED_ENTRY_POINT_ID="invoke";

function current(snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>,id:string) {
  return snapshot.activeCharacter.resources.find((resource)=>resource.id===id)?.current;
}

function economyFingerprint(snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>) {
  const economy=snapshot.scene.economyByActor[ACTOR_ID];
  return {
    action:economy?.action,
    feature:current(snapshot,FIGHTER_ACTION_SURGE_RESOURCE_ID),
    turnGate:current(snapshot,FIGHTER_ACTION_SURGE_TURN_RESOURCE_ID),
    extraActions:economy?.extraActions?.map((grant)=>({allowsMagicAction:grant.allowsMagicAction})) ?? [],
  };
}

async function ready(adapter:MockAdapter) {
  await adapter.startInitiative();
  await adapter.setCurrentActor(ACTOR_ID);
  return adapter.getSnapshot();
}

function renamedPackagePayload() {
  return JSON.stringify({
    schemaVersion:"0.1-draft",
    moduleId:RENAMED_MODULE_ID,
    moduleVersion:RENAMED_MODULE_VERSION,
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},
    defaultLocale:"en",
    source:{document:"Rename Invariance Probe",version:"9",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],
    content:[{
      id:RENAMED_CONTENT_ID,
      category:"option",
      presentation:{defaultLocale:"en",originalName:"Totally Renamed Feature",locales:{en:{name:"Totally Renamed Feature",description:"Identity-only rename probe"}}},
      mechanics:[{
        kind:"common-play",
        config:{
          schemaVersion:"0.2-draft",
          id:RENAMED_MECHANIC_ID,
          payments:[
            {kind:"resource",resource:FIGHTER_ACTION_SURGE_RESOURCE_ID,amount:{value:1},consumeAt:"commit"},
            {kind:"resource",resource:FIGHTER_ACTION_SURGE_TURN_RESOURCE_ID,amount:{value:1},consumeAt:"commit"},
          ],
          entryPoints:[{
            id:RENAMED_ENTRY_POINT_ID,
            invocation:"manual",
            operations:[{kind:"economy.modify",bucket:"action.extra.non-magic",amount:{value:1}}],
          }],
        },
      }],
    }],
  });
}

test("built-in Fighter Action Surge executes through the generic Common Play production path with oracle parity and Undo", async () => {
  const adapter=new MockAdapter();
  let snapshot=await ready(adapter);
  const action=snapshot.scene.actionsByActor[ACTOR_ID]?.find((candidate)=>candidate.name==="액션 서지");
  assert.ok(action,"the Fighter production projection must expose Action Surge");
  assert.notEqual(action.id,"action.fighter.action-surge","the production action must no longer use the named execution id");
  const reference=parseInstalledCommonPlayActionId(action.id);
  assert.ok(reference,"the built-in production action must use the generic Common Play action reference");
  assert.match(reference.catalogId,/fighter\.action-surge/);

  const before=economyFingerprint(snapshot);
  assert.ok((before.feature??0)>0);
  assert.ok((before.turnGate??0)>0);
  assert.equal(before.action,true,"Action Surge must not spend the normal Action");

  await adapter.resolveAction(action.id,[ACTOR_ID]);
  snapshot=await adapter.getSnapshot();
  const after=economyFingerprint(snapshot);
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(snapshot.resolution?.actionId,action.id);
  assert.equal(after.feature,(before.feature??0)-1);
  assert.equal(after.turnGate,(before.turnGate??0)-1);
  assert.equal(after.action,true,"the normal Action must remain available after Action Surge");
  assert.deepEqual(after.extraActions,[{allowsMagicAction:false}],"Action Surge grants exactly one non-Magic extra Action");

  await adapter.resolveAction(action.id,[ACTOR_ID]);
  snapshot=await adapter.getSnapshot();
  assert.deepEqual(economyFingerprint(snapshot),after,"a second same-turn Action Surge must reject atomically");

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.deepEqual(economyFingerprint(snapshot),before,"Undo must restore both payments and the extra Action grant atomically");
});

test("Action Surge mechanics are invariant under unrelated content, mechanic, entry-point, and presentation identities", async () => {
  const builtin=new MockAdapter();
  let builtinSnapshot=await ready(builtin);
  const builtinAction=builtinSnapshot.scene.actionsByActor[ACTOR_ID]?.find((candidate)=>candidate.name==="액션 서지");
  assert.ok(builtinAction);
  await builtin.resolveAction(builtinAction.id,[ACTOR_ID]);
  builtinSnapshot=await builtin.getSnapshot();

  const renamed=new MockAdapter();
  setInstalledContentStoreForTests(renamed,new MemoryInstalledContentStore());
  const preview=await renamed.previewContentImport(renamedPackagePayload());
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await renamed.activateContentImport();
  await ready(renamed);
  const renamedActionId=installedCommonPlayActionId({
    catalogId:catalogQualifiedId(RENAMED_CONTENT_ID,RENAMED_MODULE_ID,RENAMED_MODULE_VERSION),
    mechanicId:RENAMED_MECHANIC_ID,
    entryPointId:RENAMED_ENTRY_POINT_ID,
  });
  await renamed.resolveAction(renamedActionId,[ACTOR_ID]);
  const renamedSnapshot=await renamed.getSnapshot();

  assert.deepEqual(economyFingerprint(renamedSnapshot),economyFingerprint(builtinSnapshot));
  assert.notEqual(renamedSnapshot.resolution?.actionId,builtinSnapshot.resolution?.actionId,"provenance identity may differ while mechanics remain identical");
});