/**
 * V0.9 D358 (ITEM_GRAMMAR_V2_PLAN.md IG-1/IG-2): a pasted magic item carries a contract, and pools of its own.
 *
 * A DM's homebrew item is pasted JSON — now the same JSON a module entry is: `contract` gives it buttons, standing
 * properties and reactions, and `uses` gives it pools besides `charges` (a use a short rest, a use a dawn, none back).
 * The contract belongs to each copy: `resource:self.<pool>` is that copy's pool, so two copies never share one.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalCharacter, newJournalNpc } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter, tokenForNpc } from "../../client/campaign/page";
import { createCatalog } from "../../client/catalog";
import { activateFeature, usableFeatures } from "../../client/character/activate";
import { autofill } from "../../client/character/autofill";
import { parseCustomItem } from "../../client/character/customItem";
import { addItem, toggleAttune } from "../../client/character/play";
import { initialRuntime } from "../../client/character/runtime";
import type { CharacterRuntime } from "../../client/character/runtime";
import { parseCustomMonster } from "../../client/compendium/customMonster";
import { featureRuleKey } from "../../client/rules/activation";
import { derivedOf } from "../../client/rules/attackSpec";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { pcHostOptions } from "../../client/session/pcHost";
import { MemoryHub } from "../../client/session/transport";
import type { JournalNpc } from "../../client/campaign/journal";
import { sourceOf } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const RING = {
  format: "simplevtt.magic-item/2",
  name: "번개 반지", type: "ring", rarity: "rare", attunement: true,
  charges: { max: 3, recharge: "1d3" },
  uses: [{ id: "bolt", label: "번개", max: 2, recharge: "short-rest" }],
  spells: [{ spellId: "dnd.srd521.spell.magic-missile", charges: 1 }],
  contract: { entryPoints: [
    { id: "ward", invocation: "manual", operations: [{ kind: "property.modify", property: "resistance", operation: "add", value: "번개" }] },
    { id: "zap", label: "번개 쏘기", invocation: "manual", payments: [{ kind: "economy", bucket: "bonus-action", amount: { value: 1 }, consumeAt: "commit" }], targeting: { from: "targets", min: 1, max: 1 }, operations: [
      { kind: "resource.change", resource: "resource:self.bolt", amount: -1, target: "self" },
      { kind: "damage.apply", dice: "2d6", damageType: "번개", target: "targets" },
    ] },
  ] },
};

function wearer() {
  const cat = createCatalog([]);
  const parsed = parseCustomItem(JSON.stringify(RING), cat);
  if ("error" in parsed) throw new Error(parsed.error);
  const made = autofill(sourceOf({ name: "마법사", classes: "fighter", level: 5 }), cat);
  const derive = (runtime: CharacterRuntime) => derivedOf({ source: made.source, runtime } as never, cat);
  let runtime = initialRuntime(made.derived);
  for (const _ of [1, 2]) runtime = addItem(runtime, { name: RING.name, custom: parsed.item });
  for (const item of derive(runtime).inventory.filter((line) => line.name === RING.name)) runtime = toggleAttune(runtime, item.instanceId, 3, item.magic);
  return { cat, made, derive, runtime, parsed };
}

test("D358: the pasted item reads cleanly, with its contract and its pools", () => {
  const { parsed } = wearer();
  assert.deepEqual(parsed.warnings, []);
  assert.equal(parsed.item.uses?.[0].recharge, "short-rest");
  assert.ok(parsed.item.contract);
});

test("D358: each copy has its own pools and its own button, and a standing property from the contract", () => {
  const { cat, derive, runtime } = wearer();
  const sheet = derive(runtime);
  const bolts = sheet.resources.filter((resource) => resource.itemPool === "bolt");
  assert.equal(bolts.length, 2, "two copies, two pools");
  assert.notEqual(bolts[0].id, bolts[1].id);
  assert.equal(bolts[0].restore.short, "all", "a short rest gives them back");
  assert.ok(sheet.defenses.resistances.some((line) => line.startsWith("번개")), JSON.stringify(sheet.defenses.resistances));
  const buttons = usableFeatures(sheet, runtime, cat).filter((use) => use.feature.name === "번개 쏘기");
  assert.equal(buttons.length, 2);
  assert.deepEqual(buttons.map((use) => use.pool?.id).sort(), bolts.map((pool) => pool.id).sort(), "each button spends its own copy's pool");
});

test("D358: pressing one copy's button spends only that copy, and the host rolls the damage at the target", async () => {
  const { cat, made, derive, runtime: start } = wearer();
  let runtime = start;
  const sheet = derive(runtime);
  const button = usableFeatures(sheet, runtime, cat).find((use) => use.feature.name === "번개 쏘기")!;
  const outcome = await activateFeature(button.feature, { source: made.source, catalog: cat, derived: sheet, runtime, rollDice: async (spec) => ({ ...spec, id: "r", dice: [], modifier: 0, total: 1, at: "" }), save: (updater) => { runtime = updater(runtime); } });
  assert.equal(outcome, "done");
  const used = sheet.resources.filter((resource) => resource.itemPool === "bolt").map((pool) => runtime.resourcesUsed[pool.id] ?? 0).sort();
  assert.deepEqual(used, [0, 1]);

  const hub = new MemoryHub();
  const campaign = { ...newCampaign("D358 시험", { userId: "dm", displayName: "DM" }), joinCode: "D358AA" };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => 0.5, ...pcHostOptions(() => cat) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "D358AA", hostSecret: "s" });
  await tick();
  const scene = newScene(campaign.id, "탑", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const pc = newJournalCharacter(campaign.id, "dm", made.source, runtime);
  const npc = newJournalNpc(campaign.id, "dm", (parseCustomMonster(JSON.stringify({ name: "허수아비", ac: 5, hp: 60, creatureType: "construct", abilities: { str: 10, dex: 1, con: 14, int: 1, wis: 6, cha: 1 } })) as { monster: Parameters<typeof newJournalNpc>[2] }).monster);
  for (const entry of [pc, npc]) dm.send({ type: "journal.put", entry });
  await tick();
  const tokens = { pc: tokenForCharacter(pc), npc: tokenForNpc(npc) };
  for (const token of Object.values(tokens)) dm.send({ type: "token.put", pageId: scene.id, token });
  await tick();
  dm.send({ type: "act.contract", actor: { entryId: pc.id, pageId: scene.id, tokenId: tokens.pc.id }, ruleKey: featureRuleKey(button.feature.id), targets: [{ entryId: npc.id, pageId: scene.id, tokenId: tokens.npc.id }] });
  await tick();
  const bar = host.pageList.flatMap((page) => page.tokens).find((token) => token.id === tokens.npc.id)?.bars[0]?.value;
  const hp = bar ?? (host.journal.find((entry) => entry.id === npc.id) as JournalNpc).runtime.hp.current;
  assert.ok(hp < 60, JSON.stringify(host.archive.slice(-2).map((message) => message.content)));
});
