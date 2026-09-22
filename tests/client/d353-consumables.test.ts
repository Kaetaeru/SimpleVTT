/**
 * V0.9 D353 (MAGIC_ITEMS_PLAN.md MI-4): potions that do more than heal, and magic ammunition.
 *
 * A potion's `use` may give temporary hit points, start an effect carrying the same fields a magic item does (근력
 * 21 for an hour), or put the drinker under a spell without concentration (속도의 물약: 가속). Drinking goes through
 * the host like a healing potion: the drinker is picked, the effect lands on them, and one potion leaves the bag.
 * Magic ammunition is a row for each weapon that shoots it, with its bonus on that row only.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalCharacter } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter } from "../../client/campaign/page";
import { createCatalog } from "../../client/catalog";
import type { RuleModuleJson } from "../../client/catalog/types";
import { autofill } from "../../client/character/autofill";
import { addItem } from "../../client/character/play";
import { initialRuntime } from "../../client/character/runtime";
import type { CharacterRuntime } from "../../client/character/runtime";
import { derivedOf } from "../../client/rules/attackSpec";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { pcHostOptions } from "../../client/session/pcHost";
import { MemoryHub } from "../../client/session/transport";
import type { JournalCharacter } from "../../client/campaign/journal";
import { sourceOf } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const GIANT = "test.d353.magic.giant-draught";
const SPEED = "test.d353.magic.quick-draught";
const HERO = "test.d353.magic.brave-draught";
const ARROWS = "test.d353.magic.keen-arrows";

const entry = (id: string, name: string, definition: Record<string, unknown>) => ({
  id, category: "magic-item",
  presentation: { originalName: name, defaultLocale: "ko-KR", locales: { "ko-KR": { name, description: `${name} 설명` } } },
  mechanics: [{ kind: "magic-item-definition", config: definition }],
});

const MODULE = { moduleId: "test.d353", moduleVersion: "1", content: [
  entry(GIANT, "거인 물약", { type: "potion", rarity: "rare", use: { effect: { name: "거인의 힘", duration: "1시간", grants: { abilities: { str: 21 }, resistances: ["cold"] } } } }),
  entry(SPEED, "재빠름 물약", { type: "potion", rarity: "very-rare", use: { spell: { spellId: "dnd.srd521.spell.haste", duration: "1분" } } }),
  entry(HERO, "용기 물약", { type: "potion", rarity: "rare", use: { tempHp: "10" } }),
  entry(ARROWS, "날카로운 화살 +1", { type: "ammunition", rarity: "uncommon", base: "dnd.srd521.item.ammunition.arrows", bonus: { attack: 1, damage: 1 } }),
] } as unknown as RuleModuleJson;

function archer() {
  const cat = createCatalog([MODULE]);
  const made = autofill(sourceOf({ name: "궁수", classes: "fighter", level: 3, abilities: { dex: 16 } }), cat);
  const derive = (runtime: CharacterRuntime) => derivedOf({ source: made.source, runtime } as never, cat);
  return { cat, made, derive };
}

test("D353: magic arrows are a row per bow, one better, and nowhere else", () => {
  const { made, derive } = archer();
  let runtime = addItem(initialRuntime(made.derived), { itemId: "dnd.srd521.item.weapon.longbow", name: "장궁" });
  runtime = addItem(runtime, { itemId: ARROWS, name: "날카로운 화살 +1" });
  const sheet = derive(runtime);
  const plain = sheet.attacks.find((attack) => attack.name === "장궁")!;
  const magic = sheet.attacks.find((attack) => attack.name === "장궁 (날카로운 화살 +1)");
  assert.ok(magic, JSON.stringify(sheet.attacks.map((attack) => attack.name)));
  assert.equal(magic!.attackBonus, plain.attackBonus + 1);
  assert.equal(magic!.damageBonus, plain.damageBonus + 1);
  const rows = sheet.attacks.filter((attack) => attack.name.endsWith("(날카로운 화살 +1)"));
  assert.ok(rows.every((row) => sheet.attacks.find((attack) => `${attack.name} (날카로운 화살 +1)` === row.name)?.range), "only weapons that shoot get a row");
  assert.ok(!rows.some((row) => row.name.startsWith("비무장")), JSON.stringify(rows.map((row) => row.name)));
});

test("D353: drinking at the table — the effect, the spell and the temporary hit points land on the drinker", async () => {
  const { cat, made, derive } = archer();
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("D353 시험", { userId: "dm", displayName: "DM" }), joinCode: "D353AA" };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => 0.5, ...pcHostOptions(() => cat) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "D353AA", hostSecret: "s" });
  const alice = new TableClient(hub.connect("p1"), { userId: "alice", displayName: "앨리스", joinCode: "D353AA", seat: "a" });
  await tick();
  const scene = newScene(campaign.id, "여관", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  let runtime = initialRuntime(made.derived);
  for (const [id, name] of [[GIANT, "거인 물약"], [SPEED, "재빠름 물약"], [HERO, "용기 물약"]]) runtime = addItem(runtime, { itemId: id, name });
  const before = derive(runtime);
  const pc = newJournalCharacter(campaign.id, "alice", made.source, runtime, { owner: "alice" });
  alice.send({ type: "journal.put", entry: pc });
  await tick();
  const token = tokenForCharacter(pc);
  alice.send({ type: "token.put", pageId: scene.id, token });
  await tick();
  const ref = { entryId: pc.id, pageId: scene.id, tokenId: token.id };
  const live = () => host.journal.find((line) => line.id === pc.id) as JournalCharacter;
  const drink = async (name: string) => {
    const item = derive(live().runtime).inventory.find((line) => line.name === name)!;
    alice.send({ type: "act.item", actor: ref, target: ref, instanceId: item.instanceId });
    await tick();
  };
  await drink("거인 물약");
  let sheet = derive(live().runtime);
  assert.equal(sheet.abilities.str.score, 21, JSON.stringify(live().runtime.effects));
  assert.ok(sheet.defenses.resistances.some((line) => line.startsWith("냉기")), JSON.stringify(sheet.defenses.resistances));
  assert.equal(live().runtime.effects?.find((effect) => effect.name === "거인의 힘")?.rounds, 600, "an hour, counted");
  assert.ok(!sheet.inventory.some((line) => line.name === "거인 물약" && line.quantity > 0), "the potion is gone");
  await drink("재빠름 물약");
  sheet = derive(live().runtime);
  const haste = live().runtime.effects?.find((effect) => effect.key === "spell:dnd.srd521.spell.haste");
  assert.ok(haste && !haste.concentration, JSON.stringify(live().runtime.effects));
  assert.equal(sheet.ac.value, before.ac.value + 2, "haste's +2 AC, from the spell's own contract");
  await drink("용기 물약");
  assert.equal(live().runtime.hp.temp, 10);
});
