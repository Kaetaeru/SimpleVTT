/**
 * V0.9 D363 (ITEM_GRAMMAR_V2_PLAN.md IG-7): the campaign's own magic item library.
 *
 * The DM saves item JSON to the campaign (`table.items`, the GM's only); every seat gets it in the snapshot and in an
 * `items` event, and adds it to its catalog as a module. A character given one holds only its id, so when the DM
 * edits the item, every bag that holds it reads the new definition.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalCharacter } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { createCatalog } from "../../client/catalog";
import type { ContentCatalog } from "../../client/catalog/catalog";
import { autofill } from "../../client/character/autofill";
import { campaignItemsModule } from "../../client/character/customItem";
import { addItem, toggleAttune } from "../../client/character/play";
import { initialRuntime } from "../../client/character/runtime";
import { derivedOf } from "../../client/rules/attackSpec";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { pcHostOptions } from "../../client/session/pcHost";
import { MemoryHub } from "../../client/session/transport";
import type { JournalCharacter } from "../../client/campaign/journal";
import { sourceOf } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const RING = (ac: number) => ({ id: "campaign.item.guard-ring", definition: { name: "파수꾼의 반지", type: "ring", rarity: "rare", attunement: true, bonus: { ac } } });

test("D363: the DM's library reaches every seat, a bag holds the id, and an edit reaches the bag", async () => {
  let cat: ContentCatalog = createCatalog([]);
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("D363 시험", { userId: "dm", displayName: "DM" }), joinCode: "D363AA" };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => 0.5, ...pcHostOptions(() => cat) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "D363AA", hostSecret: "s" });
  const alice = new TableClient(hub.connect("p1"), { userId: "alice", displayName: "앨리스", joinCode: "D363AA", seat: "a" });
  await tick();
  alice.send({ type: "table.items", items: [RING(5)] });
  await tick();
  assert.deepEqual(alice.snapshot?.items ?? [], [], "a player cannot write the library");

  dm.send({ type: "table.items", items: [RING(1)] });
  await tick();
  assert.equal(alice.snapshot?.items?.[0]?.id, RING(1).id, "the player's seat has it");
  const seatCatalog = () => createCatalog([campaignItemsModule(campaign.id, alice.snapshot!.items!)]);
  cat = seatCatalog();
  assert.equal(cat.itemById(RING(1).id)?.name, "파수꾼의 반지");

  const made = autofill(sourceOf({ name: "앨리스", classes: "fighter", level: 3 }), cat);
  let runtime = addItem(initialRuntime(made.derived), { itemId: RING(1).id, name: "파수꾼의 반지" });
  const pc = newJournalCharacter(campaign.id, "alice", made.source, runtime, { owner: "alice" });
  const ring = derivedOf(pc, cat).inventory.find((item) => item.officialId === RING(1).id)!;
  runtime = toggleAttune(runtime, ring.instanceId, 3, ring.magic);
  alice.send({ type: "journal.put", entry: { ...pc, runtime } });
  await tick();
  const live = () => host.journal.find((entry) => entry.id === pc.id) as JournalCharacter;
  const plain = derivedOf({ ...pc, runtime: initialRuntime(made.derived) }, cat).ac.value;
  assert.equal(derivedOf(live(), cat).ac.value, plain + 1);
  assert.equal(live().runtime.inventory?.extra?.[0]?.custom, undefined, "the bag holds the id, not a copy");

  dm.send({ type: "table.items", items: [RING(2)] });
  await tick();
  cat = seatCatalog();
  assert.equal(derivedOf(live(), cat).ac.value, plain + 2, "the edit reached the bag");
  assert.equal((host as unknown as { campaign: { items?: unknown[] } }).campaign.items?.length, 1, "saved on the campaign");
});
