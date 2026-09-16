/**
 * R27 (ROLL20_TABLE_SPEC.md D138–D146): the player's seat.
 *
 * What a player could see, answer and hand over. A sheet shared with 모든 플레이어 silently lost its macros; the
 * approval sheet ate the board's clicks; every player prompt also opened as a modal on the DM's screen with Enter
 * bound to its primary button; the economy chips hid out of turn; the tracker window never opened for a player at
 * all; a table whose carrier had dropped looked exactly like a live one; a prompt opened at creatures that could
 * not answer it; and there was no command in the protocol for handing a creature to someone else.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { newJournalCharacter, newJournalNpc } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter, tokenForNpc } from "../../client/campaign/page";
import { controlsToken } from "../../client/campaign/page";
import { initialRuntime } from "../../client/character/runtime";
import { monsterById } from "../../client/compendium/monsters";
import { promptAnswerer, promptIsMine } from "../../client/screens/Notify";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { MemoryHub } from "../../client/session/transport";
import type { ChatMessage } from "../../client/campaign/model";
import type { JournalCharacter } from "../../client/campaign/journal";
import { build } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

async function table() {
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("R27 시험", { userId: "dm", displayName: "DM" }), joinCode: "R27AAA" };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s" });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "R27AAA", hostSecret: "s" });
  const alice = new TableClient(hub.connect("p1"), { userId: "alice", displayName: "앨리스", joinCode: "R27AAA", seat: "a" });
  const bob = new TableClient(hub.connect("p2"), { userId: "bob", displayName: "밥", joinCode: "R27AAA", seat: "b" });
  await tick();
  const scene = newScene(campaign.id, "복도", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const made = build({ name: "앨리스의 파이터", classes: "fighter", level: 3 });
  const pc = newJournalCharacter(campaign.id, "alice", made.source, initialRuntime(made.derived), { owner: "alice" });
  alice.send({ type: "journal.put", entry: pc });
  const ogre = newJournalNpc(campaign.id, "dm", monsterById("dnd.srd521.monster.ogre")!);
  dm.send({ type: "journal.put", entry: ogre });
  await tick();
  const pcToken = tokenForCharacter(pc);
  const ogreToken = tokenForNpc(ogre);
  alice.send({ type: "token.put", pageId: scene.id, token: pcToken });
  dm.send({ type: "token.put", pageId: scene.id, token: ogreToken });
  await tick();
  const refs = { pc: { entryId: pc.id, pageId: scene.id, tokenId: pcToken.id }, ogre: { entryId: ogre.id, pageId: scene.id, tokenId: ogreToken.id } };
  return { host, dm, alice, bob, scene, pc, ogre, pcToken, ogreToken, refs };
}

test("seat: a prompt belongs to the player who controls the reactor, not to everyone who could answer it (D140)", async () => {
  const { host, dm, alice, refs } = await table();
  // The ogre walks away from Alice's fighter: the opportunity attack is hers.
  dm.send({ type: "act.provoke", mover: refs.ogre, from: refs.pc });
  await tick();
  const prompt = [...host.archive].reverse().find((message) => message.type === "prompt")! as ChatMessage;
  const snapshot = dm.snapshot!;
  assert.equal(promptAnswerer(prompt, snapshot), "alice", "the prompt is addressed to Alice");
  assert.equal(promptIsMine(prompt, snapshot, "alice"), true);
  // The DM *can* answer it — that never changed — but it is not theirs to be handed as a modal with Enter bound.
  assert.equal(promptIsMine(prompt, snapshot, "dm"), true, "the DM can still take it over on purpose");
  assert.notEqual(promptAnswerer(prompt, snapshot), "dm");
  void alice;
});

test("seat: a prompt with no connected owner falls to the DM (D140)", async () => {
  const { host, dm, alice, refs } = await table();
  alice.leave();
  await tick();
  dm.send({ type: "act.provoke", mover: refs.ogre, from: refs.pc });
  await tick();
  const prompt = [...host.archive].reverse().find((message) => message.type === "prompt")! as ChatMessage;
  assert.equal(promptAnswerer(prompt, dm.snapshot!), null, "nobody is there to answer, so the DM's copy is not a takeover");
});

test("seat: no prompt opens at a creature that cannot take the reaction (D144)", async () => {
  const { host, dm, alice, ogre, refs } = await table();
  // An unconscious ogre is asked nothing; the table is told in one line instead.
  const live = host.journal.find((entry) => entry.id === ogre.id)!;
  dm.send({ type: "journal.put", entry: { ...live, runtime: { ...(live as typeof ogre).runtime, conditions: ["무의식"], updatedAt: new Date(Date.now() + 1000).toISOString() } } as typeof ogre });
  await tick();
  const before = host.archive.filter((message) => message.type === "prompt").length;
  alice.send({ type: "act.provoke", mover: refs.pc, from: refs.ogre });
  await tick();
  assert.equal(host.archive.filter((message) => message.type === "prompt").length, before, "no card whose only button is 안 함");
  const told = [...host.archive].reverse().find((message) => message.type === "system")!;
  assert.ok(told.content.includes("무의식") && told.content.includes("기회 공격이 없습니다"), told.content);
});

test("seat: a character can be handed to another player, and taken back (D146)", async () => {
  const { host, dm, alice, bob, pc, pcToken, scene } = await table();
  const sheet = () => host.journal.find((entry) => entry.id === pc.id) as JournalCharacter;
  const bobViewer = { userId: "bob", role: "player" as const };
  const token = () => host.pageList.find((page) => page.id === scene.id)!.tokens.find((item) => item.id === pcToken.id)!;
  assert.equal(controlsToken(token(), bobViewer, host.journal), false, "Bob cannot drive it to begin with");
  alice.send({ type: "journal.grant", id: pc.id, userId: "bob", control: true });
  await tick();
  assert.equal(controlsToken(token(), bobViewer, host.journal), true, "Alice handed her paladin to Bob before stepping out");
  assert.ok(sheet().canView !== "all" && sheet().canView.includes("bob"), "and he can see it");
  assert.ok(host.archive.some((message) => message.content.includes("밥이(가) 맡습니다")), JSON.stringify(host.archive.map((message) => message.content)));
  alice.send({ type: "journal.grant", id: pc.id, userId: "bob", control: false });
  await tick();
  assert.equal(controlsToken(token(), bobViewer, host.journal), false, "and takes it back");
  // Bob cannot help himself to someone else's character.
  const refusals: string[] = [];
  bob.onRefused((reason) => refusals.push(reason));
  bob.send({ type: "journal.grant", id: pc.id, userId: "bob", control: true });
  await tick();
  assert.ok(refusals.some((reason) => reason.includes("자기 캐릭터만")), JSON.stringify(refusals));
  void dm;
});

test("seat: a dropped carrier does not swallow what the player presses (D145)", async () => {
  const { host, alice } = await table();
  alice.leave();
  await tick();
  const before = host.archive.length;
  alice.send({ type: "chat.say", text: "들리나요?" });
  await tick();
  assert.equal(host.archive.length, before, "nothing reached the table…");
  assert.equal(alice.status, "closed", "…and the mirror knows it is not live");
});

test("seat: the approval sheet dims the board without eating its clicks (D139)", () => {
  const css = readFileSync(new URL("../../client/ui/app.css", import.meta.url), "utf8");
  const rule = css.split("\n").find((line) => line.startsWith(".cl-approval-overlay{"))!;
  assert.ok(rule.includes("pointer-events:none"), rule);
  assert.ok(css.includes(".cl-approval-overlay .cl-approval{pointer-events:auto}"), "the card itself still takes the pointer");
});
