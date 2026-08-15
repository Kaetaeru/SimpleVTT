import "./progressionContracts";
import "../domain/warlockPactTome";
import type { CharacterSheet } from "./contracts";
import { classByName } from "../domain/progressionCatalog";
import type { ProgressionCharacterState } from "../domain/progression";

const clone=<T,>(value:T):T=>structuredClone(value);
const unique=(values:string[])=>[...new Set(values.filter(Boolean))];
const normalizedSkillName=(value:string)=>value.replace(/\s+[+-]\d+$/," ").trim();

export interface ProgressionProjectionOptions {
  excludePactTomeFromBaseSpells?:boolean;
}

export type ProgressionApplicationScope="full"|"wizard-long-rest"|"pact-tome";

export interface ProgressionApplicationOptions {
  scope?:ProgressionApplicationScope;
  featureLabelById?:(featureId:string)=>string|undefined;
}

function fallbackClassTracks(sheet:CharacterSheet) {
  const primary=classByName(sheet.className) ?? classByName(sheet.className.split("/")[0]?.trim() ?? sheet.className);
  return sheet.classLevels ?? (primary ? [{ classId:primary.id,className:primary.nameKo,level:sheet.level,subclassName:sheet.subclassName }] : []);
}

export function projectProgressionCharacterState(
  sheet:CharacterSheet,
  options:ProgressionProjectionOptions={},
):ProgressionCharacterState {
  const tomeIds=options.excludePactTomeFromBaseSpells
    ? new Set([...(sheet.pactTomeCantripIds ?? []),...(sheet.pactTomeRitualSpellIds ?? [])])
    : new Set<string>();
  return {
    revision:sheet.progressionRevision ?? 0,
    id:sheet.id,
    name:sheet.name,
    totalLevel:sheet.level,
    abilities:clone(sheet.abilities),
    hpCurrent:sheet.hp,
    hpMaximum:sheet.maxHp,
    proficiencyBonus:sheet.proficiencyBonus,
    classTracks:clone(fallbackClassTracks(sheet)),
    hitDiceByDie:clone(sheet.hitDiceByDie ?? {}),
    features:clone(sheet.features),
    proficientSkills:unique(sheet.skills.map(normalizedSkillName)),
    expertiseSkills:clone(sheet.expertiseSkills ?? []),
    expertiseSources:clone(sheet.expertiseSources ?? {}),
    languages:clone(sheet.languages ?? []),
    languageSources:clone(sheet.languageSources ?? {}),
    cantripIds:clone((sheet.cantrips ?? []).filter((spellId)=>!tomeIds.has(spellId))),
    cantripSources:clone(sheet.cantripSources ?? {}),
    preparedSpellIds:clone((sheet.preparedSpells ?? []).filter((spellId)=>!tomeIds.has(spellId.replace(/^always:/,"")))),
    preparedSpellSources:clone(sheet.preparedSpellSources ?? {}),
    spellbookSpellIds:clone(sheet.spellbookSpells ?? []),
    spellbookSpellSources:clone(sheet.spellbookSpellSources ?? {}),
    spellMasterySpellIds:clone(sheet.spellMasterySpellIds ?? {}),
    spellMasterySources:clone(sheet.spellMasterySources ?? {}),
    signatureSpellIds:clone(sheet.signatureSpellIds ?? []),
    signatureSpellSources:clone(sheet.signatureSpellSources ?? {}),
    metamagicIds:clone(sheet.metamagicIds ?? []),
    metamagicSources:clone(sheet.metamagicSources ?? {}),
    eldritchInvocationIds:clone(sheet.eldritchInvocationIds ?? []),
    eldritchInvocationSources:clone(sheet.eldritchInvocationSources ?? {}),
    mysticArcanumSpellIds:clone(sheet.mysticArcanumSpellIds ?? {}),
    mysticArcanumSources:clone(sheet.mysticArcanumSources ?? {}),
    pactTomeCantripIds:clone(sheet.pactTomeCantripIds ?? []),
    pactTomeRitualSpellIds:clone(sheet.pactTomeRitualSpellIds ?? []),
    pactTomeSpellSources:clone(sheet.pactTomeSpellSources ?? {}),
    pactMagicSlotLevel:sheet.pactMagicSlotLevel ?? 0,
    pactMagicSlotMaximum:sheet.pactMagicSlotMaximum ?? 0,
    spellSlotMaximums:clone(sheet.spellSlotMaximums ?? {}),
  };
}

export function applyProgressionCharacterState(
  sheet:CharacterSheet,
  next:ProgressionCharacterState,
  options:ProgressionApplicationOptions={},
) {
  const scope=options.scope ?? "full";
  sheet.progressionRevision=next.revision;

  if (scope==="wizard-long-rest") {
    sheet.preparedSpells=clone(next.preparedSpellIds ?? []);
    sheet.preparedSpellSources=clone(next.preparedSpellSources ?? {});
    sheet.spellMasterySpellIds=clone(next.spellMasterySpellIds ?? {});
    sheet.spellMasterySources=clone(next.spellMasterySources ?? {});
    return sheet;
  }

  if (scope==="pact-tome") {
    sheet.pactTomeCantripIds=clone(next.pactTomeCantripIds ?? []);
    sheet.pactTomeRitualSpellIds=clone(next.pactTomeRitualSpellIds ?? []);
    sheet.pactTomeSpellSources=clone(next.pactTomeSpellSources ?? {});
    return sheet;
  }

  sheet.level=next.totalLevel;
  sheet.hp=next.hpCurrent;
  sheet.maxHp=next.hpMaximum;
  sheet.proficiencyBonus=next.proficiencyBonus;
  sheet.abilities=clone(next.abilities);
  sheet.classLevels=clone(next.classTracks);
  sheet.hitDiceByDie=clone(next.hitDiceByDie);
  sheet.expertiseSkills=clone(next.expertiseSkills ?? []);
  sheet.expertiseSources=clone(next.expertiseSources ?? {});
  sheet.languages=clone(next.languages ?? []);
  sheet.languageSources=clone(next.languageSources ?? {});
  sheet.cantrips=clone(next.cantripIds ?? []);
  sheet.cantripSources=clone(next.cantripSources ?? {});
  sheet.preparedSpells=clone(next.preparedSpellIds ?? []);
  sheet.preparedSpellSources=clone(next.preparedSpellSources ?? {});
  sheet.spellbookSpells=clone(next.spellbookSpellIds ?? []);
  sheet.spellbookSpellSources=clone(next.spellbookSpellSources ?? {});
  sheet.spellMasterySpellIds=clone(next.spellMasterySpellIds ?? {});
  sheet.spellMasterySources=clone(next.spellMasterySources ?? {});
  sheet.signatureSpellIds=clone(next.signatureSpellIds ?? []);
  sheet.signatureSpellSources=clone(next.signatureSpellSources ?? {});
  sheet.metamagicIds=clone(next.metamagicIds ?? []);
  sheet.metamagicSources=clone(next.metamagicSources ?? {});
  sheet.eldritchInvocationIds=clone(next.eldritchInvocationIds ?? []);
  sheet.eldritchInvocationSources=clone(next.eldritchInvocationSources ?? {});
  sheet.mysticArcanumSpellIds=clone(next.mysticArcanumSpellIds ?? {});
  sheet.mysticArcanumSources=clone(next.mysticArcanumSources ?? {});
  sheet.pactTomeCantripIds=clone(next.pactTomeCantripIds ?? []);
  sheet.pactTomeRitualSpellIds=clone(next.pactTomeRitualSpellIds ?? []);
  sheet.pactTomeSpellSources=clone(next.pactTomeSpellSources ?? {});
  sheet.pactMagicSlotLevel=next.pactMagicSlotLevel ?? 0;
  sheet.pactMagicSlotMaximum=next.pactMagicSlotMaximum ?? 0;
  sheet.spellSlotMaximums=clone(next.spellSlotMaximums ?? {});
  sheet.features=next.features.map((feature)=>options.featureLabelById?.(feature) ?? feature);
  const primary=sheet.classLevels[0];
  if (primary?.subclassName) sheet.subclassName=primary.subclassName;
  return sheet;
}
