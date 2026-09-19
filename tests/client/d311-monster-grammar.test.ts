/**
 * V0.9 D311 (SRD_MODULE_PLAN.md S2): a module can define monsters.
 *
 * The SRD's stat blocks came only from the generated monster catalog, and a module had no way to add one — a DM could
 * paste an NPC, a module could not ship it. A `combatant` entry with a `monster-definition` now joins the compendium:
 * written in the paste format (read by the paste reader, with the entry's id), or as a whole stat block that replaces
 * an SRD monster of the same id. Its trait rules and attacks play at the table (CLAUDE.md §1.6, §1.7).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalNpc } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForNpc } from "../../client/campaign/page";
import { createCatalog } from "../../client/catalog";
import type { RuleModuleJson } from "../../client/catalog/types";
import { monsterById, MONSTERS, searchMonsters } from "../../client/compendium/monsters";
import { traitRule } from "../../client/compendium/monsterTraits";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { pcHostOptions } from "../../client/session/pcHost";
import { MemoryHub } from "../../client/session/transport";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const BOG = "test.d311.monster.bog-hag";
const GOBLIN = "dnd.srd521.monster.goblin-warrior";
const named = (id: string, name: string, nameEn: string, config: Record<string, unknown>) => ({ id, category: "combatant", presentation: { originalName: nameEn, defaultLocale: "ko-KR", locales: { "ko-KR": { name } } }, mechanics: [{ kind: "monster-definition", config }] });

const MODULE = {
  moduleId: "test.d311", moduleVersion: "1",
  content: [
    named(BOG, "늪 마녀", "Bog Hag", {
      size: "medium", creatureType: "fey", ac: 14, hp: 45, cr: 3, abilities: { str: 16, dex: 12, con: 14, int: 12, wis: 13, cha: 14 },
      traits: [{ name: "마법 저항", text: "주문에 대한 내성 굴림에 유리.", rules: [{ pattern: "magic-resistance" }] }],
      actions: [{ name: "할퀴기", attack: { mode: "melee", bonus: 5, damage: [{ formula: "2d6+3", type: "slashing" }] } }],
    }),
  ],
} as unknown as RuleModuleJson;

test("D311: a module monster in the paste format joins the compendium with its trait rules", () => {
  createCatalog([MODULE]);
  const hag = monsterById(BOG);
  assert.ok(hag, "found by its entry id");
  assert.equal(hag!.name, "늪 마녀");
  assert.equal(hag!.proficiencyBonus, 2);
  assert.ok(traitRule(hag!, "magic-resistance"), "its trait carries its rule");
  assert.ok(searchMonsters("늪").some((monster) => monster.id === BOG));
  // Built without the module again, the compendium forgets it.
  createCatalog([]);
  assert.equal(monsterById(BOG), undefined);
});

test("D311: a whole stat block replaces the SRD monster of the same id", () => {
  const srd = monsterById(GOBLIN);
  assert.ok(srd, "the SRD block exists");
  const count = MONSTERS.length;
  createCatalog([{ moduleId: "test.d311b", moduleVersion: "1", content: [named(GOBLIN, "고블린 전사 (개정)", "Goblin Warrior", { statBlock: { ...srd!, hp: 99 } })] } as unknown as RuleModuleJson]);
  assert.equal(monsterById(GOBLIN)?.hp, 99);
  assert.equal(monsterById(GOBLIN)?.name, "고블린 전사 (개정)");
  assert.equal(MONSTERS.length, count, "replaced, not added");
  createCatalog([]);
  assert.equal(monsterById(GOBLIN)?.hp, srd!.hp);
});

test("D311: at the table the module monster attacks with its own action", async () => {
  const cat = createCatalog([MODULE]);
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("D311 시험", { userId: "dm", displayName: "DM" }), joinCode: "D311AA" };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => 0.5, ...pcHostOptions(() => cat) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "D311AA", hostSecret: "s" });
  await tick();
  const scene = newScene(campaign.id, "늪", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const hag = newJournalNpc(campaign.id, "dm", monsterById(BOG)!);
  const other = newJournalNpc(campaign.id, "dm", monsterById(BOG)!);
  for (const entry of [hag, other]) dm.send({ type: "journal.put", entry });
  await tick();
  const tokens = { hag: tokenForNpc(hag), other: tokenForNpc(other) };
  for (const token of Object.values(tokens)) dm.send({ type: "token.put", pageId: scene.id, token });
  await tick();
  dm.send({ type: "act.attack", attacker: { entryId: hag.id, pageId: scene.id, tokenId: tokens.hag.id }, targets: [{ entryId: other.id, pageId: scene.id, tokenId: tokens.other.id }], attack: { source: "npc", actionName: "할퀴기" }, overrides: { outcome: "hit" } });
  await tick();
  const hp = host.pageList.flatMap((page) => page.tokens).find((item) => item.id === tokens.other.id)!.bars[0]?.value ?? 0;
  assert.ok(hp < 45, host.archive.map((message) => message.content).join(" | "));
  createCatalog([]);
});
