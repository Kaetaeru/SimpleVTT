import "./installedContentContracts";
import type { AppSnapshot, CatalogEntry, CharacterSheet, CombatantDefinitionVm, ResolutionView, SceneVm, SessionMode } from "./contracts";
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
import { applyResolutionEvents } from "./realEventApplyService";
import { runtimeResolutionEventHistories } from "./runtimeResolutionEventHistory";
import { persistCharacterResolutionEvents } from "./resolutionCharacterWriteBackPort";
import { resolveRuntimeProfileProperty, SIMPLEVTT_APP_RULES_PROFILE } from "./realResolutionService";
import { commitAdapterTurnRuntimeState, snapshotAdapterTurnRuntimeState } from "./turnRuntimeSessionRegistry";
import { parseCommonPlayDefinition } from "../domain/commonPlayDefinitionRuntime";
import { lowerCommonPlayReactionDefinition } from "../domain/commonPlayReactionDefinitionRuntime";
import {
  applyAutomaticCommonPlayInterceptor,
  resumeCommonPlayInteraction,
  startCommonPlayResolution,
  type AwaitingCommonPlayInteraction,
  type CommonPlayInteractionAuthority,
  type CommonPlayReactionDefinition,
} from "../domain/commonPlayRuntime";
import { itemEntryById, itemMechanic } from "./characterCreationV10Data";
import { compatibleItemDefinitionId } from "./sessionInventoryRuntimeAdapter";
import type { RulesRuntimeState } from "../domain/combatState";
import type { D20TestResult, ModifierContribution } from "../domain/d20";
import type { DamageRollResolution } from "../domain/damageRoll";
import type { PendingResolution, ResolutionEvent, ResolutionOperation } from "../domain/resolutionTypes";
import {
  COMMON_PLAY_STANDARD_FACTS,
  resolveCommonPlayFactPredicate,
  type CommonPlayFactProvider,
} from "../domain/commonPlaySpatialFactRuntime";
import { authoritativeCommonPlaySpatialRelation } from "./realSpatialRuntimeService";
import { resolveRuntimeCreatureType } from "./realRuntimeStatProvider";
import { resolveCommonPlaySenses, type CommonPlaySense } from "../domain/commonPlaySenseRuntime";
import { previewRuntimeAtomicAttackDamage } from "./phase09RealRuntimeAttackAdapter";
import { queueAtomicAttackDamageReduction } from "./realAttackTransactionService";

interface AdapterState {
  sessionMode:SessionMode;
  scene:SceneVm;
  activeCharacter:CharacterSheet;
  catalog:CatalogEntry[];
  combatantDefinitions:CombatantDefinitionVm[];
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
  resumeCheckAfterResponse:boolean;
  candidate:PassiveReactionCandidate;
  awaiting:AwaitingCommonPlayInteraction;
};

type ResolutionReactionState={resolutionId:string;handled:Set<string>};

const previousResolveAction=MockAdapter.prototype.resolveAction;
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

function modifierAuthority(internal:AdapterState,pending:Pick<PendingPassiveReaction,"candidate">&{interceptorId:string}):CommonPlayInteractionAuthority|undefined {
  const interceptor=pending.candidate.definition.interceptors.find((entry)=>entry.id===pending.interceptorId);
  if(!interceptor||(interceptor.slot!=="d20.roll"&&interceptor.slot!=="primary.damage"))return undefined;
  const modifierDiceFaces:Record<number,number[]>={};
  let drawIndex=0;
  interceptor.operations.forEach((operation,index)=>{
    if(operation.mode!=="add-die"&&operation.mode!=="subtract-die"&&operation.mode!=="reroll")return;
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

function catalogEntryMatchesFeature(entry:CatalogEntry,featureId:string) {
  const token=featureId.trim();
  return (entry.category==="option"||entry.category==="feat")&&Boolean(token)&&(
    entry.id===token||entry.contentId===token||entry.nameKo===token||entry.nameEn===token
  );
}

function catalogEntryMatchesSubclass(entry:CatalogEntry,subclassId:string) {
  const token=subclassId.trim();
  return entry.category==="subclass"&&Boolean(token)&&(
    entry.id===token||entry.contentId===token||entry.nameKo===token||entry.nameEn===token
  );
}

const ACTOR_CLASS_LEVEL_REF="actor.class-level:";
function ownerNumericReference(sheet:CharacterSheet,ref:string) {
  if(!ref.startsWith(ACTOR_CLASS_LEVEL_REF))return undefined;
  const classId=ref.slice(ACTOR_CLASS_LEVEL_REF.length);
  if(!classId)return undefined;
  return sheet.classLevels?.find((entry)=>entry.classId===classId)?.level;
}

function contentIdentitySetForLocal(internal:AdapterState) {
  const identities=new Set<string>();
  try {
    for(const identity of buildCharacterSessionProjectionV1(internal.activeCharacter,internal.catalog).contentIdentities) identities.add(identity.qualifiedId);
  } catch {
    // Legacy/reference Characters can fail the full SessionProjection envelope for unrelated
    // source-model reasons. Passive item ownership still has a direct canonical catalog fact.
  }
  for(const subclassId of Object.values(internal.activeCharacter.subclassIds ?? {})) {
    const matches=internal.catalog.filter((entry)=>catalogEntryMatchesSubclass(entry,subclassId));
    if(matches.length===1)identities.add(matches[0].id);
  }
  for(const item of internal.activeCharacter.items) {
    const matches=internal.catalog.filter((entry)=>catalogEntryMatchesItem(entry,item));
    if(matches.length===1)identities.add(matches[0].id);
  }
  for(const featureId of internal.activeCharacter.subclassFeatureIds ?? []) {
    const matches=internal.catalog.filter((entry)=>catalogEntryMatchesFeature(entry,featureId));
    if(matches.length===1)identities.add(matches[0].id);
  }
  return identities;
}

async function passiveReactionCandidates(adapter:MockAdapter):Promise<PassiveReactionCandidate[]> {
  const internal=adapter as unknown as AdapterState;
  const installed=await requiredSessionInstalledContent(adapter,[]);
  const installedEntries=new Map(installed.map((entry)=>[catalogQualifiedId(entry.contentId,entry.sourceId,entry.version),entry]));
  const builtinEntries=new Map<string,CatalogEntry>();
  for(const entry of internal.catalog){
    if(entry.scope!=="builtin"||!(entry.mechanics??[]).some((mechanic)=>mechanic.kind==="common-play")||!entry.contentId||!entry.sourceId)continue;
    builtinEntries.set(catalogQualifiedId(entry.contentId,entry.sourceId,entry.version),entry);
  }
  if(!installedEntries.size&&!builtinEntries.size)return [];
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
      const entry=installedEntries.get(qualifiedId) ?? builtinEntries.get(qualifiedId);
      if(!entry)continue;
      for(const [mechanicIndex,mechanic] of (entry.mechanics??[]).entries()){
        if(mechanic.kind!=="common-play")continue;
        const canonical=parseCommonPlayDefinition(mechanic.config,`Installed passive Common Play ${qualifiedId} mechanic ${mechanicIndex}`);
        const definition=lowerCommonPlayReactionDefinition(canonical,{resolveResourceDie:(resourceId)=>owner.sheet.resources.find((resource)=>resource.id===resourceId)?.dieSides,resolveNumericReference:(ref)=>ownerNumericReference(owner.sheet,ref)});
        if(!definition)continue;
        const presentationEntry=internal.catalog.find((candidate)=>
          candidate.contentId===canonical.id&&candidate.sourceId===entry.sourceId&&candidate.version===entry.version
        );
        for(const interceptor of definition.interceptors){
          // An automatic interceptor (no interaction) is owned by its source actor exactly like an actor-owner choice.
          const responder=interceptor.interaction?.responder??"actor-owner";
          if(responder!=="actor"&&responder!=="actor-owner")continue;
          candidates.push({
            key:`${owner.sheet.id}:${qualifiedId}:${canonical.id}:${interceptor.id}`,
            sourceActorId:owner.sheet.id,
            sourceActorName:owner.sheet.name,
            source:entry.source,
            optionName:presentationEntry?.nameKo||presentationEntry?.nameEn||entry.nameKo||entry.nameEn||entry.contentId||qualifiedId,
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

function saveContributions(save:ResolutionView["saveResults"][number]):ModifierContribution[] {
  if(save.modifierContributions?.length)return save.modifierContributions.map((entry)=>({...entry}));
  return [{source:`production-save:${save.targetId}:base-modifier`,value:save.total-save.d20}];
}

function validD20(value:number|undefined):value is number {
  return value!==undefined&&Number.isInteger(value)&&value>=1&&value<=20;
}

function checkSuccessOperations(scene:SceneVm,resolution:ResolutionView,operationId:string):ResolutionOperation[] {
  if(resolution.rollKind!=="check"||resolution.checkOutcome!=="실패")return [];
  const origin=Object.values(scene.actionsByActor).flat().find((entry)=>entry.id===resolution.actionId);
  const targetId=resolution.targetIds[0];
  if(!origin||!targetId)return [];
  return (origin.checkSuccessOperations??[]).flatMap((operation,index):ResolutionOperation[]=>{
    if(operation.kind==="stabilize"&&operation.target==="first-target")return [{
      id:`${operationId}.success.${index}`,
      kind:"stabilize",
      targetId,
      when:{operationId,field:"outcome",equals:"success"},
    }];
    return [];
  });
}

function pendingD20s(resolution:ResolutionView,state:RulesRuntimeState,scene:SceneVm):Array<{pending:PendingResolution;operationId:string}> {
  const projections:Array<{pending:PendingResolution;operationId:string}>=[];
  const natural=resolution.naturalD20??resolution.authoritativeDice[0];
  if(resolution.rollKind==="check"&&resolution.checkOutcome&&Number.isFinite(resolution.checkTarget)&&validD20(natural)){
    const operationId=`op.${resolution.actionId}.ability-check`;
    const d20Operation:ResolutionOperation={id:operationId,kind:"d20",actorId:resolution.actorId,request:{
      family:"ability-check",target:resolution.checkTarget!,modifierContributions:d20Contributions(resolution),
      dice:{id:`${resolution.id}:common-play:d20`,purpose:resolution.actionName,sides:20,faces:[natural]},
    }};
    projections.push({operationId,pending:{
      id:`${resolution.id}:common-play-interceptor`,actorId:resolution.actorId,sourceId:resolution.actionId,
      expectedRevision:state.revision,
      operations:[d20Operation,...checkSuccessOperations(scene,resolution,operationId)],
    }});
  }
  if(resolution.rollKind==="attack"&&resolution.stage==="attack-result"&&resolution.attackOutcome&&Number.isFinite(resolution.targetAc)&&validD20(natural)){
    const operationId=`op.${resolution.actionId}.attack-roll`;
    projections.push({operationId,pending:{
      id:`${resolution.id}:common-play-interceptor`,actorId:resolution.actorId,sourceId:resolution.actionId,
      expectedRevision:state.revision,
      operations:[{id:operationId,kind:"d20",actorId:resolution.actorId,targetId:resolution.targetIds[0],request:{
        family:"attack-roll",target:resolution.targetAc!,targetSource:`target:${resolution.targetIds[0]}:ac`,
        modifierContributions:d20Contributions(resolution),
        dice:{id:`${resolution.id}:common-play:d20`,purpose:resolution.actionName,sides:20,faces:[natural]},
        criticalThreshold:resolution.critical?natural:undefined,
      }}],
    }});
  }
  if(resolution.rollKind==="save"&&resolution.stage==="save-result"){
    resolution.saveResults.forEach((save,index)=>{
      if(!validD20(save.d20)||!Number.isFinite(save.dc))return;
      const operationId=`op.${resolution.actionId}.saving-throw.${index}`;
      projections.push({operationId,pending:{
        id:`${resolution.id}:common-play-interceptor:${save.targetId}`,actorId:resolution.actorId,sourceId:resolution.actionId,
        expectedRevision:state.revision,
        operations:[{id:operationId,kind:"d20",actorId:save.targetId,request:{
          family:"saving-throw",target:save.dc,modifierContributions:saveContributions(save),
          dice:{id:`${resolution.id}:common-play:save:${save.targetId}`,purpose:`${resolution.actionName}:${save.targetName}`,sides:20,faces:[save.d20]},
        }}],
      }});
    });
  }
  return projections;
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
  const intercepted=pending.operations.find((operation)=>operation.kind==="d20"&&(operation.request.family==="ability-check"||operation.request.family==="saving-throw"||operation.request.family==="attack-roll"));
  if(!intercepted||intercepted.kind!=="d20")return !subject||subject==="intercepted.actor"?pending.actorId:subject==="interceptor.source"?candidate.sourceActorId:undefined;
  if(!subject||subject==="intercepted.actor")return intercepted.actorId;
  if(subject==="intercepted.target")return intercepted.targetId;
  if(subject==="interceptor.source")return candidate.sourceActorId;
  return undefined;
}

const RULES_PROFILE_SENSE_PROPERTIES=[
  {property:"sense.darkvision.range-feet",kind:"darkvision"},
  {property:"sense.blindsight.range-feet",kind:"blindsight"},
  {property:"sense.tremorsense.range-feet",kind:"tremorsense"},
  {property:"sense.truesight.range-feet",kind:"truesight"},
] as const satisfies ReadonlyArray<{property:string;kind:CommonPlaySense["kind"]}>;

function rulesProfileObserverSenses(candidate:PassiveReactionCandidate,runtime:RulesRuntimeState):CommonPlaySense[] {
  const actor=runtime.combatants[candidate.sourceActorId];
  if(!actor)return [];
  const sheet=candidate.sheet;
  const inputs:Record<string,number>={
    ...(actor.baseProperties??{}),
    "movement.walk":actor.baseSpeed,
    "hp.current":actor.life.hp.current,
    "hp.maximum":actor.life.hp.maximum,
    "hp.temporary":actor.life.hp.temporary,
    "ability.str.score":sheet.abilities.str,
    "ability.dex.score":sheet.abilities.dex,
    "ability.con.score":sheet.abilities.con,
    "ability.int.score":sheet.abilities.int,
    "ability.wis.score":sheet.abilities.wis,
    "ability.cha.score":sheet.abilities.cha,
    "progression.character.level":sheet.level,
    "proficiency.bonus":sheet.proficiencyBonus,
    "defense.ac":sheet.ac,
  };
  for(const entry of RULES_PROFILE_SENSE_PROPERTIES) if(!Number.isFinite(inputs[entry.property])) inputs[entry.property]=0;
  return RULES_PROFILE_SENSE_PROPERTIES.flatMap((entry)=>{
    try {
      const rangeFeet=resolveRuntimeProfileProperty(runtime.effects,candidate.sourceActorId,entry.property,inputs).value;
      return Number.isFinite(rangeFeet)&&rangeFeet>0?[{kind:entry.kind,rangeFeet}]:[];
    } catch { return []; }
  });
}

function mergedObserverSenses(provider:CommonPlaySense[],profile:CommonPlaySense[]):CommonPlaySense[] {
  const merged=new Map<CommonPlaySense["kind"],CommonPlaySense>();
  for(const sense of [...provider,...profile]) {
    const current=merged.get(sense.kind);
    if(!current) { merged.set(sense.kind,{...sense}); continue; }
    if(current.rangeFeet===undefined||sense.rangeFeet===undefined) merged.set(sense.kind,{kind:sense.kind});
    else if(sense.rangeFeet>current.rangeFeet) merged.set(sense.kind,{kind:sense.kind,rangeFeet:sense.rangeFeet});
  }
  return [...merged.values()];
}

function composedRelationSenses(relation:NonNullable<ReturnType<typeof authoritativeCommonPlaySpatialRelation>>,candidate:PassiveReactionCandidate,runtime:RulesRuntimeState,resolverTargetInvisible=false) {
  if(relation.light===undefined||relation.obscurement===undefined)return undefined;
  return resolveCommonPlaySenses(mergedObserverSenses(relation.observerSenses??[{kind:"normal-sight"}],rulesProfileObserverSenses(candidate,runtime)),{
    distanceFeet:relation.distanceFeet,
    light:relation.light==="darkness"?"dark":relation.light,
    obscurement:relation.obscurement,
    lineOfSight:relation.visible,
    lineOfEffect:relation.cover!=="total",
    targetInvisible:(relation.targetInvisible??false)||resolverTargetInvisible,
    targetHidden:false,
    targetAudible:relation.targetAudible??false,
    observerCanHear:relation.observerCanHear??false,
    sharedGroundContact:relation.sharedGroundContact??false,
  });
}

function interceptorFactProvider(internal:AdapterState,candidate:PassiveReactionCandidate,pending:PendingResolution,runtime:RulesRuntimeState):CommonPlayFactProvider {
  return {
    id:"simplevtt.authoritative-spatial",
    resolve(query){
      const subjectId=factSubjectId(candidate,pending,query.subject);
      if(!subjectId)return {status:"unsupported",reason:`unsupported interceptor fact subject: ${query.subject??"intercepted.actor"}`};
      if(query.fact==="identity.same-entity")return {status:"answered",value:subjectId===candidate.sourceActorId};
      if(query.fact==="identity.creature-type"){
        const entity=internal.scene.entities.find((entry)=>entry.id===subjectId);
        const creatureType=entity?resolveRuntimeCreatureType(entity,internal.combatantDefinitions):undefined;
        return creatureType?{status:"answered",value:creatureType}:{status:"unknown"};
      }
      if(query.fact==="sense.hidden")return {status:"answered",value:runtime.effects.some((effect)=>effect.targetId===subjectId&&effect.tags.includes("hidden"))};
      if(query.fact.startsWith("attack.weapon."))return attackWeaponFact(internal,candidate,pending,subjectId,query.fact);
      if(query.fact.startsWith("equipment."))return equipmentFact(internal,candidate,subjectId,query.fact);
      const relation=authoritativeCommonPlaySpatialRelation(internal.scene,candidate.sourceActorId,subjectId);
      if(!relation)return {status:"unknown"};
      const resolverTargetInvisible=runtime.effects.some((effect)=>effect.targetId===subjectId&&effect.conditionId==="invisible"&&!effect.suppression);
      if(query.fact==="spatial.distance-feet")return {status:"answered",value:relation.distanceFeet};
      if(query.fact==="spatial.adjacent")return {status:"answered",value:relation.distanceFeet<=5};
      if(query.fact==="spatial.within-reach"&&relation.withinReach!==undefined)return {status:"answered",value:relation.withinReach};
      if(query.fact==="spatial.total-cover")return {status:"answered",value:relation.cover==="total"};
      if(query.fact==="sense.can-see"){
        const composed=composedRelationSenses(relation,candidate,runtime,resolverTargetInvisible);
        return {status:"answered",value:composed?.canSee??relation.visible};
      }
      if(query.fact==="sense.light"&&relation.light!==undefined)return {status:"answered",value:relation.light};
      if(query.fact==="sense.obscurement"&&relation.obscurement!==undefined)return {status:"answered",value:relation.obscurement};
      if(query.fact==="sense.detected"){
        if(relation.detected!==undefined)return {status:"answered",value:relation.detected};
        const composed=composedRelationSenses(relation,candidate,runtime,resolverTargetInvisible);
        if(composed)return {status:"answered",value:composed.detected};
      }
      return {status:"unknown"};
    },
  };
}

type WeaponDefinitionConfig={mode?:"melee"|"ranged";properties?:string[]};

/** The sheet whose equipment answers a fact about `subjectId`, when that subject is a Character this adapter knows. */
function sheetForSubject(internal:AdapterState,candidate:PassiveReactionCandidate,subjectId:string):CharacterSheet|undefined {
  if(subjectId===candidate.sourceActorId)return candidate.sheet;
  if(subjectId===internal.activeCharacter.id)return internal.activeCharacter;
  return projectedCharacterById(internal as unknown as MockAdapter,subjectId)?.sheet;
}

function weaponDefinitionOf(item:CharacterSheet["items"][number]):WeaponDefinitionConfig|undefined {
  const entry=itemEntryById(compatibleItemDefinitionId(item.definitionId));
  return entry?.category==="weapon"?itemMechanic(entry,"weapon-definition") as WeaponDefinitionConfig|undefined:undefined;
}

/** Facts about the intercepted attack: the action is the pending resolution's source, the attacker its actor. */
function attackWeaponFact(internal:AdapterState,candidate:PassiveReactionCandidate,pending:PendingResolution,subjectId:string,fact:string):ReturnType<CommonPlayFactProvider["resolve"]> {
  const attack=pending.operations.find((operation)=>operation.kind==="d20"&&operation.request.family==="attack-roll");
  if(!attack||attack.kind!=="d20")return {status:"unsupported",reason:`${fact} requires an intercepted attack roll`};
  if(attack.actorId!==subjectId)return {status:"unsupported",reason:`${fact} describes the attacker; subject must be intercepted.actor`};
  const action=Object.values(internal.scene.actionsByActor).flat().find((entry)=>entry.id===pending.sourceId&&entry.actorId===attack.actorId);
  const runtimeAttack=action?.runtimeAttack;
  if(!runtimeAttack)return {status:"unknown"};
  const sheet=sheetForSubject(internal,candidate,subjectId);
  const item=sheet?.items.find((entry)=>entry.grantedActionIds.includes(pending.sourceId))
    ??sheet?.items.find((entry)=>entry.name===action.name&&itemEntryById(compatibleItemDefinitionId(entry.definitionId))?.category==="weapon");
  const definition=item?weaponDefinitionOf(item):undefined;
  const weapon=runtimeAttack.sourceKind==="weapon";
  const ranged=weapon&&(definition?definition.mode==="ranged":runtimeAttack.rangeFeet>10);
  if(fact==="attack.weapon.ranged")return {status:"answered",value:ranged};
  if(fact==="attack.weapon.melee")return {status:"answered",value:(weapon||runtimeAttack.sourceKind==="unarmed")&&!ranged};
  if(fact==="attack.weapon.two-handed"){
    if(!weapon)return {status:"answered",value:false};
    if(!item)return {status:"unknown"};
    const properties=definition?.properties??[];
    return {status:"answered",value:item.wieldSlot==="two-hand"||properties.includes("two-handed")};
  }
  return {status:"unknown"};
}

/** Facts about what the subject wears or wields, from the Character sheet's equipped items. */
function equipmentFact(internal:AdapterState,candidate:PassiveReactionCandidate,subjectId:string,fact:string):ReturnType<CommonPlayFactProvider["resolve"]> {
  const sheet=sheetForSubject(internal,candidate,subjectId);
  if(!sheet)return {status:"unknown"};
  const equipped=sheet.items.filter((item)=>item.equipped);
  const categoryOf=(item:CharacterSheet["items"][number])=>itemEntryById(compatibleItemDefinitionId(item.definitionId))?.category;
  if(fact==="equipment.armor.worn")return {status:"answered",value:equipped.some((item)=>categoryOf(item)==="armor")};
  if(fact==="equipment.shield.worn")return {status:"answered",value:equipped.some((item)=>categoryOf(item)==="shield")};
  if(fact==="equipment.weapons.two-wielded"){
    const wielded=equipped.filter((item)=>categoryOf(item)==="weapon"&&(item.wielded||item.wieldSlot));
    const main=wielded.some((item)=>item.wieldSlot==="main-hand"),off=wielded.some((item)=>item.wieldSlot==="off-hand");
    return {status:"answered",value:main&&off};
  }
  return {status:"unknown"};
}

async function interceptorEligible(internal:AdapterState,candidate:PassiveReactionCandidate,pending:PendingResolution,runtime:RulesRuntimeState) {
  const interceptor=candidate.definition.interceptors[0];
  if(!interceptor?.eligibility)return true;
  const result=await resolveCommonPlayFactPredicate({
    registry:COMMON_PLAY_STANDARD_FACTS,
    queries:interceptor.eligibility.factQueries,
    predicate:interceptor.eligibility.when,
    resolutionId:pending.id,
    expectedRevision:pending.expectedRevision,
    provider:interceptorFactProvider(internal,candidate,pending,runtime),
  });
  return result.status==="eligible";
}

function interactionCost(definition:CommonPlayReactionDefinition) {
  return definition.payments.map((payment)=>{
    const base=payment.kind==="economy"?payment.bucket:`${payment.resource} ${payment.amount.value}`;
    const condition=payment.condition?.kind==="d20-result"?` (${payment.condition.outcome==="success"?"성공":"실패"} 시)`:"";
    return `${base}${condition}`;
  }).join(" + ")||"비용 없음";
}

/** "interrupt": a choice was opened and the resolution paused; "applied": an automatic interceptor changed the resolution; false: nothing happened. */
async function offerPassiveReaction(adapter:MockAdapter):Promise<"interrupt"|"applied"|false> {
  const internal=adapter as unknown as AdapterState;
  const resolution=internal.resolution;
  if(!resolution||resolution.interrupt||internal.sessionMode!=="initiative")return false;
  const runtime=snapshotAdapterTurnRuntimeState(adapter,internal.scene);
  if(!runtime)return false;
  const state=reactionState(adapter,resolution.id);
  let applied=false;
  for(const candidate of await passiveReactionCandidates(adapter)){
    if(state.handled.has(candidate.key)||!runtime.combatants[candidate.sourceActorId])continue;
    const interceptor=candidate.definition.interceptors[0];
    const damage=interceptor?.slot==="primary.damage";
    const damageProjection=damage?pendingDamage(adapter,resolution,runtime):undefined;
    const projections=damageProjection?[damageProjection]:pendingD20s(resolution,runtime,internal.scene);
    if(!projections.length)continue;
    if(interceptor&&!interceptor.interaction){
      // Automatic interceptor: apply immediately when eligible, no interrupt. The resolution keeps advancing.
      for(const projected of projections){
        if(!await interceptorEligible(internal,candidate,projected.pending,runtime))continue;
        if(await applyAutomaticReaction(adapter,resolution,runtime,candidate,interceptor.id,projected,damage))applied=true;
      }
      state.handled.add(candidate.key);
      continue;
    }
    for(const projected of projections){
      const seeded=seededReactionState(runtime,candidate);
      if(!await interceptorEligible(internal,candidate,projected.pending,runtime))continue;
      const started=startCommonPlayResolution(SIMPLEVTT_APP_RULES_PROFILE,seeded,projected.pending,candidate.definition,candidate.sourceActorId);
      if(started.status!=="awaiting-input")continue;
      pendingByAdapter.set(adapter,{resolutionId:resolution.id,operationId:projected.operationId,kind:damage?"damage":"d20",originalTotal:"originalTotal" in projected?projected.originalTotal:undefined,resumeCheckAfterResponse:resolution.rollKind==="check"&&resolution.stage!=="complete",candidate,awaiting:started});
      if(damage)resolution.rollKind="damage";
      const intercepted=projected.pending.operations.find((operation)=>operation.id===projected.operationId&&operation.kind==="d20");
      const save=resolution.rollKind==="save"&&intercepted?.kind==="d20"?resolution.saveResults.find((entry)=>entry.targetId===intercepted.actorId):undefined;
      resolution.interrupt={
        id:started.interaction.id,
        responderId:candidate.sourceActorId,
        responderName:candidate.sourceActorName,
        trigger:damage
          ? `${resolution.actionName} 피해 굴림 ${"originalTotal" in projected?projected.originalTotal:"—"}`
          : save
          ? `${resolution.actionName} · ${save.targetName} ${save.total} vs DC ${save.dc}`
          : resolution.rollKind==="attack"
          ? `${resolution.actionName} ${resolution.attackTotal} vs AC ${resolution.targetAc}`
          : `${resolution.actionName} ${resolution.rollTotal} vs DC ${resolution.checkTarget}`,
        optionName:candidate.optionName,
        cost:interactionCost(candidate.definition),
        effect:damage?"피해 굴림을 Common Play 인터셉터로 재계산합니다.":"d20 결과를 Common Play 인터셉터로 재계산합니다.",
        source:candidate.source,
      };
      resolution.stage="interrupt";
      resolution.canAdvance=false;
      resolution.nextLabel=undefined;
      return "interrupt";
    }
    state.handled.add(candidate.key);
  }
  return applied?"applied":false;
}

async function applyAutomaticReaction(
  adapter:MockAdapter,
  resolution:ResolutionView,
  runtime:RulesRuntimeState,
  candidate:PassiveReactionCandidate,
  interceptorId:string,
  projected:{pending:PendingResolution;operationId:string;originalTotal?:number},
  damage:boolean,
) {
  const internal=adapter as unknown as AdapterState;
  const seeded=seededReactionState(runtime,candidate);
  const authority=modifierAuthority(internal,{candidate,interceptorId});
  const applied=applyAutomaticCommonPlayInterceptor(SIMPLEVTT_APP_RULES_PROFILE,seeded,projected.pending,candidate.definition,candidate.sourceActorId,authority);
  if(applied.status==="not-applicable")return false;
  if(applied.status==="rejected"){
    resolution.detail.push(`${candidate.optionName}: 자동 인터셉터 거부 · ${applied.error}`);
    return false;
  }
  const pending:PendingPassiveReaction={
    resolutionId:resolution.id,operationId:projected.operationId,kind:damage?"damage":"d20",originalTotal:projected.originalTotal,
    resumeCheckAfterResponse:resolution.rollKind==="check"&&resolution.stage!=="complete",candidate,
    awaiting:{
      status:"awaiting-input",state:seeded,
      interaction:{id:`${projected.pending.id}:${candidate.definition.id}:automatic`,idempotencyKey:`${projected.pending.id}:${candidate.definition.id}:automatic`,responder:"actor-owner",mode:"blocking",expectedRevision:seeded.revision,resolutionId:projected.pending.id,sourceId:projected.pending.sourceId},
      context:{sourceActorId:candidate.sourceActorId,definition:candidate.definition,interceptorId,interceptedOperationId:projected.operationId,pending:projected.pending},
    },
  };
  const committed=await commitAcceptedReaction(adapter,pending,applied);
  if(committed.status==="rejected"){
    resolution.detail.push(`${candidate.optionName}: 자동 인터셉터 적용 거부 · ${committed.error}`);
    return false;
  }
  if(damage){
    const result=applied.results[projected.operationId] as DamageRollResolution|undefined;
    if(!result||projected.originalTotal===undefined){resolution.detail.push(`${candidate.optionName}: 자동 피해 인터셉터 결과 누락`);return false;}
    queueAtomicAttackDamageReduction(resolution.id,projected.originalTotal-result.total,`common-play:${candidate.definition.id}`);
    resolution.detail.push(`${candidate.optionName}: 피해 ${projected.originalTotal} → ${result.total} (자동)`);
    resolution.provenance.push(`common-play:${candidate.definition.id} · automatic damage-roll interceptor`);
    return true;
  }
  const d20=applied.results[projected.operationId] as D20TestResult|undefined;
  if(!d20){resolution.detail.push(`${candidate.optionName}: 자동 인터셉터 결과 누락`);return false;}
  updateD20Presentation(resolution,pending,d20,authority,internal.scene);
  resolution.detail.push(`${candidate.optionName}: 자동 적용 · ${d20.total} vs ${d20.family==="attack-roll"?"AC":"DC"} ${d20.target}`);
  return true;
}

function paymentEvents(events:ResolutionEvent[]) {
  return events.filter((event)=>event.stateChanges.length>0).map((event)=>structuredClone(event));
}

function updateD20Presentation(resolution:ResolutionView,pending:PendingPassiveReaction,result:D20TestResult,authority:CommonPlayInteractionAuthority|undefined,scene:SceneVm) {
  const rolled=authority?.modifierDiceFaces?Object.values(authority.modifierDiceFaces).flat():[];
  if(result.family==="saving-throw"){
    const operation=pending.awaiting.context.pending.operations.find((entry)=>entry.id===pending.operationId&&entry.kind==="d20");
    if(!operation||operation.kind!=="d20")throw new Error("Common Play saving-throw interceptor operation is missing");
    const saveIndex=resolution.saveResults.findIndex((entry)=>entry.targetId===operation.actorId);
    if(saveIndex<0)throw new Error(`Common Play saving-throw target is missing: ${operation.actorId}`);
    const save=resolution.saveResults[saveIndex];
    const before=saveContributions(save);
    const beforeModifier=before.reduce((sum,entry)=>sum+entry.value,0);
    const delta=result.modifier-beforeModifier;
    save.modifierContributions=delta!==0?[...before,{source:`common-play:${pending.candidate.definition.id}`,value:delta}]:before;
    save.d20=result.natural;
    save.total=result.total;
    save.dc=result.target;
    save.outcome=result.outcome==="success"?"성공":"실패";
    if(saveIndex<resolution.authoritativeDice.length)resolution.authoritativeDice[saveIndex]=result.natural;
    if(rolled.length)resolution.detail.push(`${pending.candidate.optionName}: ${save.targetName} · ${rolled.join(", ")} · ${result.total}`);
    resolution.provenance.push(`common-play:${pending.candidate.definition.id} · generic post-roll interceptor`);
    resolution.compact=resolution.saveResults.map((entry)=>`${entry.targetName} ${entry.outcome}`).join(" / ");
    resolution.calculatedOutcome="내성 결과";
    resolution.finalOutcome=resolution.compact;
    return;
  }
  const before=d20Contributions(resolution);
  const beforeModifier=before.reduce((sum,entry)=>sum+entry.value,0);
  const delta=result.modifier-beforeModifier;
  if(delta!==0)resolution.rollModifierContributions=[...before,{source:`common-play:${pending.candidate.definition.id}`,value:delta}];
  else resolution.rollModifierContributions=before;
  resolution.rollTotal=result.total;
  resolution.naturalD20=result.natural;
  if(resolution.authoritativeDice.length)resolution.authoritativeDice[0]=result.natural;
  else resolution.authoritativeDice=[result.natural];
  if(rolled.length)resolution.detail.push(`${pending.candidate.optionName}: ${rolled.join(", ")} · ${result.total}`);
  resolution.provenance.push(`common-play:${pending.candidate.definition.id} · generic post-roll interceptor`);
  if(result.family==="ability-check"){
    const origin=Object.values(scene.actionsByActor).flat().find((entry)=>entry.id===resolution.actionId);
    resolution.checkTarget=result.target;
    resolution.checkOutcome=result.outcome==="success"?"성공":"실패";
    resolution.compact=`${result.total} vs DC ${result.target} · ${resolution.checkOutcome}`;
    resolution.calculatedOutcome=resolution.compact;
    resolution.finalOutcome=origin?.checkOutcomeLabels?.[result.outcome]??resolution.checkOutcome;
  }else{
    resolution.targetAc=result.target;
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
  const resolution=internal.resolution;
  const completedCheck=resolution?.rollKind==="check"&&!pending.resumeCheckAfterResponse;
  const projected=completedCheck
    ? applyResolutionEvents(internal.scene,durableEvents,internal.activeCharacter.resources,internal.activeCharacter.items,current)
    : undefined;
  if(projected?.status==="rejected")return projected;
  const writeBack=await persistCharacterResolutionEvents(adapter,durableEvents,"forward");
  if(writeBack.status==="rejected")return writeBack;
  if(!commitAdapterTurnRuntimeState(adapter,internal.scene,current.revision,result.state)){
    if(writeBack.changed)await persistCharacterResolutionEvents(adapter,durableEvents,"inverse");
    return {status:"rejected" as const,error:"Common Play reaction TurnRuntime revision changed before commit"};
  }
  if(projected?.status==="committed"){
    internal.scene=projected.scene;
    internal.activeCharacter.resources=projected.resources;
    internal.activeCharacter.items=projected.items;
    if(resolution)resolution.stateChanges.push(...projected.stateChanges);
    const history=runtimeResolutionEventHistories.get(adapter);
    runtimeResolutionEventHistories.set(adapter,{
      resolutionId:pending.resolutionId,
      events:[...(history?.resolutionId===pending.resolutionId?history.events:[]),...durableEvents],
    });
  }else if(durableEvents.length)appendAdapterInterruptEvents(adapter,pending.resolutionId,durableEvents);
  projectAdapterTurnRuntime(adapter);
  synchronizeProjectedCharacterResources(adapter,result.state);
  internal.syncChar();
  return {status:"committed" as const};
}

function restoreInterruptedStage(resolution:ResolutionView,pending:PendingPassiveReaction) {
  resolution.interrupt=undefined;
  if(resolution.rollKind==="check"){
    if(!pending.resumeCheckAfterResponse){
      resolution.stage="complete";
      resolution.canAdvance=false;
      resolution.nextLabel=undefined;
      return;
    }
    resolution.stage="roll-animation";
    resolution.canAdvance=true;
    resolution.nextLabel="판정 적용";
  }else if(resolution.rollKind==="save"){
    resolution.stage="save-result";
    resolution.canAdvance=true;
    resolution.nextLabel="내성 결과 적용";
  }else{
    const damage=resolution.rollKind==="damage";
    resolution.rollKind="attack";
    resolution.stage="attack-result";
    resolution.canAdvance=true;
    resolution.nextLabel=resolution.attackOutcome==="명중"?(damage?"피해 적용":"판정 적용"):"완료";
  }
}

MockAdapter.prototype.resolveAction=async function resolveWithPortableCommonPlayInterceptors(actionId:string,targetIds:string[]) {
  const resolved=await previousResolveAction.call(this,actionId,targetIds);
  if(await offerPassiveReaction(this))return (this as unknown as AdapterState).getSnapshot();
  return resolved;
};

MockAdapter.prototype.advanceResolution=async function advanceWithPortableCommonPlayInterceptors() {
  const pending=pendingByAdapter.get(this);
  if(pending&&(this as unknown as AdapterState).resolution?.id===pending.resolutionId)return (this as unknown as AdapterState).getSnapshot();
  // An automatic application before the advance does not consume the advance; only an opened choice pauses.
  if(await offerPassiveReaction(this)==="interrupt")return (this as unknown as AdapterState).getSnapshot();
  const advanced=await previousAdvanceResolution.call(this);
  if(await offerPassiveReaction(this))return (this as unknown as AdapterState).getSnapshot();
  return advanced;
};

MockAdapter.prototype.respondToInterrupt=async function respondToPortableCommonPlayInterceptor(accept:boolean,selectedIds?:string[]) {
  const internal=this as unknown as AdapterState;
  const resolution=internal.resolution;
  const pending=pendingByAdapter.get(this);
  if(!resolution||!pending||pending.resolutionId!==resolution.id||resolution.interrupt?.id!==pending.awaiting.interaction.id){
    return previousRespondToInterrupt.call(this,accept,selectedIds);
  }
  pendingByAdapter.delete(this);
  reactionState(this,resolution.id).handled.add(pending.candidate.key);
  const current=snapshotAdapterTurnRuntimeState(this,internal.scene);
  if(!current){restoreInterruptedStage(resolution,pending);return internal.getSnapshot();}
  const seeded=seededReactionState(current,pending.candidate);
  const authority=accept?modifierAuthority(internal,{candidate:pending.candidate,interceptorId:pending.awaiting.context.interceptorId}):undefined;
  const resumed=resumeCommonPlayInteraction(SIMPLEVTT_APP_RULES_PROFILE,seeded,pending.awaiting,{
    interactionId:pending.awaiting.interaction.id,
    idempotencyKey:pending.awaiting.interaction.idempotencyKey,
    value:accept,
  },authority);
  if(resumed.status==="invalidated"){
    restoreInterruptedStage(resolution,pending);
    resolution.detail.push(`Common Play 인터셉터 무효화: ${resumed.error}`);
    return internal.getSnapshot();
  }
  if(resumed.status==="rejected"){
    restoreInterruptedStage(resolution,pending);
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
      restoreInterruptedStage(resolution,pending);
      resolution.detail.push(`Common Play 인터셉터 적용 거부: ${committed.error}`);
      return internal.getSnapshot();
    }
    if(pending.kind==="damage"){
      const damage=resumed.results[pending.operationId] as DamageRollResolution|undefined;
      if(!damage||pending.originalTotal===undefined){restoreInterruptedStage(resolution,pending);resolution.detail.push("Common Play 피해 인터셉터 결과 누락");return internal.getSnapshot();}
      const reduction=pending.originalTotal-damage.total;
      queueAtomicAttackDamageReduction(resolution.id,reduction,`common-play:${pending.candidate.definition.id}`);
      const rolled=authority?.modifierDiceFaces?Object.values(authority.modifierDiceFaces).flat():[];
      resolution.detail.push(`${pending.candidate.optionName}: ${rolled.join(", ")} · 피해 ${pending.originalTotal} → ${damage.total}`);
      resolution.provenance.push(`common-play:${pending.candidate.definition.id} · generic damage-roll interceptor`);
    }else{
      const d20=resumed.results[pending.operationId] as D20TestResult|undefined;
      if(!d20){restoreInterruptedStage(resolution,pending);resolution.detail.push("Common Play 인터셉터 결과 누락");return internal.getSnapshot();}
      updateD20Presentation(resolution,pending,d20,authority,internal.scene);
      if(pending.candidate.definition.payments.some((payment)=>payment.condition?.kind==="d20-result"&&payment.condition.outcome!==d20.outcome)) {
        resolution.detail.push(`${pending.candidate.optionName}: 결과 조건 불충족 · 자원 보존`);
      }
    }
  }
  restoreInterruptedStage(resolution,pending);
  // A response may finish one timing window, but must not enter a later one in the same interaction.
  // Attack-result remains observable before a damage.rolled interceptor is offered on the next advance.
  if(pending.kind==="d20"&&resolution.rollKind==="attack")return internal.getSnapshot();
  if(await offerPassiveReaction(this)==="interrupt")return internal.getSnapshot();
  if(resolution.rollKind==="check"&&pending.resumeCheckAfterResponse)return previousAdvanceResolution.call(this);
  return internal.getSnapshot();
};
