/**
 * V0.9 D359 (ITEM_GRAMMAR_V2_PLAN.md IG-3): an item's damage that waits for a condition, and items that work in hand.
 *
 * `bonus.extraDamage` may be a list, and each part a `when`: `targetTypes` (only against undead, fiends …) or
 * `effect` (only while an effect of that name runs — a blade that has to be lit). `worksWhen: "held"` makes an item
 * work only in a hand slot. The table checks the target's creature type when the hit lands, as it does for a smite.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalCharacter, newJournalNpc } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter, tokenForNpc } from "../../client/campaign/page";
import { createCatalog } from "../../client/catalog";
import { autofill } from "../../client/character/autofill";
import { parseCustomItem } from "../../client/character/customItem";
import { addItem, toggleAttune } from "../../client/character/play";
import { initialRuntime } from "../../client/character/runtime";
import type { CharacterRuntime } from "../../client/character/runtime";
import { parseCustomMonster } from "../../client/compendium/customMonster";
import { derivedOf, pcAttackSpec, versusParts } from "../../client/rules/attackSpec";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { pcHostOptions } from "../../client/session/pcHost";
import { MemoryHub } from "../../client/session/transport";
import type { JournalNpc } from "../../client/campaign/journal";
import { sourceOf } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const BLADE = { name: "새벽 칼날", type: "weapon", rarity: "rare", base: "longsword", bonus: { attack: 1, damage: 1, extraDamage: [
  { dice: "2d6", type: "radiant", when: { targetTypes: ["Undead", "fiend"] } },
  { dice: "1d6", type: "fire", when: { effect: "불꽃" } },
] } };
const STAFF = { name: "수호 지팡이", type: "staff", rarity: "rare", attunement: true, worksWhen: "held", bonus: { ac: 2 } };

function knight() {
  const cat = createCatalog([]);
  const made = autofill(sourceOf({ name: "성기사", classes: "fighter", level: 5, background: "sage", abilities: { str: 16 } }), cat);
  const derive = (runtime: CharacterRuntime) => derivedOf({ source: made.source, runtime } as never, cat);
  const item = (json: object) => { const read = parseCustomItem(JSON.stringify(json), cat); if ("error" in read) throw new Error(read.error); assert.deepEqual(read.warnings, []); return read.item; };
  return { cat, made, derive, item, start: initialRuntime(made.derived) };
}

test("D359: the radiant part lands only on undead and fiends, the fire part only while lit", () => {
  const { made, derive, item, start } = knight();
  const runtime = addItem(start, { name: BLADE.name, custom: item(BLADE) });
  const cold = derive(runtime);
  const row = cold.attacks.find((attack) => attack.name === BLADE.name)!;
  assert.deepEqual(row.extraDamage?.map((part) => [part.formula, part.versus]), [["2d6", ["undead", "fiend"]]], "unlit: no fire");
  const spec = pcAttackSpec({ source: made.source, runtime } as never, cold, row.id)!.spec;
  assert.equal(versusParts(spec, "undead").length, 1);
  assert.equal(versusParts(spec, "construct").length, 0);
  assert.ok(!(spec.riders ?? []).some((part) => part.formula === "2d6"), "not on every hit");
  const lit = derive({ ...runtime, effects: [{ key: "feature:x#light", name: "불꽃", source: "feature", duration: "10분", concentration: false, elapsed: 0, startedAt: "" }] });
  assert.ok(lit.attacks.find((attack) => attack.name === BLADE.name)!.extraDamage?.some((part) => part.formula === "1d6"), "lit: 1d6 fire");
});

test("D359: a staff that works in hand adds its AC only while held", () => {
  const { derive, item, start } = knight();
  let runtime = addItem(start, { name: STAFF.name, custom: item(STAFF) });
  const staff = derive(runtime).inventory.find((line) => line.name === STAFF.name)!;
  runtime = toggleAttune(runtime, staff.instanceId, 3, staff.magic);
  const base = derive(start).ac.value;
  assert.equal(derive(runtime).ac.value, base, "carried, not held");
  assert.equal(derive({ ...runtime, equipped: { ...runtime.equipped, offHand: staff.instanceId } }).ac.value, base + 2, "held");
});

test("D359: at the table the undead takes the radiant dice and the construct does not", async () => {
  const { cat, made, item, start } = knight();
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("D359 시험", { userId: "dm", displayName: "DM" }), joinCode: "D359AA" };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => 0.99, ...pcHostOptions(() => cat) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "D359AA", hostSecret: "s" });
  await tick();
  const scene = newScene(campaign.id, "묘지", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const runtime = addItem(start, { name: BLADE.name, custom: item(BLADE) });
  const pc = newJournalCharacter(campaign.id, "dm", made.source, runtime);
  const foe = (name: string, creatureType: string) => newJournalNpc(campaign.id, "dm", (parseCustomMonster(JSON.stringify({ name, ac: 5, hp: 200, creatureType, abilities: { str: 10, dex: 1, con: 14, int: 1, wis: 6, cha: 1 } })) as { monster: Parameters<typeof newJournalNpc>[2] }).monster);
  const ghoul = foe("구울", "undead");
  const golem = foe("골렘", "construct");
  for (const entry of [pc, ghoul, golem]) dm.send({ type: "journal.put", entry });
  await tick();
  const tokens = { pc: tokenForCharacter(pc), ghoul: tokenForNpc(ghoul), golem: tokenForNpc(golem) };
  for (const token of Object.values(tokens)) dm.send({ type: "token.put", pageId: scene.id, token });
  await tick();
  const attackId = derivedOf(pc, cat).attacks.find((attack) => attack.name === BLADE.name)!.id;
  const me = { entryId: pc.id, pageId: scene.id, tokenId: tokens.pc.id };
  const hpOf = (key: "ghoul" | "golem", entry: JournalNpc) => host.pageList.flatMap((page) => page.tokens).find((token) => token.id === tokens[key].id)?.bars[0]?.value ?? (host.journal.find((line) => line.id === entry.id) as JournalNpc).runtime.hp.current;
  for (const [key, entry] of [["ghoul", ghoul], ["golem", golem]] as const) {
    dm.send({ type: "act.attack", attacker: me, targets: [{ entryId: entry.id, pageId: scene.id, tokenId: tokens[key].id }], attack: { source: "weapon", attackId } });
    await tick();
  }
  const lostGhoul = 200 - hpOf("ghoul", ghoul);
  const lostGolem = 200 - hpOf("golem", golem);
  assert.ok(lostGolem > 0, JSON.stringify(host.archive.slice(-2).map((message) => message.content)));
  assert.ok(lostGhoul > lostGolem, `undead ${lostGhoul} vs construct ${lostGolem}`);
});
