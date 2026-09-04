import "./phase09RealNoRollDamageAdapter";
import "./combatantRuntimeContracts";
import type { AbilityKey, AbilityScores, ActionVm, AppSnapshot, CombatantDefinitionVm, CombatantImportPreview, SceneEntity, SceneVm } from "./contracts";
import type { CombatantRuntimeAttackVm } from "./combatantRuntimeContracts";
import { MockAdapter } from "./mockAdapter";
import { diceShape, parseRuntimeActions, parseRuntimeStats } from "./combatantRuntimeDefinitionParse";

const BUILTIN_RUNTIME_ACTIONS:Record<string,CombatantRuntimeAttackVm[]>={
  "combatant.goblin":[
    { id:"scimitar", name:"시미터", category:"weapon", sourceKind:"weapon", attackBonus:4, rangeFeet:5, damage:{ type:"참격", dice:"1d6", flat:2 } },
    { id:"shortbow", name:"숏보우", category:"weapon", sourceKind:"weapon", attackBonus:4, rangeFeet:80, damage:{ type:"관통", dice:"1d6", flat:2 } },
  ],
};

interface CombatantRuntimeAdapterState {
  combatantImport:CombatantImportPreview|null;
  combatantDefinitions:CombatantDefinitionVm[];
  scene:SceneVm;
  getSnapshot():Promise<AppSnapshot>;
}

function actionVm(
  definition:CombatantDefinitionVm,
  actorId:string,
  spec:CombatantRuntimeAttackVm,
  existingId?:string,
):ActionVm {
  const shape=diceShape(spec.damage.dice);
  const average=Math.max(0,Math.round(shape.count*((shape.sides+1)/2)+spec.damage.flat));
  const signedFlat=spec.damage.flat===0 ? "" : ` ${spec.damage.flat>0?"+":"-"} ${Math.abs(spec.damage.flat)}`;
  return {
    id:existingId ?? `action.${actorId}.${spec.id}`,
    actorId,
    name:spec.name,
    category:spec.category,
    target:"enemy",
    economy:"행동",
    resolutionKind:"attack",
    summary:`${spec.attackBonus>=0?"+":""}${spec.attackBonus} · ${spec.damage.dice}${signedFlat} ${spec.damage.type}`,
    available:true,
    eligibleTargetIds:[],
    attackBonus:spec.attackBonus,
    damage:[{ type:spec.damage.type, dice:spec.damage.dice, flat:spec.damage.flat, average }],
    runtimeAttack:{
      sourceKind:spec.sourceKind,
      rangeFeet:spec.rangeFeet,
      diceSides:shape.sides,
      diceCount:shape.count,
      damageSource:`runtime:combatant-definition:${definition.id}:action:${spec.id}:damage`,
    },
    details:[
      { label:"출처", value:definition.source, source:`Combatant Definition ${definition.id}` },
      { label:"사거리", value:`${spec.rangeFeet}피트`, source:"runtime action contract" },
      { label:"명중", value:`${spec.attackBonus>=0?"+":""}${spec.attackBonus}`, source:"runtime action contract" },
      { label:"피해", value:`${spec.damage.dice}${signedFlat} ${spec.damage.type}`, source:"runtime action contract" },
    ],
  };
}

function matchesDefinition(entityId:string,definitionId:string) {
  return entityId===definitionId
    || entityId.startsWith(`${definitionId}.`)
    || entityId.startsWith(`${definitionId}-`);
}

function definitionForEntity(definitions:CombatantDefinitionVm[],entityId:string) {
  return [...definitions]
    .sort((left,right)=>right.id.length-left.id.length)
    .find((definition)=>matchesDefinition(entityId,definition.id));
}

function runtimeActionsFor(definition:CombatantDefinitionVm) {
  return definition.runtimeActions ?? BUILTIN_RUNTIME_ACTIONS[definition.id];
}

function sameRuntimeAction(left:ActionVm,right:ActionVm) {
  return left.id===right.id
    && left.actorId===right.actorId
    && left.name===right.name
    && left.attackBonus===right.attackBonus
    && left.damage?.[0]?.type===right.damage?.[0]?.type
    && left.damage?.[0]?.dice===right.damage?.[0]?.dice
    && left.damage?.[0]?.flat===right.damage?.[0]?.flat
    && left.runtimeAttack?.sourceKind===right.runtimeAttack?.sourceKind
    && left.runtimeAttack?.rangeFeet===right.runtimeAttack?.rangeFeet
    && left.runtimeAttack?.damageSource===right.runtimeAttack?.damageSource;
}

function materializeEncounterRuntimeActions(internal:CombatantRuntimeAdapterState,entity?:SceneEntity) {
  const entities=entity ? [entity] : internal.scene.entities.filter((entry)=>entry.kind==="combatant");
  for (const combatant of entities) {
    const definition=definitionForEntity(internal.combatantDefinitions,combatant.id);
    if (!definition) continue;
    const specs=runtimeActionsFor(definition);
    if (!specs) continue;
    const existing=internal.scene.actionsByActor[combatant.id] ?? [];
    const preserveLegacyIds=!combatant.id.includes(".instance-");
    const next=specs.map((spec)=>{
      const existingId=preserveLegacyIds ? existing.find((action)=>action.name===spec.name)?.id : undefined;
      return actionVm(definition,combatant.id,spec,existingId);
    });
    if (existing.length===next.length && existing.every((action,index)=>sameRuntimeAction(action,next[index]))) continue;
    internal.scene.actionsByActor[combatant.id]=next;
  }
}

const previousGetSnapshot=MockAdapter.prototype.getSnapshot;
const previousPreview=MockAdapter.prototype.previewCombatantImport;
const previousInstantiate=MockAdapter.prototype.instantiateCombatant;

MockAdapter.prototype.getSnapshot=async function getSnapshotWithEncounterRuntimeActions() {
  const internal=this as unknown as CombatantRuntimeAdapterState;
  materializeEncounterRuntimeActions(internal);
  return previousGetSnapshot.call(this);
};

MockAdapter.prototype.previewCombatantImport=async function previewCombatantImportWithRuntimeStats(payload:string) {
  const internal=this as unknown as CombatantRuntimeAdapterState;
  await previousPreview.call(this,payload);
  const preview=internal.combatantImport;
  if (!preview?.definition || preview.validation.some((entry)=>entry.severity==="blocking")) return internal.getSnapshot();
  try {
    const parsed=JSON.parse(payload) as Record<string,unknown>;
    const runtimeStats=parseRuntimeStats(parsed);
    const runtimeActions=parseRuntimeActions(parsed);
    if (runtimeStats) {
      preview.definition.runtimeStats=runtimeStats;
      preview.validation.push({ severity:"info", message:"Combatant runtime ability/save/speed/defense stats 검증 통과" });
    } else {
      preview.validation.push({ severity:"warning", message:"runtime abilities가 없어 saving throw/real runtime action은 explicit reject될 수 있습니다." });
    }
    if (runtimeActions) {
      preview.definition.runtimeActions=runtimeActions;
      preview.definition.actions=runtimeActions.map((entry)=>entry.name);
      preview.validation.push({ severity:"info", message:"Combatant runtime action contracts 검증 통과" });
    } else if (runtimeStats) {
      preview.validation.push({ severity:"warning", message:"runtimeActions가 없어 구조화된 Combatant는 가짜 기본 공격을 생성하지 않습니다." });
    }
  } catch (error) {
    preview.validation.push({ severity:"blocking", message:error instanceof Error ? error.message : String(error) });
  }
  return internal.getSnapshot();
};

MockAdapter.prototype.instantiateCombatant=async function instantiateCombatantWithRuntimeDefinition(definitionId:string) {
  const internal=this as unknown as CombatantRuntimeAdapterState;
  const beforeIds=new Set(internal.scene.entities.map((entity)=>entity.id));
  await previousInstantiate.call(this,definitionId);
  const added=internal.scene.entities.find((entity)=>!beforeIds.has(entity.id));
  const definition=internal.combatantDefinitions.find((entry)=>entry.id===definitionId);
  if (!added || !definition) return internal.getSnapshot();
  const stats=definition.runtimeStats;
  if (stats) {
    added.resistances=[...stats.resistances];
    added.immunities=[...stats.immunities];
    added.vulnerabilities=[...stats.vulnerabilities];
    internal.scene.economyByActor[added.id]={ action:true, bonusAction:true, reaction:true, movement:stats.speed, movementMax:stats.speed };
  }
  const runtimeActions=runtimeActionsFor(definition);
  if (runtimeActions) {
    internal.scene.actionsByActor[added.id]=runtimeActions.map((entry)=>actionVm(definition,added.id,entry));
  } else if (stats) {
    internal.scene.actionsByActor[added.id]=[];
  }
  materializeEncounterRuntimeActions(internal,added);
  return internal.getSnapshot();
};
