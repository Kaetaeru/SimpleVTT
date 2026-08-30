import type { RulesRuntimeState } from "../domain/combatState";
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

function applyFormSpellcastingProjection(snapshot:AppSnapshot,form:FormArtifactData) {
  if(form.spellcasting!=="blocked")return;
  const current=snapshot.scene.actionsByActor[form.targetActorId];
  if(!current)return;
  snapshot.scene.actionsByActor[form.targetActorId]=current.filter((action)=>action.category!=="magic");
}

MockAdapter.prototype.getSnapshot=async function getSnapshotWithCommonPlayFormProjection(){
  const snapshot=await previousGetSnapshot.call(this);
  const state=snapshotAdapterTurnRuntimeState(this,snapshot.scene);
  if(!state)return snapshot;
  for(const artifact of state.artifacts??[]) {
    if(artifact.artifactKind!=="form"||!artifact.form)continue;
    applyFormProjection(snapshot,artifact.form);
    await applyFormActionProjection(this,snapshot,state,artifact.form);
    applyFormSpellcastingProjection(snapshot,artifact.form);
  }
  return snapshot;
};
