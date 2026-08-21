import "./characterCreationV10Adapter";
import "./characterCreationAuthoringSource";
import type { AppSnapshot, CharacterCreateDraft, CharacterSheet, CharacterSummary, SceneVm } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import {
  applyCreationAuthoringSourceV1,
  projectExplicitCreationAuthoringSourceV1,
} from "./characterCreationAuthoringSource";
import { normalizeCreationV10 } from "./characterCreationV10Plan";

const cp = <T,>(value:T):T => structuredClone(value);
const LEGACY_RECONSTRUCTION_WARNING = "이 캐릭터는 명시적 생성 source가 없는 이전 기록입니다. materialized 값에서 복구한 입력을 검토한 뒤 저장하세요.";

type State = {
  activeCharacter:CharacterSheet;
  characters:CharacterSummary[];
  createDraft:CharacterCreateDraft|null;
  scene:SceneVm;
  getSnapshot():Promise<AppSnapshot>;
};

function stateOf(adapter:MockAdapter) {
  return adapter as unknown as State;
}

function preserveExistingRuntime(before:CharacterSheet,next:CharacterSheet) {
  next.hp = Math.min(before.hp,next.maxHp);
  next.tempHp = before.tempHp;
  next.durableLifeFlags = before.durableLifeFlags ? cp(before.durableLifeFlags) : undefined;
  next.goldGp = before.goldGp;
  next.runtimeRevision = before.runtimeRevision;
  next.sourceRevision = before.sourceRevision;
  next.rulesProfileVersion = before.rulesProfileVersion;

  const resources = new Map(before.resources.map((resource) => [resource.id,resource]));
  next.resources = next.resources.map((resource) => {
    const previous = resources.get(resource.id);
    if (!previous) return resource;
    return { ...resource,current:Math.min(previous.current,resource.max) };
  });

  const items = new Map(before.items.map((item) => [item.id,item]));
  next.items = next.items.map((item) => {
    const previous = items.get(item.id);
    if (!previous) return item;
    const preserved = {
      ...item,
      quantity:previous.quantity,
      equipped:previous.equipped,
      wielded:previous.wielded,
      wieldSlot:previous.wieldSlot,
      attuned:previous.attuned,
    };
    if (item.charges) {
      preserved.charges = {
        ...item.charges,
        current:Math.min(previous.charges?.current ?? item.charges.current,item.charges.max),
      };
    }
    return preserved;
  });
}

function replaceActiveSummary(state:State) {
  state.characters = state.characters.map((character) =>
    character.id === state.activeCharacter.id ? { ...character,...cp(state.activeCharacter) } : character,
  );
}

function projectActiveToScene(state:State) {
  const entity = state.scene.entities.find((entry) => entry.id === state.activeCharacter.id);
  if (!entity) return;
  entity.hp = state.activeCharacter.hp;
  entity.maxHp = state.activeCharacter.maxHp;
  entity.tempHp = state.activeCharacter.tempHp;
  entity.ac = state.activeCharacter.ac;
}

const oldGetSnapshot = MockAdapter.prototype.getSnapshot;
MockAdapter.prototype.getSnapshot = async function getSnapshotWithSourceEditStatus() {
  const snapshot = await oldGetSnapshot.call(this);
  if (snapshot.createDraft?.authoringSourceCompleteness !== "legacy-reconstructed") return snapshot;
  const warning = { severity:"warning" as const,message:LEGACY_RECONSTRUCTION_WARNING };
  if (!snapshot.createDraft.validation.some((entry) => entry.message === warning.message)) {
    snapshot.createDraft.validation = [...snapshot.createDraft.validation,warning];
  }
  if (snapshot.creationPlan && !snapshot.creationPlan.validation.some((entry) => entry.message === warning.message)) {
    snapshot.creationPlan.validation = [...snapshot.creationPlan.validation,warning];
    snapshot.creationPlan.summary.warningCount += 1;
    const review = snapshot.creationPlan.sections.find((section) => section.id === "review");
    if (review && !review.validation.some((entry) => entry.message === warning.message)) {
      review.validation = [...review.validation,warning];
    }
  }
  return snapshot;
};

const oldEditCharacterDraft = MockAdapter.prototype.editCharacterDraft;
MockAdapter.prototype.editCharacterDraft = async function editCharacterDraftFromSource(characterId:string) {
  const state = stateOf(this);
  const authoringSource = characterId === state.activeCharacter.id
    ? cp(state.activeCharacter.creationAuthoringSource)
    : undefined;

  await oldEditCharacterDraft.call(this,characterId);
  const draft = state.createDraft;
  if (!draft || draft.editingCharacterId !== characterId) return state.getSnapshot();

  if (authoringSource?.completeness === "explicit") {
    applyCreationAuthoringSourceV1(draft,authoringSource);
  } else {
    draft.authoringSourceCompleteness = "legacy-reconstructed";
  }
  normalizeCreationV10(draft);
  return state.getSnapshot();
};

const oldFinalizeCharacterDraft = MockAdapter.prototype.finalizeCharacterDraft;
MockAdapter.prototype.finalizeCharacterDraft = async function finalizeCharacterDraftWithSource() {
  const state = stateOf(this);
  const draft = state.createDraft ? cp(state.createDraft) : null;
  const before = cp(state.activeCharacter);
  const result = await oldFinalizeCharacterDraft.call(this);

  if (!draft || state.createDraft) return result;
  const next = state.activeCharacter;
  next.creationAuthoringSource = projectExplicitCreationAuthoringSourceV1(draft);
  next.notes = draft.notes;
  next.rulesProfileId = draft.rulesProfileId;
  if (draft.editingCharacterId === before.id && next.id === before.id) preserveExistingRuntime(before,next);
  replaceActiveSummary(state);
  projectActiveToScene(state);
  return state.getSnapshot();
};
