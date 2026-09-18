/**
 * V0.9 D303: two things an installed subclass could not say — that it makes its class a one-third caster, and which
 * options (maneuvers and the like) it knows in growing numbers from a list the module itself declares.
 *
 * A synthetic module, not the SRD and not anyone's supplement (CLAUDE.md §1.6, §2).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalCharacter, newJournalNpc, type JournalCharacter } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter, tokenForNpc } from "../../client/campaign/page";
import { createCatalog } from "../../client/catalog";
import type { RuleModuleJson } from "../../client/catalog/types";
import { autofill } from "../../client/character/autofill";
import { initialRuntime } from "../../client/character/runtime";
import { parseCustomMonster } from "../../client/compendium/customMonster";
import { featureRuleKey } from "../../client/rules/activation";
import { featureContract } from "../../client/rules/contractActivation";
import { multiclassCasterLevel } from "../../client/rules/tables";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { pcHostOptions } from "../../client/session/pcHost";
import { MemoryHub } from "../../client/session/transport";
import { ids, sourceOf } from "./support";

const SUBCLASS = "test.d303.subclass.fighter.spellblade";
const LIST = "test.d303.maneuvers";
const OPTIONS = ["test.d303.option.maneuvers.feint", "test.d303.option.maneuvers.parry", "test.d303.option.maneuvers.rally"];
const MAGIC_MISSILE = "dnd.srd521.spell.magic-missile";

const option = (id: string, name: string) => ({
  id, category: "option",
  presentation: { originalName: name, defaultLocale: "ko-KR", locales: { "ko-KR": { name, description: `${name} 설명` } } },
  mechanics: [{ kind: "common-play", config: { id, entryPoints: [{ id: "use", invocation: "manual", operations: [{ kind: "adjudication.request", question: `${name}: DM 판정 (시험용)` }] }] } }],
});

const MODULE = {
  moduleId: "test.d303", moduleVersion: "1",
  content: [
    {
      id: SUBCLASS, category: "subclass",
      presentation: { originalName: "Spellblade", defaultLocale: "ko-KR", locales: { "ko-KR": { name: "주문검" } } },
      relationships: [{ kind: "parent", target: ids.cls("fighter") }],
      progressionContributions: [],
      mechanics: [{
        kind: "subclass-definition",
        config: {
          spellcasting: { kind: "third", ability: "int", list: ids.cls("wizard"), cantrips: { "3": 2, "10": 3 }, prepared: { "3": 3, "4": 4, "7": 5 } },
          optionPools: [{ id: "maneuvers", list: LIST, label: "기동", known: { "3": 1, "7": 2 } }],
        },
      }],
    },
    { id: "test.d303.maneuvers", category: "option", mechanics: [{ kind: "option-list-definition", config: { list: LIST, options: OPTIONS } }] },
    option(OPTIONS[0], "속임수"), option(OPTIONS[1], "받아넘기기"), option(OPTIONS[2], "재집결"),
  ],
} as unknown as RuleModuleJson;

const catalog = () => createCatalog([MODULE]);

/** A fighter of the installed subclass (then wizard levels, if any), every other choice auto-answered. */
function build(fighter: number, wizard = 0, prefer: Record<string, string[]> = {}) {
  const cat = catalog();
  const classes = [...Array.from({ length: fighter }, () => "fighter"), ...Array.from({ length: wizard }, () => "wizard")];
  const made = autofill(sourceOf({ classes, abilities: { int: 14 }, choices: { "class.2.subclass": [SUBCLASS] } }), cat, { prefer: { "class.2.subclass": [SUBCLASS], ...prefer } });
  assert.deepEqual(made.derived.validation.blocking, [], made.derived.validation.blocking.join(" / "));
  return { catalog: cat, ...made };
}

test("D303: the one-third caster's slots follow the full-caster row at a third of the class level", () => {
  assert.deepEqual(build(3).derived.spellSlots, { 1: 2 });
  assert.deepEqual(build(4).derived.spellSlots, { 1: 3 });
  assert.deepEqual(build(7).derived.spellSlots, { 1: 4, 2: 2 });
  // Before the subclass the fighter casts nothing.
  const two = autofill(sourceOf({ classes: "fighter", level: 2 }), catalog());
  assert.deepEqual(two.derived.spellSlots, {});
  assert.equal(two.derived.spellcasting.length, 0);
});

test("D303: the subclass decides the casting ability, the list and how many cantrips and spells are prepared", () => {
  const third = build(3).derived;
  const entry = third.spellcasting.find((item) => item.classId === ids.cls("fighter"))!;
  assert.ok(entry, JSON.stringify(third.spellcasting));
  assert.equal(entry.ability, "int");
  assert.equal(entry.cantrips.length, 2);
  assert.equal(entry.prepared.length, 3);
  // The spells come from the wizard's list, and only up to the level the slots reach.
  const cat = catalog();
  for (const id of entry.prepared) {
    const spell = cat.spellById(id)!;
    assert.ok(spell.classes.includes(ids.cls("wizard")), spell.id);
    assert.equal(spell.level, 1, spell.id);
  }
  assert.equal(build(4).derived.spellcasting.find((item) => item.classId === ids.cls("fighter"))!.prepared.length, 4);
});

test("D303: in a multiclass the one-third caster adds a third of its levels, rounded down", () => {
  assert.equal(multiclassCasterLevel([{ kind: "third", level: 3 }, { kind: "full", level: 3 }]), 4);
  assert.equal(multiclassCasterLevel([{ kind: "third", level: 5 }]), 1);
  // Fighter 3 (the subclass) + wizard 3 casts as a 4th-level caster, not as the wizard alone (1: 4, 2: 2).
  assert.deepEqual(build(3, 3).derived.spellSlots, { 1: 4, 2: 3 });
});

test("D303: a module declares an option list, and its subclass knows options from it in growing numbers", () => {
  const cat = catalog();
  assert.deepEqual(cat.classOptions[LIST].map((item) => item.id), OPTIONS);
  assert.equal(cat.classOptions[LIST][0].name, "속임수");
  // The builtin lists are still there, untouched.
  assert.ok((cat.classOptions["warlock.invocations"] ?? []).length > 0);

  const third = build(3).derived;
  assert.equal(third.choices.find((item) => item.id === "class.0.maneuvers")?.count, 1);
  const seventh = build(7, 0, { "class.0.maneuvers": [OPTIONS[0], OPTIONS[2]] }).derived;
  assert.equal(seventh.choices.find((item) => item.id === "class.0.maneuvers")?.count, 2);
  const known = seventh.features.filter((feature) => OPTIONS.includes(feature.id)).map((feature) => feature.id);
  assert.deepEqual(known.sort(), [OPTIONS[0], OPTIONS[2]]);
  // A known option finds its own contract, so it plays like any other feature.
  assert.ok(featureContract(cat, featureRuleKey(OPTIONS[0])));
});

test("D303: an option list naming an entry nobody wrote says so", () => {
  const broken = createCatalog([{ ...MODULE, content: [...MODULE.content, { id: "test.d303.broken", category: "option", mechanics: [{ kind: "option-list-definition", config: { list: "test.d303.broken", options: ["test.d303.option.missing"] } }] }] } as unknown as RuleModuleJson]);
  assert.ok(broken.warnings.some((line) => line.includes("test.d303.option.missing")), broken.warnings.join(" / "));
  assert.deepEqual(broken.classOptions["test.d303.broken"], []);
});

test("D303: at the table the one-third caster casts a prepared spell and the host spends its slot", async () => {
  const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
  const { catalog: cat, source, derived } = build(3, 0, { "class.0.spells": [MAGIC_MISSILE] });
  assert.ok(derived.spellcasting.some((entry) => entry.prepared.includes(MAGIC_MISSILE)));
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("D303 시험", { userId: "dm", displayName: "DM" }), joinCode: "D3AAAA" };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => 0.5, ...pcHostOptions(() => cat) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "D3AAAA", hostSecret: "s" });
  await tick();
  const scene = newScene(campaign.id, "훈련장", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const blade = newJournalCharacter(campaign.id, "dm", { ...source, name: "주문검사" }, initialRuntime(derived));
  const parsed = parseCustomMonster(JSON.stringify({ name: "허수아비", ac: 10, hp: 40, creatureType: "construct", abilities: { str: 10, dex: 10, con: 10, int: 1, wis: 1, cha: 1 } }));
  assert.ok("monster" in parsed, JSON.stringify(parsed));
  const dummy = newJournalNpc(campaign.id, "dm", (parsed as { monster: Parameters<typeof newJournalNpc>[2] }).monster);
  for (const entry of [blade, dummy]) dm.send({ type: "journal.put", entry });
  await tick();
  const tokens = { blade: tokenForCharacter(blade), dummy: tokenForNpc(dummy) };
  for (const token of Object.values(tokens)) dm.send({ type: "token.put", pageId: scene.id, token });
  await tick();

  dm.send({ type: "act.cast", caster: { entryId: blade.id, pageId: scene.id, tokenId: tokens.blade.id }, spellId: MAGIC_MISSILE, targets: [{ entryId: dummy.id, pageId: scene.id, tokenId: tokens.dummy.id }], method: { kind: "slot", level: 1 } });
  await tick();
  const card = host.archive.filter((message) => message.type === "spell" && message.spell).at(-1);
  assert.ok(card, "a spell card");
  const sheet = host.journal.find((item) => item.id === blade.id) as JournalCharacter;
  assert.equal(sheet.runtime.slotsUsed[1], 1);
});
