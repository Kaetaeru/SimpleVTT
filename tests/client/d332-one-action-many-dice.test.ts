/**
 * V0.9 D332 (SRD_MODULE_PLAN.md §23): one action, several dice.
 *
 * Three PHB uses spend as many of their own dice as the player likes for a single action (천상체의 치유의 빛,
 * 열광자의 격노 주사위, 이형의 혜택). Pressing the button once per die charged the action once per press, which the
 * rules never ask for. An economy payment may now say `oncePerTurn`: the sheet tells the host which use it belongs
 * to, and the host charges that action once a turn however many times it is pressed.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalCharacter, newJournalNpc } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter, tokenForNpc } from "../../client/campaign/page";
import { createCatalog } from "../../client/catalog";
import { autofill } from "../../client/character/autofill";
import { initialRuntime } from "../../client/character/runtime";
import { parseCustomMonster } from "../../client/compendium/customMonster";
import { parseContract } from "../../client/rules/contract";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { pcHostOptions } from "../../client/session/pcHost";
import { MemoryHub } from "../../client/session/transport";
import { sourceOf } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test("D332: an economy payment may say it is charged once a turn", () => {
  const parsed = parseContract({ id: "feature:test.spend", entryPoints: [
    { id: "spend", label: "주사위 쓰기", invocation: "manual", payments: [{ kind: "economy", bucket: "bonus-action", amount: { value: 1 }, consumeAt: "commit", oncePerTurn: true }], operations: [{ kind: "healing.apply", dice: "1d6", target: "targets" }] },
  ] }, "test.d332.feature.spend");
  assert.deepEqual(parsed.unsupported, []);
  assert.equal(parsed.entryPoints[0].payments?.[0].oncePerTurn, true);
  // Without the flag it stays as it was: every press costs its own action.
  const plain = parseContract({ id: "feature:test.plain", entryPoints: [
    { id: "spend", invocation: "manual", payments: [{ kind: "economy", bucket: "bonus-action", amount: { value: 1 }, consumeAt: "commit" }], operations: [] },
  ] }, "test.d332.feature.plain");
  assert.equal(plain.entryPoints[0].payments?.[0].oncePerTurn, undefined);
});

test("D332: the host charges that action once, however many presses", async () => {
  const cat = createCatalog([]);
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("D332 시험", { userId: "dm", displayName: "DM" }), joinCode: "D332AA" };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => 0.5, ...pcHostOptions(() => cat) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "D332AA", hostSecret: "s" });
  await tick();
  const scene = newScene(campaign.id, "성소", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const made = autofill(sourceOf({ name: "워락", classes: "warlock", level: 5, abilities: { cha: 16 } }), cat);
  const pc = newJournalCharacter(campaign.id, "dm", made.source, initialRuntime(made.derived));
  const npc = newJournalNpc(campaign.id, "dm", (parseCustomMonster(JSON.stringify({ name: "허수아비", ac: 5, hp: 20, creatureType: "construct", abilities: { str: 10, dex: 6, con: 14, int: 1, wis: 6, cha: 1 } })) as { monster: Parameters<typeof newJournalNpc>[2] }).monster);
  for (const entry of [pc, npc]) dm.send({ type: "journal.put", entry });
  await tick();
  const tokens = { pc: tokenForCharacter(pc), npc: tokenForNpc(npc) };
  for (const token of Object.values(tokens)) dm.send({ type: "token.put", pageId: scene.id, token });
  await tick();
  dm.send({ type: "tracker.add", turn: { name: "워락", tokenId: tokens.pc.id, pageId: scene.id, entryId: pc.id, initiative: 20 } });
  dm.send({ type: "tracker.add", turn: { name: "허수아비", tokenId: tokens.npc.id, pageId: scene.id, entryId: npc.id, initiative: 1 } });
  dm.send({ type: "tracker.next" });
  await tick();
  const ref = { entryId: pc.id, pageId: scene.id, tokenId: tokens.pc.id };
  const bonusUsed = () => Boolean(host.tracker.turns.find((turn) => turn.entryId === pc.id)?.bonusUsed);
  // Three presses of the same use: the bonus action goes once.
  for (let press = 0; press < 3; press += 1) { dm.send({ type: "act.spend", actor: ref, which: "bonus", once: "feature:test.healing-light" }); await tick(); }
  assert.equal(bonusUsed(), true, "it was spent");
  dm.send({ type: "act.spend", actor: ref, which: "bonus", grant: true, source: "시험" });
  await tick();
  assert.equal(bonusUsed(), false, "given back for the next part of the test");
  // A use that does not say so still costs one each time: the first press spends it again.
  dm.send({ type: "act.spend", actor: ref, which: "bonus" });
  await tick();
  assert.equal(bonusUsed(), true);
});
