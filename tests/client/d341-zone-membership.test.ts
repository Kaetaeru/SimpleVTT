/**
 * V0.9 D341 (SRD_MODULE_PLAN.md §32): the rules you live under while you stand in a zone.
 *
 * A creature inside a spell's area carries a membership effect (`zone:<caster>:<spell id>`), which the table uses
 * to decide who the zone touches. The sheet read nothing from it, so a spell whose whole rule is "while you are
 * inside, your saves change" (권능의 원) had no way to say it. That key now finds the spell's own contract, so the
 * standing properties of the spell apply for as long as the creature is in it — and stop when it steps out.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalCharacter } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter } from "../../client/campaign/page";
import { createCatalog } from "../../client/catalog";
import type { RuleModuleJson } from "../../client/catalog/types";
import { autofill } from "../../client/character/autofill";
import { initialRuntime } from "../../client/character/runtime";
import type { ActiveEffect } from "../../client/character/types";
import { applyActiveEffects, effectRuleKey } from "../../client/rules/effects";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { pcHostOptions } from "../../client/session/pcHost";
import { MemoryHub } from "../../client/session/transport";
import type { JournalCharacter } from "../../client/campaign/journal";
import { sourceOf } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const SPELL = "test.d341.spell.circle";

const MODULE = {
  moduleId: "test.d341", moduleVersion: "1",
  content: [
    {
      id: `effect.spell.${SPELL}`, category: "option",
      presentation: { originalName: "Circle", defaultLocale: "ko-KR", locales: { "ko-KR": { name: "보호의 원", description: "원 안에서는 내성에 이점" } } },
      mechanics: [{ kind: "common-play", config: { id: `spell:${SPELL}`, entryPoints: [
        { id: "while-inside", invocation: "manual", operations: [
          { kind: "property.modify", property: "saving-throw.advantage", operation: "add", note: "원 안에 있는 동안" },
        ] },
      ] } }],
    },
    {
      id: SPELL, category: "spell",
      presentation: { originalName: "Circle", defaultLocale: "ko-KR", locales: { "ko-KR": { name: "보호의 원", description: "반경 30피트 오라" } } },
      mechanics: [
        { kind: "spell-definition", config: { level: 5, school: "abjuration", castingTimeText: "행동", rangeText: "자신 (30피트 반경)", durationText: "집중, 최대 10분", classes: ["dnd.srd521.class.cleric"] } },
        { kind: "spell-mechanic", config: {
          baseLevel: 5, castingEconomy: "action", concentration: true,
          targeting: { kind: "self", rangeFeet: 0, minTargets: 1, maxTargets: 1 },
          primary: { kind: "tracked-effect", summary: "오라 안에서는 내성에 이점", duration: { kind: "concentration" } },
          sustain: { economy: "none", zone: true },
        } },
      ],
    },
  ],
} as unknown as RuleModuleJson;

const inside = (): ActiveEffect => ({ key: `zone:caster-1:${SPELL}`, name: "보호의 원 안", source: "spell", duration: "구역", concentration: false, elapsed: 0, startedAt: "", from: "caster-1" });

test("D341: a zone membership key reads the spell's own contract", () => {
  const cat = createCatalog([MODULE]);
  assert.equal(effectRuleKey(inside(), cat), `spell:${SPELL}`);
});

test("D341: standing in the zone changes the sheet, and the card says what it did", () => {
  const cat = createCatalog([MODULE]);
  const made = autofill(sourceOf({ name: "전사", classes: "fighter", level: 5, abilities: { str: 16 } }), cat);
  assert.equal(made.derived.rollAdvantage?.some((item) => item.families?.includes("saving-throw")) ?? false, false, "nothing before");
  const after = applyActiveEffects(made.derived, [inside()], cat, { list: true });
  assert.ok(after.rollAdvantage?.some((item) => item.families?.includes("saving-throw")), JSON.stringify(after.rollAdvantage));
  const card = after.activeEffects.find((item) => item.name === "보호의 원 안")!;
  assert.equal(card.applied, true, card.notes.join(" · "));
});

test("D341: at the table, stepping in and out puts it on and takes it off", async () => {
  const cat = createCatalog([MODULE]);
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("D341 시험", { userId: "dm", displayName: "DM" }), joinCode: "D341AA" };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => 0.5, ...pcHostOptions(() => cat) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "D341AA", hostSecret: "s" });
  const alice = new TableClient(hub.connect("p1"), { userId: "alice", displayName: "앨리스", joinCode: "D341AA", seat: "a" });
  await tick();
  const scene = newScene(campaign.id, "성소", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const caster = autofill(sourceOf({ name: "클레릭", classes: "cleric", level: 9, abilities: { wis: 16 } }), cat);
  const walker = autofill(sourceOf({ name: "전사", classes: "fighter", level: 5, abilities: { str: 16 } }), cat);
  const casterEntry = newJournalCharacter(campaign.id, "alice", caster.source, initialRuntime(caster.derived), { owner: "alice" });
  const walkerEntry = newJournalCharacter(campaign.id, "alice", walker.source, initialRuntime(walker.derived), { owner: "alice" });
  // The caster is already concentrating on the circle: the effect on their own sheet is what the zone hangs from.
  const running = { ...casterEntry, runtime: { ...casterEntry.runtime, effects: [{ key: `spell:${SPELL}`, name: "보호의 원", source: "spell" as const, duration: "10분", concentration: true, elapsed: 0, startedAt: "" }] } };
  alice.send({ type: "journal.put", entry: running });
  alice.send({ type: "journal.put", entry: walkerEntry });
  await tick();
  const tokens = { caster: tokenForCharacter(running), walker: tokenForCharacter(walkerEntry) };
  for (const token of Object.values(tokens)) alice.send({ type: "token.put", pageId: scene.id, token });
  await tick();
  const walkerRef = { entryId: walkerEntry.id, pageId: scene.id, tokenId: tokens.walker.id };
  const effectsOf = () => ((host.journal.find((entry) => entry.id === walkerEntry.id) as JournalCharacter).runtime.effects ?? []).map((effect) => effect.key);
  alice.send({ type: "act.zone", casterEntryId: running.id, spellId: SPELL, target: walkerRef, action: "enter" });
  await tick();
  assert.ok(effectsOf().includes(`zone:${running.id}:${SPELL}`), `in the circle: ${effectsOf().join(", ")}`);
  alice.send({ type: "act.zone", casterEntryId: running.id, spellId: SPELL, target: walkerRef, action: "leave" });
  await tick();
  assert.equal(effectsOf().includes(`zone:${running.id}:${SPELL}`), false, `and out of it again: ${effectsOf().join(", ")}`);
});
