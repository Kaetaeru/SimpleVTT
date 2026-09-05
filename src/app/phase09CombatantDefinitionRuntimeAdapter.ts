import "./phase09RealNoRollDamageAdapter";
import "./combatantRuntimeContracts";
import type { ActionVm, AppSnapshot, CombatantDefinitionVm, CombatantImportPreview, DamageSpecVm, SceneEntity, SceneVm } from "./contracts";
import type { CombatantRuntimeAttackVm, CombatantRuntimeDamageVm, CombatantRuntimeSaveActionVm, CombatantRuntimeTextActionVm } from "./combatantRuntimeContracts";
import { MockAdapter } from "./mockAdapter";
import { diceShape, parseRuntimeActions, parseRuntimeStats } from "./combatantRuntimeDefinitionParse";
import { abilityLabelKo, isSrdMonsterId, srdMonsterById, srdMonsterCombatantDefinition } from "./srdMonsterCatalog";

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
  /** Test hook: the next initiative d20 for an instantiated SRD monster (consumed once). */
  queuedInitiativeD20?:number|null;
  getSnapshot():Promise<AppSnapshot>;
}

function damageSpec(component:CombatantRuntimeDamageVm):DamageSpecVm {
  const shape=diceShape(component.dice);
  const average=Math.max(0,Math.round(shape.count*((shape.sides+1)/2)+component.flat));
  return { type:component.type, dice:component.dice, flat:component.flat, average };
}

function damageText(component:CombatantRuntimeDamageVm) {
  const signedFlat=component.flat===0 ? "" : ` ${component.flat>0?"+":"-"} ${Math.abs(component.flat)}`;
  return `${component.dice}${signedFlat} ${component.type}`;
}

function actionVm(
  definition:CombatantDefinitionVm,
  actorId:string,
  spec:CombatantRuntimeAttackVm,
  existingId?:string,
):ActionVm {
  const shape=diceShape(spec.damage.dice);
  const components=[spec.damage,...(spec.extraDamage ?? [])];
  const damage=components.map(damageSpec);
  const damageLabel=components.map(damageText).join(" + ");
  const multi=spec.attacksPerAction && spec.attacksPerAction>1 ? ` · ${spec.attacksPerAction}회` : "";
  return {
    id:existingId ?? `action.${actorId}.${spec.id}`,
    actorId,
    name:spec.name,
    category:spec.category,
    target:"enemy",
    economy:spec.economy ?? "행동",
    resolutionKind:"attack",
    summary:`${spec.attackBonus>=0?"+":""}${spec.attackBonus} · ${damageLabel}${multi}`,
    available:true,
    eligibleTargetIds:[],
    attackBonus:spec.attackBonus,
    damage,
    ...(spec.attacksPerAction && spec.attacksPerAction>1 ? { attacksPerAction:spec.attacksPerAction } : {}),
    runtimeAttack:{
      sourceKind:spec.sourceKind,
      rangeFeet:spec.rangeFeet,
      diceSides:shape.sides,
      diceCount:shape.count,
      damageSource:`runtime:combatant-definition:${definition.id}:action:${spec.id}:damage`,
    },
    details:[
      { label:"출처", value:definition.source, source:`Combatant Definition ${definition.id}` },
      { label:"사거리", value:spec.longRangeFeet ? `${spec.rangeFeet}/${spec.longRangeFeet}피트` : `${spec.rangeFeet}피트`, source:"runtime action contract" },
      { label:"명중", value:`${spec.attackBonus>=0?"+":""}${spec.attackBonus}`, source:"runtime action contract" },
      { label:"피해", value:damageLabel, source:"runtime action contract" },
      ...(spec.attacksPerAction && spec.attacksPerAction>1 ? [{ label:"다중 공격", value:`행동당 ${spec.attacksPerAction}회`, source:"runtime action contract" }] : []),
      ...(spec.hitText ? [{ label:"적중", value:spec.hitText, source:"stat block" }] : []),
    ],
  };
}

function saveActionVm(definition:CombatantDefinitionVm,actorId:string,spec:CombatantRuntimeSaveActionVm):ActionVm {
  const damage=spec.damage.map(damageSpec);
  const abilityLabel=abilityLabelKo(spec.saveAbility);
  const damageLabel=spec.damage.map(damageText).join(" + ");
  const successLabel=spec.successDamage==="half" ? "성공 시 절반" : "성공 시 피해 없음";
  return {
    id:`action.${actorId}.${spec.id}`,
    actorId,
    name:spec.name,
    category:"basic",
    target:spec.maxTargets>1 ? "multi-enemy" : "enemy",
    economy:spec.economy ?? "행동",
    resolutionKind:"saving-throw",
    summary:`${abilityLabel} 내성 DC ${spec.saveDc} · ${damageLabel || "효과"}${spec.maxTargets>1 ? " · 여러 대상" : ""}`,
    available:true,
    eligibleTargetIds:[],
    maxTargets:spec.maxTargets,
    saveDc:spec.saveDc,
    saveAbility:abilityLabel,
    saveHalf:spec.successDamage==="half",
    damage,
    details:[
      { label:"출처", value:definition.source, source:`Combatant Definition ${definition.id}` },
      ...(spec.areaText ? [{ label:"범위", value:spec.areaText, source:"stat block" }] : []),
      { label:"내성", value:`${abilityLabel} DC ${spec.saveDc}`, source:"runtime action contract" },
      ...(damage.length ? [{ label:"피해", value:`${damageLabel} · ${successLabel}`, source:"runtime action contract" }] : []),
      ...(spec.failText ? [{ label:"실패", value:spec.failText, source:"stat block" }] : []),
      ...(spec.successText ? [{ label:"성공", value:spec.successText, source:"stat block" }] : []),
    ],
  };
}

function textActionVm(definition:CombatantDefinitionVm,actorId:string,spec:CombatantRuntimeTextActionVm):ActionVm {
  const firstSentence=spec.text.replace(/\s+/g," ").split(/(?<=다\.)\s/)[0] ?? spec.text;
  const summary=firstSentence.length>72 ? `${firstSentence.slice(0,70)}…` : firstSentence;
  return {
    id:`action.${actorId}.${spec.id}`,
    actorId,
    name:spec.name,
    category:"basic",
    target:"none",
    economy:spec.economy,
    resolutionKind:"no-roll",
    summary,
    available:true,
    eligibleTargetIds:[],
    details:[
      { label:"출처", value:definition.source, source:`Combatant Definition ${definition.id}` },
      { label:"효과", value:spec.text, source:"stat block" },
      ...(spec.economy==="없음" ? [{ label:"비용", value:"전설 행동 (다른 크리처의 턴이 끝날 때)", source:"stat block" }] : []),
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

function runtimeActionVms(definition:CombatantDefinitionVm,actorId:string,existing:ActionVm[]=[],preserveLegacyIds=false):ActionVm[]|undefined {
  const attacks=runtimeActionsFor(definition);
  const saves=definition.runtimeSaveActions ?? [];
  const texts=definition.runtimeTextActions ?? [];
  if (!attacks && !saves.length && !texts.length) return undefined;
  return [
    ...(attacks ?? []).map((spec)=>{
      const existingId=preserveLegacyIds ? existing.find((action)=>action.name===spec.name)?.id : undefined;
      return actionVm(definition,actorId,spec,existingId);
    }),
    ...saves.map((spec)=>saveActionVm(definition,actorId,spec)),
    ...texts.map((spec)=>textActionVm(definition,actorId,spec)),
  ];
}

function sameRuntimeAction(left:ActionVm,right:ActionVm) {
  return left.id===right.id
    && left.actorId===right.actorId
    && left.name===right.name
    && left.resolutionKind===right.resolutionKind
    && left.economy===right.economy
    && left.attackBonus===right.attackBonus
    && left.saveDc===right.saveDc
    && left.attacksPerAction===right.attacksPerAction
    && (left.damage?.length ?? 0)===(right.damage?.length ?? 0)
    && left.damage?.[0]?.type===right.damage?.[0]?.type
    && left.damage?.[0]?.dice===right.damage?.[0]?.dice
    && left.damage?.[0]?.flat===right.damage?.[0]?.flat
    && left.runtimeAttack?.sourceKind===right.runtimeAttack?.sourceKind
    && left.runtimeAttack?.rangeFeet===right.runtimeAttack?.rangeFeet
    && left.runtimeAttack?.damageSource===right.runtimeAttack?.damageSource;
}

export function materializeEncounterRuntimeActions(internal:CombatantRuntimeAdapterState,entity?:SceneEntity) {
  const entities=entity ? [entity] : internal.scene.entities.filter((entry)=>entry.kind==="combatant");
  for (const combatant of entities) {
    const definition=definitionForEntity(internal.combatantDefinitions,combatant.id);
    if (!definition) continue;
    const existing=internal.scene.actionsByActor[combatant.id] ?? [];
    const next=runtimeActionVms(definition,combatant.id,existing,!combatant.id.includes(".instance-"));
    if (!next) continue;
    if (existing.length===next.length && existing.every((action,index)=>sameRuntimeAction(action,next[index]))) continue;
    internal.scene.actionsByActor[combatant.id]=next;
  }
}

/** SRD monsters live in the catalog module until the DM adds one; the definition is materialized then. */
export function ensureCombatantDefinition(internal:CombatantRuntimeAdapterState,definitionId:string):CombatantDefinitionVm|undefined {
  const existing=internal.combatantDefinitions.find((entry)=>entry.id===definitionId);
  if (existing) return existing;
  if (!isSrdMonsterId(definitionId)) return undefined;
  const monster=srdMonsterById(definitionId);
  if (!monster) return undefined;
  const definition=srdMonsterCombatantDefinition(monster);
  internal.combatantDefinitions=[...internal.combatantDefinitions,definition];
  return definition;
}

function rollInitiativeD20(internal:CombatantRuntimeAdapterState) {
  const queued=internal.queuedInitiativeD20;
  if (typeof queued==="number") {
    internal.queuedInitiativeD20=null;
    return queued;
  }
  return Math.floor(Math.random()*20)+1;
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
  const definition=ensureCombatantDefinition(internal,definitionId);
  const beforeIds=new Set(internal.scene.entities.map((entity)=>entity.id));
  await previousInstantiate.call(this,definitionId);
  const added=internal.scene.entities.find((entity)=>!beforeIds.has(entity.id));
  if (!added || !definition) return internal.getSnapshot();
  const stats=definition.runtimeStats;
  if (stats) {
    added.resistances=[...stats.resistances];
    added.immunities=[...stats.immunities];
    added.vulnerabilities=[...stats.vulnerabilities];
    internal.scene.economyByActor[added.id]={ action:true, bonusAction:true, reaction:true, movement:stats.speed, movementMax:stats.speed };
  }
  if (definition.runtimeMonster) {
    added.initiative=rollInitiativeD20(internal)+definition.runtimeMonster.initiativeBonus;
  }
  const actions=runtimeActionVms(definition,added.id);
  if (actions) {
    internal.scene.actionsByActor[added.id]=actions;
  } else if (stats) {
    internal.scene.actionsByActor[added.id]=[];
  }
  materializeEncounterRuntimeActions(internal,added);
  return internal.getSnapshot();
};
