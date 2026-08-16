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
    draft.choiceSelections = cp(state.activeCharacter.creationSelections ?? {});
    draft.notes = state.activeCharacter.notes ?? "";
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
