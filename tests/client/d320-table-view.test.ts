/**
 * V0.9 D320: what a player sees at the table (owner's report).
 *
 * - A scene's background reaches the players: art visibility counted journal pictures only, so the DM saw the map
 *   and every player saw an empty board.
 * - Every roll tumbles: a card with dice (an attack, a spell, a check, an initiative) becomes the roll the dice
 *   overlay animates, with the values the host rolled.
 * - "플레이어에게 보여주기" on a handout nobody may see shares it and pops it up for the players (not the DM).
 * - A picture given to an NPC reaches its tokens.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { chunkText, hashText, newArtAsset } from "../../client/campaign/art";
import { newHandout, newJournalNpc } from "../../client/campaign/journal";
import type { ChatMessage } from "../../client/campaign/model";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForNpc } from "../../client/campaign/page";
import { parseCustomMonster } from "../../client/compendium/customMonster";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { MemoryHub } from "../../client/session/transport";
import { rollOfMessage } from "../../client/ui/dice/messageDice";

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const tick = async (times = 6) => { for (let index = 0; index < times; index += 1) await settle(); };

function stage() {
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("D320 시험", { userId: "dm", displayName: "DM" }), joinCode: "D320AA" };
  const bytes = new Map<string, string>();
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", artData: { get: async (hash) => bytes.get(hash), put: (hash, data) => { bytes.set(hash, data); } } });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "D320AA", hostSecret: "s" });
  const alice = new TableClient(hub.connect("p1"), { userId: "alice", displayName: "앨리스", joinCode: "D320AA" });
  return { host, dm, alice, campaign };
}

async function upload(client: TableClient, campaignId: string, name: string) {
  const dataUrl = `data:image/png;base64,${"B".repeat(5000)}`;
  const asset = newArtAsset(campaignId, "dm", { name, mime: "image/png", bytes: 5000, hash: await hashText(dataUrl) });
  const chunks = chunkText(dataUrl, 4096);
  client.send({ type: "art.upload", asset, total: chunks.length });
  chunks.forEach((data, index) => client.send({ type: "art.chunk", id: asset.id, index, total: chunks.length, data }));
  return { asset, dataUrl };
}

test("D320: the background of the players' scene reaches the players; another scene's does not", async () => {
  const { dm, alice, campaign } = stage();
  await tick();
  const map = await upload(dm, campaign.id, "지도");
  const secret = await upload(dm, campaign.id, "비밀 지도");
  await tick();
  const shown = { ...newScene(campaign.id, "동굴", 0), background: { color: "#000", image: `art:${map.asset.id}` } };
  const hidden = { ...newScene(campaign.id, "보스방", 1), background: { color: "#000", image: `art:${secret.asset.id}` } };
  dm.send({ type: "page.put", page: shown });
  dm.send({ type: "page.put", page: hidden });
  dm.send({ type: "page.ribbon", pageId: shown.id });
  await tick();
  assert.ok(alice.snapshot!.art.some((asset) => asset.id === map.asset.id), "the player's library knows the background");
  assert.equal((await alice.fetchArt(map.asset.id)).dataUrl, map.dataUrl, "and may fetch its bytes");
  assert.ok(!alice.snapshot!.art.some((asset) => asset.id === secret.asset.id), "a scene the players are not on stays hidden");
  await assert.rejects(alice.fetchArt(secret.asset.id), /볼 수 없는/);
  // The ribbon moves: the new scene's background follows.
  dm.send({ type: "page.ribbon", pageId: hidden.id });
  await tick();
  assert.ok(alice.snapshot!.art.some((asset) => asset.id === secret.asset.id));
});

test("D320: a handout nobody may see is shared when shown, and pops up for the players only", async () => {
  const { host, dm, alice, campaign } = stage();
  await tick();
  const handout = newHandout(campaign.id, "dm", "보물 지도");
  dm.send({ type: "journal.put", entry: handout });
  await tick();
  const shows = { dm: [] as string[], alice: [] as string[] };
  dm.onShow((id) => shows.dm.push(id));
  alice.onShow((id) => shows.alice.push(id));
  dm.send({ type: "journal.show", id: handout.id });
  await tick();
  assert.equal(host.journal.find((entry) => entry.id === handout.id)?.canView, "all");
  assert.deepEqual(shows, { dm: [], alice: [handout.id] });
});

test("D320: a picture given to an NPC reaches the tokens that showed none", async () => {
  const { host, dm, campaign } = stage();
  await tick();
  const scene = newScene(campaign.id, "숲", 0);
  dm.send({ type: "page.put", page: scene });
  const npc = newJournalNpc(campaign.id, "dm", (parseCustomMonster(JSON.stringify({ name: "늑대", ac: 13, hp: 11, creatureType: "beast", abilities: { str: 12, dex: 15, con: 12, int: 3, wis: 12, cha: 6 } })) as { monster: Parameters<typeof newJournalNpc>[2] }).monster);
  dm.send({ type: "journal.put", entry: npc });
  await tick();
  const token = tokenForNpc(npc);
  dm.send({ type: "token.put", pageId: scene.id, token });
  await tick();
  dm.send({ type: "journal.put", entry: { ...host.journal.find((entry) => entry.id === npc.id)!, avatar: "art:wolf" } });
  await tick();
  assert.equal(host.pageList.flatMap((page) => page.tokens).find((item) => item.id === token.id)?.image, "art:wolf");
});

test("D320: a card with dice is the roll the dice overlay shows", () => {
  const base = { id: "m1", at: "2026-09-20T00:00:00Z", who: "DM", content: "" };
  const attack = rollOfMessage({ ...base, type: "action", action: { attacker: { id: "a", name: "고블린", kind: "npc" }, target: { id: "t", name: "전사", kind: "pc" }, attack: { name: "시미터", source: "npc", mode: "melee", bonus: 4 }, advantage: "advantage", reasons: [], d20s: [7, 15], kept: 15, cover: 0, attackTotal: 19, targetAc: 16, outcome: "hit", damage: [{ part: { formula: "1d6+2", type: "slashing" }, dice: [5], rolled: 7, adjusted: 7, adjustment: null }], damageTotal: 7, absorbed: 0, hpLost: 7, hpBefore: 20, hpAfter: 13, tempAfter: 0, inflicted: [], applied: true } } as unknown as ChatMessage)!;
  assert.deepEqual(attack.dice.map((die) => [die.sides, die.value, Boolean(die.dropped)]), [[20, 7, true], [20, 15, false], [6, 5, false]]);
  assert.equal(attack.total, 19);
  assert.equal(attack.natural, 15);
  const initiative = rollOfMessage({ ...base, type: "rollresult", roll: { formula: "1d20+2", total: 13, dice: [{ sides: 20, value: 11 }], modifier: 2, label: "전사 · 이니셔티브" } } as ChatMessage)!;
  assert.deepEqual([initiative.label, initiative.total, initiative.dice[0].value], ["전사 · 이니셔티브", 13, 11]);
  const check = rollOfMessage({ ...base, type: "act", act: { kind: "hide", name: "숨기", actor: { name: "도적" }, text: "", check: { label: "은신", d20: 12, bonus: 5, total: 17, dc: 15, success: true }, actorMarks: [], targetMarks: [], actorUnmarks: [] } } as unknown as ChatMessage)!;
  assert.deepEqual([check.dice.length, check.total, check.note], [1, 17, "성공"]);
  assert.equal(rollOfMessage({ ...base, type: "general", content: "안녕" } as ChatMessage), null, "talk has no dice");
});
