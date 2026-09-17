/**
 * H1 (V0.9, ROLL20_TABLE_SPEC.md D238): monster traits are rules in data, not names in code. A pasted NPC (the same
 * JSON a module ships) carries `traits[].rules`; SRD stat blocks get theirs from the SRD index. Both run through the
 * same patterns at the table.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalCharacter, newJournalNpc, type JournalCharacter } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter, tokenForNpc } from "../../client/campaign/page";
import { initialRuntime } from "../../client/character/runtime";
import { parseCustomMonster } from "../../client/compendium/customMonster";
import { monsterById, type MonsterView } from "../../client/compendium/monsters";
import { traitRule } from "../../client/compendium/monsterTraits";
import { pcStats } from "../../client/rules/actions";
import { derivedOf, npcCombatant, pcCombatant, pcConcentrationKey } from "../../client/rules/attackSpec";
import { applyDamage, diceFrom, suggestAdvantage } from "../../client/rules/resolve";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { MemoryHub } from "../../client/session/transport";
import { build, catalog } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const EMBER = {
  name: "잿불 수호자", ac: 14, hp: 60, cr: 4, abilities: { str: 16, dex: 12, con: 16, int: 6, wis: 10, cha: 8 }, saveProficiencies: ["con"],
  traits: [
    { name: "불꽃 삼키기", text: "화염 피해를 받으면 그만큼 회복한다.", rules: [{ pattern: "absorb", damageType: "fire" }] },
    { name: "타오르는 몸", text: "턴이 끝날 때 곁의 크리처를 태운다.", rules: [{ pattern: "aura-damage", dice: "2d6", damageType: "fire", timing: "owner-turn-end" }] },
    { name: "꺼지지 않는 불씨", text: "쓰러질 때 버틴다.", rules: [{ pattern: "hold-at-one-hp", ability: "con", dcBase: 5, exceptDamageTypes: ["cold"], exceptCritical: true }] },
    { name: "되살아나는 불", text: "턴 시작에 회복한다. 냉기에 막힌다.", rules: [{ pattern: "regeneration", amount: 7, suppressedByDamageTypes: ["cold"] }] },
    { name: "무리 사냥", text: "동료와 함께 공격한다.", rules: [{ pattern: "situational", side: "attacker", note: "동료가 대상 곁에 있으면 유리", button: "동료가 곁에 있음", grants: "advantage" }] },
  ],
  actions: [
    { name: "불 주먹", attack: { mode: "melee", bonus: 6, damage: [{ formula: "2d6+3", type: "fire" }] } },
    { name: "서리 주먹", attack: { mode: "melee", bonus: 6, damage: [{ formula: "2d6+3", type: "cold" }] } },
  ],
};

const ember = (): MonsterView => { const parsed = parseCustomMonster(JSON.stringify(EMBER)); assert.ok("monster" in parsed, JSON.stringify(parsed)); return parsed.monster; };

test("H1: a pasted NPC's trait rules reach its combatant, and a bad rule is a warning, not a crash (D238)", () => {
  const block = ember();
  const self = npcCombatant(newJournalNpc("c", "dm", block));
  assert.deepEqual(self.absorbs, ["fire"]);
  assert.equal(self.holdAtOneHp?.label, "꺼지지 않는 불씨");
  assert.deepEqual(self.regeneration, { amount: 7, suppressedByDamageTypes: ["cold"] });
  const healed = applyDamage({ ...self, hp: { current: 40, max: 60, temp: 0 } }, [{ formula: "5", type: "화염" }], diceFrom(() => 0.5));
  assert.equal(healed.hpAfter, 45, healed.trait);
  const bad = parseCustomMonster(JSON.stringify({ ...EMBER, traits: [{ name: "이상한", text: "", rules: [{ pattern: "teleport-everyone" }, { pattern: "absorb" }] }] }));
  assert.ok("warnings" in bad && bad.warnings.some((line) => line.includes("teleport-everyone")) && bad.warnings.some((line) => line.includes("absorb")), JSON.stringify(bad));
  // The situational rule decides the roll once the attacker confirms it.
  const plain = npcCombatant(newJournalNpc("c", "dm", monsterById("dnd.srd521.monster.ogre")!));
  const fist = { name: "불 주먹", source: "npc" as const, attackBonus: 6, mode: "melee" as const, damage: [] };
  assert.equal(suggestAdvantage(self, plain, fist).advantage, "normal");
  assert.equal(suggestAdvantage(self, plain, fist, [{ reason: "동료가 곁에 있음", grants: "advantage" }]).advantage, "advantage");
});

test("H1: SRD stat blocks get the same rules from the index, with the SRD numbers (D238)", () => {
  assert.equal(traitRule(monsterById("dnd.srd521.monster.troll")!, "regeneration")?.rule.amount, 15);
  assert.deepEqual(traitRule(monsterById("dnd.srd521.monster.troll")!, "regeneration")?.rule.suppressedByDamageTypes, ["acid", "fire"]);
  assert.equal(npcCombatant(newJournalNpc("c", "dm", monsterById("dnd.srd521.monster.flesh-golem")!)).absorbs?.[0], "lightning");
  assert.equal(npcCombatant(newJournalNpc("c", "dm", monsterById("dnd.srd521.monster.lich")!)).magicResistance ?? false, traitRule(monsterById("dnd.srd521.monster.lich")!, "magic-resistance") !== undefined);
});

async function table() {
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("H1 시험", { userId: "dm", displayName: "DM" }), joinCode: "H1AAAA" };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => 0.5,
    attributeOf: (entry, link) => (link === "hp" ? { value: entry.runtime.hp.current, max: entry.runtime.hp.maxSeen } : undefined),
    pcCombatant: (entry) => pcCombatant(entry, derivedOf(entry, catalog())), pcConcentrationKey,
    pcStats: (entry) => pcStats(derivedOf(entry, catalog())) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "H1AAAA", hostSecret: "s" });
  await tick();
  const scene = newScene(campaign.id, "화로", 0);
  dm.send({ type: "page.put", page: scene });
  const made = build({ name: "파이터", classes: "fighter", level: 5 });
  const pc = newJournalCharacter(campaign.id, "dm", made.source, initialRuntime(made.derived));
  const npc = newJournalNpc(campaign.id, "dm", ember());
  for (const entry of [pc, npc]) dm.send({ type: "journal.put", entry });
  await tick();
  const pcToken = tokenForCharacter(pc);
  const fresh = tokenForNpc(npc);
  const npcToken: typeof fresh = { ...fresh, bars: [{ ...fresh.bars[0], value: 30 }, fresh.bars[1], fresh.bars[2]] };
  for (const token of [pcToken, npcToken]) dm.send({ type: "token.put", pageId: scene.id, token });
  await tick();
  dm.send({ type: "tracker.add", turn: { name: "파이터", tokenId: pcToken.id, pageId: scene.id, entryId: pc.id, initiative: 20 } });
  dm.send({ type: "tracker.add", turn: { name: "수호자", tokenId: npcToken.id, pageId: scene.id, entryId: npc.id, initiative: 10 } });
  dm.send({ type: "tracker.next" });
  await tick();
  const refs = { pc: { entryId: pc.id, pageId: scene.id, tokenId: pcToken.id }, npc: { entryId: npc.id, pageId: scene.id, tokenId: npcToken.id } };
  const fighter = () => host.journal.find((entry) => entry.id === pc.id) as JournalCharacter;
  // The guardian token is unlinked, so its hit points live on the token bar (D78).
  const guardianHp = () => host.pageList.find((page) => page.id === scene.id)!.tokens.find((token) => token.id === npcToken.id)!.bars[0].value ?? 0;
  return { host, dm, refs, fighter, guardianHp, npcId: npc.id };
}

test("H1: a pasted NPC's aura burns the fighter marked inside at the end of its turn (D238)", async () => {
  const t = await table();
  t.dm.send({ type: "act.zone", casterEntryId: t.npcId, spellId: "aura:타오르는 몸", target: t.refs.pc, action: "enter" });
  await tick();
  const before = t.fighter().runtime.hp.current;
  t.dm.send({ type: "tracker.next" }); // the guardian's turn starts
  await tick();
  t.dm.send({ type: "tracker.next" }); // and ends: the aura goes off
  await tick();
  assert.equal(t.fighter().runtime.hp.current, before - 8, JSON.stringify(t.host.archive.slice(-3).map((message) => message.content)));
  assert.ok(t.host.archive.some((message) => message.type === "spell" && message.content.includes("타오르는 몸")));
});

test("H1: regeneration heals at the turn start, and a suppressing damage type stops it for one turn (D238)", async () => {
  const t = await table();
  t.dm.send({ type: "tracker.next" }); // guardian's turn: regenerates 7 from 30
  await tick();
  assert.equal(t.guardianHp(), 37);
  t.dm.send({ type: "act.attack", attacker: t.refs.npc, targets: [t.refs.npc], attack: { source: "npc", actionName: "서리 주먹" }, overrides: { outcome: "hit" } });
  await tick();
  const hit = t.guardianHp();
  assert.ok(hit < 37, "the frost fist landed");
  t.dm.send({ type: "tracker.next" });
  await tick();
  t.dm.send({ type: "tracker.next" }); // guardian's next turn: suppressed
  await tick();
  assert.equal(t.guardianHp(), hit, JSON.stringify(t.host.archive.slice(-3).map((message) => message.content)));
  assert.ok(t.host.archive.some((message) => message.content.includes("되살아나는 불 멈춤")));
  t.dm.send({ type: "tracker.next" });
  await tick();
  t.dm.send({ type: "tracker.next" }); // and the turn after: back again
  await tick();
  assert.equal(t.guardianHp(), Math.min(60, hit + 7));
});
