/**
 * V0.9 D356 (MAGIC_ITEMS_PLAN.md, owner's answers): raises with a ceiling, a weapon's own damage type, and casting
 * higher for extra charges.
 *
 * - `abilityBonuses`: a score rises by N up to a maximum while the item works (건강의 아이운 스톤: +2, 최대 20), and a
 *   score already above the maximum stays where it is.
 * - `use.effect.permanent`: a reading that never ends (교본: +2, 최대 30), added again by a second book.
 * - `damageType`: the item's weapon deals its own type (태양검: 광휘).
 * - `spells[].perLevel` / `maxLevel`: each extra charge raises the spell a level (화염구의 마법봉: 최대 6레벨).
 * The SRD entries are used as shipped, through the host where play goes through it.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalCharacter, newJournalNpc } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter, tokenForNpc } from "../../client/campaign/page";
import { createCatalog } from "../../client/catalog";
import { autofill } from "../../client/character/autofill";
import { addItem, toggleAttune } from "../../client/character/play";
import { initialRuntime } from "../../client/character/runtime";
import type { CharacterRuntime } from "../../client/character/runtime";
import { parseCustomMonster } from "../../client/compendium/customMonster";
import { derivedOf } from "../../client/rules/attackSpec";
import { pcSpell } from "../../client/rules/spellcast";
import { castOptions } from "../../client/screens/SheetView";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { pcHostOptions } from "../../client/session/pcHost";
import { MemoryHub } from "../../client/session/transport";
import type { JournalCharacter } from "../../client/campaign/journal";
import { sourceOf } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const ID = (slug: string) => `dnd.srd521.magic-item.${slug}`;
const FIREBALL = "dnd.srd521.spell.fireball";

function hero(con = 14) {
  const cat = createCatalog([]);
  const made = autofill(sourceOf({ name: "모험가", classes: "fighter", level: 5, abilities: { str: 16, con } }), cat);
  const derive = (runtime: CharacterRuntime) => derivedOf({ source: made.source, runtime } as never, cat);
  const carry = (runtime: CharacterRuntime, slug: string) => {
    const view = cat.itemById(ID(slug))!;
    const next = addItem(runtime, { itemId: view.id, name: view.name });
    const item = derive(next).inventory.find((line) => line.officialId === view.id)!;
    return item.magic?.attunement ? toggleAttune(next, item.instanceId, 3, item.magic) : next;
  };
  return { cat, made, derive, carry, start: initialRuntime(made.derived) };
}

test("D356: 건강의 아이운 스톤 raises Constitution by 2 up to 20, and leaves a higher score alone", () => {
  const low = hero(14);
  const before = low.derive(low.start).abilities.con.score;
  assert.equal(low.derive(low.carry(low.start, "ioun-stone-of-fortitude")).abilities.con.score, Math.min(20, before + 2));
  const high = hero(20);
  const top = high.derive(high.start).abilities.con.score;
  assert.equal(high.derive(high.carry(high.start, "ioun-stone-of-fortitude")).abilities.con.score, top, "already at or past 20");
});

test("D356: 태양검 cuts with radiant light", () => {
  const { derive, carry, start } = hero();
  const sheet = derive(carry(start, "sun-blade"));
  const row = sheet.attacks.find((attack) => attack.name.includes("태양검"))!;
  assert.equal(row.damageType, "광휘");
});

test("D356: 화염구의 마법봉 offers each higher level for its extra charges", () => {
  const { derive, carry, start } = hero();
  const live = carry(start, "wand-of-fireballs");
  const sheet = derive(live);
  const labels = castOptions({ id: FIREBALL, level: 3 } as never, sheet, live).map((option) => option.label);
  assert.ok(labels.some((label) => label.includes("6레벨 · 4회")), JSON.stringify(labels));
  assert.ok(!labels.some((label) => label.includes("7레벨")), "not above 6");
});

test("D356: at the table the wand casts fireball at 5th level for three charges, and a manual raises Strength for good", async () => {
  const { cat, made, derive, carry, start } = hero();
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("D356 시험", { userId: "dm", displayName: "DM" }), joinCode: "D356AA" };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => 0.5, ...pcHostOptions(() => cat) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "D356AA", hostSecret: "s" });
  await tick();
  const scene = newScene(campaign.id, "들판", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  let runtime = carry(start, "wand-of-fireballs");
  runtime = addItem(runtime, { itemId: ID("manual-of-gainful-exercise"), name: cat.itemById(ID("manual-of-gainful-exercise"))!.name });
  runtime = addItem(runtime, { itemId: ID("manual-of-gainful-exercise"), name: cat.itemById(ID("manual-of-gainful-exercise"))!.name });
  const strength = derive(runtime).abilities.str.score;
  const pc = newJournalCharacter(campaign.id, "dm", made.source, runtime);
  const monster = (parseCustomMonster(JSON.stringify({ name: "허수아비", ac: 5, hp: 200, creatureType: "construct", abilities: { str: 10, dex: 1, con: 14, int: 1, wis: 6, cha: 1 } })) as { monster: Parameters<typeof newJournalNpc>[2] }).monster;
  const npc = newJournalNpc(campaign.id, "dm", monster);
  for (const entry of [pc, npc]) dm.send({ type: "journal.put", entry });
  await tick();
  const tokens = { pc: tokenForCharacter(pc), npc: tokenForNpc(npc) };
  for (const token of Object.values(tokens)) dm.send({ type: "token.put", pageId: scene.id, token });
  await tick();
  const live = () => host.journal.find((entry) => entry.id === pc.id) as JournalCharacter;
  const pool = `resource.${ID("wand-of-fireballs")}`;
  const ref = { entryId: pc.id, pageId: scene.id, tokenId: tokens.pc.id };
  const planned = pcSpell({ runtime: live().runtime }, derive(live().runtime), cat, FIREBALL, { kind: "resource", id: pool, level: 5 })!;
  assert.equal(planned.spec.level, 5);
  dm.send({ type: "act.cast", caster: ref, spellId: FIREBALL, targets: [{ entryId: npc.id, pageId: scene.id, tokenId: tokens.npc.id }], method: { kind: "resource", id: pool, level: 5 } });
  await tick();
  assert.equal(live().runtime.resourcesUsed[pool], 3, "one charge and two more for two levels up");
  for (const _ of [1, 2]) {
    const book = derive(live().runtime).inventory.find((line) => line.officialId === ID("manual-of-gainful-exercise") && line.quantity > 0)!;
    dm.send({ type: "act.item", actor: ref, target: ref, instanceId: book.instanceId });
    await tick();
  }
  assert.equal(derive(live().runtime).abilities.str.score, strength + 4, "two books, two raises");
  assert.ok((live().runtime.effects ?? []).every((effect) => effect.rounds === undefined), "they never run out");
});
