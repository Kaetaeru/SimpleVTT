import "../../src/app/characterCreationV09Adapter";
import { MockAdapter } from "../../src/app/mockAdapter";

export async function buildFighterCharacter() {
  const adapter = new MockAdapter();
  await adapter.createCharacterDraft("guided");
  await adapter.updateCharacterDraft({ type: "set-name", value: "Gate Fighter" });
  await adapter.updateCharacterDraft({ type: "set-species", value: "인간" });
  await adapter.updateCharacterDraft({ type: "set-background", value: "병사" });
  await adapter.updateCharacterDraft({ type: "set-class", value: "전사" });
  await adapter.updateCharacterDraft({ type: "toggle-skill", value: "운동" });
  await adapter.updateCharacterDraft({ type: "toggle-skill", value: "지각" });
  await adapter.updateCharacterDraft({ type: "toggle-class-choice", value: "choice.fighting-style.defense" });

  const beforeCommit = await adapter.getSnapshot();
  await adapter.finalizeCharacterDraft();
  const afterCommit = await adapter.getSnapshot();
  return { beforeCommit, afterCommit };
}

export async function switchFighterToWizard() {
  const adapter = new MockAdapter();
  await adapter.createCharacterDraft("guided");
  await adapter.updateCharacterDraft({ type: "set-name", value: "Gate Wizard" });
  await adapter.updateCharacterDraft({ type: "set-species", value: "엘프" });
  await adapter.updateCharacterDraft({ type: "set-background", value: "현자" });
  await adapter.updateCharacterDraft({ type: "set-class", value: "전사" });
  await adapter.updateCharacterDraft({ type: "toggle-skill", value: "운동" });
  await adapter.updateCharacterDraft({ type: "toggle-class-choice", value: "choice.fighting-style.defense" });
  await adapter.updateCharacterDraft({ type: "set-class", value: "마법사" });
  return adapter.getSnapshot();
}

export async function switchGuidedQuickWithoutLosingDraft() {
  const adapter = new MockAdapter();
  await adapter.createCharacterDraft("guided");
  await adapter.updateCharacterDraft({ type: "set-name", value: "Persistent Draft" });
  const guided = await adapter.getSnapshot();
  await adapter.updateCharacterDraft({ type: "set-mode", value: "quick" });
  const quick = await adapter.getSnapshot();
  await adapter.updateCharacterDraft({ type: "set-mode", value: "guided" });
  const guidedAgain = await adapter.getSnapshot();
  return { guided, quick, guidedAgain };
}
