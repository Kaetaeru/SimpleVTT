import "./characterCreationV10Adapter";
import type { AppSnapshot, CharacterCreateDraft, CharacterSheet, CharacterSummary } from "./contracts";
import { MockAdapter } from "./mockAdapter";

type State = {
  createDraft: CharacterCreateDraft | null;
  activeCharacter: CharacterSheet;
  characters: CharacterSummary[];
  getSnapshot(): Promise<AppSnapshot>;
};

const oldFinalize = MockAdapter.prototype.finalizeCharacterDraft;
const oldEdit = MockAdapter.prototype.editCharacterDraft;

MockAdapter.prototype.finalizeCharacterDraft = async function () {
  const state = this as unknown as State;
  const notes = state.createDraft?.notes;
  const result = await oldFinalize.call(this);
  if (!state.createDraft && notes !== undefined) {
    state.activeCharacter.notes = notes;
    return state.getSnapshot();
  }
  return result;
};

MockAdapter.prototype.editCharacterDraft = async function (id: string) {
  const state = this as unknown as State;
  const notes = id === state.activeCharacter.id ? state.activeCharacter.notes : undefined;
  const result = await oldEdit.call(this, id);
  if (state.createDraft && notes !== undefined) {
    state.createDraft.notes = notes;
    return state.getSnapshot();
  }
  return result;
};
