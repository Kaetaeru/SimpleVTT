import type { RulesRuntimeState } from "./combatState";
import type { DurationSpec, EffectInstance } from "./effects";
import type { RulesProfileLike } from "./profileEngine";
import { resolvePendingResolution } from "./resolution";
import type {
  PendingResolution,
  ResolutionCommit,
  ResolutionEvent,
  ResolutionOperation,
} from "./resolutionTypes";
import { compileCommonPlayPayments, parseCommonPlayPayments, type CommonPlayPayment } from "./commonPlayOperationRuntime";
import type { ActionUseKind } from "./turnEconomy";

type LiteralNumberExpression={value:number};
type EffectTarget="actor";
type EventDamageTarget="event.actor";
type AutomaticDamageEvent="damage.taken"|"damage.dealt";

interface CommonPlayEffectApplyOperation {
  kind:"effect.apply";
  template:string;
  target?:EffectTarget;
}

interface CommonPlayTriggeredDamageOperation {
  kind:"damage.apply";
  amount:LiteralNumberExpression;
  damageType:string;
  target:EventDamageTarget;
}

interface CommonPlayAutomaticDamageRule {
  id:string;
  event:AutomaticDamageEvent;
  frequency?:"once";
  operations:CommonPlayTriggeredDamageOperation[];
}

type CommonPlayEffectDuration=
  | {kind:"durable"}
  | {
      kind:"elapsed";
      amount:LiteralNumberExpression;
      unit:"seconds"|"minutes"|"hours"|"days";
      decrementAt?:string;
    };

export interface CommonPlayEffectArtifactTemplate {
  id:string;
  artifactKind:"effect";
  duration:CommonPlayEffectDuration;
  rules:CommonPlayAutomaticDamageRule[];
  lifetime:{
    kind:"until-event";
    event:AutomaticDamageEvent;
    onEnd:"destroy";
  };
  instancePolicy?:"stack";
}

export interface CommonPlayPersistentEffectDefinition {
  $schema?:string;
  schemaVersion:"0.2-draft";
  id:string;
  payments?:CommonPlayPayment[];
  entryPoints:Array<{
    id:string;
    invocation:"manual"|"triggered"|"automatic"|"granted";
    operations:CommonPlayEffectApplyOperation[];
  }>;
  artifactTemplates:CommonPlayEffectArtifactTemplate[];
}

export interface CommonPlayEffectActivationInput {
  resolutionId:string;
  actorId:string;
  entryPointId:string;
  actionKind?:ActionUseKind;
}

export interface CommonPlayEffectEventInput {
  event:ResolutionEvent;
  actorCreatureKind:"character"|"monster";
}

export interface CommonPlayEffectEventNoMatch {
  status:"no-match";
  state:RulesRuntimeState;
  reason:string;
}

export type CommonPlayEffectEventResult=ResolutionCommit|CommonPlayEffectEventNoMatch;

const DEFINITION_KEYS=["$schema","schemaVersion","id","payments","entryPoints","artifactTemplates"] as const;
const EFFECT_METADATA_DEFINITION="commonPlayDefinitionId";
const EFFECT_METADATA_TEMPLATE="commonPlayTemplateId";

function rejected(state:RulesRuntimeState,error:string):Extract<ResolutionCommit,{status:"rejected"}> {
  return {status:"rejected",state,events:[],results:{},error};
}

function assertOnlyKeys(value:object,allowed:readonly string[],label:string) {
  const unsupported=Object.keys(value).filter((key)=>!allowed.includes(key));
  if (unsupported.length) throw new Error(`${label} contains unsupported field(s): ${unsupported.join(", ")}`);
}

function literalNumber(expression:LiteralNumberExpression,label:string) {
  if (!expression||typeof expression!=="object"||!Number.isFinite(expression.value)) {
    throw new Error(`${label} requires a finite literal number`);
  }
  return expression.value;
}

function runtimeDuration(duration:CommonPlayEffectDuration,label:string):DurationSpec {
  if (duration.kind==="durable") {
    assertOnlyKeys(duration,["kind"],label);
    return {kind:"permanent"};
  }
  assertOnlyKeys(duration,["kind","amount","unit","decrementAt"],label);
  if (duration.decrementAt!==undefined) {
    throw new Error(`${label} decrementAt is not supported by this event-effect runtime slice`);
  }
  const amount=literalNumber(duration.amount,`${label} amount`);
  if (amount<=0) throw new Error(`${label} amount must be positive`);
  if (duration.unit==="seconds") return {kind:"seconds",amount};
  if (duration.unit==="minutes") return {kind:"minutes",amount};
  if (duration.unit==="hours") return {kind:"hours",amount};
  if (duration.unit==="days") return {kind:"hours",amount:amount*24};
  throw new Error(`${label} unit is not supported by this event-effect runtime slice`);
}

function validateRule(rule:CommonPlayAutomaticDamageRule,templateId:string,ruleIndex:number) {
  const label=`artifact ${templateId} rule ${ruleIndex+1}`;
  assertOnlyKeys(rule,["id","event","frequency","operations"],label);
  if (!rule.id) throw new Error(`${label} id is required`);
  if (rule.event!=="damage.taken"&&rule.event!=="damage.dealt") throw new Error(`${label} supports only damage.taken or damage.dealt`);
  if (rule.frequency!==undefined&&rule.frequency!=="once") {
    throw new Error(`${label} supports only once frequency in this runtime slice`);
  }
  if (!rule.operations.length) throw new Error(`${label} requires at least one operation`);
  rule.operations.forEach((operation,index)=>{
    const operationLabel=`${label} operation ${index+1}`;
    assertOnlyKeys(operation,["kind","amount","damageType","target"],operationLabel);
    if (operation.kind!=="damage.apply") throw new Error(`${operationLabel} supports only damage.apply`);
    const amount=literalNumber(operation.amount,`${operationLabel} amount`);
    if (!Number.isInteger(amount)||amount<0) throw new Error(`${operationLabel} amount must be a non-negative integer`);
    if (!operation.damageType) throw new Error(`${operationLabel} damageType is required`);
    if (operation.target!=="event.actor") {
      throw new Error(`${operationLabel} target must be event.actor in this runtime slice`);
    }
  });
}

function validateTemplate(template:CommonPlayEffectArtifactTemplate,index:number) {
  const label=`artifact template ${index+1}`;
  assertOnlyKeys(template,["id","artifactKind","duration","rules","lifetime","instancePolicy"],label);
  if (!template.id) throw new Error(`${label} id is required`);
  if (template.artifactKind!=="effect") throw new Error(`${label} must be an effect artifact`);
  runtimeDuration(template.duration,`${label} duration`);
  if (!Array.isArray(template.rules)||!template.rules.length) throw new Error(`${label} requires at least one rule`);
  template.rules.forEach((rule,ruleIndex)=>validateRule(rule,template.id,ruleIndex));
  assertOnlyKeys(template.lifetime,["kind","event","onEnd"],`${label} lifetime`);
  if (template.lifetime.kind!=="until-event"||(template.lifetime.event!=="damage.taken"&&template.lifetime.event!=="damage.dealt")||template.lifetime.onEnd!=="destroy") {
    throw new Error(`${label} lifetime must destroy on damage.taken or damage.dealt in this runtime slice`);
  }
  if(template.rules.some((rule)=>rule.event!==template.lifetime.event)) {
    throw new Error(`${label} rules must match lifetime event ${template.lifetime.event} in this runtime slice`);
  }
  if (template.instancePolicy!==undefined&&template.instancePolicy!=="stack") {
    throw new Error(`${label} supports only stack instancePolicy in this runtime slice`);
  }
}

export function validateCommonPlayEffectTemplate(template:CommonPlayEffectArtifactTemplate,index=0) {
  validateTemplate(template,index);
  return template;
}

function validateDefinition(definition:CommonPlayPersistentEffectDefinition) {
  assertOnlyKeys(definition,DEFINITION_KEYS,"Common Play definition");
  if (definition.schemaVersion!=="0.2-draft") throw new Error(`unsupported Common Play schema version: ${definition.schemaVersion}`);
  if (!definition.id) throw new Error("Common Play definition id is required");
  if (!Array.isArray(definition.entryPoints)) throw new Error("Common Play entryPoints are required");
  if (!Array.isArray(definition.artifactTemplates)||!definition.artifactTemplates.length) {
    throw new Error("Common Play artifactTemplates are required");
  }
  const ids=new Set<string>();
  definition.artifactTemplates.forEach((template,index)=>{
    validateTemplate(template,index);
    if (ids.has(template.id)) throw new Error(`duplicate artifact template id: ${template.id}`);
    ids.add(template.id);
  });
}

function templateById(definition:CommonPlayPersistentEffectDefinition,id:string) {
  const template=definition.artifactTemplates.find((candidate)=>candidate.id===id);
  if (!template) throw new Error(`artifact template not found: ${id}`);
  return template;
}

export function compileCommonPlayEffectApplyOperation(
  definitionId:string,
  template:CommonPlayEffectArtifactTemplate,
  input:{operationId:string;effectId:string;sourceActorId:string;targetId:string},
):Extract<ResolutionOperation,{kind:"apply-effect"}> {
  validateTemplate(template,0);
  return {
    id:input.operationId,
    kind:"apply-effect",
    effect:{
      id:input.effectId,
      sourceId:definitionId,
      sourceActorId:input.sourceActorId,
      targetId:input.targetId,
      kind:"marker",
      duration:runtimeDuration(template.duration,`artifact ${template.id} duration`),
      metadata:{
        [EFFECT_METADATA_DEFINITION]:definitionId,
        [EFFECT_METADATA_TEMPLATE]:template.id,
      },
    },
  };
}

function effectForTemplate(
  definition:CommonPlayPersistentEffectDefinition,
  template:CommonPlayEffectArtifactTemplate,
  input:CommonPlayEffectActivationInput,
  operationIndex:number,
):Extract<ResolutionOperation,{kind:"apply-effect"}> {
  return compileCommonPlayEffectApplyOperation(definition.id,template,{
    operationId:`common-play-effect-apply-${operationIndex+1}`,
    effectId:`${input.resolutionId}:artifact:${operationIndex+1}:${template.id}`,
    sourceActorId:input.actorId,
    targetId:input.actorId,
  });
}

export function compileCommonPlayEffectActivation(
  inputState:RulesRuntimeState,
  definition:CommonPlayPersistentEffectDefinition,
  input:CommonPlayEffectActivationInput,
):PendingResolution {
  validateDefinition(definition);
  if (!input.resolutionId||!input.actorId) throw new Error("resolutionId and actorId are required");
  const entryPoint=definition.entryPoints.find((candidate)=>candidate.id===input.entryPointId);
  if (!entryPoint) throw new Error(`Common Play entry point not found: ${input.entryPointId}`);
  assertOnlyKeys(entryPoint,["id","invocation","operations"],`entry point ${entryPoint.id}`);
  if (entryPoint.invocation!=="manual") throw new Error("effect activation runtime requires a manual entry point");
  if (!entryPoint.operations.length) throw new Error("effect activation entry point requires at least one operation");

  const operations:ResolutionOperation[]=[...compileCommonPlayPayments(parseCommonPlayPayments(definition.payments),input),...entryPoint.operations.map((operation,index)=>{
    const label=`entry point ${entryPoint.id} operation ${index+1}`;
    assertOnlyKeys(operation,["kind","template","target"],label);
    if (operation.kind!=="effect.apply") throw new Error(`${label} supports only effect.apply`);
    if (operation.target!==undefined&&operation.target!=="actor") {
      throw new Error(`${label} target must be actor in this runtime slice`);
    }
    return effectForTemplate(definition,templateById(definition,operation.template),input,index);
  })];

  return {
    id:input.resolutionId,
    actorId:input.actorId,
    sourceId:definition.id,
    expectedRevision:inputState.revision,
    operations,
  };
}

export function resolveCommonPlayEffectActivation(
  profile:RulesProfileLike,
  inputState:RulesRuntimeState,
  definition:CommonPlayPersistentEffectDefinition,
  input:CommonPlayEffectActivationInput,
):ResolutionCommit {
  try {
    return resolvePendingResolution(profile,inputState,compileCommonPlayEffectActivation(inputState,definition,input));
  } catch (error) {
    return rejected(inputState,error instanceof Error?error.message:String(error));
  }
}

function semanticPositiveDamage(event:ResolutionEvent) {
  if (event.kind!=="damage"&&event.kind!=="compound-damage") return false;
  if (!event.targetId) throw new Error("authoritative damage event requires targetId");
  if (!event.actorId) throw new Error("authoritative damage event requires actorId");
  if (!event.result||typeof event.result!=="object") throw new Error("authoritative damage event requires an object result");
  const finalDamage=(event.result as Record<string,unknown>).finalDamage;
  if (typeof finalDamage!=="number"||!Number.isFinite(finalDamage)||finalDamage<0) {
    throw new Error("authoritative damage event requires non-negative finalDamage");
  }
  return finalDamage>0;
}

function matchingEffects(
  state:RulesRuntimeState,
  definition:CommonPlayPersistentEffectDefinition,
  targetId:string,
):EffectInstance[] {
  return state.effects.filter((effect)=>
    effect.targetId===targetId
    && effect.sourceId===definition.id
    && effect.metadata?.[EFFECT_METADATA_DEFINITION]===definition.id
    && typeof effect.metadata?.[EFFECT_METADATA_TEMPLATE]==="string"
  );
}

function triggerOperations(
  definition:CommonPlayPersistentEffectDefinition,
  effects:EffectInstance[],
  event:ResolutionEvent,
  eventKind:AutomaticDamageEvent,
  actorCreatureKind:CommonPlayEffectEventInput["actorCreatureKind"],
):ResolutionOperation[] {
  const operations:ResolutionOperation[]=[];
  effects.forEach((effect,effectIndex)=>{
    const templateId=effect.metadata?.[EFFECT_METADATA_TEMPLATE];
    if (typeof templateId!=="string") throw new Error(`effect ${effect.id} is missing its Common Play template binding`);
    const template=templateById(definition,templateId);
    validateTemplate(template,effectIndex);
    const rules=template.rules.filter((rule)=>rule.event===eventKind);
    if(!rules.length) return;
    rules.forEach((rule,ruleIndex)=>{
      rule.operations.forEach((operation,operationIndex)=>{
        const amount=literalNumber(operation.amount,`artifact ${template.id} rule ${rule.id} damage amount`);
        operations.push({
          id:`common-play-effect-${effectIndex+1}-rule-${ruleIndex+1}-damage-${operationIndex+1}`,
          kind:"damage",
          targetId:event.actorId,
          damageType:operation.damageType,
          amount,
          creatureKind:actorCreatureKind,
        });
      });
    });
    operations.push({
      id:`common-play-effect-${effectIndex+1}-remove`,
      kind:"remove-effect",
      effectId:effect.id,
    });
  });
  return operations;
}

export function appendCommonPlayDamageTakenTriggers(
  inputState:RulesRuntimeState,
  definitions:CommonPlayPersistentEffectDefinition[],
  pending:PendingResolution,
  actorCreatureKind:"character"|"monster",
):PendingResolution {
  const operations=[...pending.operations];
  const handled=new Set<string>();
  for(const [damageIndex,damage] of pending.operations.entries()) {
    if(damage.kind!=="damage"||damage.when) continue;
    const when={operationId:damage.id,field:"finalDamage",greaterThan:0} as const;
    const contexts:Array<{event:AutomaticDamageEvent;subjectId:string}>=[
      {event:"damage.taken",subjectId:damage.targetId},
      {event:"damage.dealt",subjectId:pending.actorId},
    ];
    for(const context of contexts) {
      for(const [definitionIndex,definition] of definitions.entries()) {
        validateDefinition(definition);
        for(const [effectIndex,effect] of matchingEffects(inputState,definition,context.subjectId).entries()) {
          const key=`${context.event}:${effect.id}`;
          if(handled.has(key)) continue;
          const templateId=effect.metadata?.[EFFECT_METADATA_TEMPLATE];
          if(typeof templateId!=="string") throw new Error(`effect ${effect.id} is missing its Common Play template binding`);
          const template=templateById(definition,templateId);
          validateTemplate(template,effectIndex);
          const rules=template.rules.filter((rule)=>rule.event===context.event);
          if(!rules.length) continue;
          handled.add(key);
          for(const [ruleIndex,rule] of rules.entries()) {
            for(const [operationIndex,operation] of rule.operations.entries()) operations.push({
              id:`${pending.id}:automatic:${context.event}:${definitionIndex}:${effectIndex}:${damageIndex}:${ruleIndex}:${operationIndex}`,
              kind:"damage",targetId:pending.actorId,damageType:operation.damageType,
              amount:literalNumber(operation.amount,`artifact ${template.id} rule ${rule.id} damage amount`),
              creatureKind:actorCreatureKind,when,
            });
          }
          operations.push({
            id:`${pending.id}:automatic:${context.event}:${definitionIndex}:${effectIndex}:${damageIndex}:remove`,
            kind:"remove-effect",effectId:effect.id,when,
          });
        }
      }
    }
  }
  return operations.length===pending.operations.length?pending:{...pending,operations};
}

export function resolveCommonPlayEffectEvent(
  profile:RulesProfileLike,
  inputState:RulesRuntimeState,
  definition:CommonPlayPersistentEffectDefinition,
  input:CommonPlayEffectEventInput,
):CommonPlayEffectEventResult {
  try {
    validateDefinition(definition);
    const fires=semanticPositiveDamage(input.event);
    if (!fires) {
      return {status:"no-match",state:inputState,reason:"event does not represent positive damage"};
    }
    const candidates:Array<{event:AutomaticDamageEvent;subjectId:string}>=[
      {event:"damage.taken",subjectId:input.event.targetId!},
      {event:"damage.dealt",subjectId:input.event.actorId!},
    ];
    const operations:ResolutionOperation[]=[];
    let actorId:string|undefined;
    for(const candidate of candidates) {
      const effects=matchingEffects(inputState,definition,candidate.subjectId);
      const triggered=triggerOperations(definition,effects,input.event,candidate.event,input.actorCreatureKind);
      if(triggered.length) {
        actorId??=candidate.subjectId;
        operations.push(...triggered);
      }
    }
    if (!operations.length) return {status:"no-match",state:inputState,reason:"no active Common Play effect matches the damage event"};
    return resolvePendingResolution(profile,inputState,{
      id:`${input.event.id}:${definition.id}:automatic-effects`,
      actorId:actorId!,
      sourceId:definition.id,
      expectedRevision:inputState.revision,
      operations,
    });
  } catch (error) {
    return rejected(inputState,error instanceof Error?error.message:String(error));
  }
}
