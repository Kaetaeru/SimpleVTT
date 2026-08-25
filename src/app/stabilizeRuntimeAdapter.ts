import "./lifeRuntimeContracts";
import type { ActionVm, ActivityEntry, AppRole, AppSnapshot, CharacterSheet, ResolutionView, SceneEntity, SceneVm, SessionMode } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { applyResolutionEvents } from "./realEventApplyService";
import { projectResolutionEventsToActivity } from "./realActivityProjectionService";
import { recordRuntimeResolutionEvents } from "./runtimeResolutionEventHistory";
import { commitAdapterTurnRuntimeState, snapshotAdapterTurnRuntimeState } from "./turnRuntimeSessionRegistry";
import { persistCharacterResolutionEvents } from "./resolutionCharacterWriteBackPort";
import { SIMPLEVTT_APP_RULES_PROFILE } from "./realResolutionService";
import { resolvePendingResolution } from "../domain/resolution";
import type { D20TestResult } from "../domain/d20";

const ACTION_ID="action.standard.stabilize";
const SOURCE="profile:dnd.srd-5.2.1/stabilize";
type DicePrototype={d20(actionId:string,index?:number):number};
interface AdapterState {
  role:AppRole;sessionMode:SessionMode;scene:SceneVm;activeCharacter:CharacterSheet;resolution:ResolutionView|null;activity:ActivityEntry[];
  lastResolutionId:string|null;lastBefore:unknown;syncChar():void;getSnapshot():Promise<AppSnapshot>;
}
const previousGetSnapshot=MockAdapter.prototype.getSnapshot;
const previousResolveAction=MockAdapter.prototype.resolveAction;

function validTarget(entity:SceneEntity) {
  const life=entity.runtimeLife;
  return entity.hp===0&&Boolean(life?.unconscious&&!life.stable&&!life.dead);
}

function actorAction(scene:SceneVm) {
  for (const actorId of [scene.selectedActorId,scene.currentActorId,...Object.keys(scene.actionsByActor)]) {
    const action=scene.actionsByActor[actorId]?.find((entry)=>entry.id===ACTION_ID);
    if (action) return action;
  }
}

function syncActions(internal:AdapterState,scene:SceneVm) {
  const targetIds=scene.entities.filter(validTarget).map((entry)=>entry.id);
  for (const [actorId,actions] of Object.entries(scene.actionsByActor)) {
    const without=actions.filter((entry)=>entry.id!==ACTION_ID);
    const actor=scene.entities.find((entry)=>entry.id===actorId);
    if (!actor||actor.kind!=="character"||actor.runtimeLife?.unconscious||actor.runtimeLife?.dead||actor.status.includes("행동불능")) { scene.actionsByActor[actorId]=without;continue; }
    const medicine=actions.find((entry)=>entry.id==="action.skill.medicine");
    const economy=scene.economyByActor[actorId];
    const available=targetIds.length>0&&(internal.sessionMode!=="initiative"||Boolean(economy?.action||economy?.extraActions?.length));
    const action:ActionVm={
      id:ACTION_ID,actorId,name:"안정화",category:"basic",target:"any",economy:"행동",resolutionKind:"ability-check",
      summary:`의학 DC 10 · 쓰러진 대상 ${targetIds.length}명`,available,
      disabledReason:available?undefined:targetIds.length?"행동을 이미 사용했습니다.":"HP 0의 불안정한 대상이 없습니다.",
      eligibleTargetIds:[...targetIds],eligibleTargetReasons:Object.fromEntries(scene.entities.filter((entry)=>!targetIds.includes(entry.id)).map((entry)=>[entry.id,"HP 0의 불안정한 대상만 안정화할 수 있습니다."])),
      checkBonus:medicine?.checkBonus??0,maxTargets:1,
      details:[{label:"판정",value:`의학 ${medicine?.summary??"+0"}`},{label:"DC",value:"10"},{label:"성공",value:"죽음 내성굴림을 멈추고 안정화"},{label:"출처",value:"SRD 5.2.1 · Stabilize"}],
    };
    scene.actionsByActor[actorId]=[...without,action];
  }
}

MockAdapter.prototype.getSnapshot=async function getSnapshotWithStabilizeAction() {
  const internal=this as unknown as AdapterState;
  syncActions(internal,internal.scene);
  const snapshot=await previousGetSnapshot.call(this);
  syncActions(internal,snapshot.scene);
  return snapshot;
};

MockAdapter.prototype.resolveAction=async function resolveStabilize(actionId:string,targetIds:string[]) {
  if (actionId!==ACTION_ID) return previousResolveAction.call(this,actionId,targetIds);
  const internal=this as unknown as AdapterState;
  const snapshot=await internal.getSnapshot();
  const action=actorAction(snapshot.scene);
  const targetId=targetIds[0];
  if (!action?.available||targetIds.length!==1||!action.eligibleTargetIds.includes(targetId)) return snapshot;
  if (internal.sessionMode==="initiative"&&internal.role==="player"&&action.actorId!==internal.scene.currentActorId) return snapshot;
  const state=snapshotAdapterTurnRuntimeState(this,internal.scene);
  if (!state?.combatants[action.actorId]||!state.combatants[targetId]) return snapshot;
  const resolutionId=`stabilize.${Date.now()}.${Math.floor(Math.random()*1000)}`;
  const rollId=`${resolutionId}:medicine`;
  const faces=[0,1].map((index)=>(MockAdapter.prototype as unknown as DicePrototype).d20.call(this,ACTION_ID,index));
  const committed=resolvePendingResolution(SIMPLEVTT_APP_RULES_PROFILE,state,{
    id:resolutionId,actorId:action.actorId,sourceId:SOURCE,expectedRevision:state.revision,
    operations:[
      ...(internal.sessionMode==="initiative"?[{id:`${resolutionId}:economy`,kind:"use-economy" as const,actorId:action.actorId,slot:"action" as const,actionKind:"other" as const}]:[]),
      {id:rollId,kind:"d20",actorId:action.actorId,targetId,request:{family:"ability-check",target:10,targetSource:"SRD 5.2.1 · Stabilize DC",modifierContributions:[{source:"Character Medicine modifier",value:action.checkBonus??0}],dice:{id:`${resolutionId}:d20`,purpose:"Medicine check to stabilize",sides:20,faces}},condition:{ability:"wis"}},
      {id:`${resolutionId}:stabilize`,kind:"stabilize",targetId,when:{operationId:rollId,field:"outcome",equals:"success"}},
    ],
  });
  if (committed.status==="rejected") return snapshot;
  const projected=applyResolutionEvents(internal.scene,committed.events);
  if (projected.status==="rejected") return snapshot;
  const writeBack=await persistCharacterResolutionEvents(this,committed.events,"forward");
  if (writeBack.status==="rejected") return snapshot;
  if (!commitAdapterTurnRuntimeState(this,internal.scene,state.revision,committed.state)) {
    if (writeBack.changed) await persistCharacterResolutionEvents(this,committed.events,"inverse");
    return snapshot;
  }
  internal.scene=projected.scene;
  const roll=committed.results[rollId] as D20TestResult;
  const target=internal.scene.entities.find((entry)=>entry.id===targetId)!;
  const outcome=roll.outcome==="success"?"안정화 성공":"안정화 실패";
  const resolution:ResolutionView={
    id:resolutionId,actorId:action.actorId,targetIds:[targetId],actionId:ACTION_ID,actionName:"안정화",rollKind:"check",stage:"complete",
    authoritativeDice:[...roll.dice.faces],rollTotal:roll.total,checkTarget:10,checkOutcome:roll.outcome==="success"?"성공":"실패",saveResults:[],damageComponents:[],compact:`의학 ${roll.total} vs DC 10 · ${outcome}`,
    detail:[`d20 ${roll.natural} + ${roll.modifier} = ${roll.total}`],provenance:["SRD 5.2.1 · Stabilize"],calculatedOutcome:outcome,finalOutcome:outcome,
    stateChanges:projected.stateChanges,adjudicated:false,canAdvance:false,
  };
  internal.resolution=resolution;
  internal.activity.unshift(projectResolutionEventsToActivity({resolution,events:committed.events,actorName:internal.scene.entities.find((entry)=>entry.id===action.actorId)?.name??action.actorId,targetNames:[target.name]}));
  internal.lastResolutionId=resolutionId;internal.lastBefore=null;
  recordRuntimeResolutionEvents(this,resolutionId,committed.events);
  internal.syncChar();
  return internal.getSnapshot();
};
