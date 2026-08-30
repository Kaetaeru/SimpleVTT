import type { AppSnapshot } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { snapshotAdapterTurnRuntimeState } from "./turnRuntimeSessionRegistry";
import type { FormArtifactData } from "../domain/runtimeArtifact";

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

MockAdapter.prototype.getSnapshot=async function getSnapshotWithCommonPlayFormProjection(){
  const snapshot=await previousGetSnapshot.call(this);
  const state=snapshotAdapterTurnRuntimeState(this,snapshot.scene);
  if(!state)return snapshot;
  for(const artifact of state.artifacts??[]) {
    if(artifact.artifactKind==="form"&&artifact.form)applyFormProjection(snapshot,artifact.form);
  }
  return snapshot;
};
