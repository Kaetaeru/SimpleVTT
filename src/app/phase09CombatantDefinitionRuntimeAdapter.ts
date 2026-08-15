import "./phase09RealNoRollDamageAdapter";
import "./combatantRuntimeContracts";
import type { AbilityKey, AbilityScores, AppSnapshot, CombatantDefinitionVm, CombatantImportPreview, SceneVm } from "./contracts";
import { MockAdapter } from "./mockAdapter";

const ABILITY_KEYS:AbilityKey[]=["str","dex","con","int","wis","cha"];

interface CombatantRuntimeAdapterState {
  combatantImport:CombatantImportPreview|null;
  combatantDefinitions:CombatantDefinitionVm[];
  scene:SceneVm;
  getSnapshot():Promise<AppSnapshot>;
}

function stringArray(value:unknown) {
  return Array.isArray(value) ? value.map(String) : [];
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
  if (savesRaw!==undefined && !Array.isArray(savesRaw)) {
    throw new Error("savingThrowProficiencies must be an array");
  }
  const savingThrowProficiencies=stringArray(savesRaw) as AbilityKey[];
  for (const key of savingThrowProficiencies) {
    if (!ABILITY_KEYS.includes(key)) throw new Error(`invalid saving throw proficiency: ${key}`);
  }
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
    if (runtimeStats) {
      preview.definition.runtimeStats=runtimeStats;
      preview.validation.push({ severity:"info", message:"Combatant runtime ability/save/speed/defense stats 검증 통과" });
    } else {
      preview.validation.push({ severity:"warning", message:"runtime abilities가 없어 saving throw/real runtime action은 explicit reject될 수 있습니다." });
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
  const stats=definition?.runtimeStats;
  if (!added || !stats) return internal.getSnapshot();
  added.resistances=[...stats.resistances];
  added.immunities=[...stats.immunities];
  added.vulnerabilities=[...stats.vulnerabilities];
  internal.scene.economyByActor[added.id]={
    action:true,
    bonusAction:true,
    reaction:true,
    movement:stats.speed,
    movementMax:stats.speed,
  };
  return internal.getSnapshot();
};
