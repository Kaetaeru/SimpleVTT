import test from "node:test";
import assert from "node:assert/strict";
import "../../src/app/characterCreationV09Adapter";
import { MockAdapter } from "../../src/app/mockAdapter";

async function snapshotFor(adapter: MockAdapter) {
  return adapter.getSnapshot();
}

function section(snapshot: Awaited<ReturnType<MockAdapter["getSnapshot"]>>, id: string) {
  const value = snapshot.creationPlan?.sections.find((item) => item.id === id);
  assert.ok(value, `missing CharacterCreationPlan section: ${id}`);
  return value;
}

async function start(adapter: MockAdapter, name: string, species: string, background: string, className: string) {
  await adapter.createCharacterDraft("guided");
  await adapter.updateCharacterDraft({ type: "set-name", value: name });
  await adapter.updateCharacterDraft({ type: "set-species", value: species });
  await adapter.updateCharacterDraft({ type: "set-background", value: background });
  await adapter.updateCharacterDraft({ type: "set-class", value: className });
}

test("Gate 04.5 catalog breadth exposes the SRD creation sources", async () => {
  const adapter = new MockAdapter();
  await adapter.createCharacterDraft("guided");
  const snapshot = await snapshotFor(adapter);

  assert.equal(section(snapshot, "class").options.length, 12);
  assert.equal(section(snapshot, "species").options.length, 9);
  assert.equal(section(snapshot, "background").options.length, 4);
  assert.ok(section(snapshot, "class").options.some((option) => option.name === "파이터" && option.nameEn === "Fighter"));
  assert.ok(section(snapshot, "class").options.some((option) => option.name === "바드" && option.nameEn === "Bard"));
  assert.ok(section(snapshot, "class").options.some((option) => option.name === "팔라딘" && option.nameEn === "Paladin"));
});

test("catalog Fighter is commit-ready while unresolved SRD source choices remain explicit warnings", async () => {
  const adapter = new MockAdapter();
  await start(adapter, "Gate Fighter", "인간", "군인", "파이터");

  let snapshot = await snapshotFor(adapter);
  const skillOptions = section(snapshot, "proficiencies").options.slice(0, 2);
  assert.equal(skillOptions.length, 2);
  for (const option of skillOptions) await adapter.updateCharacterDraft({ type: "toggle-skill", value: option.name });

  snapshot = await snapshotFor(adapter);
  const style = section(snapshot, "class-choices").options[0];
  assert.ok(style, "Fighter must expose a catalog-backed Fighting Style option");
  await adapter.updateCharacterDraft({ type: "toggle-class-choice", value: style.id });

  const beforeCommit = await snapshotFor(adapter);
  assert.equal(beforeCommit.creationPlan?.summary.blockingCount, 0);
  assert.equal(beforeCommit.createDraft?.className, "파이터");
  assert.equal(section(beforeCommit, "species").status, "warning", "Human follow-up choices must not be silently treated as complete");
  assert.equal(section(beforeCommit, "background").status, "warning", "Background ability/equipment choices must remain explicit");
  assert.equal(section(beforeCommit, "class-choices").status, "warning", "Fighter Weapon Mastery remains an explicit pending ChoiceDefinition");
  assert.ok(beforeCommit.createDraft?.equipmentPreset.startsWith("dnd.srd521."));
  assert.ok(beforeCommit.creationPlan?.validation.some((message) => message.message.includes("종족 세부 선택")));
  assert.ok(beforeCommit.creationPlan?.validation.some((message) => message.message.includes("카탈로그 ChoiceDefinition UI 미연결")));

  await adapter.finalizeCharacterDraft();
  const afterCommit = await snapshotFor(adapter);
  assert.equal(afterCommit.createDraft, null);
  assert.equal(afterCommit.activeCharacter.name, "Gate Fighter");
  assert.equal(afterCommit.activeCharacter.className, "파이터");
  assert.ok(afterCommit.activeCharacter.items.length > 0);
  assert.ok(afterCommit.activeCharacter.items.every((item) => item.definitionId.startsWith("dnd.srd521.")));
});

test("catalog Bard requires three reviewed skills and labels spell choices as DEMO fallback", async () => {
  const adapter = new MockAdapter();
  await start(adapter, "Gate Bard", "드워프", "현자", "바드");

  let snapshot = await snapshotFor(adapter);
  const skills = section(snapshot, "proficiencies").options.slice(0, 3);
  assert.equal(skills.length, 3);
  for (const option of skills) await adapter.updateCharacterDraft({ type: "toggle-skill", value: option.name });

  snapshot = await snapshotFor(adapter);
  assert.equal(snapshot.createDraft?.selectedSkills.length, 3);
  assert.equal(snapshot.creationPlan?.summary.blockingCount, 0);
  assert.equal(section(snapshot, "proficiencies").status, "complete");
  assert.equal(section(snapshot, "spells").status, "warning");
  assert.ok(section(snapshot, "spells").options.length > 0);
  assert.ok(section(snapshot, "spells").options.every((option) => option.source.includes("DEMO fallback")));
  assert.ok(snapshot.creationPlan?.validation.some((message) => message.message.includes("DEMO fallback")));
});

test("catalog Paladin exposes missing skill and spell-list semantics instead of inventing choices", async () => {
  const adapter = new MockAdapter();
  await start(adapter, "Gate Paladin", "드워프", "군인", "팔라딘");

  const snapshot = await snapshotFor(adapter);
  assert.equal(snapshot.creationPlan?.summary.blockingCount, 0);
  assert.equal(section(snapshot, "proficiencies").status, "warning");
  assert.equal(section(snapshot, "proficiencies").options.length, 0);
  assert.equal(section(snapshot, "spells").status, "warning");
  assert.equal(section(snapshot, "spells").options.length, 0);
  assert.ok(snapshot.creationPlan?.validation.some((message) => message.message.includes("semantic map")));
  assert.ok(snapshot.creationPlan?.validation.some((message) => message.message.includes("주문 시전 클래스")));
});

test("Guided and Quick continue to edit the same autosaved draft", async () => {
  const adapter = new MockAdapter();
  await adapter.createCharacterDraft("guided");
  await adapter.updateCharacterDraft({ type: "set-name", value: "Persistent Draft" });
  const guided = await snapshotFor(adapter);
  await adapter.updateCharacterDraft({ type: "set-mode", value: "quick" });
  const quick = await snapshotFor(adapter);
  await adapter.updateCharacterDraft({ type: "set-mode", value: "guided" });
  const guidedAgain = await snapshotFor(adapter);

  assert.equal(guided.createDraft?.id, quick.createDraft?.id);
  assert.equal(quick.createDraft?.id, guidedAgain.createDraft?.id);
  assert.equal(quick.createDraft?.name, "Persistent Draft");
  assert.equal(quick.createDraft?.mode, "quick");
  assert.equal(guidedAgain.createDraft?.mode, "guided");
});
