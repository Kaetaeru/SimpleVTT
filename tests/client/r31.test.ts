/**
 * R31 (ROLL20_TABLE_SPEC.md D160–D164): the monster traits the app can actually run.
 *
 * Of 328 traits on the 329 SRD stat blocks, 317 were text the engine never read. Some of that is the right answer
 * for a scene with no positions — 수륙양용, 거미 등반, 무리 전술. Some of it was not: eleven traits carry a fully
 * parsed saving throw (사체 폭발, 악취, 공포 오라 …) that no code could fire because the lookup skipped `traits`;
 * 마법 저항 sits on 34 blocks and changed no roll; 재생 names its own number and healed nobody.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalCharacter, newJournalNpc } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter, tokenForNpc } from "../../client/campaign/page";
import { newTurn } from "../../client/campaign/tracker";
import { initialRuntime } from "../../client/character/runtime";
import { monsterById, searchMonsters } from "../../client/compendium/monsters";
import { pcStats } from "../../client/rules/actions";
import { derivedOf, npcCombatant, npcSaveExec, pcCombatant, pcConcentrationKey } from "../../client/rules/attackSpec";
import { traitRule } from "../../client/compendium/monsterTraits";
import { pcSpell, resolveSpell, type CasterStats } from "../../client/rules/spellcast";
import { spellExec } from "../../client/compendium/spells";
import { diceFrom, type Combatant } from "../../client/rules/resolve";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { MemoryHub } from "../../client/session/transport";
import type { JournalNpc } from "../../client/campaign/journal";
import { build, catalog } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const fixed = (value: number) => diceFrom(() => (value - 0.5) / 20);
const combatant = (over: Partial<Combatant> = {}): Combatant => ({ id: "t", name: "대상", kind: "npc", ac: 13, hp: { current: 40, max: 40, temp: 0 }, conditions: [], defenses: { resistances: [], immunities: [], vulnerabilities: [] }, conSave: 0, effects: [], ...over });

test("traits: a trait whose save is parsed resolves like any other save action (D160)", () => {
  const mephit = newJournalNpc("c", "dm", monsterById("dnd.srd521.monster.dust-mephit")!);
  const burst = mephit.statBlock.traits.find((trait) => trait.kind === "save")!;
  assert.ok(burst, "the dust mephit's 사체 폭발 carries a parsed save");
  const prepared = npcSaveExec(mephit, burst.name);
  assert.ok(prepared, "and the lookup finds it now — it used to skip traits entirely");
  assert.equal(prepared!.casterStats.saveDc, burst.save!.dc);
  assert.equal(prepared!.spec.exec.primary.kind, "save-damage");
  // Every trait in the catalog that carries a save is reachable the same way.
  const reachable = searchMonsters("").flatMap((view) => {
    const entry = newJournalNpc("c", "dm", monsterById(view.id)!);
    return entry.statBlock.traits.filter((trait) => trait.kind === "save").map((trait) => Boolean(npcSaveExec(entry, trait.name)));
  });
  assert.ok(reachable.every(Boolean), `${reachable.filter((ok) => !ok).length} still unreachable`);
});

test("traits: 마법 저항 gives advantage on a save against a spell, not against a breath (D161)", () => {
  const mage = newJournalNpc("c", "dm", monsterById("dnd.srd521.monster.archmage")!);
  assert.ok(traitRule(mage.statBlock, "magic-resistance"), "the archmage has 마법 저항 as a trait rule");
  assert.equal(npcCombatant(mage).magicResistance, true);
  const ogre = newJournalNpc("c", "dm", monsterById("dnd.srd521.monster.ogre")!);
  assert.equal(npcCombatant(ogre).magicResistance ?? false, false, "an ogre has none");
  const casterStats: CasterStats = { saveDc: 15, attackBonus: 7, modifier: 4, level: 9 };
  const stats = { abilities: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }, saves: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }, skills: {}, proficiencyBonus: 4 } as never;
  const cast = (target: Combatant) => resolveSpell({
    spec: { spellId: "dnd.srd521.spell.fireball", name: "화염구", level: 3, exec: spellExec("dnd.srd521.spell.fireball")! },
    caster: combatant({ id: "c", kind: "pc" }), casterStats, dice: fixed(8), targets: [{ combatant: target, stats }],
  }).targets[0].save!;
  assert.equal(cast(combatant()).advantage, undefined, "an ordinary creature just rolls");
  assert.equal(cast(combatant({ magicResistance: true })).advantage, "마법 저항");
  // A monster's own breath is not a spell, so the trait does nothing against it.
  const breath = resolveSpell({
    spec: { spellId: "npc:불의 숨결", name: "불의 숨결", level: 0, exec: { ...spellExec("dnd.srd521.spell.fireball")!, spellId: "npc:불의 숨결" } },
    caster: combatant({ id: "c" }), casterStats, dice: fixed(8), targets: [{ combatant: combatant({ magicResistance: true }), stats }],
  }).targets[0].save!;
  assert.equal(breath.advantage, undefined, "마법 저항 is against magic, not against a stat-block action");
});

test("traits: 재생 names its own number, and the host hands it back at the turn start (D162)", async () => {
  const troll = newJournalNpc("c", "dm", monsterById("dnd.srd521.monster.troll")!);
  const regen = traitRule(troll.statBlock, "regeneration")?.rule;
  assert.ok(regen && regen.amount > 0, `the troll regenerates: ${JSON.stringify(regen)}`);
  assert.equal(regen?.amount, 15, "SRD 5.2.1: the troll regains 15");
  assert.equal(traitRule(monsterById("dnd.srd521.monster.ogre")!, "regeneration"), undefined);

  const hub = new MemoryHub();
  const campaign = { ...newCampaign("R31 재생", { userId: "dm", displayName: "DM" }), joinCode: "R31AAA" };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => 0.5,
    attributeOf: (entry, link) => (link === "hp" ? { value: entry.runtime.hp.current, max: entry.runtime.hp.maxSeen } : undefined),
    pcCombatant: (entry) => pcCombatant(entry, derivedOf(entry, catalog())), pcConcentrationKey,
    pcStats: (entry) => pcStats(derivedOf(entry, catalog())),
    pcSpell: (entry, spellId, method) => pcSpell(entry, derivedOf(entry, catalog()), catalog(), spellId, method) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "R31AAA", hostSecret: "s" });
  await tick();
  const scene = newScene(campaign.id, "다리 밑", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const made = build({ name: "파이터", classes: "fighter", level: 3 });
  const pc = newJournalCharacter(campaign.id, "dm", made.source, initialRuntime(made.derived));
  dm.send({ type: "journal.put", entry: pc });
  const hurt = { ...troll, campaignId: campaign.id };
  dm.send({ type: "journal.put", entry: hurt });
  await tick();
  const pcToken = tokenForCharacter(pc);
  // H1 (D238): the troll's token is unlinked, so the wound and the healing are on its bar (D78).
  const whole = tokenForNpc(hurt);
  const trollToken: typeof whole = { ...whole, bars: [{ ...whole.bars[0], value: (whole.bars[0].max ?? 0) - 30 }, whole.bars[1], whole.bars[2]] };
  const barHp = () => host.pageList.find((page) => page.id === scene.id)!.tokens.find((token) => token.id === trollToken.id)!.bars[0].value ?? 0;
  dm.send({ type: "token.put", pageId: scene.id, token: trollToken });
  dm.send({ type: "token.put", pageId: scene.id, token: pcToken });
  await tick();
  const before = barHp();
  dm.send({ type: "tracker.set", tracker: { open: true, round: 1, current: 0, sorted: true, turns: [newTurn({ name: "파이터", initiative: 20, tokenId: pcToken.id, pageId: scene.id, entryId: pc.id }), newTurn({ name: "트롤", initiative: 10, tokenId: trollToken.id, pageId: scene.id, entryId: troll.id })] } });
  await tick();
  dm.send({ type: "tracker.next" });
  await tick();
  const after = barHp();
  assert.equal(after, before + regen!.amount, "the troll's turn started and it healed");
  assert.ok(host.archive.some((message) => message.content.includes("재생")), JSON.stringify(host.archive.map((message) => message.content).slice(-4)));
});
