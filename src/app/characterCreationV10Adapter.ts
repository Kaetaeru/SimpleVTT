import "./creationContracts";
import type { AbilityKey, AppSnapshot, CharacterCreateDraft, CharacterSheet, CharacterSummary, ItemInstanceVm } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { SKILL_LABELS, backgroundSkills, classIdFromName, classLoadoutOptions, classMeta, classSkillOptions, entryName, featEntry, itemDisplayName, itemMechanic, speciesDefinition, type ResolvedItem } from "./characterCreationV10Data";
import {
  activeOriginFeats,
  classAndBackgroundLoadout,
  finalAbilities,
  finalCantrips,
  finalLanguageNames,
  finalMasteryWeapons,
  finalPreparedSpells,
  nonClassSkillNames,
  finalSkillNames,
  finalSpellbook,
  finalToolProficiencies,
  selectedChoiceLabels,
  speciesAutomaticEffects,
} from "./characterCreationV10Choices";
import {
  normalizeCreationChoiceSelections,
  toggleCreationChoiceSelection,
} from "./characterCreationChoiceDefinition";
import { buildCreationPlanV10, normalizeCreationV10, recommendedAbilitiesV10 } from "./characterCreationV10Plan";

type State = {
  createDraft: CharacterCreateDraft | null;
  activeCharacter: CharacterSheet;
  characters: CharacterSummary[];
  edgeState: AppSnapshot["edgeState"];
  getSnapshot(): Promise<AppSnapshot>;
};
const cp = <T,>(value: T): T => structuredClone(value);
const abilityMod = (score: number) => Math.floor((score - 10) / 2);
const LEGACY_CLASS: Record<string,string> = { "전사":"파이터", "음유시인":"바드", "마법사":"위저드", "성직자":"클레릭" };
const LEGACY_BACKGROUND: Record<string,string> = { "병사":"군인" };

function normalizeClassSkills(draft: CharacterCreateDraft) {
  if (!draft.className) { draft.selectedSkills = []; return; }
  const outside = new Set(nonClassSkillNames(draft));
  const allowed = new Set(classSkillOptions(classIdFromName(draft.className)).filter((item) => !outside.has(item.name)).map((item) => item.name));
  draft.selectedSkills = draft.selectedSkills.filter((name) => allowed.has(name));
}

const clearChoicePrefix = (draft: CharacterCreateDraft, prefix: string) => {
  draft.choiceSelections ??= {};
  for (const key of Object.keys(draft.choiceSelections)) if (key.startsWith(prefix)) delete draft.choiceSelections[key];
};

function itemInstances(draft: CharacterCreateDraft): ItemInstanceVm[] {
  const loadout = classAndBackgroundLoadout(draft);
  let mainHandAssigned=false;
  return loadout.items.map((item, index) => {
    const armor = itemMechanic(item.entry, "armor-definition") as { ac?: { base?: number } } | undefined;
    const shield = itemMechanic(item.entry, "shield-definition") as { acBonus?: number } | undefined;
    const weapon = itemMechanic(item.entry, "weapon-definition") as { damage?: string; damageType?: string } | undefined;
    const effects = [
      armor?.ac?.base !== undefined ? `기본 AC ${armor.ac.base}` : "",
      shield?.acBonus !== undefined ? `AC +${shield.acBonus}` : "",
      weapon?.damage ? `${weapon.damage} ${weapon.damageType ?? ""}`.trim() : "",
    ].filter(Boolean);
    const equipped = ["armor", "shield", "weapon", "focus"].includes(item.entry.category);
    const wieldSlot=item.entry.category === "weapon"&&!mainHandAssigned?"main-hand":item.entry.category === "shield"?"off-hand":undefined;
    if (wieldSlot==="main-hand") mainHandAssigned=true;
    return {
      id:`item.created.${index}.${item.id}${item.variant ? `.${item.variant}` : ""}`,
      definitionId:item.id,
      name:itemDisplayName(item),
      nameEn:item.entry.presentation.originalName,
      kind:"equipment",
      quantity:item.quantity,
      equipped,
      wielded:item.entry.category === "weapon" || item.entry.category === "shield",
      wieldSlot,
      passiveEffects:effects,
      grantedActionIds:[],
      provenance:["SRD 5.2.1 · Character Creation", item.id, ...(item.variant ? [`variant:${item.variant}`] : [])],
    };
  });
}

function firstWeapon(items: ResolvedItem[]) {
  return items.find((item) => item.entry.category === "weapon");
}
function weaponAttackBonus(item: ResolvedItem, draft: CharacterCreateDraft) {
  const def = itemMechanic(item.entry, "weapon-definition") as { mode?: string; properties?: string[] } | undefined;
  const a = draft.finalAbilities ?? finalAbilities(draft);
  const modifier = def?.mode === "ranged" ? abilityMod(a.dex) : def?.properties?.includes("finesse") ? Math.max(abilityMod(a.str), abilityMod(a.dex)) : abilityMod(a.str);
  return draft.derived.proficiencyBonus + modifier;
}

function originFeatName(id: string) {
  if (id === "dnd.srd521.feat.magic-initiate-cleric") return "마법 입문자 · 클레릭";
  if (id === "dnd.srd521.feat.magic-initiate-wizard") return "마법 입문자 · 위저드";
  const entry = featEntry(id);
  return entry ? entryName(entry) : id;
}

function sheet(draft: CharacterCreateDraft): CharacterSheet {
  const classId = classIdFromName(draft.className);
  const meta = classMeta(classId);
  const abilities = draft.finalAbilities ?? finalAbilities(draft);
  const loadout = classAndBackgroundLoadout(draft);
  const instances = itemInstances(draft);
  const labels = selectedChoiceLabels(draft);
  const selectedFeatures = Object.entries(labels)
    .filter(([id, values]) => values.length && !id.includes("spells") && !id.includes("loadout") && !id.includes("equipment") && !id.includes("ability") && id !== "identity.languages")
    .flatMap(([id, values]) => values.map((value) => `${id.replace(/^class\.|^species\.|^background\./, "")} · ${value}`));
  const originFeats = activeOriginFeats(draft).map(originFeatName);
  const speciesAutomatic = speciesAutomaticEffects(draft);
  const weapon = firstWeapon(loadout.items);
  const weaponDef = weapon ? itemMechanic(weapon.entry, "weapon-definition") as { damage?: string; damageType?: string } | undefined : undefined;
  const attacks = weapon ? [{ id:"action.starter", name:itemDisplayName(weapon), bonus:weaponAttackBonus(weapon, draft), damage:weaponDef?.damage ? `${weaponDef.damage} ${weaponDef.damageType ?? ""}`.trim() : "시작 무기 피해" }] : [];
  const resources = classId === "dnd.srd521.class.fighter" ? [{ id:"resource.second-wind", label:"재기의 바람", current:2, max:2, source:"SRD Fighter level 1" }] : [];
  return {
    id:`char.${draft.name.trim().toLowerCase().replace(/\s+/g, "-") || "new"}`,
    name:draft.name.trim() || "이름 없음",
    className:draft.className,
    level:draft.level,
    species:draft.species,
    background:draft.background,
    hp:draft.derived.hp,
    maxHp:draft.derived.hp,
    tempHp:0,
    ac:draft.derived.ac,
    speed:draft.derived.speed,
    proficiencyBonus:draft.derived.proficiencyBonus,
    saveState:"saved",
    abilities:cp(abilities),
    saves:meta.saves.map((key) => `${key.toUpperCase()} +${draft.derived.proficiencyBonus + abilityMod(abilities[key])}`),
    skills:finalSkillNames(draft),
    features:[...meta.features, ...originFeats, ...speciesAutomatic.features, ...selectedFeatures],
    equipment:instances.map((item) => item.quantity > 1 ? `${item.name} ×${item.quantity}` : item.name),
    items:instances,
    resources,
    attacks,
    size:draft.choiceSelections?.["species.size"]?.[0] ?? speciesDefinition(draft.species).size?.[0],
    languages:finalLanguageNames(draft),
    toolProficiencies:finalToolProficiencies(draft),
    cantrips:finalCantrips(draft),
    preparedSpells:finalPreparedSpells(draft),
    spellbookSpells:finalSpellbook(draft),
    masteryWeapons:finalMasteryWeapons(draft),
    goldGp:loadout.gp,
    creationSelections:cp(draft.choiceSelections ?? {}),
  };
}

const oldGet = MockAdapter.prototype.getSnapshot;
const oldCreate = MockAdapter.prototype.createCharacterDraft;
const oldEdit = MockAdapter.prototype.editCharacterDraft;
const oldUpdate = MockAdapter.prototype.updateCharacterDraft;
const oldFinalize = MockAdapter.prototype.finalizeCharacterDraft;

MockAdapter.prototype.getSnapshot = async function () {
  const snapshot = await oldGet.call(this);
  if (snapshot.createDraft) {
    const draft = normalizeCreationV10(snapshot.createDraft);
    snapshot.createDraft = cp(draft);
    snapshot.creationPlan = buildCreationPlanV10(draft);
  } else snapshot.creationPlan = null;
  return snapshot;
};

MockAdapter.prototype.createCharacterDraft = async function (mode = "guided") {
  await oldCreate.call(this, mode);
  const state = this as unknown as State;
  const draft = state.createDraft;
  if (!draft) return state.getSnapshot();
  draft.activeSectionId = "identity";
  draft.choiceSelections = {};
  draft.selectedClassChoices = [];
  draft.selectedSpells = [];
  draft.backgroundEquipmentPreset = "";
  if (mode === "duplicate") {
    draft.className = LEGACY_CLASS[draft.className] ?? draft.className;
    draft.background = LEGACY_BACKGROUND[draft.background] ?? draft.background;
    draft.selectedSkills = [];
    draft.equipmentPreset = classLoadoutOptions(classIdFromName(draft.className))[0]?.id ?? "";
  } else {
    draft.className = "";
    draft.subclassName = "";
    draft.species = "";
    draft.background = "";
    draft.selectedSkills = [];
    draft.equipmentPreset = "";
    draft.level = 1;
  }
  normalizeClassSkills(draft);
  normalizeCreationV10(draft);
  return state.getSnapshot();
};

MockAdapter.prototype.editCharacterDraft = async function (id: string) {
  await oldEdit.call(this, id);
  const state = this as unknown as State;
  if (state.createDraft) {
    state.createDraft.className = LEGACY_CLASS[state.createDraft.className] ?? state.createDraft.className;
    state.createDraft.background = LEGACY_BACKGROUND[state.createDraft.background] ?? state.createDraft.background;
    state.createDraft.activeSectionId = "identity";
    state.createDraft.choiceSelections = cp(state.activeCharacter.creationSelections ?? {});
    state.createDraft.selectedClassChoices = [];
    state.createDraft.equipmentPreset = classLoadoutOptions(classIdFromName(state.createDraft.className))[0]?.id ?? state.createDraft.equipmentPreset;
    normalizeClassSkills(state.createDraft);
    normalizeCreationV10(state.createDraft);
  }
  return state.getSnapshot();
};

MockAdapter.prototype.updateCharacterDraft = async function (command) {
  const state = this as unknown as State;
  if (!state.createDraft) await oldCreate.call(this, "guided");
  let draft = state.createDraft;
  if (!draft) return state.getSnapshot();

  if (command.type === "set-section") {
    draft.activeSectionId = String(command.value ?? "identity");
    return state.getSnapshot();
  }
  if (command.type === "toggle-class-choice" && command.choiceId) {
    toggleCreationChoiceSelection(draft, command.choiceId, String(command.value ?? ""));
    normalizeCreationV10(draft);
    return state.getSnapshot();
  }

  const previousClass = draft.className;
  const previousSpecies = draft.species;
  const previousBackground = draft.background;
  const previousEquipment = draft.equipmentPreset;
  await oldUpdate.call(this, command);
  draft = state.createDraft;
  if (!draft) return state.getSnapshot();

  if (command.type === "set-class" && draft.className !== previousClass) {
    clearChoicePrefix(draft, "class.");
    draft.subclassName = "";
    draft.selectedClassChoices = [];
    draft.selectedSpells = [];
    draft.selectedSkills = [];
    draft.equipmentPreset = classLoadoutOptions(classIdFromName(draft.className))[0]?.id ?? "";
  }
  if (command.type === "set-species" && draft.species !== previousSpecies) clearChoicePrefix(draft, "species.");
  if (command.type === "set-background" && draft.background !== previousBackground) clearChoicePrefix(draft, "background.");
  if (command.type === "set-equipment" && draft.equipmentPreset !== previousEquipment) clearChoicePrefix(draft, "class.loadout.");
  if (command.type === "apply-recommended-array") draft.abilities = recommendedAbilitiesV10(draft);
  if (command.type === "import-json" && draft.importStatus === "valid") {
    draft.choiceSelections = {};
    draft.selectedSkills = [];
    draft.equipmentPreset = classLoadoutOptions(classIdFromName(draft.className))[0]?.id ?? "";
    draft.activeSectionId = "review";
  }
  normalizeCreationChoiceSelections(draft);
  normalizeClassSkills(draft);
  normalizeCreationChoiceSelections(draft);
  normalizeCreationV10(draft);
  return state.getSnapshot();
};

MockAdapter.prototype.finalizeCharacterDraft = async function () {
  const state = this as unknown as State;
  const draft = state.createDraft;
  if (!draft) return oldFinalize.call(this);
  normalizeCreationV10(draft);
  if (state.edgeState === "save-error" || buildCreationPlanV10(draft).validation.some((item) => item.severity === "blocking")) return state.getSnapshot();
  const existing = draft.editingCharacterId === state.activeCharacter.id;
  const next = sheet(draft);
  if (existing) { next.id = state.activeCharacter.id; next.tempHp = state.activeCharacter.tempHp; }
  state.activeCharacter = cp(next);
  state.characters = existing ? state.characters.map((item) => item.id === next.id ? cp(next) : item) : [...state.characters.filter((item) => item.id !== next.id), cp(next)];
  state.createDraft = null;
  return state.getSnapshot();
};
