/**
 * V0.9 D308: a use exists only for the character whose choices allow it.
 *
 * A green dragonborn could breathe all five damage types, and a goliath of any ancestry had all six giant powers:
 * the labelled uses of one contract were offered whatever the species choice was. An entry point now carries a
 * `when` the character's scope decides (`actor.chose:<choice>:<option>`), the sheet, the attack dialog and the
 * reaction window leave out what fails it, and the table refuses it. Also: the repeat of an area spell with no
 * creature named (가시 성장) threw instead of asking for one.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalCharacter, newJournalNpc } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter, tokenForNpc } from "../../client/campaign/page";
import { createCatalog } from "../../client/catalog";
import type { RuleModuleJson } from "../../client/catalog/types";
import { autofill } from "../../client/character/autofill";
import type { CharacterSource } from "../../client/character/types";
import { initialRuntime } from "../../client/character/runtime";
import { parseCustomMonster } from "../../client/compendium/customMonster";
import { spellExec, sustainedExec } from "../../client/compendium/spells";
import { featureRuleKey } from "../../client/rules/activation";
import { pcGuards } from "../../client/rules/contractReactions";
import { tableOutcome } from "../../client/rules/contractTable";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { pcHostOptions } from "../../client/session/pcHost";
import { MemoryHub } from "../../client/session/transport";
import { sourceOf } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const build = (cat: ReturnType<typeof createCatalog>, species: string, choices: Record<string, string[]>) =>
  autofill(sourceOf({ classes: "fighter", level: 5, species, choices }), cat, { prefer: choices });

const giantGuards = (derived: ReturnType<typeof build>["derived"], cat: ReturnType<typeof createCatalog>) =>
  pcGuards({ runtime: initialRuntime(derived) }, derived, cat, "attack.hit-self").filter((offer) => offer.ruleKey.includes("giant"));

test("D308: a green dragonborn breathes poison and nothing else", () => {
  const cat = createCatalog([]);
  const { derived } = build(cat, "dragonborn", { "origin.species.draconicAncestry": ["green"] });
  const breaths = derived.features.filter((feature) => feature.id.includes("breath-weapon#"));
  assert.deepEqual(breaths.map((feature) => feature.name), ["브레스 웨폰 (독)"]);
  const key = featureRuleKey(breaths[0].id).replace(/#.*$/, "");
  assert.equal(tableOutcome(derived, cat, `${key}#acid`), null, "another ancestry's breath does nothing at the table");
  assert.equal(tableOutcome(derived, cat, `${key}#poison`)?.strikes?.[0]?.damageType, "독");
});

test("D308: a goliath has the one giant power its ancestry gives", () => {
  const cat = createCatalog([]);
  const fire = build(cat, "goliath", { "origin.species.giantAncestry": ["fire"] }).derived;
  const riders = (fire.attackRiders ?? []).filter((rider) => rider.key.includes("giant-ancestry"));
  assert.equal(riders.length, 1, JSON.stringify(riders.map((rider) => rider.key)));
  assert.deepEqual(riders[0].damage.map((part) => [part.formula, part.type]), [["1d10", "화염"]]);
  assert.equal(giantGuards(fire, cat).length, 0, "no stone or storm reaction");

  const stone = build(cat, "goliath", { "origin.species.giantAncestry": ["stone"] }).derived;
  assert.equal((stone.attackRiders ?? []).filter((rider) => rider.key.includes("giant-ancestry")).length, 0);
  assert.deepEqual(giantGuards(stone, cat).map((offer) => offer.reduce), [`1d12+${stone.abilities.con.modifier}`]);

  const storm = build(cat, "goliath", { "origin.species.giantAncestry": ["storm"] }).derived;
  assert.deepEqual(giantGuards(storm, cat)[0]?.redirect, { formula: "1d8", damageType: "천둥" }, "no save against it");
});

/** A table with a PC and a wolf on one scene, driven by the DM's client. */
async function table(cat: ReturnType<typeof createCatalog>, source: CharacterSource, derived: ReturnType<typeof build>["derived"]) {
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("D308 시험", { userId: "dm", displayName: "DM" }), joinCode: "D308AA" };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => 0.5, ...pcHostOptions(() => cat) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "D308AA", hostSecret: "s" });
  const refusals: string[] = [];
  dm.onRefused((reason) => refusals.push(reason));
  await tick();
  const scene = newScene(campaign.id, "들판", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const pc = newJournalCharacter(campaign.id, "dm", source, initialRuntime(derived));
  const wolf = newJournalNpc(campaign.id, "dm", (parseCustomMonster(JSON.stringify({ name: "늑대", ac: 13, hp: 30, creatureType: "beast", abilities: { str: 12, dex: 15, con: 12, int: 3, wis: 12, cha: 6 } })) as { monster: Parameters<typeof newJournalNpc>[2] }).monster);
  for (const entry of [pc, wolf]) dm.send({ type: "journal.put", entry });
  await tick();
  const tokens = { pc: tokenForCharacter(pc), wolf: tokenForNpc(wolf) };
  for (const token of Object.values(tokens)) dm.send({ type: "token.put", pageId: scene.id, token });
  await tick();
  return {
    dm, refusals,
    actor: { entryId: pc.id, pageId: scene.id, tokenId: tokens.pc.id },
    wolfRef: { pageId: scene.id, tokenId: tokens.wolf.id },
    // An NPC token carries its own hit points in its first bar.
    wolfHp: () => host.pageList.flatMap((page) => page.tokens).find((item) => item.id === tokens.wolf.id)!.bars[0]?.value ?? 0,
  };
}

// A module species with a choice that decides which of its uses a character has (CLAUDE.md §1.6).
const SPECIES = "test.d308.species.stormkin";
const MODULE = {
  moduleId: "test.d308", moduleVersion: "1",
  content: [
    { id: SPECIES, category: "species", presentation: { originalName: "Stormkin", defaultLocale: "ko-KR", locales: { "ko-KR": { name: "폭풍족" } } }, mechanics: [{ kind: "species-definition", config: { size: ["medium"], speed: 30, choices: { sky: ["rain", "hail"] }, traits: ["sky-gift"] } }] },
    { id: "effect.feature.species.sky-gift", category: "option", presentation: { originalName: "Sky Gift", defaultLocale: "ko-KR", locales: { "ko-KR": { name: "하늘의 선물" } } }, mechanics: [{ kind: "common-play", config: { id: "feature:species.sky-gift", entryPoints: [
      { id: "rain", label: "비 뿌리기", invocation: "manual", when: { ref: "actor.chose:sky:rain" }, targeting: { from: "targets", min: 1, max: 1 }, operations: [{ kind: "damage.apply", dice: "1d4", damageType: "번개", target: "targets" }] },
      { id: "hail", label: "우박 던지기", invocation: "manual", when: { ref: "actor.chose:sky:hail" }, targeting: { from: "targets", min: 1, max: 1 }, operations: [{ kind: "damage.apply", dice: "2d6", damageType: "냉기", target: "targets" }] },
    ] } }] },
  ],
} as unknown as RuleModuleJson;

test("D308: a module species' choice decides its uses, on the sheet and at the table", async () => {
  const cat = createCatalog([MODULE]);
  const choices = { "origin.species.sky": ["hail"] };
  const base = sourceOf({ classes: "fighter", level: 3, choices });
  const made = autofill({ ...base, origin: { ...base.origin, speciesId: SPECIES } }, cat, { prefer: choices });
  const uses = made.derived.features.filter((feature) => feature.id.includes("#"));
  assert.deepEqual(uses.map((feature) => feature.name), ["우박 던지기"]);

  const t = await table(cat, made.source, made.derived);
  const key = featureRuleKey(uses[0].id).replace(/#.*$/, "");
  t.dm.send({ type: "act.contract", actor: t.actor, ruleKey: `${key}#rain`, targets: [t.wolfRef] });
  await tick();
  assert.equal(t.wolfHp(), 30, "the use this character does not have does nothing");
  t.dm.send({ type: "act.contract", actor: t.actor, ruleKey: `${key}#hail`, targets: [t.wolfRef] });
  await tick();
  assert.ok(t.wolfHp() < 30, `the one it has hurts: ${t.refusals.join(" / ")}`);
});

test("D308: the repeat of an area spell asks for the creature it hurts", async () => {
  const cat = createCatalog([]);
  const spike = cat.spells.find((spell) => spell.name === "가시 성장")!.id;
  const exec = spellExec(spike)!;
  assert.equal(exec.targeting.maxTargets, 0, "the cast names a point, no creature");
  assert.equal(sustainedExec(exec)!.targeting.minTargets, 1, "the repeat names one");

  const choices = { "class.0.spells": [spike] };
  const made = autofill(sourceOf({ classes: "druid", level: 3, choices }), cat, { prefer: choices });
  const t = await table(cat, made.source, made.derived);
  t.dm.send({ type: "act.cast", caster: t.actor, spellId: spike, targets: [], method: { kind: "slot", level: 2 } });
  await tick();
  t.dm.send({ type: "act.cast", caster: t.actor, spellId: spike, targets: [], method: { kind: "sustain" } });
  await tick();
  assert.ok(t.refusals.some((reason) => reason.includes("대상")), `refused, not thrown: ${t.refusals.join(" / ")}`);
  t.dm.send({ type: "act.cast", caster: t.actor, spellId: spike, targets: [t.wolfRef], method: { kind: "sustain" } });
  await tick();
  assert.ok(t.wolfHp() < 30, `the creature that moved through it is hurt: ${t.refusals.join(" / ")}`);
});
