/**
 * R21 (ROLL20_TABLE_SPEC.md D117): whoever launches a table is its DM.
 *
 * The campaign document remembers the user id of the tab that created it, and in a browser that id lives in
 * sessionStorage — a new tab, or a reload into a fresh session, mints a new one. So the owner who reopened an older
 * campaign and pressed 게임 시작 arrived at their own table as a plain player, with no DM controls at all. The host
 * secret is minted per launch and only the launching app holds it, so the host seat can be trusted with the role.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newCampaign } from "../../client/campaign/model";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { MemoryHub } from "../../client/session/transport";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const roleOf = (client: TableClient, userId: string) => client.snapshot!.players.find((player) => player.userId === userId)?.role;

/** A campaign made in an earlier tab, whose owner record was never at a table. */
const yesterday = (ownerId: string) => ({ ...newCampaign("어제 만든 캠페인", { userId: ownerId, displayName: "DM" }), joinCode: "ABC234" });

test("host: the launching host is the DM even when the campaign remembers an older tab's user id", async () => {
  const hub = new MemoryHub();
  const campaign = yesterday("old-tab");
  assert.equal(campaign.players[0].role, "gm", "the campaign was made with its creator as the DM");
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "new-tab", hostSecret: "s" });
  const seat = new TableClient(hub.connect("host-seat"), { userId: "new-tab", displayName: "DM 민수", joinCode: "ABC234", hostSecret: "s" });
  await tick();
  assert.equal(roleOf(seat, "new-tab"), "gm", "the host of the table is its DM");
  assert.deepEqual(seat.snapshot!.players.map((player) => player.userId), ["new-tab"], "the earlier tab's leftover DM record is gone, not left as an offline ghost");
  // And the DM really can do DM things.
  const refusals: string[] = [];
  seat.onRefused((reason) => refusals.push(reason));
  seat.send({ type: "table.clock", minutes: 60 });
  await tick();
  assert.deepEqual(refusals, [], "no refusals: the host has the DM commands");
  assert.equal(host.state.players.find((player) => player.userId === "new-tab")?.role, "gm");
});

test("host: a real co-DM who has sat at the table is kept; a player joining is still a player", async () => {
  const hub = new MemoryHub();
  const now = new Date().toISOString();
  const later = new Date(Date.parse(now) + 60_000).toISOString();
  const campaign = { ...yesterday("old-tab"), players: [
    { userId: "old-tab", displayName: "DM", role: "gm" as const, color: "#e0a458", joinedAt: now, lastSeenAt: now },
    { userId: "co-dm", displayName: "공동 DM", role: "gm" as const, color: "#7fb3d5", joinedAt: now, lastSeenAt: later },
  ] };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "new-tab", hostSecret: "s" });
  const seat = new TableClient(hub.connect("host-seat"), { userId: "new-tab", displayName: "DM", joinCode: "ABC234", hostSecret: "s" });
  const alice = new TableClient(hub.connect("p1"), { userId: "alice", displayName: "앨리스", joinCode: "ABC234" });
  await tick();
  assert.deepEqual([roleOf(seat, "new-tab"), roleOf(seat, "co-dm"), roleOf(seat, "alice")], ["gm", "gm", "player"]);
  assert.ok(!seat.snapshot!.players.some((player) => player.userId === "old-tab"), "only the never-seated leftover went");
  // A player cannot take the DM's chair by claiming the host's id without the secret.
  const refusals: string[] = [];
  const thief = new TableClient(hub.connect("p2"), { userId: "new-tab", displayName: "도둑", joinCode: "ABC234" });
  thief.onRefused((reason) => refusals.push(reason));
  await tick();
  assert.ok(refusals.some((reason) => reason.includes("호스트와 같은 사용자 id")), JSON.stringify(refusals));
  void host;
});

test("host: launching from the same tab that made the campaign changes nothing", async () => {
  const hub = new MemoryHub();
  const campaign = yesterday("same-tab");
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "same-tab", hostSecret: "s" });
  const seat = new TableClient(hub.connect("host-seat"), { userId: "same-tab", displayName: "DM", joinCode: "ABC234", hostSecret: "s" });
  await tick();
  assert.equal(roleOf(seat, "same-tab"), "gm");
  assert.equal(seat.snapshot!.players.length, 1);
  void host;
});
