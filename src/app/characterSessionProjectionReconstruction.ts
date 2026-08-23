import "./creationContracts";
import "./progressionContracts";
import "./combatantRuntimeContracts";
import "./lifeRuntimeContracts";
import "./persistenceContracts";
import type {
  ActionVm,
  CatalogEntry,
  CharacterResourceVm,
  CharacterSheet,
  EconomyVm,
  ItemInstanceVm,
  SceneEntity,
} from "./contracts";
import {
  classIdFromName,
  entryName,
  itemEntryById,
  itemMechanic,
  classMeta,
  speciesDefinition,
} from "./characterCreationV10Data";
import { proficiencyBonusForTotalLevel } from "../domain/progressionCatalog";
import {
  parseCharacterSessionProjectionV1,
  type CharacterProjectionContentIdentityV1,
  type CharacterSessionProjectionV1,
} from "./characterSessionProjection";

export type CharacterSessionProjectionReconstruction =
  | {
      status:"accepted";
      projection:CharacterSessionProjectionV1;
      sheet:CharacterSheet;
      entity:SceneEntity;
      actions:ActionVm[];
      economy:EconomyVm;
    }
  | { status:"rejected"; error:string };

type ArmorDefinition = { ac?:{ base?:number; dex?:string; dexMax?:number } };
type ShieldDefinition = { acBonus?:number };
type ConsumableDefinition = { economy?:string; healing?:string };

const POTION_OF_HEALING_ID="dnd.srd521.item.gear.potion-of-healing";
const clone=<T,>(value:T):T=>structuredClone(value);
const abilityMod=(score:number)=>Math.floor((score-10)/2);

function classIdentities(projection:CharacterSessionProjectionV1) {
  return projection.contentIdentities.filter((identity)=>identity.category==="class");
}

function primaryClassId(projection:CharacterSessionProjectionV1) {
  return projection.source.build.classLevels?.[0]?.classId ?? classIdFromName(projection.source.build.className);
}

function primaryClassIdentity(projection:CharacterSessionProjectionV1):CharacterProjectionContentIdentityV1 {
  const id=primaryClassId(projection);
  const identity=classIdentities(projection).find((entry)=>entry.contentId===id);
  if (!identity) throw new Error(`projection is missing primary class identity: ${id}`);
  return identity;
}

function classLevel(projection:CharacterSessionProjectionV1,classId:string) {
  const tracks=projection.source.build.classLevels ?? [];
  if (tracks.length) return tracks.find((track)=>track.classId===classId)?.level ?? 0;
  return primaryClassId(projection)===classId ? projection.source.build.level : 0;
}

function runtimeItemById(projection:CharacterSessionProjectionV1) {
  return new Map(projection.runtime.items.map((item)=>[item.id,item]));
}

function reconstructItems(projection:CharacterSessionProjectionV1):ItemInstanceVm[] {
  const runtimeById=runtimeItemById(projection);
  const sourceIds=new Set(projection.source.itemReferences.map((item)=>item.id));
  for (const runtime of projection.runtime.items) {
    if (!sourceIds.has(runtime.id)) throw new Error(`projection runtime item has no source definition: ${runtime.id}`);
  }

  return projection.source.itemReferences.map((source) => {
    const runtime=runtimeById.get(source.id);
    if (!runtime) throw new Error(`projection source item is missing runtime state: ${source.id}`);
    if (!Number.isInteger(runtime.quantity) || runtime.quantity<0) throw new Error(`projection item quantity is invalid: ${source.id}`);
    const canonical=itemEntryById(source.definitionId);
    if (!canonical && (runtime.equipped || runtime.wielded || runtime.attuned)) {
      throw new Error(`active projected item has no trusted host mechanic entry: ${source.definitionId}`);
    }
    const consumable=canonical ? itemMechanic(canonical,"consumable-definition") : undefined;
    const kind:ItemInstanceVm["kind"] = source.kind ?? (consumable ? "consumable" : "equipment");
    const maxCharges=source.chargeMaximum;
    if (runtime.charges && (!Number.isInteger(runtime.charges.current) || runtime.charges.current<0 || maxCharges===undefined || runtime.charges.current>maxCharges)) {
      throw new Error(`projection item charge state is invalid: ${source.id}`);
    }
    return {
      id:source.id,
      definitionId:source.definitionId,
      name:canonical ? entryName(canonical) : source.name ?? source.definitionId,
      nameEn:canonical?.presentation.originalName ?? source.nameEn,
      kind,
      quantity:runtime.quantity,
      equipped:runtime.equipped,
      wielded:runtime.wielded,
      wieldSlot:runtime.wieldSlot,
      attunementRequired:source.attunementRequired === true,
      attuned:runtime.attuned,
      charges:maxCharges!==undefined ? { current:runtime.charges?.current ?? maxCharges,max:maxCharges } : undefined,
      passiveEffects:canonical ? [] : clone(source.passiveEffects ?? []),
      grantedActionIds:[],
      provenance:canonical
        ? [`SessionProjection:${projection.characterId}`,`canonical-item:${source.definitionId}`]
        : [...clone(source.provenance),`SessionProjection:${projection.characterId}`,`inert-custom-item:${source.definitionId}`],
    };
  });
}

function reconstructResources(projection:CharacterSessionProjectionV1):CharacterResourceVm[] {
  const definitions=projection.source.resourceDefinitions ?? [];
  const runtimeById=new Map(projection.runtime.resources.map((resource)=>[resource.id,resource]));
  const definitionIds=new Set(definitions.map((resource)=>resource.id));
  for (const runtime of projection.runtime.resources) {
    if (!definitionIds.has(runtime.id)) throw new Error(`projection runtime resource has no source definition: ${runtime.id}`);
  }
  return definitions.map((definition) => {
    const runtime=runtimeById.get(definition.id);
    if (!runtime) throw new Error(`projection source resource is missing runtime state: ${definition.id}`);
    if (!Number.isInteger(definition.max) || definition.max<0 || !Number.isInteger(runtime.current) || runtime.current<0 || runtime.current>definition.max) {
      throw new Error(`projection resource state is invalid: ${definition.id}`);
    }
    return {
      id:definition.id,
      label:definition.label,
      current:runtime.current,
      max:definition.max,
      source:definition.source,
    };
  });
}

function equipmentArmorClass(projection:CharacterSessionProjectionV1,items:ItemInstanceVm[]) {
  const dex=abilityMod(projection.source.build.abilities.dex);
  const con=abilityMod(projection.source.build.abilities.con);
  const wis=abilityMod(projection.source.build.abilities.wis);
  let armorAc:number|undefined;
  let shield=0;
  let hasArmor=false;
  let hasShield=false;
  for (const item of items.filter((candidate)=>candidate.equipped && candidate.quantity>0)) {
    const canonical=itemEntryById(item.definitionId);
    if (!canonical) throw new Error(`equipped projected item has no canonical AC mechanic: ${item.definitionId}`);
    const armor=itemMechanic(canonical,"armor-definition") as ArmorDefinition|undefined;
    const shieldDef=itemMechanic(canonical,"shield-definition") as ShieldDefinition|undefined;
    const weapon=itemMechanic(canonical,"weapon-definition");
    if (!armor && !shieldDef && !weapon && !["gear","tool","focus","pack","book"].includes(canonical.category)) {
      throw new Error(`equipped projected item category is not reconstructable: ${item.definitionId}`);
    }
    if (armor?.ac?.base!==undefined) {
      hasArmor=true;
      const dexContribution=armor.ac.dex==="full"
        ? dex
        : armor.ac.dexMax!==undefined
          ? Math.min(dex,armor.ac.dexMax)
          : 0;
      armorAc=Math.max(armorAc ?? Number.NEGATIVE_INFINITY,armor.ac.base+dexContribution);
    }
    if (shieldDef?.acBonus) {
      hasShield=true;
      shield+=shieldDef.acBonus;
    }
  }
  let ac=(armorAc ?? (10+dex))+shield;
  const primaryClass=primaryClassIdentity(projection).contentId;
  if (primaryClass==="dnd.srd521.class.barbarian" && !hasArmor) ac=Math.max(ac,10+dex+con+shield);
  if (primaryClass==="dnd.srd521.class.monk" && !hasArmor && !hasShield) ac=Math.max(ac,10+dex+wis);
  if (hasArmor && (projection.source.progression.fightingStyleFeatIds ?? []).includes("dnd.srd521.feat.fighting-style.defense")) ac+=1;
  return ac;
}

function skillProficient(skills:string[],nameKo:string,nameEn:string) {
  return skills.some((skill)=>{
    const normalized=skill.replace(/\s+[+-]\d+$/,"").trim().toLowerCase();
    return normalized===nameKo.toLowerCase() || normalized===nameEn.toLowerCase();
  });
}

function parseHealingFormula(value:string|undefined) {
  const match=value?.trim().match(/^(\d+)d(\d+)(?:\s*\+\s*(\d+))?$/i);
  if (!match) return undefined;
  const count=Number(match[1]);
  const sides=Number(match[2]);
  const flat=Number(match[3]??0);
  if (!Number.isInteger(count)||count<1||!Number.isInteger(sides)||sides<2||!Number.isInteger(flat)||flat<0) return undefined;
  return { dice:`${count}d${sides}`,flat,average:Math.floor(count*(sides+1)/2+flat) };
}

function consumableEconomy(value:string|undefined):ActionVm["economy"]|undefined {
  if (value==="bonus-action") return "추가 행동";
  if (value==="action") return "행동";
  return undefined;
}

function projectedItemActions(sheet:CharacterSheet,targetSelf:string[]):ActionVm[] {
  const actions:ActionVm[]=[];
  for (const item of sheet.items) {
    if (item.definitionId!==POTION_OF_HEALING_ID) continue;
    const canonical=itemEntryById(item.definitionId);
    if (!canonical) continue;
    const mechanic=itemMechanic(canonical,"consumable-definition") as ConsumableDefinition|undefined;
    const healing=parseHealingFormula(mechanic?.healing);
    const economy=consumableEconomy(mechanic?.economy);
    if (!mechanic||!healing||!economy) continue;
    actions.push({
      id:"action.healing-potion",
      actorId:sheet.id,
      name:item.name,
      category:"basic",
      target:"self",
      economy,
      resolutionKind:"healing",
      summary:`${healing.dice} + ${healing.flat} 회복 · ${item.quantity}개`,
      available:item.quantity>0,
      disabledReason:item.quantity>0 ? undefined : "남은 수량이 없습니다.",
      eligibleTargetIds:targetSelf,
      healing,
      itemCost:{itemId:item.id,quantity:1},
      details:[
        {label:"대상",value:"자신"},
        {label:"회복",value:`${healing.dice} + ${healing.flat}`,source:`canonical-item:${item.definitionId}`},
        {label:"비용",value:`${economy} + ${item.name} 1개`,source:`SessionProjection:${sheet.id}`},
      ],
    });
  }
  return actions;
}

function actionsFor(projection:CharacterSessionProjectionV1,sheet:CharacterSheet):ActionVm[] {
  const targetSelf=[sheet.id];
  const actions:ActionVm[]=[
    {
      id:`action.phase13.dash.${sheet.id}`,
      actorId:sheet.id,
      name:"질주",
      category:"basic",
      target:"self",
      economy:"행동",
      resolutionKind:"no-roll",
      summary:"이동 가능량 증가",
      available:true,
      eligibleTargetIds:targetSelf,
      details:[
        {label:"대상",value:"자신"},
        {label:"효과",value:`이동 가능량 +${sheet.speed}피트`,source:"host canonical SessionProjection"},
        {label:"비용",value:"행동 1"},
      ],
    },
  ];
  const athletics=abilityMod(sheet.abilities.str)+(skillProficient(sheet.skills,"운동","Athletics") ? sheet.proficiencyBonus : 0);
  actions.push({
    id:`action.phase13.athletics.${sheet.id}`,
    actorId:sheet.id,
    name:"운동 판정",
    category:"basic",
    target:"none",
    economy:"없음",
    resolutionKind:"ability-check",
    summary:`근력(운동) ${athletics>=0?"+":""}${athletics}`,
    available:true,
    eligibleTargetIds:[],
    checkBonus:athletics,
    details:[
      {label:"판정",value:"근력(운동)"},
      {label:"보너스",value:`${athletics>=0?"+":""}${athletics}`,source:"host-derived ability + proficiency"},
    ],
  });

  const fighterLevel=classLevel(projection,"dnd.srd521.class.fighter");
  if (fighterLevel>=1) {
    const secondWind=sheet.resources.find((resource)=>resource.id==="resource.second-wind" || resource.id.includes("second-wind"));
    if (!secondWind) throw new Error("Fighter SessionProjection is missing canonical Second Wind resource state");
    actions.push({
      id:"action.second-wind",
      actorId:sheet.id,
      name:"세컨드 윈드",
      category:"basic",
      target:"self",
      economy:"추가 행동",
      resolutionKind:"healing",
      summary:`1d10+${fighterLevel} 회복`,
      available:secondWind.current>0,
      disabledReason:secondWind.current>0 ? undefined : "세컨드 윈드 자원 없음",
      eligibleTargetIds:targetSelf,
      healing:{dice:"1d10",flat:fighterLevel,average:Math.floor(5.5+fighterLevel)},
      resourceCost:{resourceId:secondWind.id,amount:1},
      details:[
        {label:"대상",value:"자신"},
        {label:"회복",value:`1d10 + ${fighterLevel}`,source:"SRD Fighter · Second Wind"},
        {label:"비용",value:"추가 행동 + 자원 1"},
      ],
    });
  }
  actions.push(...projectedItemActions(sheet,targetSelf));
  return actions;
}

function reconstructAccepted(projection:CharacterSessionProjectionV1):CharacterSessionProjectionReconstruction {
  const classId=primaryClassIdentity(projection).contentId;
  const meta=classMeta(classId);
  const species=speciesDefinition(projection.source.build.species);
  const proficiencyBonus=proficiencyBonusForTotalLevel(projection.source.build.level);
  if (proficiencyBonus<=0) throw new Error(`projection total level is outside supported progression: ${projection.source.build.level}`);
  const items=reconstructItems(projection);
  const resources=reconstructResources(projection);
  const ac=equipmentArmorClass(projection,items);
  const speed=species.speed ?? 30;
  const abilities=clone(projection.source.build.abilities);
  const sheet:CharacterSheet={
    id:projection.characterId,
    name:projection.source.name,
    className:projection.source.build.className,
    subclassName:projection.source.build.subclassName,
    level:projection.source.build.level,
    species:projection.source.build.species,
    background:projection.source.build.background,
    hp:projection.runtime.hp,
    maxHp:projection.sourceAuthority.maxHp,
    ac,
    saveState:"saved",
    proficiencyBonus,
    speed,
    tempHp:projection.runtime.tempHp,
    abilities,
    saves:meta.saves.map((ability)=>`${ability.toUpperCase()} ${proficiencyBonus+abilityMod(abilities[ability])>=0?"+":""}${proficiencyBonus+abilityMod(abilities[ability])}`),
    skills:clone(projection.source.build.skills),
    features:clone(projection.source.featureGrants ?? []),
    equipment:items.map((item)=>item.quantity>1 ? `${item.name} ×${item.quantity}` : item.name),
    items,
    resources,
    attacks:[],
    rulesProfileId:projection.rulesProfile.id,
    rulesProfileVersion:projection.rulesProfile.version,
    sourceRevision:projection.sourceRevision,
    runtimeRevision:projection.runtimeRevision,
    durableLifeFlags:projection.runtime.lifeFlags ? clone(projection.runtime.lifeFlags) : undefined,
  };
  Object.assign(sheet,{
    classLevels:clone(projection.source.build.classLevels ?? []),
    hitDiceByDie:clone(projection.source.build.hitDiceByDie ?? {}),
    size:projection.source.build.size ?? species.size?.[0],
    languages:clone(projection.source.build.languages ?? []),
    toolProficiencies:clone(projection.source.build.toolProficiencies ?? []),
    creationSelections:clone(projection.source.build.creationSelections),
    notes:projection.source.build.notes,
    creationAuthoringSource:projection.source.creationAuthoring ? clone(projection.source.creationAuthoring) : undefined,
    cantrips:clone(projection.source.spellAndFeatureSelections.cantrips ?? []),
    preparedSpells:clone(projection.source.spellAndFeatureSelections.preparedSpells ?? []),
    spellbookSpells:clone(projection.source.spellAndFeatureSelections.spellbookSpells ?? []),
    masteryWeapons:clone(projection.source.spellAndFeatureSelections.masteryWeapons ?? []),
    goldGp:projection.runtime.goldGp,
    ...clone(projection.source.progression),
  });
  const entity:SceneEntity={
    id:sheet.id,
    name:sheet.name,
    side:"ally",
    kind:"character",
    hp:sheet.hp,
    maxHp:sheet.maxHp,
    tempHp:sheet.tempHp,
    ac:sheet.ac,
    initiative:abilityMod(sheet.abilities.dex),
    status:[],
    resistances:[],
    immunities:[],
    vulnerabilities:[],
    reactions:[],
    runtimeLife:sheet.durableLifeFlags ? {
      deathSaves:{successes:0,failures:0},
      stable:sheet.durableLifeFlags.stable,
      unconscious:sheet.durableLifeFlags.unconscious,
      dead:sheet.durableLifeFlags.dead,
    } : undefined,
  };
  const actions=actionsFor(projection,sheet);
  const economy:EconomyVm={
    action:true,
    bonusAction:true,
    reaction:true,
    movement:sheet.speed,
    movementMax:sheet.speed,
  };
  return {status:"accepted",projection:clone(projection),sheet,entity,actions,economy};
}

export function reconstructCharacterSessionProjectionV1(
  value:unknown,
  hostCatalog:CatalogEntry[],
):CharacterSessionProjectionReconstruction {
  const parsed=parseCharacterSessionProjectionV1(value,hostCatalog);
  if (parsed.status==="rejected") return parsed;
  try {
    return reconstructAccepted(parsed.projection);
  } catch(error) {
    return {status:"rejected",error:error instanceof Error ? error.message : String(error)};
  }
}
