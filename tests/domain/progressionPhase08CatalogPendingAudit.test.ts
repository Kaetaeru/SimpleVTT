import assert from "node:assert/strict";
import test from "node:test";
import { SPELL_PRESENTATIONS } from "../../src/app/spellPresentation";
import { FEAT_RULE_CATALOG } from "../../src/domain/featRuleCatalog";
import type { ChoiceSelectionMap } from "../../src/domain/choiceDefinition";
import type { ProgressionCharacterState, ProgressionRequest } from "../../src/domain/progression";
import { PROGRESSION_CATALOG, proficiencyBonusForTotalLevel } from "../../src/domain/progressionCatalog";
import { buildProgressionPlanPhase08WizardEvocation } from "../../src/domain/progressionPhase08WizardEvocation";
import { classCantripListEntries } from "../../src/domain/spellListCatalog";
import { srdSubclassIdForClass } from "../../src/domain/srdSubclassCatalog";

type AuditState = ProgressionCharacterState & {
  subclassIds?:Record<string,string>;
  subclassFeatureIds?:string[];
  subclassFeatureSources?:Record<string,string>;
  epicBoonFeatIds?:string[];
  epicBoonFeatSources?:Record<string,string>;
  bardMagicalDiscoverySpellIds?:string[];
  bardMagicalDiscoverySpellSources?:Record<string,string>;
};

const spellOptions = SPELL_PRESENTATIONS.map((spell) => ({
  id:spell.id,
  label:spell.name,
  description:spell.summary,
  level:spell.level,
  castingTime:spell.castingTime,
  school:spell.school,
}));
const featOptions = FEAT_RULE_CATALOG.feats.map((feat) => ({ id:feat.id, label:feat.name, description:feat.originalName }));
const originFeatOptions = FEAT_RULE_CATALOG.feats
  .filter((feat) => feat.tags.includes("origin"))
  .map((feat) => ({ id:feat.id, label:feat.name, description:feat.originalName }));
const fightingStyleOptions = FEAT_RULE_CATALOG.feats
  .filter((feat) => feat.tags.includes("fighting-style"))
  .map((feat) => ({ id:feat.id, label:feat.name, description:feat.originalName }));
const languageOptions = ["공용어","드워프어","엘프어","거인어","노움어","고블린어","하플링어","오크어"]
  .map((label,index) => ({ id:`language:audit-${index}`, label, description:"Phase 08 catalog-pending audit option" }));

function classCantripOptions(classId:string) {
  const presentation = new Map(SPELL_PRESENTATIONS.map((spell) => [spell.id,spell]));
  return classCantripListEntries(classId).map((spell) => ({
    id:spell.id,
    label:presentation.get(spell.id)?.name ?? spell.nameEn,
    description:presentation.get(spell.id)?.summary ?? spell.nameEn,
  }));
}

function stateFor(classId:string,targetLevel:number):AuditState {
  const definition = PROGRESSION_CATALOG.classes.find((entry) => entry.id === classId)!;
  const currentLevel = targetLevel - 1;
  const subclassId = currentLevel >= 3 ? srdSubclassIdForClass(classId) : undefined;
  return {
    revision:1000 + targetLevel,
    id:`audit:${definition.slug}:${currentLevel}`,
    name:`Audit ${definition.nameEn}`,
    totalLevel:currentLevel,
    abilities:{ str:18,dex:18,con:18,int:18,wis:18,cha:18 },
    hpCurrent:20 + currentLevel * 6,
    hpMaximum:20 + currentLevel * 6,
    proficiencyBonus:proficiencyBonusForTotalLevel(currentLevel),
    classTracks:[{
      classId,
      className:definition.nameKo,
      level:currentLevel,
      ...(currentLevel >= 3 ? { subclassName:definition.srdSubclassName } : {}),
    }],
    hitDiceByDie:{ [`d${definition.hitDie}`]:currentLevel },
    features:["주문 시전",...(currentLevel >= 3 ? [definition.srdSubclassName] : [])],
    proficientSkills:["운동","곡예","비전","역사","통찰","지각","은신","설득"],
    expertiseSkills:[],
    expertiseSources:{},
    languages:["공용어"],
    languageSources:{},
    cantripIds:[],
    cantripSources:{},
    preparedSpellIds:[],
    preparedSpellSources:{},
    spellbookSpellIds:[],
    spellbookSpellSources:{},
    spellMasterySpellIds:{},
    spellMasterySources:{},
    signatureSpellIds:[],
    signatureSpellSources:{},
    metamagicIds:[],
    metamagicSources:{},
    eldritchInvocationIds:[],
    eldritchInvocationSources:{},
    mysticArcanumSpellIds:{},
    mysticArcanumSources:{},
    pactMagicSlotLevel:0,
    pactMagicSlotMaximum:0,
    spellSlotMaximums:{},
    weaponMasteryIds:[],
    weaponMasterySources:{},
    fightingStyleFeatIds:[],
    fightingStyleFeatSources:{},
    subclassIds:subclassId ? { [classId]:subclassId } : {},
    subclassFeatureIds:[],
    subclassFeatureSources:{},
    epicBoonFeatIds:[],
    epicBoonFeatSources:{},
    bardMagicalDiscoverySpellIds:[],
    bardMagicalDiscoverySpellSources:{},
  };
}

function requestFor(state:AuditState,classId:string,targetLevel:number):ProgressionRequest {
  const definition = PROGRESSION_CATALOG.classes.find((entry) => entry.id === classId)!;
  const selections:ChoiceSelectionMap = targetLevel === 3
    ? { [`progression.${classId}.3.subclass`]:{ kind:"options", optionIds:[`subclass:${definition.srdSubclassName}`] } }
    : {};
  return {
    expectedRevision:state.revision,
    targetClassId:classId,
    hpMethod:"fixed",
    selections,
    featOptions,
    originFeatOptions,
    fightingStyleOptions,
    druidCantripOptions:classCantripOptions("dnd.srd521.class.druid"),
    clericCantripOptions:classCantripOptions("dnd.srd521.class.cleric"),
    languageOptions,
    spellOptions,
  };
}

const KNOWN_BLOCKERS = [
  "dnd.srd521.class.monk:6",
  "dnd.srd521.class.monk:11",
  "dnd.srd521.class.monk:17",
  "dnd.srd521.class.rogue:9",
  "dnd.srd521.class.rogue:13",
  "dnd.srd521.class.rogue:17",
] as const;

test("outermost Phase 08 progression plans match the explicit known catalog-pending blocker allowlist", () => {
  const pending:Array<{ classId:string; className:string; level:number; choiceId:string; label:string; reason:string }> = [];
  for (const definition of PROGRESSION_CATALOG.classes) {
    for (let targetLevel = 2; targetLevel <= 20; targetLevel += 1) {
      const state = stateFor(definition.id,targetLevel);
      const plan = buildProgressionPlanPhase08WizardEvocation(state,requestFor(state,definition.id,targetLevel));
      for (const choice of plan.choices.filter((entry) => entry.status === "catalog-pending")) {
        pending.push({
          classId:definition.id,
          className:definition.nameKo,
          level:targetLevel,
          choiceId:choice.id,
          label:choice.label,
          reason:choice.pendingReason ?? "missing pending reason",
        });
      }
    }
  }
  assert.deepEqual(
    pending.map((entry) => `${entry.classId}:${entry.level}`),
    [...KNOWN_BLOCKERS],
    `unexpected Phase 08 catalog-pending choices:\n${JSON.stringify(pending,null,2)}`,
  );
  assert.ok(pending.every((entry) => entry.choiceId.endsWith(".subclass-feature")));
});
