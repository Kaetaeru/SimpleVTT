/**
 * V0.9 D345 (SRD_MODULE_PLAN.md §36): a spell in play may have its own button.
 *
 * 타샤의 보글거리는 가마솥 summons a cauldron and lets anyone reach in for a bottle. Nothing about that is a
 * character feature — the button belongs to the spell while it lasts. The sheet only ever read its buttons from
 * the character's features, so such a spell had no way to hand anything out and stayed a line for the DM.
 *
 * The labelled uses of a running effect's contract are now buttons too, keyed `<effect rule key>#<use>`, which the
 * catalog and the host already resolve. Nothing about the contract grammar changed.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalCharacter } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter } from "../../client/campaign/page";
import { createCatalog } from "../../client/catalog";
import type { RuleModuleJson } from "../../client/catalog/types";
import { usableFeatures } from "../../client/character/activate";
import { autofill } from "../../client/character/autofill";
import { initialRuntime } from "../../client/character/runtime";
import type { ActiveEffect } from "../../client/character/types";
import { tableOutcome } from "../../client/rules/contractTable";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { pcHostOptions } from "../../client/session/pcHost";
import { MemoryHub } from "../../client/session/transport";
import type { JournalCharacter } from "../../client/campaign/journal";
import { sourceOf } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const SPELL = "test.d345.spell.cauldron";
const POTION = "dnd.srd521.item.gear.potion-of-healing";

const MODULE = {
  moduleId: "test.d345", moduleVersion: "1",
  content: [
    {
      id: `effect.spell.${SPELL}`, category: "option",
      presentation: { originalName: "Cauldron", defaultLocale: "ko-KR", locales: { "ko-KR": { name: "가마솥", description: "손을 넣어 물약을 꺼낸다" } } },
      mechanics: [{ kind: "common-play", config: { id: `spell:${SPELL}`, entryPoints: [
        { id: "draw", invocation: "manual", label: "물약 한 병 꺼내기", payments: [{ kind: "economy", bucket: "bonus-action", amount: { value: 1 }, consumeAt: "commit" }], targeting: { from: "targets", min: 1, max: 1 }, operations: [
          { kind: "content.grant", contentId: POTION, target: "targets" },
          { kind: "adjudication.request", question: "마지막 병을 꺼내면 가마솥이 사라진다 — 효과를 끝내 주세요" },
        ] },
      ] } }],
    },
  ],
} as unknown as RuleModuleJson;

const cauldron = (): ActiveEffect => ({ key: `spell:${SPELL}`, name: "가마솥", source: "spell", duration: "10분", concentration: false, rounds: 100, elapsed: 0, startedAt: "" });

test("D345: the running spell's labelled use is a button, and only while it runs", () => {
  const cat = createCatalog([MODULE]);
  const made = autofill(sourceOf({ name: "위저드", classes: "wizard", level: 11, abilities: { int: 16 } }), cat);
  const plain = initialRuntime(made.derived);
  assert.equal(usableFeatures(made.derived, plain, cat).some((item) => item.feature.name === "물약 한 병 꺼내기"), false, "no cauldron, no button");
  const withSpell = { ...plain, effects: [cauldron()] };
  const button = usableFeatures(made.derived, withSpell, cat).find((item) => item.feature.name === "물약 한 병 꺼내기");
  assert.ok(button, JSON.stringify(usableFeatures(made.derived, withSpell, cat).map((item) => item.feature.name)));
  assert.equal(button!.feature.id, `spell:${SPELL}#draw`);
  assert.equal(button!.feature.source, "spell", "the sheet says the button belongs to a spell");
  assert.equal(button!.bonus, true, "and that it costs a bonus action");
  assert.equal(button!.pressable, true);
});

test("D345: pressing it hands over what the contract grants", () => {
  const cat = createCatalog([MODULE]);
  const made = autofill(sourceOf({ name: "위저드", classes: "wizard", level: 11, abilities: { int: 16 } }), cat);
  const outcome = tableOutcome(made.derived, cat, `spell:${SPELL}#draw`);
  assert.deepEqual(outcome?.party.grants, [POTION], JSON.stringify(outcome?.party));
});

test("D345: at the table the potion lands in the chosen creature's bag", async () => {
  const cat = createCatalog([MODULE]);
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("D345 시험", { userId: "dm", displayName: "DM" }), joinCode: "D345AA" };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => 0.5, ...pcHostOptions(() => cat) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "D345AA", hostSecret: "s" });
  const alice = new TableClient(hub.connect("p1"), { userId: "alice", displayName: "앨리스", joinCode: "D345AA", seat: "a" });
  await tick();
  const scene = newScene(campaign.id, "주방", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const made = autofill(sourceOf({ name: "위저드", classes: "wizard", level: 11, abilities: { int: 16 } }), cat);
  const base = initialRuntime(made.derived);
  const pc = newJournalCharacter(campaign.id, "alice", made.source, { ...base, effects: [cauldron()] }, { owner: "alice" });
  alice.send({ type: "journal.put", entry: pc });
  await tick();
  const token = tokenForCharacter(pc);
  alice.send({ type: "token.put", pageId: scene.id, token });
  await tick();
  const ref = { entryId: pc.id, pageId: scene.id, tokenId: token.id };
  alice.send({ type: "act.contract", actor: ref, ruleKey: `spell:${SPELL}#draw`, targets: [ref] });
  await tick();
  const bag = (host.journal.find((entry) => entry.id === pc.id) as JournalCharacter).runtime.inventory.extra;
  assert.deepEqual(bag.map((item) => item.itemId), [POTION], JSON.stringify(bag));
});
