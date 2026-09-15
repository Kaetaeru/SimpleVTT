/**
 * Spells at the table (ROLL20_TABLE_SPEC.md D102): the execution catalog drives the resolver — spell attacks
 * scale as cantrips, save spells roll the target's save and halve or cancel, one area roll hits everyone, healing
 * adds the modifier, magic missile's darts always land, Bless and Hold Person start effects and conditions.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { CONDITION_KO, describeSpellExec, spellExec } from "../../client/compendium/spells";
import type { ActorStats } from "../../client/rules/actions";
import type { Combatant } from "../../client/rules/resolve";
import { describeSpell, durationText, resolveSpell, type CasterStats } from "../../client/rules/spellcast";

const scripted = (...values: number[]) => ({ d: (sides: number) => { const value = values.shift(); if (value === undefined) throw new Error("dice ran out"); return Math.min(sides, value); } });
const combatant = (over: Partial<Combatant> = {}): Combatant => ({ id: over.id ?? "t", name: over.name ?? "대상", kind: "npc", ac: 13, hp: { current: 20, max: 20, temp: 0 }, conditions: [], defenses: { resistances: [], immunities: [], vulnerabilities: [] }, conSave: 2, effects: [], ...over });
const stats: ActorStats = { abilities: { str: 0, dex: 2, con: 1, int: 0, wis: 1, cha: 0 }, saves: { str: 0, dex: 2, con: 1, int: 0, wis: 1, cha: 0 }, skills: {}, proficiencyBonus: 2 };
const caster = combatant({ id: "c", name: "시전자", kind: "pc" });
const casterStats: CasterStats = { attackBonus: 5, saveDc: 13, modifier: 3, level: 5 };
const spec = (id: string, level: number, name = id) => ({ spellId: `dnd.srd521.spell.${id}`, name, level, exec: spellExec(`dnd.srd521.spell.${id}`)! });

test("catalog: every spell used here has an execution definition; conditions map to sheet names", () => {
  for (const id of ["fire-bolt", "sacred-flame", "fireball", "cure-wounds", "bless", "hold-person", "magic-missile", "shield", "scorching-ray", "false-life"]) assert.ok(spellExec(`dnd.srd521.spell.${id}`), id);
  assert.equal(CONDITION_KO.paralyzed, "마비");
  assert.ok(describeSpellExec(spellExec("dnd.srd521.spell.fireball")!).includes("민첩 내성"));
  assert.equal(durationText({ kind: "concentration" }), "집중 (최대 1분)");
});

test("fire bolt: a ranged spell attack whose dice scale with character level; guiding bolt's hit leaves an effect", () => {
  // Level 5 caster: 2d10. d20 15 + 5 = 20 vs AC 13 hits; dice 6 and 4.
  const result = resolveSpell({ caster, casterStats, spec: spec("fire-bolt", 0, "화염 화살"), targets: [{ combatant: combatant(), stats }], dice: scripted(15, 6, 4) });
  const row = result.targets[0];
  assert.deepEqual([row.mode, row.attack!.outcome, row.attack!.damageTotal, row.hpAfter, row.attack!.attack.source], ["attack", "hit", 10, 10, "spell"]);
  assert.ok(describeSpell(result).includes("적중 피해 10"));
  const bolt = resolveSpell({ caster, casterStats, spec: spec("guiding-bolt", 1, "유도 화살"), targets: [{ combatant: combatant(), stats }], dice: scripted(18, 3, 3, 3, 3) });
  assert.equal(bolt.targets[0].effect?.name, "유도 화살");
});

test("sacred flame and fireball: the target saves; none or half on success; one area roll for everyone", () => {
  // Sacred flame (DC 13) from a level-5 caster is 2d8, rolled once for the area; save d20 12 + 2 = 14 succeeds → no damage.
  const flame = resolveSpell({ caster, casterStats, spec: spec("sacred-flame", 0, "신성한 불꽃"), targets: [{ combatant: combatant(), stats }], dice: scripted(7, 5, 12) });
  assert.deepEqual([flame.targets[0].save!.success, flame.targets[0].damage!.damageTotal, flame.targets[0].hpAfter], [true, 0, 20]);
  const burnt = resolveSpell({ caster, casterStats, spec: spec("sacred-flame", 0, "신성한 불꽃"), targets: [{ combatant: combatant(), stats }], dice: scripted(7, 5, 3) });
  assert.deepEqual([burnt.targets[0].save!.success, burnt.targets[0].damage!.damageTotal, burnt.targets[0].hpAfter], [false, 12, 8]);
  // Fireball at 3rd level: 8d6 rolled once (all 3s = 24); A fails (d20 5 + 2 = 7) → 24; B succeeds (d20 18) → 12.
  const a = combatant({ id: "a", name: "A" });
  const b = combatant({ id: "b", name: "B", defenses: { resistances: ["fire"], immunities: [], vulnerabilities: [] } });
  const ball = resolveSpell({ caster, casterStats, spec: spec("fireball", 3, "파이어볼"), targets: [{ combatant: a, stats }, { combatant: b, stats }], dice: scripted(3, 3, 3, 3, 3, 3, 3, 3, 5, 18) });
  assert.deepEqual(ball.targets.map((row) => [row.save!.success, row.damage!.damageTotal, row.hpAfter]), [[false, 24, 0], [true, 6, 14]], "B resists fire (12) and saved (6)");
  assert.equal(ball.targets[0].damage!.downed, "dead");
  // 4th-level fireball has 9d6.
  const big = resolveSpell({ caster, casterStats, spec: spec("fireball", 4, "파이어볼"), targets: [{ combatant: combatant(), stats }], dice: scripted(1, 1, 1, 1, 1, 1, 1, 1, 1, 20) });
  assert.equal(big.targets[0].damage!.damage[0].dice.length, 9);
});

test("cure wounds heals with the modifier and never past max; false life grants temp HP; magic missile's darts always land", () => {
  const hurt = combatant({ kind: "pc", hp: { current: 5, max: 20, temp: 0 } });
  const cure = resolveSpell({ caster, casterStats, spec: spec("cure-wounds", 1, "상처 치료"), targets: [{ combatant: hurt, stats }], dice: scripted(8, 8) });
  assert.deepEqual([cure.targets[0].mode, cure.targets[0].healed, cure.targets[0].hpAfter, cure.targets[0].note], ["heal", 15, 20, "2d8+3 = 19"]);
  const life = resolveSpell({ caster, casterStats, spec: spec("false-life", 1, "거짓 생명"), targets: [{ combatant: caster, stats }], dice: scripted(2, 3) });
  assert.deepEqual([life.targets[0].mode, life.targets[0].tempHp], ["temp", 9]);
  const a = combatant({ id: "a", name: "A" });
  const b = combatant({ id: "b", name: "B" });
  // 2nd-level magic missile: 4 darts, round-robin A B A B; each 1d4+1.
  const missile = resolveSpell({ caster, casterStats, spec: spec("magic-missile", 2, "마법 화살"), targets: [{ combatant: a, stats }, { combatant: b, stats }], dice: scripted(4, 4, 1, 1) });
  assert.deepEqual(missile.targets.map((row) => [row.projectiles, row.damage!.damageTotal]), [[2, 10], [2, 4]]);
});

test("bless starts a concentration effect on each ally; hold person paralyses on a failed save with the spell's duration", () => {
  const ally = combatant({ id: "a", name: "아군", kind: "pc" });
  const bless = resolveSpell({ caster, casterStats, spec: spec("bless", 1, "축복"), targets: [{ combatant: ally, stats }, { combatant: caster, stats }], dice: scripted() });
  assert.equal(bless.concentration, true);
  assert.deepEqual(bless.targets.map((row) => [row.mode, row.effect!.name, row.effect!.rounds]), [["effect", "축복", 10], ["effect", "축복", 10]]);
  const hold = resolveSpell({ caster, casterStats, spec: spec("hold-person", 2, "인간형 포박"), targets: [{ combatant: combatant(), stats }], dice: scripted(4) });
  assert.deepEqual([hold.targets[0].save!.success, hold.targets[0].marks, hold.targets[0].effect!.concentration], [false, ["마비"], true]);
  const held = resolveSpell({ caster, casterStats, spec: spec("hold-person", 2, "인간형 포박"), targets: [{ combatant: combatant(), stats }], dice: scripted(19) });
  assert.deepEqual([held.targets[0].save!.success, held.targets[0].marks], [true, []]);
  // Shield: a tracked effect on the caster for a round.
  const shield = resolveSpell({ caster, casterStats, spec: spec("shield", 1, "방패"), targets: [{ combatant: caster, stats }], dice: scripted() });
  assert.deepEqual([shield.economy, shield.targets[0].effect!.rounds, shield.targets[0].note], ["reaction", 1, "AC +5"]);
});

import { newJournalCharacter, newJournalNpc } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter, tokenForNpc } from "../../client/campaign/page";
import { initialRuntime } from "../../client/character/runtime";
import { monsterById } from "../../client/compendium/monsters";
import { pcStats } from "../../client/rules/actions";
import { derivedOf, pcAttackSpec, pcCombatant, pcConcentrationKey } from "../../client/rules/attackSpec";
import { pcSpell } from "../../client/rules/spellcast";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { MemoryHub } from "../../client/session/transport";
import { build, catalog } from "./support";

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const tick = async (times = 6) => { for (let index = 0; index < times; index += 1) await settle(); };

test("host: a cleric's sacred flame and cure wounds through the table — the goblin saves or burns, the slot is spent, the fighter heals, undo restores; the mage's magic missile always lands", async () => {
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("주문 시험", { userId: "dm", displayName: "DM" }), joinCode: "ABC234" };
  // A constant die: every d20 is 11, every d8 5, every d4 3.
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => 0.5, attributeOf: (entry, link) => (link === "hp" ? { value: entry.runtime.hp.current, max: entry.runtime.hp.maxSeen } : undefined), pcCombatant: (entry) => pcCombatant(entry, derivedOf(entry, catalog())), pcConcentrationKey, pcAttackSpec: (entry, id, riders) => pcAttackSpec(entry, derivedOf(entry, catalog()), id, riders), pcStats: (entry) => pcStats(derivedOf(entry, catalog())), pcSpell: (entry, spellId, method) => pcSpell(entry, derivedOf(entry, catalog()), catalog(), spellId, method) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "ABC234", hostSecret: "s" });
  const alice = new TableClient(hub.connect("p1"), { userId: "alice", displayName: "앨리스", joinCode: "ABC234" });
  await tick();
  const scene = newScene(campaign.id, "여관", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const cleric = build({ name: "성직자", classes: "cleric", level: 3 }, { "class.0.cantrips": ["dnd.srd521.spell.sacred-flame", "dnd.srd521.spell.light", "dnd.srd521.spell.thaumaturgy"] });
  const pc = newJournalCharacter(campaign.id, "alice", cleric.source, initialRuntime(cleric.derived));
  const fighter = build({ name: "파이터", classes: "fighter", level: 3 });
  const pc2 = newJournalCharacter(campaign.id, "alice", fighter.source, { ...initialRuntime(fighter.derived), hp: { ...initialRuntime(fighter.derived).hp, current: 5 } });
  alice.send({ type: "journal.put", entry: pc });
  alice.send({ type: "journal.put", entry: pc2 });
  const goblin = newJournalNpc(campaign.id, "dm", monsterById("dnd.srd521.monster.goblin-warrior")!);
  const mage = newJournalNpc(campaign.id, "dm", monsterById("dnd.srd521.monster.mage")!);
  dm.send({ type: "journal.put", entry: goblin });
  dm.send({ type: "journal.put", entry: mage });
  await tick();
  const clericToken = tokenForCharacter(pc);
  const fighterToken = tokenForCharacter(pc2);
  const goblinToken = tokenForNpc(goblin);
  const mageToken = tokenForNpc(mage);
  alice.send({ type: "token.put", pageId: scene.id, token: clericToken });
  alice.send({ type: "token.put", pageId: scene.id, token: fighterToken });
  dm.send({ type: "token.put", pageId: scene.id, token: goblinToken });
  dm.send({ type: "token.put", pageId: scene.id, token: mageToken });
  await tick();
  const ref = (entryId: string, tokenId: string) => ({ entryId, pageId: scene.id, tokenId });
  const lastSpell = (client: TableClient) => [...client.snapshot!.chat].reverse().find((message) => message.type === "spell")!;
  const goblinHp = () => host.pageList[0].tokens.find((token) => token.id === goblinToken.id)!.bars[0].value;
  const sacredFlame = cleric.derived.spellcasting[0].cantrips.find((id) => id.endsWith(".sacred-flame"));
  assert.ok(sacredFlame, "the cleric knows sacred flame");
  // Sacred flame: the goblin's DEX save 11 + 2 = 13 vs the cleric's DC (8 + 2 + WIS mod).
  alice.send({ type: "act.cast", caster: ref(pc.id, clericToken.id), spellId: sacredFlame!, targets: [ref(goblin.id, goblinToken.id)] });
  await tick();
  const flame = lastSpell(dm);
  assert.ok(flame, "a spell card");
  const row = flame.spell!.targets[0];
  assert.equal(row.save!.dc, cleric.derived.spellcasting[0].saveDc);
  assert.equal(row.save!.total, 13);
  if (row.save!.success) assert.equal(goblinHp(), 10); else assert.equal(goblinHp(), 10 - 5);
  assert.ok(alice.snapshot!.chat.some((message) => message.id === flame.id), "the player sees the card");
  // Cure wounds on the fighter (HP 5): 1st-level slot spent, 2d8 (5+5) + WIS mod healed.
  const cure = cleric.derived.spellcasting[0].prepared.find((id) => id.endsWith(".cure-wounds")) ?? cleric.derived.spellcasting[0].alwaysPrepared.find((id) => id.endsWith(".cure-wounds"));
  assert.ok(cure, "cure wounds is prepared");
  alice.send({ type: "act.cast", caster: ref(pc.id, clericToken.id), spellId: cure!, targets: [ref(pc2.id, fighterToken.id)], method: { kind: "slot", level: 1 } });
  await tick();
  const heal = lastSpell(alice);
  const healed = heal.spell!.targets[0].healed!;
  assert.equal(healed, 10 + cleric.derived.abilities.wis.modifier);
  const fighterNow = host.journal.find((entry) => entry.id === pc2.id);
  assert.ok(fighterNow?.kind === "character" && fighterNow.runtime.hp.current === 5 + healed, "the fighter's sheet healed");
  const clericNow = host.journal.find((entry) => entry.id === pc.id);
  assert.ok(clericNow?.kind === "character" && clericNow.runtime.slotsUsed[1] === 1, "a 1st-level slot was spent");
  // Undo gives the HP and the slot back.
  dm.send({ type: "act.undo", messageId: heal.id });
  await tick();
  const fighterBack = host.journal.find((entry) => entry.id === pc2.id);
  const clericBack = host.journal.find((entry) => entry.id === pc.id);
  assert.ok(fighterBack?.kind === "character" && fighterBack.runtime.hp.current === 5 && clericBack?.kind === "character" && !clericBack.runtime.slotsUsed[1], "undo restored HP and the slot");
  // A player cannot cast with the mage; the DM casts magic missile (3 darts of 1d4+1 = 4 each) at the fighter.
  const refusals: string[] = [];
  alice.onRefused((reason) => refusals.push(reason));
  alice.send({ type: "act.cast", caster: ref(mage.id, mageToken.id), spellId: "dnd.srd521.spell.magic-missile", targets: [ref(pc2.id, fighterToken.id)] });
  await tick();
  assert.equal(refusals.length, 1);
  const mageCasting = mage.statBlock.actions.find((action) => action.kind === "spellcasting")?.spellcasting;
  const missileId = mageCasting?.lists.flatMap((list) => list.entries).find((item) => item.spellId?.endsWith(".magic-missile"))?.spellId;
  if (missileId) {
    dm.send({ type: "act.cast", caster: ref(mage.id, mageToken.id), spellId: missileId, targets: [ref(pc2.id, fighterToken.id)] });
    await tick();
    const missile = lastSpell(alice);
    assert.deepEqual([missile.spell!.targets[0].projectiles, missile.spell!.targets[0].damage!.damageTotal, missile.spell!.targets[0].hpAfter], [3, 12, 0]);
  } else {
    // The SRD mage's list may not carry magic missile: fireball (4th level per the block) at the goblin instead — DC 14, save 11 + 2 fails.
    const fireballId = mageCasting?.lists.flatMap((list) => list.entries).find((item) => item.spellId?.endsWith(".fireball"))!.spellId!;
    dm.send({ type: "act.cast", caster: ref(mage.id, mageToken.id), spellId: fireballId, targets: [ref(goblin.id, goblinToken.id)] });
    await tick();
    const ball = lastSpell(alice);
    assert.deepEqual([ball.spell!.level, ball.spell!.targets[0].save!.success, ball.spell!.targets[0].damage!.damage[0].dice.length], [4, false, 9]);
  }
});
