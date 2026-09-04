import test from "node:test";
import assert from "node:assert/strict";
import "../../src/app/characterCreationV10Adapter";
import "../../src/app/characterLibraryRuntimeAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import { classIdFromName, classMeta } from "../../src/app/characterCreationV10Data";
import type { CharacterCreationSection, CharacterSheet } from "../../src/app/contracts";
import { prepareCharacterSpellComponents } from "../../src/app/spellComponentInventoryRuntime";

type DynamicSection = CharacterCreationSection & { selection:{ choiceId:string; count:number } };

async function fillCurrentDraft(adapter: MockAdapter) {
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
    const dynamic = (current.creationPlan?.sections ?? []).filter((section) => section.kind === "dynamic-choice" && section.status === "incomplete" && section.selection) as DynamicSection[];
    for (const section of dynamic) {
      for (let step = 0; step < 8; step++) {
        const latest = await adapter.getSnapshot();
        const target = latest.creationPlan?.sections.find((item) => item.selection?.choiceId === section.selection.choiceId);
        if (!target || target.status === "complete" || target.status === "blocked") break;
        const next = target.options.find((option) => !option.selected);
        if (!next) break;
        await adapter.updateCharacterDraft({ type:"toggle-class-choice", choiceId:section.selection.choiceId, value:next.id });
        changed = true;
      }
    }
    const after = await adapter.getSnapshot();
    if ((after.creationPlan?.summary.blockingCount ?? 1) === 0) return after;
    if (!changed) assert.fail(`unable to complete draft: ${after.creationPlan?.sections.filter((section) => section.status !== "complete").map((section) => `${section.id}:${section.status}`).join(", ")}`);
  }
  assert.fail("creation completion exceeded 40 passes");
}

async function createCharacter(className:string, background:string) {
  const adapter = new MockAdapter();
  await adapter.createCharacterDraft("guided");
  await adapter.updateCharacterDraft({ type:"set-name", value:`Wield ${className}` });
  await adapter.updateCharacterDraft({ type:"set-species", value:"인간" });
  await adapter.updateCharacterDraft({ type:"set-background", value:background });
  await adapter.updateCharacterDraft({ type:"set-class", value:className });
  await adapter.updateCharacterDraft({ type:"apply-recommended-array" });
  await fillCurrentDraft(adapter);
  await adapter.finalizeCharacterDraft();
  const snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.createDraft, null);
  return { adapter, sheet: snapshot.activeCharacter };
}

function handsOccupied(sheet: CharacterSheet) {
  return sheet.items.filter((item) => item.wielded).reduce((count, item) => count + (item.wieldSlot === "two-hand" ? 2 : 1), 0);
}

function assertLegalWieldState(sheet: CharacterSheet) {
  for (const item of sheet.items) {
    if (item.wielded) assert.ok(item.wieldSlot, `${item.name} is wielded without a wield slot`);
    if (item.wielded) assert.equal(item.equipped, true, `${item.name} is wielded but not equipped`);
  }
  assert.ok(handsOccupied(sheet) <= 2, `created Character occupies ${handsOccupied(sheet)} hands: ${sheet.items.filter((item) => item.wielded).map((item) => `${item.name}:${item.wieldSlot}`).join(", ")}`);
  const mainHands = sheet.items.filter((item) => item.wielded && item.wieldSlot !== "off-hand");
  assert.equal(mainHands.length, 1, `exactly one weapon may hold the main hand: ${mainHands.map((item) => item.name).join(", ")}`);
}

test("a created Cleric with the Soldier background wields one weapon and the shield; the background weapons are carried, not wielded", async () => {
  const { adapter, sheet } = await createCharacter("클레릭", "군인");
  assertLegalWieldState(sheet);
  const weapons = sheet.items.filter((item) => item.definitionId.includes(".weapon."));
  assert.ok(weapons.length >= 2, `Soldier + Cleric loadout must carry several weapons; got ${weapons.map((item) => item.name).join(", ")}`);
  const wieldedWeapons = weapons.filter((item) => item.wielded);
  assert.equal(wieldedWeapons.length, 1);
  assert.equal(wieldedWeapons[0].wieldSlot, "main-hand");
  const shield = sheet.items.find((item) => item.definitionId === "dnd.srd521.item.shield");
  assert.ok(shield, "Cleric equipment set A carries a shield");
  assert.equal(shield.wielded, true);
  assert.equal(shield.wieldSlot, "off-hand");
  for (const carried of weapons.filter((item) => !item.wielded)) {
    assert.equal(carried.equipped, true, `${carried.name} stays equipped (carried) so its attack remains available`);
    assert.equal(carried.wieldSlot, undefined);
  }

  // Only the mace and the shield occupy hands; the carried weapons no longer count as phantom hands.
  assert.equal(handsOccupied(sheet), 2);

  // Inventory transactions must not be rejected by an illegal wield state: the player can stow the
  // shield, which frees the hand a somatic-only spell such as Sacred Flame needs.
  const after = await adapter.toggleItemEquipped(shield.id);
  const stowed = after.activeCharacter;
  assert.equal(stowed.items.find((item) => item.id === shield.id)?.equipped, false);
  assert.equal(handsOccupied(stowed), 1);
  const components = prepareCharacterSpellComponents({ character: stowed, requirements: { verbal:true, somatic:true }, status: [], targetCount: 1 });
  assert.equal(components.context.freeHands, 1);
  assert.equal(components.context.hasFocus, true, "the holy symbol from the loadout is a held focus");
});

test("a created Fighter wields a two-handed weapon with both hands and no shield beside it", async () => {
  const { sheet } = await createCharacter("파이터", "군인");
  assertLegalWieldState(sheet);
  const wielded = sheet.items.filter((item) => item.wielded);
  const twoHanded = wielded.find((item) => item.wieldSlot === "two-hand");
  if (twoHanded) {
    assert.equal(wielded.length, 1, `a two-handed weapon leaves no hand for ${wielded.filter((item) => item !== twoHanded).map((item) => item.name).join(", ")}`);
  } else {
    assert.ok(wielded.length <= 2);
  }
});

test("a created caster without a shield keeps a free hand for somatic components", async () => {
  const { sheet } = await createCharacter("위저드", "현자");
  assertLegalWieldState(sheet);
  const components = prepareCharacterSpellComponents({ character: sheet, requirements: { verbal:true, somatic:true }, status: [], targetCount: 1 });
  assert.ok(components.context.freeHands >= 1, `a Wizard with one wielded weapon keeps a free hand; occupied=${handsOccupied(sheet)}`);
});
