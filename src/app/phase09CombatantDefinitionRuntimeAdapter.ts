import "./phase09RealNoRollDamageAdapter";
import "./combatantRuntimeContracts";
import type { AbilityKey, AbilityScores, ActionVm, AppSnapshot, CombatantDefinitionVm, CombatantImportPreview, SceneVm } from "./contracts";
import type { CombatantRuntimeAttackVm } from "./combatantRuntimeContracts";
import { MockAdapter } from "./mockAdapter";

const ABILITY_KEYS:AbilityKey[]=["str","dex","con","int","wis","cha"];

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

function stringArray(value:unknown) {
  return Array.isArray(value) ? value.map(String) : [];
}

function diceShape(formula:string) {
  const match=formula.match(/^(\d+)d(\d+)$/i);
  if (!match) throw new Error(`unsupported runtime action damage dice: ${formula}`);
  const count=Number(match[1]);
  const sides=Number(match[2]);
  if (!Number.isInteger(count)||count<1||!Number.isInteger(sides)||sides<2) throw new Error(`invalid runtime action damage dice: ${formula}`);
  return { count,sides };
}

function parseRuntimeStats(payload:Record<string,unknown>) {
  const abilitiesRaw=payload.abilities;
  if (!abilitiesRaw || typeof abilitiesRaw!=="object" || Array.isArray(abilitiesRaw)) return undefined;
  const record=abilitiesRaw as Record<string,unknown>;
  const abilities={} as AbilityScores;
  for (const key of ABILITY_KEYS) {
    const value=record[key];
    if (typeof value!=="number" || !Number.isInteger(value) || value<1 || value>30) {
      throw new Error(`abilities.${key} must be an integer from 1 to 30`);
    }
    abilities[key]=value;
  }
  const proficiencyBonus=payload.proficiencyBonus;
  if (typeof proficiencyBonus!=="number" || !Number.isInteger(proficiencyBonus) || proficiencyBonus<0) {
    throw new Error("proficiencyBonus must be a non-negative integer when runtime abilities are provided");
  }
  const speed=payload.speed;
  if (typeof speed!=="number" || !Number.isInteger(speed) || speed<0) {
    throw new Error("speed must be a non-negative integer when runtime abilities are provided");
  }
  const savesRaw=payload.savingThrowProficiencies;
  if (savesRaw!==undefined && !Array.isArray(savesRaw)) throw new Error("savingThrowProficiencies must be an array");
  const savingThrowProficiencies=stringArray(savesRaw) as AbilityKey[];
  for (const key of savingThrowProficiencies) if (!ABILITY_KEYS.includes(key)) throw new Error(`invalid saving throw proficiency: ${key}`);
  return {
    abilities,
    proficiencyBonus,
    savingThrowProficiencies,
    speed,
    resistances:stringArray(payload.resistances),
    immunities:stringArray(payload.immunities),
    vulnerabilities:stringArray(payload.vulnerabilities),
  };
}

function parseRuntimeActions(payload:Record<string,unknown>):CombatantRuntimeAttackVm[]|undefined {
  if (payload.runtimeActions===undefined) return undefined;
  if (!Array.isArray(payload.runtimeActions)) throw new Error("runtimeActions must be an array");
  return payload.runtimeActions.map((raw,index)=>{
    if (!raw || typeof raw!=="object" || Array.isArray(raw)) throw new Error(`runtimeActions[${index}] must be an object`);
    const entry=raw as Record<string,unknown>;
    const damage=entry.damage;
    if (!damage || typeof damage!=="object" || Array.isArray(damage)) throw new Error(`runtimeActions[${index}].damage must be an object`);
    const damageRecord=damage as Record<string,unknown>;
    const id=entry.id;
    const name=entry.name;
    const category=entry.category;
    const sourceKind=entry.sourceKind;
    const attackBonus=entry.attackBonus;
    const rangeFeet=entry.rangeFeet;
    const type=damageRecord.type;
    const dice=damageRecord.dice;
    const flat=damageRecord.flat;
    if (typeof id!=="string" || !/^[a-z0-9][a-z0-9-]*$/i.test(id)) throw new Error(`runtimeActions[${index}].id must be a stable slug`);
    if (typeof name!=="string" || !name.trim()) throw new Error(`runtimeActions[${index}].name is required`);
    if (category!=="basic" && category!=="weapon" && category!=="magic") throw new Error(`runtimeActions[${index}].category is invalid`);
    if (sourceKind!=="weapon" && sourceKind!=="spell") throw new Error(`runtimeActions[${index}].sourceKind is invalid`);
    if (typeof attackBonus!=="number" || !Number.isInteger(attackBonus)) throw new Error(`runtimeActions[${index}].attackBonus must be an integer`);
    if (typeof rangeFeet!=="number" || !Number.isInteger(rangeFeet) || rangeFeet<0) throw new Error(`runtimeActions[${index}].rangeFeet must be a non-negative integer`);
    if (typeof type!=="string" || !type.trim()) throw new Error(`runtimeActions[${index}].damage.type is required`);
    if (typeof dice!=="string") throw new Error(`runtimeActions[${index}].damage.dice is required`);
    diceShape(dice);
    if (typeof flat!=="number" || !Number.isInteger(flat)) throw new Error(`runtimeActions[${index}].damage.flat must be an integer`);
    return { id,name,category,sourceKind,attackBonus,rangeFeet,damage:{ type,dice,flat } };
  });
}

function actionVm(definition:CombatantDefinitionVm,actorId:string,spec:CombatantRuntimeAttackVm):ActionVm {
  const shape=diceShape(spec.damage.dice);
  const average=Math.max(0,Math.round(shape.count*((shape.sides+1)/2)+spec.damage.flat));
  const signedFlat=spec.damage.flat===0 ? "" : ` ${spec.damage.flat>0?"+":"-"} ${Math.abs(spec.damage.flat)}`;
  return {
    id:`action.${actorId}.${spec.id}`,
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

const previousPreview=MockAdapter.prototype.previewCombatantImport;
const previousInstantiate=MockAdapter.prototype.instantiateCombatant;

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
  const runtimeActions=definition.runtimeActions ?? BUILTIN_RUNTIME_ACTIONS[definition.id];
  if (runtimeActions) {
    internal.scene.actionsByActor[added.id]=runtimeActions.map((entry)=>actionVm(definition,added.id,entry));
  } else if (stats) {
    internal.scene.actionsByActor[added.id]=[];
  }
  return internal.getSnapshot();
};
