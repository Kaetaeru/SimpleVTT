import "./progressionContracts";
import "./spellcastingRuntimeContracts";
import type { AbilityKey, ActionVm, AppSnapshot, CharacterSheet } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { multiclassSpellSlots } from "../domain/progressionCatalog";

const FIRE_BOLT="dnd.srd521.spell.fire-bolt";
const MAGIC_MISSILE="dnd.srd521.spell.magic-missile";

type SpellCharacter=CharacterSheet&{
  cantrips?:string[];
  preparedSpells?:string[];
  spellSlotMaximums?:Record<number,number>;
};

type State={
  activeCharacter:CharacterSheet;
  getSnapshot():Promise<AppSnapshot>;
};

const previousGetSnapshot=MockAdapter.prototype.getSnapshot;
const mod=(score:number)=>Math.floor((score-10)/2);
const signed=(value:number)=>value>=0?`+${value}`:`${value}`;
const detail=(label:string,value:string,source?:string)=>({label,value,...(source?{source}:{})});

function normalizedSpellId(value:string) {
  return value.replace(/^always:/,"");
}

function spellAbility(character:SpellCharacter):AbilityKey {
  const className=character.className.toLowerCase();
  if (/wizard|위저드/.test(className)) return "int";
  if (/cleric|druid|ranger|클레릭|드루이드|레인저/.test(className)) return "wis";
  if (/bard|sorcerer|warlock|paladin|바드|소서러|워락|팔라딘/.test(className)) return "cha";
  return (["int","wis","cha"] as AbilityKey[]).sort((a,b)=>character.abilities[b]-character.abilities[a])[0];
}

function productionSpellActions(character:SpellCharacter):ActionVm[] {
  const cantrips=(character.cantrips??[]).map(normalizedSpellId);
  const prepared=(character.preparedSpells??[]).map(normalizedSpellId);
  const ability=spellAbility(character);
  const abilityMod=mod(character.abilities[ability]);
  const attack=character.proficiencyBonus+abilityMod;
  const actions:ActionVm[]=[];

  if (cantrips.includes(FIRE_BOLT)) {
    actions.push({
      id:"action.fire-bolt",
      actorId:character.id,
      name:"화염탄",
      category:"magic",
      target:"enemy",
      economy:"행동",
      resolutionKind:"attack",
      summary:`${signed(attack)} · 1d10 화염`,
      available:true,
      eligibleTargetIds:[],
      attackBonus:attack,
      damage:[{type:"화염",dice:"1d10",flat:0,average:6}],
      details:[
        detail("대상","크리처 1개"),
        detail("사거리","120피트"),
        detail("명중",signed(attack),`${character.className} spellcasting ability + proficiency`),
        detail("피해","1d10 화염","SRD 5.2.1 · Fire Bolt"),
      ],
      spellCast:{spellId:FIRE_BOLT,runtimeSupport:"combat-executable",baseLevel:0,castSource:"prepared"},
    });
  }

  if (prepared.includes(MAGIC_MISSILE)) {
    actions.push({
      id:"action.magic-missile",
      actorId:character.id,
      name:"마법 화살",
      category:"magic",
      target:"multi-enemy",
      economy:"행동",
      resolutionKind:"no-roll-damage",
      summary:"자동 명중 · 3발 · 1d4+1 역장",
      available:true,
      eligibleTargetIds:[],
      maxTargets:3,
      damage:[{type:"역장",dice:"3d4",flat:3,average:11}],
      details:[
        detail("대상","최대 3개 크리처"),
        detail("사거리","120피트"),
        detail("피해","발사체마다 1d4 + 1 역장","SRD 5.2.1 · Magic Missile"),
      ],
      spellCast:{spellId:MAGIC_MISSILE,runtimeSupport:"combat-executable",baseLevel:1,castSource:"prepared"},
    });
  }

  return actions;
}

function projectSpellcaster(snapshot:AppSnapshot,character:SpellCharacter) {
  const cantrips=(character.cantrips??[]).map(normalizedSpellId);
  const preparedRaw=character.preparedSpells??[];
  const prepared=preparedRaw.filter((id)=>!id.startsWith("always:")).map(normalizedSpellId);
  const alwaysPrepared=preparedRaw.filter((id)=>id.startsWith("always:")).map(normalizedSpellId);
  if (!cantrips.length&&!prepared.length&&!alwaysPrepared.length) return snapshot;

  const ability=spellAbility(character);
  const abilityMod=mod(character.abilities[ability]);
  const slotMaximums=character.spellSlotMaximums??multiclassSpellSlots(character.classLevels??[]).slots;
  const slots=Object.entries(slotMaximums)
    .map(([level,maximum])=>({level:Number(level),current:maximum,max:maximum}))
    .filter((entry)=>Number.isInteger(entry.level)&&entry.level>0&&entry.max>0)
    .sort((a,b)=>a.level-b.level);

  snapshot.scene.spellcastingByActor??={};
  for (const actorId of Object.keys(snapshot.scene.spellcastingByActor)) {
    if (!snapshot.scene.entities.some((entity)=>entity.id===actorId)) delete snapshot.scene.spellcastingByActor[actorId];
  }
  snapshot.scene.spellcastingByActor[character.id]={
    spellAttackModifier:character.proficiencyBonus+abilityMod,
    spellSaveDc:8+character.proficiencyBonus+abilityMod,
    spellcastingAbilityModifier:abilityMod,
    cantripSpellIds:cantrips,
    preparedSpellIds:prepared,
    alwaysPreparedSpellIds:alwaysPrepared,
    slots,
    slottedSpellCastThisTurn:false,
  };

  const existing=snapshot.scene.actionsByActor[character.id]??[];
  const projected=productionSpellActions(character);
  const projectedIds=new Set(projected.map((action)=>action.id));
  snapshot.scene.actionsByActor[character.id]=[
    ...existing.filter((action)=>!projectedIds.has(action.id)),
    ...projected,
  ];
  return snapshot;
}

MockAdapter.prototype.getSnapshot=async function getSnapshotWithProductionSpellcasterProjection() {
  const snapshot=await previousGetSnapshot.call(this);
  const internal=this as unknown as State;
  const character=(snapshot.activeCharacter?.id?snapshot.activeCharacter:internal.activeCharacter) as SpellCharacter;
  return projectSpellcaster(snapshot,character);
};
