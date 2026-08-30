from pathlib import Path

runtime = Path("src/app/installedCommonPlayRuntimeAdapter.ts")
text = runtime.read_text(encoding="utf-8")
anchor = '''async function projectRuntimeArtifactActions(adapter:MockAdapter,snapshot:AppSnapshot) {
'''
helper = '''export async function projectCommonPlayRuntimeArtifactAction(
  adapter:MockAdapter,
  actionId:string,
  actorId:string,
  snapshot:AppSnapshot,
  state:RulesRuntimeState,
) {
  const action=await commonPlayAction(adapter,actionId);
  return action?projectedArtifactAction(adapter,actionId,actorId,action,snapshot.scene,state):undefined;
}

'''
if helper not in text:
    if text.count(anchor) != 1:
        raise SystemExit(f"runtime action helper anchor count: {text.count(anchor)}")
    text = text.replace(anchor, helper + anchor, 1)
runtime.write_text(text, encoding="utf-8")

projection = Path("src/app/commonPlayFormProjectionAdapter.ts")
projection.write_text('''import type { RulesRuntimeState } from "../domain/combatState";
import type { FormArtifactData } from "../domain/runtimeArtifact";
import type { ActionVm, AppSnapshot } from "./contracts";
import { projectCommonPlayRuntimeArtifactAction } from "./installedCommonPlayRuntimeAdapter";
import { MockAdapter } from "./mockAdapter";
import { snapshotAdapterTurnRuntimeState } from "./turnRuntimeSessionRegistry";

const previousGetSnapshot=MockAdapter.prototype.getSnapshot;

function replacement(form:FormArtifactData,key:string) {
  if(!form.replacementProperties.includes(key)||form.retainedProperties.includes(key)) return undefined;
  return form.propertyOverlay[key];
}

function finiteNumber(value:unknown) {
  return typeof value==="number"&&Number.isFinite(value)?value:undefined;
}

function applyFormProjection(snapshot:AppSnapshot,form:FormArtifactData) {
  const entity=snapshot.scene.entities.find((candidate)=>candidate.id===form.targetActorId);
  const character=snapshot.activeCharacter.id===form.targetActorId?snapshot.activeCharacter:undefined;
  if(!entity&&!character)return;

  const armorClass=finiteNumber(replacement(form,"defense.ac"));
  if(armorClass!==undefined) {
    if(entity)entity.ac=armorClass;
    if(character)character.ac=armorClass;
  }

  const walkSpeed=finiteNumber(replacement(form,"movement.walk"));
  if(walkSpeed!==undefined&&character)character.speed=walkSpeed;

  if(form.hpPolicy==="retain")return;
  const maximum=finiteNumber(replacement(form,"hp.maximum"));
  const current=finiteNumber(replacement(form,"hp.current"));
  const temporary=finiteNumber(replacement(form,"hp.temporary"));

  if(form.hpPolicy==="replace") {
    if(maximum!==undefined) {
      if(entity)entity.maxHp=maximum;
      if(character)character.maxHp=maximum;
    }
    if(current!==undefined) {
      if(entity)entity.hp=current;
      if(character)character.hp=current;
    }
  }
  if(temporary!==undefined) {
    if(entity)entity.tempHp=temporary;
    if(character)character.tempHp=temporary;
  }
}

async function applyFormActionProjection(adapter:MockAdapter,snapshot:AppSnapshot,state:RulesRuntimeState,form:FormArtifactData) {
  if(form.actionPolicy==="retain"||!state.combatants[form.targetActorId])return;
  const controllerId=form.controllerId??form.targetActorId;
  if(snapshot.role!=="dm"&&controllerId!==snapshot.activeCharacter.id) {
    if(form.actionPolicy==="replace") delete snapshot.scene.actionsByActor[form.targetActorId];
    return;
  }
  const projected=(await Promise.all(form.actionDefinitionIds.map((actionId)=>
    projectCommonPlayRuntimeArtifactAction(adapter,actionId,form.targetActorId,snapshot,state)
  ))).filter((action):action is ActionVm=>Boolean(action));
  if(form.actionPolicy==="replace") {
    snapshot.scene.actionsByActor[form.targetActorId]=projected;
    return;
  }
  const current=snapshot.scene.actionsByActor[form.targetActorId]??[];
  const existing=new Set(current.map((action)=>action.id));
  snapshot.scene.actionsByActor[form.targetActorId]=[...current,...projected.filter((action)=>!existing.has(action.id))];
}

MockAdapter.prototype.getSnapshot=async function getSnapshotWithCommonPlayFormProjection(){
  const snapshot=await previousGetSnapshot.call(this);
  const state=snapshotAdapterTurnRuntimeState(this,snapshot.scene);
  if(!state)return snapshot;
  for(const artifact of state.artifacts??[]) {
    if(artifact.artifactKind!=="form"||!artifact.form)continue;
    applyFormProjection(snapshot,artifact.form);
    await applyFormActionProjection(this,snapshot,state,artifact.form);
  }
  return snapshot;
};
''', encoding="utf-8")

test_file = Path("tests/ui/commonPlayFormActionProjectionProduction.test.ts")
test_file.write_text(r'''import assert from "node:assert/strict";
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
    projectedActionId:runtimeArtifactCommonPlayActionId(ACTOR_ID,definitionActionId),transformActionId,
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
    const effectiveHpBefore=snapshot.activeCharacter.hp+snapshot.activeCharacter.tempHp;
    await adapter.resolveAction(pack.projectedActionId,[ACTOR_ID]);
    snapshot=await adapter.getSnapshot();
    damage=effectiveHpBefore-(snapshot.activeCharacter.hp+snapshot.activeCharacter.tempHp);
    assert.equal(damage,1,JSON.stringify(snapshot.resolution));
    assert.equal(snapshot.resolution?.stage,"complete");
    await adapter.undoLastResolution();
    snapshot=await adapter.getSnapshot();
    assert.equal(snapshot.activeCharacter.hp+snapshot.activeCharacter.tempHp,effectiveHpBefore);
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
''', encoding="utf-8")
