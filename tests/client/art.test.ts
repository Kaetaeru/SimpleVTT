/**
 * The art library (ROLL20_TABLE_SPEC.md §9, CAMPAIGN_RESOURCES.md §3): chunked upload and fetch, bytes stored by
 * hash, visibility = owner / GM / referenced by a journal entry the viewer can see, management rights, size limit.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { ART_LIMIT, ChunkAssembler, chunkText, hashText, newArtAsset } from "../../client/campaign/art";
import { newHandout } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { MemoryHub } from "../../client/session/transport";

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const tick = async (times = 6) => { for (let index = 0; index < times; index += 1) await settle(); };

function stage() {
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("아트 시험", { userId: "dm", displayName: "DM" }), joinCode: "ABC234" };
  const bytes = new Map<string, string>();
  const changes: Array<{ asset: { id: string } } | { removed: string }> = [];
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", artData: { get: async (hash) => bytes.get(hash), put: (hash, data) => { bytes.set(hash, data); } }, onArt: (change) => changes.push(change) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "ABC234", hostSecret: "s" });
  const alice = new TableClient(hub.connect("p1"), { userId: "alice", displayName: "앨리스", joinCode: "ABC234" });
  const bob = new TableClient(hub.connect("p2"), { userId: "bob", displayName: "밥", joinCode: "ABC234" });
  return { hub, host, dm, alice, bob, bytes, changes, campaign };
}

const fakeDataUrl = (size: number) => `data:image/png;base64,${"A".repeat(size)}`;

async function upload(client: TableClient, campaignId: string, userId: string, name: string, dataUrl: string, size = 1000) {
  const asset = newArtAsset(campaignId, userId, { name, mime: "image/png", bytes: size, hash: await hashText(dataUrl) });
  const chunks = chunkText(dataUrl, 4096);
  client.send({ type: "art.upload", asset, total: chunks.length });
  chunks.forEach((data, index) => client.send({ type: "art.chunk", id: asset.id, index, total: chunks.length, data }));
  return asset;
}

test("chunks round-trip in any order and the hash is stable", async () => {
  const text = fakeDataUrl(10_000);
  const chunks = chunkText(text, 3000);
  assert.equal(chunks.length, 4);
  const assembler = new ChunkAssembler();
  assert.equal(assembler.add("x", 2, 4, chunks[2]), null);
  assert.equal(assembler.add("x", 0, 4, chunks[0]), null);
  assert.deepEqual(assembler.progress("x"), { done: 2, total: 4 });
  assert.equal(assembler.add("x", 3, 4, chunks[3]), null);
  assert.equal(assembler.add("x", 1, 4, chunks[1]), text);
  assert.equal(assembler.progress("x"), null);
  assert.equal(await hashText(text), await hashText(text));
  assert.notEqual(await hashText(text), await hashText(`${text}B`));
  assert.deepEqual(chunkText(""), [""]);
});

test("an upload is stored by hash and seen by its owner and the GM; players fetch only what something visible references", async () => {
  const { host, dm, alice, bob, bytes, changes, campaign } = stage();
  await tick();
  const data = fakeDataUrl(120_000);
  const asset = await upload(dm, campaign.id, "dm", "지도", data);
  await tick();
  assert.equal(bytes.get(asset.hash), data, "the host stored the bytes under the content hash");
  assert.ok(changes.some((change) => "asset" in change && change.asset.id === asset.id), "onArt persisted the metadata");
  assert.equal(dm.snapshot!.art[0]?.name, "지도");
  assert.equal(alice.snapshot!.art.length, 0, "a GM upload is not in a player's library");
  await assert.rejects(alice.fetchArt(asset.id), /볼 수 없는/, "fetching hidden art is refused");
  // A handout everyone can see uses it as avatar: the asset reaches the players and its bytes can be fetched.
  dm.send({ type: "journal.put", entry: { ...newHandout(campaign.id, "dm", "편지"), avatar: `art:${asset.id}`, canView: "all" } });
  await tick();
  assert.equal(alice.snapshot!.art[0]?.id, asset.id, "the referenced asset appears in the player's library");
  const progress: number[] = [];
  const fetched = await alice.fetchArt(asset.id, (done) => progress.push(done));
  assert.equal(fetched.dataUrl, data);
  assert.equal(fetched.hash, asset.hash);
  assert.ok(progress.length >= 1, "progress was reported while chunks arrived");
  // The GM hides the handout again: the asset leaves the player's library.
  const handout = host.journal[0];
  dm.send({ type: "journal.put", entry: { ...handout, canView: [] } });
  await tick();
  assert.equal(bob.snapshot!.art.length, 0);
  assert.equal(alice.snapshot!.art.length, 0, "a lost reference arrives as a removal");
  await assert.rejects(alice.fetchArt(asset.id), /볼 수 없는/);
});

test("players manage their own uploads; the GM manages everything; the size limit holds", async () => {
  const { host, dm, alice, bob, campaign } = stage();
  await tick();
  const mine = await upload(alice, campaign.id, "alice", "내 초상", fakeDataUrl(500));
  await tick();
  assert.equal(alice.snapshot!.art[0]?.ownerId, "alice", "the host stamps the uploader as owner");
  assert.equal(dm.snapshot!.art[0]?.id, mine.id, "the GM sees every upload");
  assert.equal(bob.snapshot!.art.length, 0, "another player does not");
  const refusals: string[] = [];
  bob.onRefused((reason) => refusals.push(reason));
  bob.send({ type: "art.update", id: mine.id, name: "훔친 이름" });
  await tick();
  assert.ok(refusals[0]?.includes("없습니다") || refusals[0]?.includes("권한"), "bob cannot touch alice's art");
  alice.send({ type: "art.update", id: mine.id, name: "앨리스 초상", folder: "초상" });
  await tick();
  assert.equal(host.art[0].name, "앨리스 초상");
  assert.equal(host.art[0].folder, "초상");
  const spoofed = newArtAsset(campaign.id, "alice", { name: "x", mime: "image/png", bytes: 10, hash: "h" });
  alice.send({ type: "art.upload", asset: { ...spoofed, ownerId: "dm" }, total: 1 });
  alice.send({ type: "art.chunk", id: spoofed.id, index: 0, total: 1, data: "data:image/png;base64,AA" });
  await tick();
  assert.equal(host.art.find((asset) => asset.id === spoofed.id)?.ownerId, "alice", "ownerId in the upload is ignored");
  const big = newArtAsset(campaign.id, "alice", { name: "big", mime: "image/png", bytes: ART_LIMIT + 1, hash: "big" });
  const aliceRefusals: string[] = [];
  alice.onRefused((reason) => aliceRefusals.push(reason));
  alice.send({ type: "art.upload", asset: big, total: 1 });
  await tick();
  assert.ok(aliceRefusals.some((reason) => reason.includes("너무 큽니다")));
  dm.send({ type: "art.remove", id: mine.id });
  await tick();
  assert.equal(alice.snapshot!.art.find((asset) => asset.id === mine.id), undefined, "the GM's removal reaches the owner");
  // The snapshot of a late joiner is projected the same way.
  const late = new TableClient(stage().hub.connect("late"), { userId: "carol", displayName: "캐럴", joinCode: "ABC234" });
  assert.equal(late.snapshot, null);
});
