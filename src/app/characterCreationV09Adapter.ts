import type { AppSnapshot, CharacterCreateDraft, CharacterSheet, CharacterSummary, ItemInstanceVm } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { FIGHTER, META, buildPlan, classId, meta, normalize, recommended } from "./characterCreationV09Plan";
import { equipmentForPreset, itemMechanic, itemName } from "./srdCatalogBridge";

type State = { createDraft: CharacterCreateDraft | null; activeCharacter: CharacterSheet; characters: CharacterSummary[]; edgeState: AppSnapshot["edgeState"]; getSnapshot(): Promise<AppSnapshot> };
const cp = <T,>(value: T): T => structuredClone(value);
const mod = (score: number) => Math.floor((score - 10) / 2);
const FIGHTER_ID = "dnd.srd521.class.fighter";

function items(draft: CharacterCreateDraft): ItemInstanceVm[] {
  const source = `${draft.className} 시작 장비 · SRD catalog`;
  return equipmentForPreset(draft.equipmentPreset).map((item, index) => {
    const armor = itemMechanic(item.entry, "armor-definition") as { ac?: { base?: number } } | undefined;
    const shield = itemMechanic(item.entry, "shield-definition") as { acBonus?: number } | undefined;
    const weapon = itemMechanic(item.entry, "weapon-definition") as { damage?: string; damageType?: string } | undefined;
    const effects = [armor?.ac?.base !== undefined ? `기본 AC ${armor.ac.base}` : "", shield?.acBonus !== undefined ? `AC +${shield.acBonus}` : "", weapon?.damage ? `${weapon.damage} ${weapon.damageType ?? ""}`.trim() : ""].filter(Boolean);
    const equipmentCategory = ["armor", "shield", "weapon", "focus"].includes(item.entry.category);
    return { id: `item.created.${index}.${item.id}`, definitionId: item.id, name: itemName(item.entry), nameEn: item.entry.presentation.originalName, kind: "equipment", quantity: item.quantity, equipped: equipmentCategory, passiveEffects: effects, grantedActionIds: [], provenance: [source, item.id] };
  });
}

function sheet(draft: CharacterCreateDraft): CharacterSheet {
  const m = meta(draft);
  const resolved = equipmentForPreset(draft.equipmentPreset);
  const its = items(draft);
  const style = FIGHTER.find((item) => item.id === draft.selectedClassChoices?.[0])?.name;
  const weapon = resolved.find((item) => item.entry.category === "weapon");
  const weaponDef = weapon ? itemMechanic(weapon.entry, "weapon-definition") as { damage?: string; damageType?: string } | undefined : undefined;
  const attacks = weapon ? [{ id: "action.starter", name: itemName(weapon.entry), bonus: draft.derived.proficiencyBonus + mod(draft.abilities[m.rec[0]]), damage: weaponDef?.damage ? `${weaponDef.damage} ${weaponDef.damageType ?? ""}`.trim() : "시작 무기 피해" }] : [];
  return {
    id: `char.${draft.name.trim().toLowerCase().replace(/\s+/g, "-") || "new"}`,
    name: draft.name.trim() || "이름 없음",
    className: draft.className,
    level: draft.level,
    species: draft.species,
    background: draft.background,
    hp: draft.derived.hp,
    maxHp: draft.derived.hp,
    tempHp: 0,
    ac: draft.derived.ac,
    speed: draft.derived.speed,
    proficiencyBonus: draft.derived.proficiencyBonus,
    saveState: "saved",
    abilities: cp(draft.abilities),
    saves: m.saves.map((value) => `${value} +${draft.derived.proficiencyBonus}`),
    skills: cp(draft.selectedSkills),
    features: [...m.features, ...(style ? [style] : [])],
    equipment: its.map((item) => item.quantity > 1 ? `${item.name} ×${item.quantity}` : item.name),
    items: its,
    resources: classId(draft) === FIGHTER_ID ? [{ id: "resource.second-wind", label: "세컨드 윈드", current: 1, max: 1, source: "SRD Fighter level 1 catalog slice" }] : [],
    attacks,
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
    const draft = normalize(snapshot.createDraft);
    snapshot.createDraft = cp(draft);
    snapshot.creationPlan = buildPlan(draft);
  } else snapshot.creationPlan = null;
  return snapshot;
};

MockAdapter.prototype.createCharacterDraft = async function (mode = "guided") {
  await oldCreate.call(this, mode);
  const state = this as unknown as State;
  const draft = state.createDraft;
  if (!draft) return state.getSnapshot();
  draft.activeSectionId = "identity";
  draft.selectedClassChoices = [];
  if (mode !== "duplicate") {
    draft.className = "";
    draft.subclassName = "";
    draft.species = "";
    draft.background = "";
    draft.selectedSkills = [];
    draft.selectedSpells = [];
    draft.equipmentPreset = "";
    draft.level = 1;
  }
  normalize(draft);
  return state.getSnapshot();
};

MockAdapter.prototype.editCharacterDraft = async function (id: string) {
  await oldEdit.call(this, id);
  const state = this as unknown as State;
  if (state.createDraft) {
    state.createDraft.activeSectionId = "identity";
    state.createDraft.selectedClassChoices = [];
    normalize(state.createDraft);
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
  if (command.type === "toggle-class-choice") {
    const value = String(command.value ?? "");
    draft.selectedClassChoices = (draft.selectedClassChoices ?? []).includes(value) ? [] : [value];
    normalize(draft);
    return state.getSnapshot();
  }
  const previousClass = draft.className;
  await oldUpdate.call(this, command);
  draft = state.createDraft;
  if (!draft) return state.getSnapshot();
  if (command.type === "set-class" && draft.className !== previousClass) {
    draft.subclassName = "";
    draft.selectedClassChoices = [];
    draft.selectedSpells = [];
    const m = META[classId(draft)] ?? META[FIGHTER_ID];
    draft.selectedSkills = m.skillsMapped ? draft.selectedSkills.filter((value) => m.skills.includes(value)) : [];
    draft.equipmentPreset = m.gear[0]?.id ?? "";
  }
  if (command.type === "apply-recommended-array") draft.abilities = recommended(draft);
  if (command.type === "import-json" && draft.importStatus === "valid") {
    if (draft.level <= 1) draft.subclassName = "";
    draft.activeSectionId = "review";
  }
  normalize(draft);
  return state.getSnapshot();
};

MockAdapter.prototype.finalizeCharacterDraft = async function () {
  const state = this as unknown as State;
  const draft = state.createDraft;
  if (!draft) return oldFinalize.call(this);
  normalize(draft);
  if (state.edgeState === "save-error" || buildPlan(draft).validation.some((item) => item.severity === "blocking")) return state.getSnapshot();
  if (draft.editingCharacterId) return oldFinalize.call(this);
  const next = sheet(draft);
  state.activeCharacter = cp(next);
  state.characters = [...state.characters.filter((item) => item.id !== next.id), cp(next)];
  state.createDraft = null;
  return state.getSnapshot();
};
