import type { ActivityEntry, AppSnapshot, CharacterSheet, ResolutionView, SceneVm } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { applyResolutionEvents } from "./realEventApplyService";
import { runtimeResolutionEventHistories } from "./runtimeResolutionEventHistory";
import { projectTurnRuntimeToScene } from "./realTurnRuntimeService";
import { commitAdapterTurnRuntimeState, snapshotAdapterTurnRuntimeState, turnRuntimeSessions } from "./turnRuntimeSessionRegistry";
import { persistCharacterResolutionEvents } from "./resolutionCharacterWriteBackPort";
import { SIMPLEVTT_APP_RULES_PROFILE } from "./realResolutionService";
import { DIVINE_SMITE_ID, PALADIN_ID } from "../domain/classFeatureSpellResources";
import {
  DEVOTION_SMITE_OF_PROTECTION_FEATURE_ID,
  resolveDevotionSmiteOfProtection,
} from "../domain/paladinDevotion";
import { PALADIN_DEVOTION_SUBCLASS_ID } from "../domain/srdSubclassCatalog";

interface AdapterState {
  scene:SceneVm;
  activeCharacter:CharacterSheet;
  resolution:ResolutionView|null;
  activity:ActivityEntry[];
  lastResolutionId:string|null;
  syncChar():void;
  getSnapshot():Promise<AppSnapshot>;
}

const previousResolveAction=MockAdapter.prototype.resolveAction;
const handledResolutionIds=new WeakMap<MockAdapter,Set<string>>();

function paladinLevel(character:CharacterSheet) {
  return character.classLevels?.find((entry)=>entry.classId===PALADIN_ID)?.level??0;
}

function qualifies(character:CharacterSheet) {
  return paladinLevel(character)>=15
    && character.subclassIds?.[PALADIN_ID]===PALADIN_DEVOTION_SUBCLASS_ID;
}

function handled(adapter:MockAdapter,resolutionId:string) {
  return handledResolutionIds.get(adapter)?.has(resolutionId)??false;
}

function markHandled(adapter:MockAdapter,resolutionId:string) {
  const ids=handledResolutionIds.get(adapter)??new Set<string>();
  ids.add(resolutionId);
  handledResolutionIds.set(adapter,ids);
}

function refreshActivity(internal:AdapterState,resolution:ResolutionView) {
  const activity=internal.activity.find((entry)=>entry.id===resolution.id);
  if(!activity)return;
  activity.summary=resolution.compact;
  activity.detail=[...resolution.detail,...resolution.provenance.map((entry)=>`출처: ${entry}`)];
  activity.stateChanges=[...resolution.stateChanges];
}

MockAdapter.prototype.resolveAction=async function resolveWithDevotionSmiteOfProtection(actionId:string,targetIds:string[]) {
  const internal=this as unknown as AdapterState;
  const before=await internal.getSnapshot();
  const sourceAction=(before.scene.actionsByActor[before.activeCharacter.id]??[]).find((entry)=>entry.id===actionId);
  const isDivineSmite=sourceAction?.spellCast?.spellId===DIVINE_SMITE_ID;
  const snapshot=await previousResolveAction.call(this,actionId,targetIds);
  const resolution=internal.resolution;

  if(!isDivineSmite||!qualifies(internal.activeCharacter)||!resolution||internal.lastResolutionId!==resolution.id||handled(this,resolution.id))return snapshot;
  const history=runtimeResolutionEventHistories.get(this);
  if(!history||history.resolutionId!==resolution.id)return snapshot;
  const state=snapshotAdapterTurnRuntimeState(this,internal.scene);
  if(!state?.combatants[internal.activeCharacter.id])return snapshot;

  const committed=resolveDevotionSmiteOfProtection(SIMPLEVTT_APP_RULES_PROFILE,state,{
    id:`${resolution.id}:smite-of-protection`,
    actorId:internal.activeCharacter.id,
    expectedRevision:state.revision,
    paladinLevel:paladinLevel(internal.activeCharacter),
    subclassId:internal.activeCharacter.subclassIds?.[PALADIN_ID],
    divineSmiteCast:true,
  });
  if(committed.status==="rejected")return snapshot;

  const projected=applyResolutionEvents(internal.scene,committed.events,internal.activeCharacter.resources,internal.activeCharacter.items,state);
  if(projected.status==="rejected")return snapshot;
  const writeBack=await persistCharacterResolutionEvents(this,committed.events,"forward");
  if(writeBack.status==="rejected")return snapshot;
  if(!commitAdapterTurnRuntimeState(this,internal.scene,state.revision,committed.state)){
    if(writeBack.changed)await persistCharacterResolutionEvents(this,committed.events,"inverse");
    return snapshot;
  }

  internal.scene=projected.scene;
  internal.activeCharacter.resources=projected.resources;
  const session=turnRuntimeSessions.get(this);
  if(session)projectTurnRuntimeToScene(session,internal.scene);
  markHandled(this,resolution.id);
  resolution.detail.push("보호의 강타: 다음 턴 시작까지 보호의 오라 안의 자신과 아군에게 절반 엄폐를 부여합니다.");
  resolution.provenance.push(`SRD 5.2.1 · Oath of Devotion · Smite of Protection · ${DEVOTION_SMITE_OF_PROTECTION_FEATURE_ID}`);
  resolution.stateChanges.push(...projected.stateChanges);
  runtimeResolutionEventHistories.set(this,{
    resolutionId:resolution.id,
    events:[...history.events.map((event)=>structuredClone(event)),...committed.events.map((event)=>structuredClone(event))],
  });
  refreshActivity(internal,resolution);
  internal.syncChar();
  return internal.getSnapshot();
};
