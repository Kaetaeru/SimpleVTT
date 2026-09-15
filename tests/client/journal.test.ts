/**
 * The campaign journal (ROLL20_TABLE_SPEC.md §4): two permission fields, GM notes that never reach players,
 * player edits limited to what a controller may change, players creating characters when the campaign allows,
 * "플레이어에게 보여주기" reaching only those who can see the entry, reconnect replay projected, persistence callbacks.
 */
import assert from "node:assert/strict";
import test from "node:test";
import type { JournalEntry, JournalHandout } from "../../client/campaign/journal";
import { canEdit, canView, journalTree, mergePlayerEdit, newHandout, newJournalCharacter, parseJournalText, projectEntry } from "../../client/campaign/journal";
import { newCampaign, withPlayerRole } from "../../client/campaign/model";
import { initialRuntime } from "../../client/character/runtime";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import type { TableEvent } from "../../client/session/protocol";
import { MemoryHub } from "../../client/session/transport";
import { build } from "./support";

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const tick = async (times = 4) => { for (let index = 0; index < times; index += 1) await settle(); };

function stage(settings: Partial<ReturnType<typeof newCampaign>["settings"]> = {}) {
  const hub = new MemoryHub();
  const base = newCampaign("잃어버린 광산", { userId: "dm", displayName: "DM 민수" });
  const campaign = { ...base, joinCode: "ABC234", settings: { ...base.settings, ...settings } };
  const saved: { journal: Array<{ entry: JournalEntry } | { removed: string }> } = { journal: [] };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s3cret", onJournal: (change) => { saved.journal.push(change); }, random: () => 0.5 });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM 민수", joinCode: "ABC234", hostSecret: "s3cret" });
  const alice = new TableClient(hub.connect("p1"), { userId: "alice", displayName: "앨리스", joinCode: "ABC234" });
  const bob = new TableClient(hub.connect("p2"), { userId: "bob", displayName: "밥", joinCode: "ABC234" });
  return { hub, host, dm, alice, bob, saved, campaign };
}

test("permissions, projection and player-edit merging are pure", () => {
  const handout = { ...newHandout("camp", "dm", "지도"), gmNotes: "비밀", canView: ["alice"], canEdit: [] as string[] };
  assert.ok(canView(handout, { userId: "dm", role: "gm" }) && canView(handout, { userId: "alice", role: "player" }) && !canView(handout, { userId: "bob", role: "player" }));
  assert.ok(!canEdit(handout, { userId: "alice", role: "player" }) && canEdit(handout, { userId: "dm", role: "gm" }));
  assert.equal(projectEntry(handout, { userId: "alice", role: "player" })?.gmNotes, "", "GM notes stripped for a player");
  assert.equal(projectEntry(handout, { userId: "dm", role: "gm" })?.gmNotes, "비밀");
  assert.equal(projectEntry({ ...handout, archived: true }, { userId: "alice", role: "player" }), null, "archived entries leave player journals");
  const merged = mergePlayerEdit(handout, { ...handout, name: "지도 (수정)", notes: "동쪽 문", gmNotes: "해킹", canView: "all", canEdit: "all", folder: "x", archived: true }, "2026-09-15T00:00:00Z");
  assert.equal(merged.name, "지도 (수정)");
  assert.equal((merged as typeof handout).notes, "동쪽 문");
  assert.equal(merged.gmNotes, "비밀", "a player cannot touch GM notes");
  assert.deepEqual([merged.canView, merged.canEdit, merged.folder, merged.archived], [["alice"], [], "", false], "permissions, folder and archive stay the GM's");
  const tree = journalTree([{ ...handout, folder: "괴물/동굴", name: "고블린" }, { ...handout, id: "h2", folder: "괴물", name: "늑대" }, { ...handout, id: "h3", folder: "", name: "지도" }]);
  assert.deepEqual(tree.entries.map((entry) => entry.name), ["지도"]);
  assert.deepEqual(tree.folders.map((folder) => folder.path), ["괴물"]);
  assert.deepEqual(tree.folders[0].entries.map((entry) => entry.name), ["늑대"]);
  assert.deepEqual(tree.folders[0].folders[0].entries.map((entry) => entry.name), ["고블린"]);
  const blocks = parseJournalText("# 동굴 입구\n횃불이 **두 개** 있다. @[늑대] 참고.\n- 왼쪽\n- [오른쪽](https://example.com)\n\n다음 문단");
  assert.equal(blocks[0].kind, "heading");
  assert.equal(blocks[1].kind, "paragraph");
  assert.ok(blocks[1].kind === "paragraph" && blocks[1].spans.some((span) => span.kind === "text" && span.bold && span.text === "두 개"));
  assert.ok(blocks[1].kind === "paragraph" && blocks[1].spans.some((span) => span.kind === "journal" && span.name === "늑대"));
  assert.equal(blocks[2].kind, "list");
  assert.ok(blocks[2].kind === "list" && blocks[2].items[1][0].kind === "link");
  assert.equal(blocks[3].kind, "paragraph");
});

test("handouts reach only 볼 수 있는 사람, without GM notes; 고칠 수 있는 사람 edits merge; the GM keeps everything", async () => {
  const { host, dm, alice, bob, saved } = stage();
  await tick();
  const handout = { ...newHandout(host.state.id, "dm", "동굴 지도"), notes: "동쪽 문", gmNotes: "함정 있음" };
  dm.send({ type: "journal.put", entry: handout });
  await tick();
  assert.equal(alice.snapshot!.journal.length, 0, "nobody but the GM sees a new handout");
  assert.equal(dm.snapshot!.journal[0]?.gmNotes, "함정 있음");
  assert.ok(saved.journal.some((change) => "entry" in change && change.entry.id === handout.id), "persisted through onJournal");
  dm.send({ type: "journal.put", entry: { ...handout, canView: ["alice"] } });
  await tick();
  assert.equal(alice.snapshot!.journal[0]?.name, "동굴 지도");
  assert.equal(alice.snapshot!.journal[0]?.gmNotes, "", "GM notes never leave the host for a player");
  assert.equal(bob.snapshot!.journal.length, 0);
  let refused: string | null = null;
  alice.onRefused((reason) => { refused = reason; });
  const mine = () => alice.snapshot!.journal[0] as JournalHandout;
  alice.send({ type: "journal.put", entry: { ...mine(), notes: "고쳤다" } });
  await tick();
  assert.ok(refused && (refused as string).includes("권한"), "a viewer without edit rights is refused");
  const stored = () => host.journal[0] as JournalHandout;
  assert.equal(stored().notes, "동쪽 문");
  dm.send({ type: "journal.put", entry: { ...stored(), canEdit: ["alice"] } });
  await tick();
  alice.send({ type: "journal.put", entry: { ...mine(), notes: "고쳤다", gmNotes: "해킹", canView: "all" } });
  await tick();
  assert.equal(stored().notes, "고쳤다");
  assert.equal(stored().gmNotes, "함정 있음", "the player's put cannot change GM notes");
  assert.deepEqual(stored().canView, ["alice"], "nor permissions");
  assert.equal(bob.snapshot!.journal.length, 0);
  // Open to everyone, then archive: players lose it, the GM keeps it in the archive.
  dm.send({ type: "journal.put", entry: { ...stored(), canView: "all" } });
  await tick();
  assert.equal((bob.snapshot!.journal[0] as JournalHandout | undefined)?.notes, "고쳤다");
  dm.send({ type: "journal.put", entry: { ...stored(), archived: true } });
  await tick();
  assert.equal(bob.snapshot!.journal.length, 0, "archived entries leave the player's list");
  assert.equal(dm.snapshot!.journal[0]?.archived, true);
  dm.send({ type: "journal.remove", id: handout.id });
  await tick();
  assert.equal(dm.snapshot!.journal.length, 0);
  assert.ok(saved.journal.some((change) => "removed" in change && change.removed === handout.id));
});

test("players create characters when the campaign allows, controlled by themselves; sheet changes reach the GM", async () => {
  const { host, dm, alice, bob } = stage();
  await tick();
  const { source, derived } = build({ name: "앨리스의 파이터", classes: "fighter", level: 3 });
  const entry = newJournalCharacter(host.state.id, "alice", source, initialRuntime(derived));
  alice.send({ type: "journal.put", entry: { ...entry, canView: "all", canEdit: "all", gmNotes: "x", folder: "몰래" } });
  await tick();
  const stored = host.journal.find((item) => item.id === entry.id)!;
  assert.deepEqual([stored.canView, stored.canEdit, stored.gmNotes, stored.folder, stored.createdBy], [["alice"], ["alice"], "", "", "alice"], "a player's new character is theirs and only theirs");
  assert.equal(bob.snapshot!.journal.length, 0);
  assert.equal(dm.snapshot!.journal[0]?.name, "앨리스의 파이터");
  assert.ok(dm.snapshot!.chat.some((message) => message.type === "system" && message.content.includes("만들었습니다")));
  // Damage on the sheet: alice sends the runtime, the GM's mirror shows it.
  const mine = alice.snapshot!.journal[0];
  assert.equal(mine.kind, "character");
  if (mine.kind !== "character") return;
  alice.send({ type: "journal.put", entry: { ...mine, runtime: { ...mine.runtime, hp: { ...mine.runtime.hp, current: mine.runtime.hp.current - 5 } } } });
  await tick();
  const seen = dm.snapshot!.journal[0];
  assert.ok(seen.kind === "character" && seen.runtime.hp.current === mine.runtime.hp.current - 5);
  // Handouts are the GM's to create; with the setting off, no new characters either.
  const refusals: string[] = [];
  bob.onRefused((reason) => refusals.push(reason));
  bob.send({ type: "journal.put", entry: newHandout(host.state.id, "bob") });
  await tick();
  assert.ok(refusals[0]?.includes("GM만"));
  host.updateCampaign({ ...host.state, settings: { ...host.state.settings, playersCanCreateCharacters: false } });
  await tick();
  assert.equal(bob.snapshot!.settings.playersCanCreateCharacters, false, "settings changes reach the mirrors");
  bob.send({ type: "journal.put", entry: newJournalCharacter(host.state.id, "bob", source, initialRuntime(derived)) });
  await tick();
  assert.ok(refusals[1]?.includes("캠페인 설정"));
});

test("플레이어에게 보여주기 reaches viewers who can see the entry; a promoted GM sees GM notes; replay is projected", async () => {
  const { hub, host, dm, alice, bob } = stage();
  await tick();
  const handout = { ...newHandout(host.state.id, "dm", "편지"), notes: "…", gmNotes: "위조", canView: ["alice"] };
  dm.send({ type: "journal.put", entry: handout });
  await tick();
  const shows: Record<string, string[]> = { alice: [], bob: [] };
  alice.onShow((id) => shows.alice.push(id));
  bob.onShow((id) => shows.bob.push(id));
  dm.send({ type: "journal.show", id: handout.id });
  await tick();
  assert.deepEqual(shows, { alice: [handout.id], bob: [] });
  let refused = "";
  alice.onRefused((reason) => { refused = reason; });
  alice.send({ type: "journal.show", id: handout.id });
  await tick();
  assert.ok(refused.includes("GM만"));
  // Bob becomes a GM: the journal is resent to him with GM notes.
  dm.send({ type: "player.role", userId: "bob", role: "gm" });
  await tick();
  assert.equal(bob.snapshot!.journal[0]?.gmNotes, "위조");
  // Alice drops and reconnects with her last event number: she gets the projected replay, and losing view rights
  // arrives as a removal.
  const lastN = alice.snapshot!.lastEventN;
  alice.leave();
  await tick();
  dm.send({ type: "journal.put", entry: { ...(host.journal[0] as JournalHandout), notes: "새 본문" } });
  await tick();
  const events: TableEvent[] = [];
  host.onEvent((event) => events.push(event));
  const back = new TableClient(hub.connect("p1b"), { userId: "alice", displayName: "앨리스", joinCode: "ABC234" });
  await tick();
  assert.equal((back.snapshot!.journal[0] as JournalHandout | undefined)?.notes, "새 본문");
  assert.equal(back.snapshot!.journal[0]?.gmNotes, "", "replayed journal events are projected too");
  dm.send({ type: "journal.put", entry: { ...host.journal[0], canView: [] } });
  await tick();
  assert.equal(back.snapshot!.journal.length, 0, "a viewer who lost view rights receives a removal");
  assert.ok(events.some((event) => event.type === "journal"));
  assert.equal(withPlayerRole(host.state, "bob", "player").players.find((player) => player.userId === "bob")?.role, "player");
});
