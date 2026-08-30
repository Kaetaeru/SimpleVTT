import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId, runtimeArtifactCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { snapshotAdapterTurnRuntimeState } from "../../src/app/turnRuntimeSessionRegistry";

type ActionPolicy="retain"|"grant"|"replace";
const ACTOR_ID="char.aelar";

function packagePayload(prefix:string,actionPolicy:ActionPolicy) {
  const moduleId=`${prefix}.module`;
  const formContentId=`${prefix}.form-content`;
  const formMechanicId=`${prefix}.form-mechanic`;
  const actionContentId=`${prefix}.form-action-content`;
  const actionMechanicId=`${prefix}.form-action-mechanic`;
  const definitionActionId=installedCommonPlayActionId({
    catalogId:catalogQualifiedId(actionContentId,moduleId,"1"),mechanicId:actionMechanicId,entryPointId:"form-strike",
  });
  const transformActionId=installedCommonPlayActionId({
    catalogId:catalogQualifiedId(formContentId,moduleId,"1"),mechanicId:formMechanicId,entryPointId:"transform",
  });
  return {
    definitionActionId,
    projectedActionId:runtimeArtifactCommonPlayActionId(ACTOR_ID,definitionActionId),
    transformActionId,
    json:JSON.stringify({
      schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",
      rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
      source:{document:"Unknown form action-policy probe",version:"1",license:"CC0",srdDerived:false},dependencies:[],conflicts:[],capabilities:[],
      content:[
        {id:formContentId,category:"option",presentation:{defaultLocale:"en",originalName:"Unknown Form",locales:{en:{name:"Unknown Form"}}},mechanics:[{kind:"common-play",config:{
          schemaVersion:"0.2-draft",id:formMechanicId,
          entryPoints:[{id:"transform",invocation:"manual",operations:[{kind:"artifact.spawn",template:"form"}]}],
          artifactTemplates:[{id:"form",artifactKind:"form",duration:{kind:"durable"},lifetime:{kind:"durable"},initialState:{
            targetActorId:"actor",propertyOverlay:{},retainedProperties:[],replacementProperties:[],hpPolicy:"retain",actionPolicy,spellcasting:"retain",actionDefinitionIds:[definitionActionId],resources:[],
          }}],
        }}]},
        {id:actionContentId,category:"option",presentation:{defaultLocale:"en",originalName:"Unknown Form Strike",locales:{en:{name:"Unknown Form Strike"}}},mechanics:[{kind:"common-play",config:{
          schemaVersion:"0.2-draft",id:actionMechanicId,
          entryPoints:[{id:"form-strike",invocation:"manual",operations:[{kind:"damage.apply",amount:{value:1},damageType:"force",target:"self"}]}],
        }}]},
      ],
    }),
  };
}

async function prepare(prefix:string,actionPolicy:ActionPolicy) {
  const adapter=new MockAdapter();
  const pack=packagePayload(prefix,actionPolicy);
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(pack.json);
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor(ACTOR_ID);
  return {adapter,pack};
}

async function projectionShape(prefix:string,actionPolicy:ActionPolicy) {
  const {adapter,pack}=await prepare(prefix,actionPolicy);
  const before=await adapter.getSnapshot();
  const beforeIds=(before.scene.actionsByActor[ACTOR_ID]??[]).map((action)=>action.id);
  await adapter.resolveAction(pack.transformActionId,[ACTOR_ID]);
  let snapshot=await adapter.getSnapshot();
  const afterIds=(snapshot.scene.actionsByActor[ACTOR_ID]??[]).map((action)=>action.id);
  const repeatedIds=((await adapter.getSnapshot()).scene.actionsByActor[ACTOR_ID]??[]).map((action)=>action.id);
  assert.equal(repeatedIds.filter((id)=>id===pack.projectedActionId).length,actionPolicy==="retain"?0:1,"projection must be idempotent across snapshots");
  if(actionPolicy==="retain") assert.deepEqual(afterIds,beforeIds);
  if(actionPolicy==="grant") {
    assert.ok(beforeIds.every((id)=>afterIds.includes(id)));
    assert.equal(afterIds.filter((id)=>id===pack.projectedActionId).length,1);
  }
  if(actionPolicy==="replace") assert.deepEqual(afterIds,[pack.projectedActionId]);

  let damage=0;
  if(actionPolicy!=="retain") {
    const hpBefore=snapshot.activeCharacter.hp;
    await adapter.resolveAction(pack.projectedActionId,[ACTOR_ID]);
    snapshot=await adapter.getSnapshot();
    damage=hpBefore-snapshot.activeCharacter.hp;
    assert.equal(damage,1,JSON.stringify(snapshot.resolution));
    assert.equal(snapshot.resolution?.stage,"complete");
    await adapter.undoLastResolution();
    snapshot=await adapter.getSnapshot();
    assert.equal(snapshot.activeCharacter.hp,hpBefore);
    assert.equal(snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)?.artifacts?.some((artifact)=>artifact.artifactKind==="form"),true);
  }
  return {policy:actionPolicy,basePreserved:actionPolicy!=="replace",projected:afterIds.includes(pack.projectedActionId),damage};
}

for(const policy of ["retain","grant","replace"] as const) test(`unknown Common Play form ${policy} action policy projects through the generic action route`,async()=>{
  await projectionShape(`unknown-form-actions-${policy}`,policy);
});

test("form action policy semantics are invariant under complete external identity rename",async()=>{
  for(const policy of ["retain","grant","replace"] as const) {
    assert.deepEqual(await projectionShape(`unknown-form-actions-a-${policy}`,policy),await projectionShape(`renamed-external-form-b-${policy}`,policy));
  }
});

test("undoing form creation restores the original action projection",async()=>{
  const {adapter,pack}=await prepare("unknown-form-actions-undo","replace");
  const before=await adapter.getSnapshot();
  const beforeIds=(before.scene.actionsByActor[ACTOR_ID]??[]).map((action)=>action.id);
  await adapter.resolveAction(pack.transformActionId,[ACTOR_ID]);
  let snapshot=await adapter.getSnapshot();
  assert.deepEqual((snapshot.scene.actionsByActor[ACTOR_ID]??[]).map((action)=>action.id),[pack.projectedActionId]);
  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.deepEqual((snapshot.scene.actionsByActor[ACTOR_ID]??[]).map((action)=>action.id),beforeIds);
  assert.equal(snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)?.artifacts?.some((artifact)=>artifact.artifactKind==="form"),false);
});
