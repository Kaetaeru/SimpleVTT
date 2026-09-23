/**
 * V0.9 D361 (ITEM_GRAMMAR_V2_PLAN.md IG-5): a spell scroll is an item of the grammar, not a special path.
 *
 * `spellChoice` says which spells an item may hold (the giver picks one), `use.castChosen` how it is read: its own save
 * DC and attack bonus, only by a class whose list has the spell, gone once cast, and an ability check (the DC base +
 * the spell's level) when the spell is above what the reader can cast. The SRD's ten 주문 두루마리 are written this
 * way in content; the older R19 scroll ids are still read.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalCharacter, newJournalNpc } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter, tokenForNpc } from "../../client/campaign/page";
import { createCatalog } from "../../client/catalog";
import { autofill } from "../../client/character/autofill";
import { officialMagicItem, spellChoices } from "../../client/character/customItem";
import { addItem } from "../../client/character/play";
import { initialRuntime } from "../../client/character/runtime";
import type { CharacterRuntime } from "../../client/character/runtime";
import { parseCustomMonster } from "../../client/compendium/customMonster";
import { derivedOf } from "../../client/rules/attackSpec";
import { pcSpell } from "../../client/rules/spellcast";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { pcHostOptions } from "../../client/session/pcHost";
import { MemoryHub } from "../../client/session/transport";
import type { JournalCharacter } from "../../client/campaign/journal";
import { sourceOf } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const SCROLL = "dnd.srd521.magic-item.spell-scroll-3rd-level";
const FIREBALL = "dnd.srd521.spell.fireball";

function reader(classes: string, level = 5) {
  const cat = createCatalog([]);
  const made = autofill(sourceOf({ name: "독자", classes, level, background: "sage", abilities: { int: 16 } }), cat);
  const derive = (runtime: CharacterRuntime) => derivedOf({ source: made.source, runtime } as never, cat);
  const view = cat.itemById(SCROLL)!;
  const runtime = addItem(initialRuntime(made.derived), { itemId: SCROLL, name: `${view.name} (화염구)`, spell: FIREBALL });
  const scroll = derive(runtime).inventory.find((item) => item.officialId === SCROLL)!;
  return { cat, made, derive, runtime, scroll };
}

test("D361: the 3rd-level scroll holds any 3rd-level spell, and carries the one it was given", () => {
  const { cat, scroll } = reader("wizard");
  const definition = officialMagicItem("x", cat.itemById(SCROLL)!.magic!, cat)!;
  const options = spellChoices(cat, definition.spellChoice!);
  assert.ok(options.length > 5 && options.every((spell) => spell.level === 3));
  assert.ok(options.some((spell) => spell.id === FIREBALL));
  assert.equal(scroll.chosenSpell, FIREBALL);
  assert.ok(scroll.name.includes("화염구"));
});

test("D361: a wizard reads it at the scroll's DC 15, and it is gone; a fighter cannot read it", () => {
  const wizard = reader("wizard");
  const cast = pcSpell({ runtime: wizard.runtime }, wizard.derive(wizard.runtime), wizard.cat, FIREBALL, { kind: "scroll", instanceId: wizard.scroll.instanceId })!;
  assert.ok(cast);
  assert.equal(cast.casterStats.saveDc, 15);
  const after = cast.spend(wizard.runtime)!;
  assert.equal(wizard.derive(after).inventory.find((item) => item.instanceId === wizard.scroll.instanceId)?.quantity ?? 0, 0);
  assert.deepEqual(after.slotsUsed, wizard.runtime.slotsUsed, "no slot");
  const fighter = reader("fighter");
  assert.equal(pcSpell({ runtime: fighter.runtime }, fighter.derive(fighter.runtime), fighter.cat, FIREBALL, { kind: "scroll", instanceId: fighter.scroll.instanceId }), null, "not on a fighter's list");
});

test("D361: at the table the scroll's fireball goes off and the scroll is used up", async () => {
  const { cat, made, runtime, scroll } = reader("wizard");
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("D361 시험", { userId: "dm", displayName: "DM" }), joinCode: "D361AA" };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => 0.5, ...pcHostOptions(() => cat) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "D361AA", hostSecret: "s" });
  await tick();
  const scene = newScene(campaign.id, "들판", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const pc = newJournalCharacter(campaign.id, "dm", made.source, runtime);
  const npc = newJournalNpc(campaign.id, "dm", (parseCustomMonster(JSON.stringify({ name: "허수아비", ac: 5, hp: 100, creatureType: "construct", abilities: { str: 10, dex: 1, con: 14, int: 1, wis: 6, cha: 1 } })) as { monster: Parameters<typeof newJournalNpc>[2] }).monster);
  for (const entry of [pc, npc]) dm.send({ type: "journal.put", entry });
  await tick();
  const tokens = { pc: tokenForCharacter(pc), npc: tokenForNpc(npc) };
  for (const token of Object.values(tokens)) dm.send({ type: "token.put", pageId: scene.id, token });
  await tick();
  dm.send({ type: "act.cast", caster: { entryId: pc.id, pageId: scene.id, tokenId: tokens.pc.id }, spellId: FIREBALL, targets: [{ entryId: npc.id, pageId: scene.id, tokenId: tokens.npc.id }], method: { kind: "scroll", instanceId: scroll.instanceId } });
  await tick();
  const live = host.journal.find((entry) => entry.id === pc.id) as JournalCharacter;
  assert.equal(derivedOf(live, cat).inventory.find((item) => item.instanceId === scroll.instanceId)?.quantity ?? 0, 0, JSON.stringify(host.archive.slice(-2).map((message) => message.content)));
  const bar = host.pageList.flatMap((page) => page.tokens).find((token) => token.id === tokens.npc.id)?.bars[0]?.value;
  assert.ok((bar ?? 100) < 100, "the fireball landed");
});
