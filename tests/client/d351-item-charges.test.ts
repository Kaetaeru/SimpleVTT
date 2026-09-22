/**
 * V0.9 D351 (MAGIC_ITEMS_PLAN.md MI-2): charges, and the spells an item casts from them.
 *
 * Wands, staves and many rings hold charges, spend them on the spells they cast — each spell at its own cost, with
 * the item's own save DC when it has one — and get some back at dawn by a roll. A magic item's definition may now
 * say so (`charges`, `spells`); the charges are a pool on the sheet, the spells are offered while the item works,
 * the cast pays its cost from the pool, and a long rest (dawn, here) rolls the charges back instead of refilling.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalCharacter, newJournalNpc } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter, tokenForNpc } from "../../client/campaign/page";
import { createCatalog } from "../../client/catalog";
import type { RuleModuleJson } from "../../client/catalog/types";
import { autofill } from "../../client/character/autofill";
import { addItem, longRest, toggleAttune } from "../../client/character/play";
import { initialRuntime } from "../../client/character/runtime";
import type { CharacterRuntime } from "../../client/character/runtime";
import { parseCustomMonster } from "../../client/compendium/customMonster";
import { derivedOf } from "../../client/rules/attackSpec";
import { castableSpells, pcSpell } from "../../client/rules/spellcast";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { pcHostOptions } from "../../client/session/pcHost";
import { MemoryHub } from "../../client/session/transport";
import type { JournalCharacter } from "../../client/campaign/journal";
import { sourceOf } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const STAFF = "test.d351.magic.storm-staff";
const BOLT = "dnd.srd521.spell.lightning-bolt";
const MISSILE = "dnd.srd521.spell.magic-missile";

const MODULE = { moduleId: "test.d351", moduleVersion: "1", content: [{
  id: STAFF, category: "magic-item",
  presentation: { originalName: "Storm Staff", defaultLocale: "ko-KR", locales: { "ko-KR": { name: "폭풍의 지팡이", description: "충전으로 주문을 쏜다" } } },
  mechanics: [{ kind: "magic-item-definition", config: {
    type: "staff", rarity: "rare", attunement: true,
    charges: { max: 10, recharge: "1d6+4", note: "마지막 충전을 쓰면 d20을 굴린다 — 1이면 부서진다" },
    spells: [{ spellId: BOLT, charges: 3, dc: 15, level: 3 }, { spellId: MISSILE, charges: 1 }],
  } }],
}] } as unknown as RuleModuleJson;

function carrier() {
  const cat = createCatalog([MODULE]);
  const made = autofill(sourceOf({ name: "용병", classes: "fighter", level: 5, abilities: { str: 16 } }), cat);
  const derive = (runtime: CharacterRuntime) => derivedOf({ source: made.source, runtime } as never, cat);
  const runtime = addItem(initialRuntime(made.derived), { itemId: STAFF, name: "폭풍의 지팡이" });
  const staff = derive(runtime).inventory.find((item) => item.name === "폭풍의 지팡이")!;
  const attune = (value: CharacterRuntime) => toggleAttune(value, staff.instanceId, 3, staff.magic);
  return { cat, made, derive, runtime, staff, attune, pool: `resource.item.${staff.instanceId}` };
}

test("D351: the charges are a pool on the sheet, and the spells wait for the item to work", () => {
  const { derive, runtime, attune, pool } = carrier();
  const unattuned = derive(runtime);
  assert.equal(unattuned.resources.find((item) => item.id === pool)?.max, 10, "the pool is there either way");
  assert.equal(castableSpells(unattuned).includes(BOLT), false, "a fighter who is not attuned cannot use its spells");
  const attuned = derive(attune(runtime));
  assert.ok(castableSpells(attuned).includes(BOLT), "attuned: the staff's spells, though the fighter knows none");
  assert.ok(castableSpells(attuned).includes(MISSILE));
});

test("D351: casting from it uses the item's numbers and costs what that spell costs", () => {
  const { cat, derive, runtime, attune, pool } = carrier();
  const live = attune(runtime);
  const derived = derive(live);
  const cast = pcSpell({ runtime: live }, derived, cat, BOLT, { kind: "resource", id: pool });
  assert.ok(cast, "the cast is allowed");
  assert.equal(cast!.casterStats.saveDc, 15, "DC 15 is the staff's, not the fighter's");
  assert.equal(cast!.spec.level, 3);
  const spent = cast!.spend(live)!;
  assert.equal(spent.resourcesUsed[pool], 3, "three charges");
  const missile = pcSpell({ runtime: spent }, derive(spent), cat, MISSILE, { kind: "resource", id: pool })!.spend(spent)!;
  assert.equal(missile.resourcesUsed[pool], 4, "and one for the cheap spell");
  const drained = { ...missile, resourcesUsed: { ...missile.resourcesUsed, [pool]: 9 } };
  assert.equal(pcSpell({ runtime: drained }, derive(drained), cat, BOLT, { kind: "resource", id: pool })!.spend(drained), null, "one charge left cannot pay for three");
});

test("D351: dawn gives back what the dice say, not everything", () => {
  const { derive, runtime, attune, pool } = carrier();
  const live = { ...attune(runtime), resourcesUsed: { [pool]: 10 } };
  const rested = longRest(live, derive(live), () => 2);
  assert.equal(rested.resourcesUsed[pool], 10 - (2 + 4), "1d6+4 with a 2: six back, four still spent");
});

test("D351: at the table the cast spends the charges, not a slot", async () => {
  const { cat, made, runtime, attune, pool } = carrier();
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("D351 시험", { userId: "dm", displayName: "DM" }), joinCode: "D351AA" };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => 0.5, ...pcHostOptions(() => cat) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "D351AA", hostSecret: "s" });
  await tick();
  const scene = newScene(campaign.id, "들판", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const pc = newJournalCharacter(campaign.id, "dm", made.source, attune(runtime));
  const monster = (parseCustomMonster(JSON.stringify({ name: "허수아비", ac: 5, hp: 60, creatureType: "construct", abilities: { str: 10, dex: 6, con: 14, int: 1, wis: 6, cha: 1 } })) as { monster: Parameters<typeof newJournalNpc>[2] }).monster;
  const npc = newJournalNpc(campaign.id, "dm", monster);
  for (const entry of [pc, npc]) dm.send({ type: "journal.put", entry });
  await tick();
  const tokens = { pc: tokenForCharacter(pc), npc: tokenForNpc(npc) };
  for (const token of Object.values(tokens)) dm.send({ type: "token.put", pageId: scene.id, token });
  await tick();
  dm.send({ type: "act.cast", caster: { entryId: pc.id, pageId: scene.id, tokenId: tokens.pc.id }, spellId: MISSILE, targets: [{ entryId: npc.id, pageId: scene.id, tokenId: tokens.npc.id }], method: { kind: "resource", id: pool } });
  await tick();
  const sheet = host.journal.find((entry) => entry.id === pc.id) as JournalCharacter;
  assert.equal(sheet.runtime.resourcesUsed[pool], 1, JSON.stringify(host.archive.slice(-2).map((message) => message.content)));
  assert.deepEqual(sheet.runtime.slotsUsed, {}, "no slot was touched");
});
