import test from "node:test";
import assert from "node:assert/strict";
import "../../src/app/characterCreationV10Adapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import { BACKGROUNDS, CLASSES, SPECIES, classIdFromName, classMeta, spellId } from "../../src/app/characterCreationV10Data";
import type { CharacterCreationSection } from "../../src/app/contracts";

async function setSource(adapter: MockAdapter, type:"set-species"|"set-background"|"set-class", value:string) {
  await adapter.updateCharacterDraft({ type, value });
}

async function fillCurrentDraft(adapter: MockAdapter, overrides: Record<string,string[]> = {}) {
  for (let pass = 0; pass < 40; pass++) {
    const snapshot = await adapter.getSnapshot();
    const draft = snapshot.createDraft;
    const plan = snapshot.creationPlan;
    assert.ok(draft && plan, "creation draft/plan must exist");
    let changed = false;

    const skills = plan.sections.find((section) => section.id === "proficiencies");
    if (skills?.status === "incomplete") {
      const count = classMeta(classIdFromName(draft.className)).semantics.skills.count;
      for (const option of skills.options.filter((item) => !item.selected).slice(0, Math.max(0, count - draft.selectedSkills.length))) {
        await adapter.updateCharacterDraft({ type:"toggle-skill", value:option.name });
        changed = true;
      }
    }

    const equipment = plan.sections.find((section) => section.id === "class-equipment");
    if (equipment?.status === "incomplete" && equipment.options[0]) {
      await adapter.updateCharacterDraft({ type:"set-equipment", value:equipment.options[0].id });
      changed = true;
    }

    const current = await adapter.getSnapshot();
    const dynamic = (current.creationPlan?.sections ?? []).filter((section) => section.kind === "dynamic-choice" && section.status === "incomplete" && section.selection) as Array<CharacterCreationSection & { selection:{ choiceId:string; count:number } }>;
    for (const section of dynamic) {
      const targetIds = overrides[section.selection.choiceId] ?? section.options.filter((option) => !option.selected).slice(0, section.selection.count - section.options.filter((option) => option.selected).length).map((option) => option.id);
      for (const id of targetIds) {
        const latest = await adapter.getSnapshot();
        const target = latest.creationPlan?.sections.find((item) => item.selection?.choiceId === section.selection.choiceId);
        if (!target || target.status === "complete" || target.status === "blocked") break;
        if (!target.options.some((option) => option.id === id && !option.selected)) continue;
        await adapter.updateCharacterDraft({ type:"toggle-class-choice", choiceId:section.selection.choiceId, value:id });
        changed = true;
      }
    }

    const after = await adapter.getSnapshot();
    if ((after.creationPlan?.summary.blockingCount ?? 1) === 0) return after;
    if (!changed) {
      const unresolved = after.creationPlan?.sections.filter((section) => section.status === "incomplete" || section.status === "blocked").map((section) => `${section.id}:${section.status}`).join(", ");
      assert.fail(`unable to complete draft: ${unresolved}; ${after.creationPlan?.validation.map((item) => item.message).join(" | ")}`);
    }
  }
  assert.fail("creation completion exceeded 40 passes");
}

async function completeClass(className:string) {
  const adapter = new MockAdapter();
  await adapter.createCharacterDraft("guided");
  await adapter.updateCharacterDraft({ type:"set-name", value:`Gate ${className}` });
  await setSource(adapter, "set-species", "드워프");
  await setSource(adapter, "set-background", "범죄자");
  await setSource(adapter, "set-class", className);
  await adapter.updateCharacterDraft({ type:"apply-recommended-array" });
  const ready = await fillCurrentDraft(adapter);
  assert.equal(ready.creationPlan?.summary.blockingCount, 0);
  assert.equal(ready.creationPlan?.summary.warningCount, 0);
  assert.ok(!ready.creationPlan?.validation.some((message) => /DEMO|semantic|미연결|대기/.test(message.message)));
  await adapter.finalizeCharacterDraft();
  const committed = await adapter.getSnapshot();
  assert.equal(committed.createDraft, null);
  assert.equal(committed.activeCharacter.className, className);
  assert.equal(committed.activeCharacter.level, 1);
  assert.equal(committed.activeCharacter.saveState, "saved");
  assert.ok((committed.activeCharacter.languages?.length ?? 0) >= 3);
  return committed.activeCharacter;
}

async function completeCharacter(className:string, species:string, background:string, name:string) {
  const adapter = new MockAdapter();
  await adapter.createCharacterDraft("guided");
  await adapter.updateCharacterDraft({ type:"set-name", value:name });
  await setSource(adapter, "set-species", species);
  await setSource(adapter, "set-background", background);
  await setSource(adapter, "set-class", className);
  await adapter.updateCharacterDraft({ type:"apply-recommended-array" });
  await fillCurrentDraft(adapter);
  await adapter.finalizeCharacterDraft();
  return adapter.getSnapshot();
}

test("Gate 04.5 complete catalog breadth remains 12 classes / 9 species / 4 backgrounds", () => {
  assert.equal(CLASSES.length, 12);
  assert.equal(SPECIES.length, 9);
  assert.equal(BACKGROUNDS.length, 4);
});

test("all twelve SRD classes can reach a fully resolved level-1 commit", async () => {
  for (const klass of CLASSES) {
    const sheet = await completeClass(klass.name);
    const semantic = classMeta(klass.id).semantics;
    assert.ok(sheet.skills.length >= semantic.skills.count + 2, `${klass.name}: class + Criminal background skills should be represented`);
    if (semantic.choices.some((choice) => choice.kind === "weapon-mastery")) assert.equal(sheet.masteryWeapons?.length, semantic.choices.find((choice) => choice.kind === "weapon-mastery")?.count);
    if (semantic.spells?.cantrips) { const bonus = semantic.spells.bonusCantripChoice && sheet.creationSelections?.[semantic.spells.bonusCantripChoice.choiceId]?.includes(semantic.spells.bonusCantripChoice.value) ? 1 : 0; assert.equal(sheet.cantrips?.length, semantic.spells.cantrips + bonus); }
    if (semantic.spells?.spellbook) assert.equal(sheet.spellbookSpells?.length, semantic.spells.spellbook);
    if (semantic.spells?.preparedFromSpellbook) assert.equal(sheet.preparedSpells?.filter((id) => !id.startsWith("always:")).length, semantic.spells.preparedFromSpellbook);
    else if (semantic.spells?.prepared) assert.ok((sheet.preparedSpells?.length ?? 0) >= semantic.spells.prepared);
    for (const name of semantic.spells?.alwaysPrepared ?? []) assert.ok(sheet.preparedSpells?.includes(`always:${spellId(name)}`), `${klass.name}: ${name} must be always prepared`);
  }
});

test("Human Soldier Fighter resolves species, origin feat, background, languages, mastery and nested loadout choices", async () => {
  const adapter = new MockAdapter();
  await adapter.createCharacterDraft("guided");
  await adapter.updateCharacterDraft({ type:"set-name", value:"Gate Human Fighter" });
  await setSource(adapter, "set-species", "인간");
  await setSource(adapter, "set-background", "군인");
  await setSource(adapter, "set-class", "파이터");
  await adapter.updateCharacterDraft({ type:"apply-recommended-array" });
  const ready = await fillCurrentDraft(adapter, {
    "species.size":["medium"],
    "species.originFeat":["dnd.srd521.feat.skilled"],
  });
  assert.equal(ready.creationPlan?.summary.blockingCount, 0);
  assert.equal(ready.creationPlan?.summary.warningCount, 0);
  assert.equal(ready.createDraft?.choiceSelections?.["species.skilled.proficiencies"]?.length, 3);
  assert.equal(ready.createDraft?.choiceSelections?.["background.gaming-set"]?.length, 1);
  assert.equal(ready.createDraft?.choiceSelections?.["class.weapon-mastery"]?.length, 3);
  await adapter.finalizeCharacterDraft();
  const sheet = (await adapter.getSnapshot()).activeCharacter;
  assert.equal(sheet.species, "인간");
  assert.equal(sheet.background, "군인");
  assert.equal(sheet.masteryWeapons?.length, 3);
  assert.ok((sheet.creationSelections?.["identity.languages"]?.length ?? 0) === 2);
  assert.ok((sheet.items?.length ?? 0) > 0);
});

test("Elf Acolyte Wizard resolves lineage, fixed Magic Initiate, spellbook six and prepared subset four", async () => {
  const adapter = new MockAdapter();
  await adapter.createCharacterDraft("guided");
  await adapter.updateCharacterDraft({ type:"set-name", value:"Gate Elf Wizard" });
  await setSource(adapter, "set-species", "엘프");
  await setSource(adapter, "set-background", "신앙 수행자");
  await setSource(adapter, "set-class", "위저드");
  await adapter.updateCharacterDraft({ type:"apply-recommended-array" });
  const ready = await fillCurrentDraft(adapter);
  assert.equal(ready.creationPlan?.summary.blockingCount, 0);
  assert.equal(ready.createDraft?.choiceSelections?.["class.spells.spellbook"]?.length, 6);
  assert.equal(ready.createDraft?.choiceSelections?.["class.spells.prepared"]?.length, 4);
  const book = new Set(ready.createDraft?.choiceSelections?.["class.spells.spellbook"] ?? []);
  for (const spell of ready.createDraft?.choiceSelections?.["class.spells.prepared"] ?? []) assert.ok(book.has(spell), "prepared Wizard spell must come from the selected spellbook");
  assert.equal(ready.createDraft?.choiceSelections?.["background.magic-initiate.cantrips"]?.length, 2);
  assert.equal(ready.createDraft?.choiceSelections?.["background.magic-initiate.level1"]?.length, 1);
  await adapter.finalizeCharacterDraft();
  const sheet = (await adapter.getSnapshot()).activeCharacter;
  assert.equal(sheet.spellbookSpells?.length, 6);
  assert.equal(sheet.preparedSpells?.filter((id) => id.startsWith("dnd.srd521.spell.")).length, 5); // 4 Wizard + 1 Magic Initiate
});

test("Guided and Quick continue to share one autosaved choice graph", async () => {
  const adapter = new MockAdapter();
  await adapter.createCharacterDraft("guided");
  await adapter.updateCharacterDraft({ type:"set-name", value:"Persistent Complete Draft" });
  await setSource(adapter, "set-species", "드워프");
  const first = await adapter.getSnapshot();
  await adapter.updateCharacterDraft({ type:"set-mode", value:"quick" });
  const quick = await adapter.getSnapshot();
  await adapter.updateCharacterDraft({ type:"set-mode", value:"guided" });
  const again = await adapter.getSnapshot();
  assert.equal(first.createDraft?.id, quick.createDraft?.id);
  assert.equal(quick.createDraft?.id, again.createDraft?.id);
  assert.equal(again.createDraft?.name, "Persistent Complete Draft");
});


test("species lineage automatic grants are committed from declarative creation semantics", async () => {
  const elf = await completeCharacter("위저드", "엘프", "현자", "Species Elf");
  assert.ok(elf.activeCharacter.cantrips?.includes("dnd.srd521.spell.prestidigitation") || elf.activeCharacter.cantrips?.includes("dnd.srd521.spell.dancing-lights") || elf.activeCharacter.cantrips?.includes("dnd.srd521.spell.druidcraft"));
  const gnome = await completeCharacter("파이터", "노움", "군인", "Species Gnome");
  assert.ok((gnome.activeCharacter.cantrips?.length ?? 0) >= 1);
  const tiefling = await completeCharacter("파이터", "티플링", "범죄자", "Species Tiefling");
  assert.ok(tiefling.activeCharacter.cantrips?.includes("dnd.srd521.spell.thaumaturgy"));
});
