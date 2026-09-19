/**
 * V0.9 D310 (SRD_MODULE_PLAN.md S1): an installed module can define a whole class.
 *
 * Until now a class's level table, its creation choices and its spell counts came only from the SRD's generated
 * progression and creation index — a module class had an empty table and stopped at level 1 ("레벨 표가 없습니다").
 * `class-definition` now carries `levels[]` (features as entry ids or row roles, and the columns), `casterKind`,
 * `skillOptions`, `level1Choices` and `spells`, and an option pool may count from a column with the list's own gates
 * (the warlock's invocations became such a pool). A synthetic module, played at the table (CLAUDE.md §1.6, §1.7).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalCharacter, newJournalNpc } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter, tokenForNpc } from "../../client/campaign/page";
import { createCatalog } from "../../client/catalog";
import type { RuleModuleJson } from "../../client/catalog/types";
import { autofill } from "../../client/character/autofill";
import { classOptionList } from "../../client/character/choices";
import { initialRuntime } from "../../client/character/runtime";
import { parseCustomMonster } from "../../client/compendium/customMonster";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { pcHostOptions } from "../../client/session/pcHost";
import { MemoryHub } from "../../client/session/transport";
import { sourceOf } from "./support";

const CLASS = "test.d310.class.tinker";
const SUB = "test.d310.subclass.tinker.clockwork";
const LIST = "test.d310.gadgets";
const MISSILE = "dnd.srd521.spell.magic-missile";
const f = (slug: string) => `test.d310.feature.tinker.${slug}`;
const named = (id: string, name: string, category = "option", mechanics: unknown[] = []) => ({ id, category, presentation: { originalName: name, defaultLocale: "ko-KR", locales: { "ko-KR": { name, description: `${name} 설명` } } }, mechanics });

const MODULE = {
  moduleId: "test.d310", moduleVersion: "1",
  content: [
    named(CLASS, "땜장이", "class", [{ kind: "class-definition", config: {
      hitDie: 8, primaryAbilities: ["int"], savingThrowProficiencies: ["con", "int"], armorTraining: ["light"], weaponTraining: ["simple"],
      casterKind: "full", spellcastingAbility: "int",
      skillOptions: { count: 2, options: ["arcana", "history", "investigation"] },
      level1Choices: [],
      resources: [{ id: "resource.test.d310.sparks", label: "불꽃", column: "불꽃", recovery: "long-rest", minLevel: 1 }],
      optionPools: [{ id: "gadgets", list: LIST, label: "장치", column: "장치" }],
      levels: [
        { level: 1, features: [f("sparks")], columns: { 불꽃: 2, 장치: 1, 소마법: 2, "준비 주문": 2, 1: 2 } },
        { level: 2, features: [], columns: { 불꽃: 2, 장치: 1, 소마법: 2, "준비 주문": 3, 1: 3 } },
        { level: 3, features: [{ role: "subclass", name: "땜장이 서브클래스" }], columns: { 불꽃: 3, 장치: 2, 소마법: 2, "준비 주문": 4, 1: 4, 2: 2 } },
        { level: 4, features: [{ role: "asi", name: "능력치 향상" }], columns: { 불꽃: 3, 장치: 2, 소마법: 3, "준비 주문": 5, 1: 4, 2: 3 } },
        { level: 5, features: [f("overclock")], columns: { 불꽃: 4, 장치: 3, 소마법: 3, "준비 주문": 6, 1: 4, 2: 3, 3: 2 } },
      ],
    } }]),
    named(f("sparks"), "불꽃 튀기기"),
    named(f("overclock"), "과부하"),
    { ...named(SUB, "태엽 장인", "subclass", [{ kind: "subclass-definition", config: {} }]), relationships: [{ kind: "parent", target: CLASS }], progressionContributions: [{ track: CLASS, threshold: 3, grants: [f("gears")] }] },
    named(f("gears"), "톱니"),
    named("test.d310.gadget-list", "장치 목록", "option", [{ kind: "option-list-definition", config: { list: LIST, options: [
      "test.d310.gadget.lamp", { id: "test.d310.gadget.drone", minLevel: 5 }, { id: "test.d310.gadget.bigger-lamp", requires: "test.d310.gadget.lamp" },
    ] } }]),
    named("test.d310.gadget.lamp", "등불"), named("test.d310.gadget.drone", "드론"), named("test.d310.gadget.bigger-lamp", "큰 등불"),
    // The SRD's own spell, joined to this class's list by the module.
    { id: MISSILE, category: "spell", presentation: { originalName: "Magic Missile", defaultLocale: "ko-KR", locales: { "ko-KR": { name: "마법 화살" } } }, mechanics: [{ kind: "spell-definition", config: { level: 1, classes: [CLASS] } }] },
  ],
} as unknown as RuleModuleJson;

const build = (level: number, choices: Record<string, string[]> = {}) => {
  const cat = createCatalog([MODULE]);
  const base = sourceOf({ classes: "fighter", level, abilities: { int: 16 }, choices });
  const made = autofill({ ...base, tracks: base.tracks.map((track) => ({ ...track, classId: CLASS })) }, cat, { prefer: { "class.2.subclass": [SUB], ...choices } });
  return { cat, ...made };
};

test("D310: a module class climbs its own table — features, subclass, ASI, resources and slots", () => {
  const five = build(5).derived;
  assert.deepEqual(five.validation.blocking, [], five.validation.blocking.join(" / "));
  const names = five.features.map((feature) => feature.name);
  for (const name of ["불꽃 튀기기", "과부하", "서브클래스: 태엽 장인", "톱니"]) assert.ok(names.includes(name), `${name}: ${names.join(", ")}`);
  assert.ok(five.choices.some((choice) => choice.id === "class.3.asi"), "the ASI row asks for an ASI");
  assert.equal(five.resources.find((pool) => pool.id === "resource.test.d310.sparks")?.max, 4, "the pool reads its column");
  assert.deepEqual(five.spellSlots, { 1: 4, 2: 3, 3: 2 });
  assert.equal(five.hp.max > 0, true);
  const skills = five.choices.find((choice) => choice.id.endsWith("skills"));
  assert.deepEqual(skills?.options.map((option) => option.id).sort(), ["arcana", "history", "investigation"]);
});

test("D310: an option pool counts from a column, and the list's gates hold", () => {
  const three = build(3).derived;
  const gadgets = three.choices.find((choice) => choice.id === "class.0.gadgets")!;
  assert.equal(gadgets.count, 2);
  assert.match(gadgets.options.find((option) => option.id === "test.d310.gadget.drone")?.disabledReason ?? "", /5레벨/);
  // Nothing picked yet: the bigger lamp waits for the lamp.
  const fresh = classOptionList(createCatalog([MODULE]), LIST, { className: "땜장이", level: 3, selected: [] });
  assert.match(fresh.find((option) => option.id === "test.d310.gadget.bigger-lamp")?.disabledReason ?? "", /등불 필요/);
  const five = build(5, { "class.0.gadgets": ["test.d310.gadget.lamp"] }).derived;
  const open = five.choices.find((choice) => choice.id === "class.0.gadgets")!;
  assert.equal(open.options.find((option) => option.id === "test.d310.gadget.drone")?.disabledReason, undefined);
  assert.equal(open.options.find((option) => option.id === "test.d310.gadget.bigger-lamp")?.disabledReason, undefined);
  assert.ok(five.features.some((feature) => feature.name === "장치: 등불"));
});

test("D310: at the table the module class casts from its list and the host spends the slot", async () => {
  const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
  const { cat, source, derived } = build(1, { "class.0.spells": [MISSILE] });
  assert.ok(derived.spellcasting.some((entry) => entry.prepared.includes(MISSILE)), JSON.stringify(derived.spellcasting));
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("D310 시험", { userId: "dm", displayName: "DM" }), joinCode: "D310AA" };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => 0.5, ...pcHostOptions(() => cat) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "D310AA", hostSecret: "s" });
  await tick();
  const scene = newScene(campaign.id, "작업장", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const pc = newJournalCharacter(campaign.id, "dm", source, initialRuntime(derived));
  const dummy = newJournalNpc(campaign.id, "dm", (parseCustomMonster(JSON.stringify({ name: "허수아비", ac: 10, hp: 40, creatureType: "construct", abilities: { str: 10, dex: 10, con: 10, int: 1, wis: 1, cha: 1 } })) as { monster: Parameters<typeof newJournalNpc>[2] }).monster);
  for (const entry of [pc, dummy]) dm.send({ type: "journal.put", entry });
  await tick();
  const tokens = { pc: tokenForCharacter(pc), dummy: tokenForNpc(dummy) };
  for (const token of Object.values(tokens)) dm.send({ type: "token.put", pageId: scene.id, token });
  await tick();
  dm.send({ type: "act.cast", caster: { entryId: pc.id, pageId: scene.id, tokenId: tokens.pc.id }, spellId: MISSILE, targets: [{ pageId: scene.id, tokenId: tokens.dummy.id }], method: { kind: "slot", level: 1 } });
  await tick();
  const hp = host.pageList.flatMap((page) => page.tokens).find((item) => item.id === tokens.dummy.id)!.bars[0]?.value ?? 0;
  assert.ok(hp < 40, `the missiles land: ${host.archive.map((message) => message.content).join(" | ")}`);
  const runtime = (host.journal.find((entry) => entry.id === pc.id) as ReturnType<typeof newJournalCharacter>).runtime;
  assert.equal(runtime.slotsUsed?.[1] ?? runtime.slotsUsed?.["1" as never], 1, JSON.stringify(runtime));
});
