import "./installedContentContracts";
import type { AppSnapshot, CatalogEntry, CharacterSheet, ResolutionView, SceneVm, SessionMode } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { buildCharacterSessionProjectionV1 } from "./characterSessionProjection";
import {
  projectedCharacterById,
  projectedCharacterIds,
  synchronizeProjectedCharacterResources,
} from "./characterSessionProjectionRegistry";
import { catalogQualifiedId } from "./contentCatalogIdentity";
import { requiredSessionInstalledContent } from "./installedContentRuntimeAdapter";
import { appendAdapterInterruptEvents, projectAdapterTurnRuntime } from "./phase09RealTurnRuntimeAdapter";
import { persistCharacterResolutionEvents } from "./resolutionCharacterWriteBackPort";
import { SIMPLEVTT_APP_RULES_PROFILE } from "./realResolutionService";
import { commitAdapterTurnRuntimeState, snapshotAdapterTurnRuntimeState } from "./turnRuntimeSessionRegistry";
import { parseCommonPlayDefinition } from "../domain/commonPlayDefinitionRuntime";
import { lowerCommonPlayReactionDefinition } from "../domain/commonPlayReactionDefinitionRuntime";
import {
  resumeCommonPlayInteraction,
  startCommonPlayResolution,
  type AwaitingCommonPlayInteraction,
  type CommonPlayInteractionAuthority,
  type CommonPlayReactionDefinition,
} from "../domain/commonPlayRuntime";
import type { RulesRuntimeState } from "../domain/combatState";
import type { D20TestResult, ModifierContribution } from "../domain/d20";
import type { DamageRollResolution } from "../domain/damageRoll";
import type { PendingResolution, ResolutionEvent } from "../domain/resolutionTypes";
import {
  COMMON_PLAY_STANDARD_FACTS,
  resolveCommonPlayFactPredicate,
  type CommonPlayFactProvider,
} from "../domain/commonPlaySpatialFactRuntime";
import { authoritativeCommonPlaySpatialRelation } from "./realSpatialRuntimeService";
import { previewRuntimeAtomicAttackDamage } from "./phase09RealRuntimeAttackAdapter";
import { queueAtomicAttackDamageReduction } from "./realAttackTransactionService";

interface AdapterState {
  sessionMode:SessionMode;
  scene:SceneVm;
  activeCharacter:CharacterSheet;
  catalog:CatalogEntry[];
  resolution:ResolutionView|null;
  d20(actionId:string,index?:number):number;
  syncChar():void;
  getSnapshot():Promise<AppSnapshot>;
}

type PassiveReactionCandidate={
  key:string;
  sourceActorId:string;
  sourceActorName:string;
  source:string;
  optionName:string;
  sheet:CharacterSheet;
  definition:CommonPlayReactionDefinition;
};

type PendingPassiveReaction={
  resolutionId:string;
  operationId:string;
  kind:"d20"|"damage";
  originalTotal?:number;
  candidate:PassiveReactionCandidate;
  awaiting:AwaitingCommonPlayInteraction;
};

type ResolutionReactionState={resolutionId:string;handled:Set<string>};

const previousAdvanceResolution=MockAdapter.prototype.advanceResolution;
const previousRespondToInterrupt=MockAdapter.prototype.respondToInterrupt;
const pendingByAdapter=new WeakMap<MockAdapter,PendingPassiveReaction>();
const reactionStateByAdapter=new WeakMap<MockAdapter,ResolutionReactionState>();

function reactionState(adapter:MockAdapter,resolutionId:string) {
  const current=reactionStateByAdapter.get(adapter);
  if(current?.resolutionId===resolutionId)return current;
  const next:ResolutionReactionState={resolutionId,handled:new Set()};
  reactionStateByAdapter.set(adapter,next);
  return next;
}

function literalDice(value:string) {
  const match=/^([0-9]+)d([0-9]+)([+-][0-9]+)?$/.exec(value.trim());
  if(!match)throw new Error(`invalid Common Play modifier dice: ${value}`);
  return {count:Number(match[1]),sides:Number(match[2])};
}

function drawDie(internal:AdapterState,purpose:string,sides:number,index:number) {
  const limit=20-(20%sides);
  let face:number;
  let draw=index;
  do face=internal.d20(purpose,draw++); while(face>limit);
  return {face:((face-1)%sides)+1,nextDraw:draw};
}

function modifierAuthority(internal:AdapterState,pending:PendingPassiveReaction):CommonPlayInteractionAuthority|undefined {
  const interceptor=pending.awaiting.context.definition.interceptors.find((entry)=>entry.id===pending.awaiting.context.interceptorId);
  if(!interceptor||(interceptor.slot!=="d20.roll"&&interceptor.slot!=="primary.damage"))return undefined;
  const modifierDiceFaces:Record<number,number[]>={};
  let drawIndex=0;
  interceptor.operations.forEach((operation,index)=>{
    const formula=literalDice(operation.dice);
    const faces:number[]=[];
    for(let die=0;die<formula.count;die+=1){
      const drawn=drawDie(internal,`common-play:${pending.candidate.definition.id}:${interceptor.id}`,formula.sides,drawIndex);
      faces.push(drawn.face);
      drawIndex=drawn.nextDraw;
    }
    modifierDiceFaces[index]=faces;
  });
  return {modifierDiceFaces};
}

function catalogEntryMatchesItem(entry:CatalogEntry,item:CharacterSheet["items"][number]) {
  const token=item.definitionId.trim();
  return entry.category==="item"&&Boolean(token)&&(
    entry.id===token||entry.contentId===token||entry.nameKo===token||entry.nameEn===token
  );
}

function contentIdentitySetForLocal(internal:AdapterState) {
  const identities=new Set<string>();
  try {
    for(const identity of buildCharacterSessionProjectionV1(internal.activeCharacter,internal.catalog).contentIdentities) identities.add(identity.qualifiedId);
  } catch {
    // Legacy/reference Characters can fail the full SessionProjection envelope for unrelated
    // source-model reasons. Passive item ownership still has a direct canonical catalog fact.
  }
  for(const item of internal.activeCharacter.items) {
    const matches=internal.catalog.filter((entry)=>catalogEntryMatchesItem(entry,item));
    if(matches.length===1)identities.add(matches[0].id);
  }
  return identities;
}

async function passiveReactionCandidates(adapter:MockAdapter):Promise<PassiveReactionCandidate[]> {
  const internal=adapter as unknown as AdapterState;
  const installed=await requiredSessionInstalledContent(adapter,[]);
  if(!installed.length)return [];
  const entries=new Map(installed.map((entry)=>[catalogQualifiedId(entry.contentId,entry.sourceId,entry.version),entry]));
  const owners:Array<{sheet:CharacterSheet;identities:Set<string>}>=[{
    sheet:internal.activeCharacter,
    identities:contentIdentitySetForLocal(internal),
  }];
  for(const characterId of projectedCharacterIds(adapter)){
    if(characterId===internal.activeCharacter.id)continue;
    const mounted=projectedCharacterById(adapter,characterId);
    if(mounted)owners.push({sheet:mounted.sheet,identities:new Set(mounted.projection.contentIdentities.map((entry)=>entry.qualifiedId))});
  }

  const candidates:PassiveReactionCandidate[]=[];
  for(const owner of owners){
    for(const qualifiedId of [...owner.identities].sort()){
      const entry=entries.get(qualifiedId);
      if(!entry)continue;
      for(const [mechanicIndex,mechanic] of (entry.mechanics??[]).entries()){
        if(mechanic.kind!=="common-play")continue;
        const canonical=parseCommonPlayDefinition(mechanic.config,`Installed passive Common Play ${qualifiedId} mechanic ${mechanicIndex}`);
        const definition=lowerCommonPlayReactionDefinition(canonical);
        if(!definition)continue;
        for(const interceptor of definition.interceptors){
          const responder=interceptor.interaction.responder;
          if(responder!=="actor"&&responder!=="actor-owner")continue;
          candidates.push({
            key:`${owner.sheet.id}:${qualifiedId}:${canonical.id}:${interceptor.id}`,
            sourceActorId:owner.sheet.id,
            sourceActorName:owner.sheet.name,
            source:entry.source,
            optionName:entry.nameKo||entry.nameEn||entry.contentId,
            sheet:structuredClone(owner.sheet),
            definition:{...definition,interceptors:[interceptor]},
          });
        }
      }
    }
  }
  return candidates.sort((left,right)=>left.key.localeCompare(right.key,"en"));
}

function seededReactionState(state:RulesRuntimeState,candidate:PassiveReactionCandidate) {
  const next=structuredClone(state);
  const combatant=next.combatants[candidate.sourceActorId];
  if(!combatant)return next;
  const resourceIds=new Set(candidate.definition.payments.flatMap((payment)=>payment.kind==="resource"?[payment.resource]:[]));
  for(const resourceId of resourceIds){
    if(combatant.resources.some((entry)=>entry.id===resourceId))continue;
    const source=candidate.sheet.resources.find((entry)=>entry.id===resourceId);
    if(source)combatant.resources.push({
      id:source.id,label:source.label,current:source.current,maximum:source.max,
      recovery:source.recovery?structuredClone(source.recovery):undefined,
    });
  }
  return next;
}

function d20Contributions(resolution:ResolutionView):ModifierContribution[] {
  if(resolution.rollModifierContributions?.length)return resolution.rollModifierContributions.map((entry)=>({...entry}));
  const natural=resolution.naturalD20??resolution.authoritativeDice[0];
  const total=resolution.rollTotal;
  if(natural===undefined||total===undefined)return [];
  return [{source:`production-resolution:${resolution.actionId}:base-modifier`,value:total-natural}];
}

function pendingD20(resolution:ResolutionView,state:RulesRuntimeState):{pending:PendingResolution;operationId:string}|undefined {
  const natural=resolution.naturalD20??resolution.authoritativeDice[0];
  if(natural===undefined||!Number.isInteger(natural)||natural<1||natural>20)return undefined;
  const common={
    modifierContributions:d20Contributions(resolution),
    dice:{id:`${resolution.id}:common-play:d20`,purpose:resolution.actionName,sides:20,faces:[natural]},
  };
  if(resolution.rollKind==="check"&&resolution.checkOutcome==="성공"&&Number.isFinite(resolution.checkTarget)){
    const operationId=`op.${resolution.actionId}.ability-check`;
    return {operationId,pending:{
      id:`${resolution.id}:common-play-interceptor`,actorId:resolution.actorId,sourceId:resolution.actionId,
      expectedRevision:state.revision,
      operations:[{id:operationId,kind:"d20",actorId:resolution.actorId,request:{family:"ability-check",target:resolution.checkTarget!,...common}}],
    }};
  }
  if(resolution.rollKind==="attack"&&resolution.stage==="attack-result"&&resolution.attackOutcome==="명중"&&Number.isFinite(resolution.targetAc)){
    const operationId=`op.${resolution.actionId}.attack-roll`;
    return {operationId,pending:{
      id:`${resolution.id}:common-play-interceptor`,actorId:resolution.actorId,sourceId:resolution.actionId,
      expectedRevision:state.revision,
      operations:[{id:operationId,kind:"d20",actorId:resolution.actorId,targetId:resolution.targetIds[0],request:{
        family:"attack-roll",target:resolution.targetAc!,targetSource:`target:${resolution.targetIds[0]}:ac`,...common,
        criticalThreshold:resolution.critical?natural:undefined,
      }}],
    }};
  }
  return undefined;
}

function pendingDamage(adapter:MockAdapter,resolution:ResolutionView,state:RulesRuntimeState) {
  const preview=previewRuntimeAtomicAttackDamage(adapter);
  if(!preview)return undefined;
  const operationId=`op.${resolution.actionId}.primary-damage`;
  return {operationId,originalTotal:preview.total,pending:{
    id:`${resolution.id}:common-play-damage-interceptor`,actorId:resolution.actorId,sourceId:resolution.actionId,
    expectedRevision:state.revision,
    operations:[{id:operationId,kind:"damage-roll" as const,request:{dice:[],flat:[{source:`production-resolution:${resolution.actionId}:authoritative-damage`,value:preview.total}]}}],
  }};
}

function factSubjectId(candidate:PassiveReactionCandidate,pending:PendingResolution,subject:string|undefined) {
  const intercepted=pending.operations.find((operation)=>operation.kind==="d20"&&(operation.request.family==="ability-check"||operation.request.family==="attack-roll"));
  if(!intercepted||intercepted.kind!=="d20")return !subject||subject==="intercepted.actor"?pending.actorId:subject==="interceptor.source"?candidate.sourceActorId:undefined;
  if(!subject||subject==="intercepted.actor")return intercepted.actorId;
  if(subject==="intercepted.target")return intercepted.targetId;
  if(subject==="interceptor.source")return candidate.sourceActorId;
  return undefined;
}

function interceptorFactProvider(internal:AdapterState,candidate:PassiveReactionCandidate,pending:PendingResolution):CommonPlayFactProvider {
  return {
    id:"simplevtt.authoritative-spatial",
    resolve(query){
      const subjectId=factSubjectId(candidate,pending,query.subject);
      if(!subjectId)return {status:"unsupported",reason:`unsupported interceptor fact subject: ${query.subject??"intercepted.actor"}`};
      const relation=authoritativeCommonPlaySpatialRelation(internal.scene,candidate.sourceActorId,subjectId);
      if(!relation)return {status:"unknown"};
      if(query.fact==="spatial.distance-feet")return {status:"answered",value:relation.distanceFeet};
      if(query.fact==="spatial.adjacent")return {status:"answered",value:relation.distanceFeet<=5};
      if(query.fact==="spatial.total-cover")return {status:"answered",value:relation.cover==="total"};
      if(query.fact==="sense.can-see")return {status:"answered",value:relation.visible};
      return {status:"unknown"};
    },
  };
}

async function interceptorEligible(internal:AdapterState,candidate:PassiveReactionCandidate,pending:PendingResolution) {
  const interceptor=candidate.definition.interceptors[0];
  if(!interceptor?.eligibility)return true;
  const result=await resolveCommonPlayFactPredicate({
    registry:COMMON_PLAY_STANDARD_FACTS,
    queries:interceptor.eligibility.factQueries,
    predicate:interceptor.eligibility.when,
    resolutionId:pending.id,
    expectedRevision:pending.expectedRevision,
    provider:interceptorFactProvider(internal,candidate,pending),
  });
  return result.status==="eligible";
}

function interactionCost(definition:CommonPlayReactionDefinition) {
  return definition.payments.map((payment)=>payment.kind==="economy"?payment.bucket:`${payment.resource} ${payment.amount.value}`).join(" + ")||"비용 없음";
}

async function offerPassiveReaction(adapter:MockAdapter) {
  const internal=adapter as unknown as AdapterState;
  const resolution=internal.resolution;
  if(!resolution||resolution.interrupt||internal.sessionMode!=="initiative")return false;
  const runtime=snapshotAdapterTurnRuntimeState(adapter,internal.scene);
  if(!runtime)return false;
  const state=reactionState(adapter,resolution.id);
  for(const candidate of await passiveReactionCandidates(adapter)){
    if(state.handled.has(candidate.key)||!runtime.combatants[candidate.sourceActorId])continue;
    const interceptor=candidate.definition.interceptors[0];
    const damage=interceptor?.slot==="primary.damage";
    const projected=damage?pendingDamage(adapter,resolution,runtime):pendingD20(resolution,runtime);
    if(!projected)continue;
    const seeded=seededReactionState(runtime,candidate);
    if(!await interceptorEligible(internal,candidate,projected.pending)){
      state.handled.add(candidate.key);
      continue;
    }
    const started=startCommonPlayResolution(SIMPLEVTT_APP_RULES_PROFILE,seeded,projected.pending,candidate.definition,candidate.sourceActorId);
    if(started.status!=="awaiting-input"){
      state.handled.add(candidate.key);
      continue;
    }
    pendingByAdapter.set(adapter,{resolutionId:resolution.id,operationId:projected.operationId,kind:damage?"damage":"d20",originalTotal:"originalTotal" in projected?projected.originalTotal:undefined,candidate,awaiting:started});
    if(damage)resolution.rollKind="damage";
    resolution.interrupt={
      id:started.interaction.id,
      responderId:candidate.sourceActorId,
      responderName:candidate.sourceActorName,
      trigger:damage
        ? `${resolution.actionName} 피해 굴림 ${"originalTotal" in projected?projected.originalTotal:"—"}`
        : resolution.rollKind==="attack"
        ? `${resolution.actionName} ${resolution.attackTotal} vs AC ${resolution.targetAc}`
        : `${resolution.actionName} ${resolution.rollTotal} vs DC ${resolution.checkTarget}`,
      optionName:candidate.optionName,
      cost:interactionCost(candidate.definition),
      effect:damage?"피해 굴림을 Common Play 인터셉터로 재계산합니다.":"성공한 d20 결과를 Common Play 인터셉터로 재계산합니다.",
      source:candidate.source,
    };
    resolution.stage="interrupt";
    resolution.canAdvance=false;
    resolution.nextLabel=undefined;
    return true;
  }
  return false;
}

function paymentEvents(events:ResolutionEvent[]) {
  return events.filter((event)=>event.stateChanges.length>0).map((event)=>structuredClone(event));
}

function updateD20Presentation(resolution:ResolutionView,pending:PendingPassiveReaction,result:D20TestResult,authority?:CommonPlayInteractionAuthority) {
  const before=d20Contributions(resolution);
  const beforeModifier=before.reduce((sum,entry)=>sum+entry.value,0);
  const delta=result.modifier-beforeModifier;
  if(delta!==0)resolution.rollModifierContributions=[...before,{source:`common-play:${pending.candidate.definition.id}`,value:delta}];
  else resolution.rollModifierContributions=before;
  resolution.rollTotal=result.total;
  const rolled=authority?.modifierDiceFaces?Object.values(authority.modifierDiceFaces).flat():[];
  if(rolled.length)resolution.detail.push(`${pending.candidate.optionName}: ${rolled.join(", ")} · ${result.total}`);
  resolution.provenance.push(`common-play:${pending.candidate.definition.id} · generic post-roll interceptor`);
  if(result.family==="ability-check"){
    resolution.checkOutcome=result.outcome==="success"?"성공":"실패";
    resolution.compact=`${result.total} vs DC ${result.target} · ${resolution.checkOutcome}`;
    resolution.calculatedOutcome=resolution.compact;
    resolution.finalOutcome=resolution.checkOutcome;
  }else{
    resolution.attackTotal=result.total;
    resolution.attackOutcome=result.outcome==="success"?"명중":"빗나감";
    resolution.critical=result.critical;
    resolution.compact=`${result.total} vs AC ${result.target} — ${resolution.attackOutcome}${result.critical?" · 치명타":""}`;
    resolution.calculatedOutcome=resolution.compact;
    resolution.finalOutcome=resolution.compact;
  }
}

async function commitAcceptedReaction(adapter:MockAdapter,pending:PendingPassiveReaction,result:Extract<ReturnType<typeof resumeCommonPlayInteraction>,{status:"committed"}>) {
  const internal=adapter as unknown as AdapterState;
  const current=snapshotAdapterTurnRuntimeState(adapter,internal.scene);
  if(!current)return {status:"rejected" as const,error:"Common Play reaction lost TurnRuntime authority"};
  const durableEvents=paymentEvents(result.events);
  const writeBack=await persistCharacterResolutionEvents(adapter,durableEvents,"forward");
  if(writeBack.status==="rejected")return writeBack;
  if(!commitAdapterTurnRuntimeState(adapter,internal.scene,current.revision,result.state)){
    if(writeBack.changed)await persistCharacterResolutionEvents(adapter,durableEvents,"inverse");
    return {status:"rejected" as const,error:"Common Play reaction TurnRuntime revision changed before commit"};
  }
  if(durableEvents.length)appendAdapterInterruptEvents(adapter,pending.resolutionId,durableEvents);
  projectAdapterTurnRuntime(adapter);
  synchronizeProjectedCharacterResources(adapter,result.state);
  internal.syncChar();
  return {status:"committed" as const};
}

function restoreInterruptedStage(resolution:ResolutionView) {
  resolution.interrupt=undefined;
  if(resolution.rollKind==="check"){
    resolution.stage="roll-animation";
    resolution.canAdvance=true;
    resolution.nextLabel="판정 적용";
  }else{
    const damage=resolution.rollKind==="damage";
    resolution.rollKind="attack";
    resolution.stage="attack-result";
    resolution.canAdvance=true;
    resolution.nextLabel=resolution.attackOutcome==="명중"?(damage?"피해 적용":"판정 적용"):"완료";
  }
}

MockAdapter.prototype.advanceResolution=async function advanceWithPortableCommonPlayInterceptors() {
  const pending=pendingByAdapter.get(this);
  if(pending&&(this as unknown as AdapterState).resolution?.id===pending.resolutionId)return (this as unknown as AdapterState).getSnapshot();
  if(await offerPassiveReaction(this))return (this as unknown as AdapterState).getSnapshot();
  return previousAdvanceResolution.call(this);
};

MockAdapter.prototype.respondToInterrupt=async function respondToPortableCommonPlayInterceptor(accept:boolean) {
  const internal=this as unknown as AdapterState;
  const resolution=internal.resolution;
  const pending=pendingByAdapter.get(this);
  if(!resolution||!pending||pending.resolutionId!==resolution.id||resolution.interrupt?.id!==pending.awaiting.interaction.id){
    return previousRespondToInterrupt.call(this,accept);
  }
  pendingByAdapter.delete(this);
  reactionState(this,resolution.id).handled.add(pending.candidate.key);
  const current=snapshotAdapterTurnRuntimeState(this,internal.scene);
  if(!current){restoreInterruptedStage(resolution);return internal.getSnapshot();}
  const seeded=seededReactionState(current,pending.candidate);
  const authority=accept?modifierAuthority(internal,pending):undefined;
  const resumed=resumeCommonPlayInteraction(SIMPLEVTT_APP_RULES_PROFILE,seeded,pending.awaiting,{
    interactionId:pending.awaiting.interaction.id,
    idempotencyKey:pending.awaiting.interaction.idempotencyKey,
    value:accept,
  },authority);
  if(resumed.status==="invalidated"){
    restoreInterruptedStage(resolution);
    resolution.detail.push(`Common Play 인터셉터 무효화: ${resumed.error}`);
    return internal.getSnapshot();
  }
  if(resumed.status==="rejected"){
    restoreInterruptedStage(resolution);
    resolution.detail.push(`Common Play 인터셉터 거부: ${resumed.error}`);
    return internal.getSnapshot();
  }
  if(resumed.status==="awaiting-input"){
    pendingByAdapter.set(this,{...pending,awaiting:resumed});
    resolution.interrupt={...resolution.interrupt!,id:resumed.interaction.id};
    return internal.getSnapshot();
  }
  if(accept){
    const committed=await commitAcceptedReaction(this,pending,resumed);
    if(committed.status==="rejected"){
      restoreInterruptedStage(resolution);
      resolution.detail.push(`Common Play 인터셉터 적용 거부: ${committed.error}`);
      return internal.getSnapshot();
    }
    if(pending.kind==="damage"){
      const damage=resumed.results[pending.operationId] as DamageRollResolution|undefined;
      if(!damage||pending.originalTotal===undefined){restoreInterruptedStage(resolution);resolution.detail.push("Common Play 피해 인터셉터 결과 누락");return internal.getSnapshot();}
      const reduction=pending.originalTotal-damage.total;
      queueAtomicAttackDamageReduction(resolution.id,reduction,`common-play:${pending.candidate.definition.id}`);
      const rolled=authority?.modifierDiceFaces?Object.values(authority.modifierDiceFaces).flat():[];
      resolution.detail.push(`${pending.candidate.optionName}: ${rolled.join(", ")} · 피해 ${pending.originalTotal} → ${damage.total}`);
      resolution.provenance.push(`common-play:${pending.candidate.definition.id} · generic damage-roll interceptor`);
    }else{
      const d20=resumed.results[pending.operationId] as D20TestResult|undefined;
      if(!d20){restoreInterruptedStage(resolution);resolution.detail.push("Common Play 인터셉터 결과 누락");return internal.getSnapshot();}
      updateD20Presentation(resolution,pending,d20,authority);
    }
  }
  restoreInterruptedStage(resolution);
  if(await offerPassiveReaction(this))return internal.getSnapshot();
  if(resolution.rollKind==="check")return previousAdvanceResolution.call(this);
  return internal.getSnapshot();
};
