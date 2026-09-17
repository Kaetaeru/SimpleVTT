/**
 * R83 (ROLL20_TABLE_SPEC.md D217): the host's content modules travel to the players.
 *
 * A PHB supplement installed on the DM's app was not on a player's, so the player's sheet listed no 마녀 화살 and the
 * turn panel could not cast it. The snapshot now lists the host's modules with a fingerprint, and a player's app
 * fetches the ones it lacks for as long as the table is open.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { newCampaign } from "../../client/campaign/model";
import type { RuleModuleJson } from "../../client/catalog/types";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { contentHash } from "../../client/session/protocol";
import { MemoryHub } from "../../client/session/transport";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const read = (path: string) => JSON.parse(readFileSync(path, "utf8")) as RuleModuleJson;

test("R83: a player sees the host's modules and fetches one whole, however large (D217)", async () => {
  const big = read("content/modules/dnd-srd-5.2.1.effect-common-play/module.json");
  const patch = read("content/supplements/phb-2024.spell-mechanics-patch/module.json");
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("R83 시험", { userId: "dm", displayName: "DM" }), joinCode: "R83AAA" };
  new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", contentModules: () => [big, patch] });
  const player = new TableClient(hub.connect("p1"), { userId: "alice", displayName: "앨리스", joinCode: "R83AAA" });
  await tick();
  assert.deepEqual(player.snapshot?.modules?.map((item) => item.moduleId), [big.moduleId, patch.moduleId], "in install order");
  assert.equal(player.snapshot?.modules?.[0].hash, contentHash(read("content/modules/dnd-srd-5.2.1.effect-common-play/module.json")), "the same text hashes the same on both sides");
  assert.ok(JSON.stringify(big).length > 48 * 1024, "more than one chunk");

  const [fetched] = await Promise.all([player.fetchContent(big.moduleId), tick()]);
  assert.deepEqual(fetched, big);
  await assert.rejects(player.fetchContent("no-such-module"), /모듈이 없습니다/);
});

test("R83: a changed module has a different fingerprint (D217)", () => {
  const patch = read("content/supplements/phb-2024.spell-mechanics-patch/module.json");
  const edited = { ...patch, moduleVersion: "0.2" } as RuleModuleJson;
  assert.notEqual(contentHash(patch), contentHash(edited));
});
