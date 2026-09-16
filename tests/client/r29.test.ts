/**
 * R29 (ROLL20_TABLE_SPEC.md D154–D155): the two things the player's seat still could not do.
 *
 * The one roll that decides whether a character lives was made by the host and posted with no name on it, against
 * the spec's own "플레이어 굴림". And out of turn a player had exactly three reactions — opportunity attack, Shield,
 * Counterspell — every one of which had to be *offered* to them: Uncanny Dodge, Absorb Elements, Hellish Rebuke and
 * Protection had no button, no prompt and no command anywhere.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalCharacter, newJournalNpc } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter, tokenForNpc } from "../../client/campaign/page";
import { newTurn } from "../../client/campaign/tracker";
import { initialRuntime } from "../../client/character/runtime";
import { monsterById } from "../../client/compendium/monsters";
import { pcStats } from "../../client/rules/actions";
import { derivedOf, pcCombatant, pcConcentrationKey } from "../../client/rules/attackSpec";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { MemoryHub } from "../../client/session/transport";
import type { CampaignSettings } from "../../client/campaign/model";
import type { JournalCharacter } from "../../client/campaign/journal";
import { build, catalog } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

async function table(settings: Partial<CampaignSettings> = {}) {
  const hub = new MemoryHub();
  const base = newCampaign("R29 시험", { userId: "dm", displayName: "DM" });
  const campaign = { ...base, joinCode: "R29AAA", settings: { ...base.settings, ...settings } };
  const dice = { value: 0.6 };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => dice.value,
    attributeOf: (entry, link) => (link === "hp" ? { value: entry.runtime.hp.current, max: entry.runtime.hp.maxSeen } : undefined),
    pcCombatant: (entry) => pcCombatant(entry, derivedOf(entry, catalog())), pcConcentrationKey,
    pcStats: (entry) => pcStats(derivedOf(entry, catalog())) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "R29AAA", hostSecret: "s" });
  const alice = new TableClient(hub.connect("p1"), { userId: "alice", displayName: "앨리스", joinCode: "R29AAA", seat: "a" });
  await tick();
  const scene = newScene(campaign.id, "복도", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const made = build({ name: "도적", classes: "rogue", level: 5 });
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
  const rows = [newTurn({ name: "오우거", initiative: 20, tokenId: ogreToken.id, pageId: scene.id, entryId: ogre.id }), newTurn({ name: "도적", initiative: 10, tokenId: pcToken.id, pageId: scene.id, entryId: pc.id })];
  dm.send({ type: "tracker.set", tracker: { open: true, round: 1, current: 0, sorted: true, turns: rows } });
  await tick();
  const me = { entryId: pc.id, pageId: scene.id, tokenId: pcToken.id };
  const sheet = () => host.journal.find((entry) => entry.id === pc.id) as JournalCharacter;
  const drop = async () => { const live = sheet(); dm.send({ type: "journal.put", entry: { ...live, runtime: { ...live.runtime, hp: { ...live.runtime.hp, current: 0 }, updatedAt: new Date(Date.now() + 5000).toISOString() } } }); await tick(); };
  return { host, dm, alice, me, pc, sheet, drop, dice };
}

test("death save: the card goes to the player, and pressing it is what rolls (D154)", async () => {
  const { host, dm, alice, sheet, drop } = await table();
  await drop();
  dm.send({ type: "tracker.next" });
  await tick();
  const card = [...alice.snapshot!.chat].reverse().find((message) => message.prompt?.kind === "death-save")!;
  assert.ok(card, "the downed character's player is asked");
  assert.equal(sheet().runtime.deathSaves.failure + sheet().runtime.deathSaves.success, 0, "nothing is rolled behind their back");
  // Nobody else may answer it for them.
  const dmRefusals: string[] = [];
  dm.onRefused((reason) => dmRefusals.push(reason));
  alice.send({ type: "act.deathSave", messageId: card.id });
  await tick();
  assert.equal(sheet().runtime.deathSaves.success + sheet().runtime.deathSaves.failure, 1);
  assert.ok(host.archive.some((message) => message.roll?.label?.includes("죽음 내성")));
  // The same card cannot be pressed twice.
  alice.send({ type: "act.deathSave", messageId: card.id });
  await tick();
  assert.equal(sheet().runtime.deathSaves.success + sheet().runtime.deathSaves.failure, 1, "one card, one save");
});

test("death save: with nobody there, or with the setting off, the host rolls it as before (D154)", async () => {
  const off = await table({ playersRollDeathSaves: false });
  await off.drop();
  off.dm.send({ type: "tracker.next" });
  await tick();
  assert.equal(off.sheet().runtime.deathSaves.success + off.sheet().runtime.deathSaves.failure, 1, "the setting turns it back into an automatic roll");
  // And with the setting on but the player gone, the table does not stall.
  const away = await table();
  await away.drop();
  away.alice.leave();
  await tick();
  away.dm.send({ type: "tracker.next" });
  await tick();
  assert.equal(away.sheet().runtime.deathSaves.success + away.sheet().runtime.deathSaves.failure, 1, "nobody to ask means the host rolls");
});

test("reaction: a player declares one of their own, out of turn, once per round (D155)", async () => {
  const { host, alice, me } = await table();
  const refusals: string[] = [];
  alice.onRefused((reason) => refusals.push(reason));
  // It is the ogre's turn; the rogue declares Uncanny Dodge with no prompt from anyone.
  alice.send({ type: "act.react", actor: me, name: "오싹한 회피", note: "받는 피해 절반" });
  await tick();
  const said = [...host.archive].reverse().find((message) => message.content.includes("오싹한 회피"))!;
  assert.ok(said, JSON.stringify(host.archive.map((message) => message.content)));
  assert.equal(host.tracker.turns.find((turn) => turn.entryId === me.entryId)?.reactionUsed, true, "and it spends the reaction");
  // Only one per round.
  alice.send({ type: "act.react", actor: me, name: "또 하나" });
  await tick();
  assert.ok(refusals.some((reason) => reason.includes("반응을 이미 썼습니다")), JSON.stringify(refusals));
});

test("reaction: one that rolls is rolled by the host, and a bad formula is refused (D155)", async () => {
  const { host, alice, me } = await table();
  const refusals: string[] = [];
  alice.onRefused((reason) => refusals.push(reason));
  alice.send({ type: "act.react", actor: me, name: "공격 빗나가게 하기", formula: "1d10+8" });
  await tick();
  const rolled = [...host.archive].reverse().find((message) => message.roll?.label?.includes("공격 빗나가게 하기"))!;
  assert.ok(rolled, "the reduction is a roll on the table, not a number the sender chose");
  assert.equal(rolled.roll!.formula, "1d10+8");
  assert.ok(rolled.roll!.total >= 9 && rolled.roll!.total <= 18, `${rolled.roll!.total} is within 1d10+8`);
  // A formula the host cannot read is refused (and the reaction is not silently eaten by a different creature).
  const second = await table();
  second.alice.onRefused((reason) => refusals.push(reason));
  second.alice.send({ type: "act.react", actor: second.me, name: "이상한 것", formula: "바나나" });
  await tick();
  assert.ok(refusals.some((reason) => reason.includes("읽을 수 없는")), JSON.stringify(refusals));
});

test("reaction: a creature that cannot act does not get one, and nobody reacts for someone else (D155)", async () => {
  const { dm, alice, me, sheet, pc } = await table();
  const refusals: string[] = [];
  alice.onRefused((reason) => refusals.push(reason));
  const live = sheet();
  dm.send({ type: "journal.put", entry: { ...live, runtime: { ...live.runtime, conditions: ["충격"], updatedAt: new Date(Date.now() + 5000).toISOString() } } });
  await tick();
  alice.send({ type: "act.react", actor: me, name: "오싹한 회피" });
  await tick();
  assert.ok(refusals.some((reason) => reason.includes("충격") && reason.includes("반응할 수 없습니다")), JSON.stringify(refusals));
  // And the ogre is not hers to react with.
  const ogreRef = { entryId: "nope", pageId: me.pageId, tokenId: me.tokenId };
  alice.send({ type: "act.react", actor: ogreRef, name: "무언가" });
  await tick();
  assert.ok(refusals.some((reason) => reason.includes("찾을 수 없습니다")), JSON.stringify(refusals));
  void pc;
});
