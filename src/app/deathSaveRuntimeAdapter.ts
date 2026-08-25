import "./lifeRuntimeContracts";
import type { ActionVm, ActivityEntry, AppSnapshot, CharacterSheet, ResolutionView, SceneVm, SessionMode } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { applyResolutionEvents } from "./realEventApplyService";
import { projectResolutionEventsToActivity } from "./realActivityProjectionService";
import { recordRuntimeResolutionEvents } from "./runtimeResolutionEventHistory";
import { commitAdapterTurnRuntimeState, snapshotAdapterTurnRuntimeState } from "./turnRuntimeSessionRegistry";
import { persistCharacterResolutionEvents } from "./resolutionCharacterWriteBackPort";
import { SIMPLEVTT_APP_RULES_PROFILE } from "./realResolutionService";
import { resolvePendingResolution } from "../domain/resolution";
import type { DeathSaveResolution } from "../domain/life";

const ACTION_ID="action.death-save";
interface AdapterState {
  sessionMode:SessionMode;scene:SceneVm;activeCharacter:CharacterSheet;resolution:ResolutionView|null;activity:ActivityEntry[];
  lastResolutionId:string|null;lastBefore:unknown;syncChar():void;getSnapshot():Promise<AppSnapshot>;
}
type DicePrototype={d20(actionId:string,index?:number):number};
const previousGetSnapshot=MockAdapter.prototype.getSnapshot;
const previousResolveAction=MockAdapter.prototype.resolveAction;

function syncAction(scene:SceneVm) {
  for (const entity of scene.entities.filter((entry)=>entry.kind==="character")) {
    const actions=scene.actionsByActor[entity.id]??[];
    const without=actions.filter((action)=>action.id!==ACTION_ID);
    const life=entity.runtimeLife;
    if (scene.currentActorId===entity.id&&entity.hp===0&&life?.unconscious&&!life.stable&&!life.dead) {
      const action:ActionVm={
        id:ACTION_ID,actorId:entity.id,name:"죽음 내성 굴림",category:"basic",target:"self",economy:"없음",resolutionKind:"saving-throw",
        summary:`성공 ${life.deathSaves.successes}/3 · 실패 ${life.deathSaves.failures}/3`,available:true,eligibleTargetIds:[entity.id],
        details:[{label:"판정",value:"d20 · 10 이상 성공"},{label:"20",value:"HP 1로 회복"},{label:"1",value:"실패 2회"}],
      };
      scene.actionsByActor[entity.id]=[...without,action];
    } else scene.actionsByActor[entity.id]=without;
  }
}

MockAdapter.prototype.getSnapshot=async function getSnapshotWithDeathSaveAction() {
  const internal=this as unknown as AdapterState;
  syncAction(internal.scene);
  const snapshot=await previousGetSnapshot.call(this);
  syncAction(snapshot.scene);
  return snapshot;
};

MockAdapter.prototype.resolveAction=async function resolveDeathSaveFromHotbar(actionId:string,targetIds:string[]) {
  if (actionId!==ACTION_ID) return previousResolveAction.call(this,actionId,targetIds);
  const internal=this as unknown as AdapterState;
  if (internal.sessionMode!=="initiative") return internal.getSnapshot();
  const state=snapshotAdapterTurnRuntimeState(this,internal.scene);
  const actorId=internal.scene.currentActorId;
  const actor=state?.combatants[actorId];
  if (!state||!actor||actorId!==internal.activeCharacter.id||targetIds.some((id)=>id!==actorId)) return internal.getSnapshot();
  const face=(MockAdapter.prototype as unknown as DicePrototype).d20.call(this,ACTION_ID);
  const resolutionId=`death-save.${Date.now()}.${Math.floor(Math.random()*1000)}`;
  const committed=resolvePendingResolution(SIMPLEVTT_APP_RULES_PROFILE,state,{
    id:resolutionId,actorId,sourceId:"profile:dnd.srd-5.2.1/death-saving-throw",expectedRevision:state.revision,
    operations:[{id:`${resolutionId}:death-save`,kind:"death-save",actorId,dice:{id:`${resolutionId}:d20`,purpose:"death saving throw",sides:20,faces:[face]}}],
  });
  if (committed.status==="rejected") return internal.getSnapshot();
  const projected=applyResolutionEvents(internal.scene,committed.events);
  if (projected.status==="rejected") return internal.getSnapshot();
  const writeBack=await persistCharacterResolutionEvents(this,committed.events,"forward");
  if (writeBack.status==="rejected") return internal.getSnapshot();
  if (!commitAdapterTurnRuntimeState(this,internal.scene,state.revision,committed.state)) {
    if (writeBack.changed) await persistCharacterResolutionEvents(this,committed.events,"inverse");
    return internal.getSnapshot();
  }
  internal.scene=projected.scene;
  const result=committed.results[`${resolutionId}:death-save`] as DeathSaveResolution;
  internal.activeCharacter.hp=result.next.hp.current;
  internal.activeCharacter.durableLifeFlags={stable:result.next.stable,unconscious:result.next.unconscious,dead:result.next.dead,deathSaves:{...result.next.deathSaves}};
  const outcome={success:"성공",failure:"실패",stable:"안정화",dead:"사망",revived:"HP 1 회복"}[result.outcome];
  const resolution:ResolutionView={
    id:resolutionId,actorId,targetIds:[actorId],actionId:ACTION_ID,actionName:"죽음 내성 굴림",rollKind:"save",stage:"complete",
    authoritativeDice:[face],rollTotal:result.total,saveResults:[],damageComponents:[],compact:`d20 ${face} · ${outcome}`,
    detail:[`성공 ${result.next.deathSaves.successes}/3 · 실패 ${result.next.deathSaves.failures}/3`],
    provenance:["SRD 5.2.1 · Death Saving Throw"],calculatedOutcome:outcome,finalOutcome:outcome,stateChanges:projected.stateChanges,
    adjudicated:false,canAdvance:false,
  };
  internal.resolution=resolution;
  internal.activity.unshift(projectResolutionEventsToActivity({resolution,events:committed.events,actorName:internal.activeCharacter.name,targetNames:[internal.activeCharacter.name]}));
  internal.lastResolutionId=resolutionId;internal.lastBefore=null;
  recordRuntimeResolutionEvents(this,resolutionId,committed.events);
  internal.syncChar();
  return internal.getSnapshot();
};
