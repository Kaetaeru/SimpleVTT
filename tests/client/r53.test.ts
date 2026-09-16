/**
 * R53 (ROLL20_TABLE_SPEC.md D188): what a rule does after the dice.
 *
 * The contract grammar had ten interceptor slots and one customer: `d20.roll`, which rescues a failed roll. Nothing
 * could hang off the end of an attack — "when you score a critical hit", "when you reduce a creature to 0 hit
 * points". That is where half the 2024 feats put their text. `attack.resolved` is that seam: it marks the target,
 * hands the attacker a turn slot back, or says the sentence the table has to judge. Extra damage on a critical hit
 * travels a different road (`AttackSpec.critRiders`), because the resolver has to know before it rolls.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalCharacter, newJournalNpc } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter, tokenForNpc } from "../../client/campaign/page";
import { initialRuntime } from "../../client/character/runtime";
import { addItem } from "../../client/character/play";
import { monsterById } from "../../client/compendium/monsters";
import { attackAftermath, critRiders, emptyAftermath } from "../../client/rules/attackAftermath";
import { characterScope, parseContract } from "../../client/rules/contract";
import { derivedOf, pcAttackSpec, pcCombatant, pcConcentrationKey } from "../../client/rules/attackSpec";
import { pcStats } from "../../client/rules/actions";
import { applyDamage, diceFrom, resolveAttack, type Combatant } from "../../client/rules/resolve";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { MemoryHub } from "../../client/session/transport";
import type { JournalCharacter } from "../../client/campaign/journal";
import { build, catalog, ids } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const target = (): Combatant => ({ id: "t", name: "대상", kind: "npc", ac: 11, hp: { current: 60, max: 60, temp: 0 }, conditions: [], defenses: { resistances: [], immunities: [], vulnerabilities: [] }, conSave: 0, effects: [] });

/** A level-19 fighter holding a greatsword, with one epic boon. */
function boonFighter(boon: string) {
  const made = build({ name: "용사", classes: "fighter", level: 19, abilities: { str: 18 } }, { "class.18.epic-boon": [ids.feat(boon)] });
  const runtime = addItem(initialRuntime(made.derived), { itemId: "dnd.srd521.item.weapon.greatsword", name: "대검" });
  const derived = derivedOf({ source: made.source, runtime } as never, catalog());
  return { made, runtime, derived };
}

test("R53: 저항할 수 없는 공격의 은총 adds the ability score, and only on a critical hit (D188)", () => {
  const { runtime, derived } = boonFighter("epic.irresistible-offense");
  const sword = derived.attacks.find((attack) => attack.name === "대검")!;
  const spec = pcAttackSpec({ runtime } as never, derived, sword.id, {}, catalog())!.spec;
  assert.equal(spec.critRiders?.length, 1, JSON.stringify(spec.critRiders));
  const rider = spec.critRiders![0];
  assert.equal(Number(rider.formula), derived.abilities.str.score, "the whole score, not the modifier");
  assert.equal(rider.critDoubles, false, "it is not doubled again by the critical that caused it");
  assert.equal(rider.type, sword.damageType, "weapon means this weapon's own type");

  // A hit does not get it; a critical does.
  const max = diceFrom(() => 0.999);
  const hit = resolveAttack({ ...target(), id: "a", name: "a", kind: "pc" }, target(), spec, { dice: max, fixed: { d20s: [12] } });
  assert.equal(hit.outcome, "hit");
  assert.equal(hit.damage.some((part) => part.part.critDoubles === false), false, JSON.stringify(hit.damage.map((part) => part.part.label)));
  const crit = resolveAttack({ ...target(), id: "a", name: "a", kind: "pc" }, target(), spec, { dice: max, fixed: { d20s: [20] } });
  assert.equal(crit.outcome, "crit");
  assert.equal(crit.damageTotal, hit.damageTotal + 12 + derived.abilities.str.score, "the weapon's 2d6 doubles, and the boon adds its score once");
});

test("R53: 비범한 운동선수's critical clause is an aftermath, not a line on the sheet (D188)", () => {
  const made = build({ name: "용사", classes: "fighter", level: 5 }, { "class.2.subclass": ["dnd.srd521.subclass.fighter.champion"] });
  const runtime = addItem(initialRuntime(made.derived), { itemId: "dnd.srd521.item.weapon.greatsword", name: "대검" });
  const derived = derivedOf({ source: made.source, runtime } as never, catalog());
  const sword = derived.attacks.find((attack) => attack.name === "대검")!;
  assert.deepEqual(attackAftermath(derived, catalog(), sword, ["hit"]).notes, [], "a plain hit says nothing");
  const crit = attackAftermath(derived, catalog(), sword, ["hit", "crit"]);
  assert.deepEqual(crit.notes, ["비범한 운동선수: 기회 공격 없이 이동 속도의 절반까지 이동할 수 있습니다"]);
  // And the sheet's own line no longer carries it, because the table hears it when it happens.
  const feature = derived.features.find((item) => item.name === "비범한 운동선수")!;
  assert.equal(feature.rules?.some((line) => line.includes("치명타")), false, JSON.stringify(feature.rules));
});

test("R53: an aftermath may mark the target and hand back a turn slot (D188)", () => {
  const contract = parseContract({
    id: "feature:test.after",
    interceptors: [{
      id: "after", timing: "attack.resolved", slot: "attack.outcome", scope: "slashing", outcomes: ["crit", "downed"],
      operations: [
        { kind: "condition.apply", condition: "둔화", target: "target" },
        { kind: "economy.modify", bucket: "bonus-action.extra", amount: 1 },
        { kind: "adjudication.request", question: "다음 자기 턴 시작까지" },
      ],
    }],
  }, "test");
  assert.deepEqual(contract.unsupported, []);
  const made = build({ name: "용사", classes: "fighter", level: 5 });
  const runtime = addItem(initialRuntime(made.derived), { itemId: "dnd.srd521.item.weapon.greatsword", name: "대검" });
  const derived = derivedOf({ source: made.source, runtime } as never, catalog());
  const sword = derived.attacks.find((attack) => attack.name === "대검")!;
  const mace = derived.attacks.find((attack) => attack.damageType === "타격");
  const stub = { contractFor: (key: string) => (key === "feature:test.after" ? contract : undefined) } as never;
  const withFeature = { ...derived, features: [{ id: "fighter.1.test.after", name: "시험 여파", source: "class" as const, sourceLabel: "", description: "" }] };

  const after = attackAftermath(withFeature as never, stub, sword, ["hit", "crit"]);
  assert.deepEqual(after.marks, ["둔화"]);
  assert.deepEqual(after.economy, [{ bucket: "bonus-action.extra", amount: 1, source: "시험 여파" }]);
  assert.deepEqual(after.notes, ["시험 여파: 다음 자기 턴 시작까지"]);
  // A plain hit is not one of its outcomes, and a bludgeoning weapon is not its scope.
  assert.deepEqual(attackAftermath(withFeature as never, stub, sword, ["hit"]), emptyAftermath());
  if (mace) assert.deepEqual(attackAftermath(withFeature as never, stub, mace, ["hit", "crit"]), emptyAftermath(), mace.name);
});

test("R53: a crit rider is not doubled twice (D188)", () => {
  const parts = [
    { formula: "2d6", type: "참격", label: "대검" },
    { formula: "4", type: "참격", label: "은총 (치명타)", critDoubles: false },
  ];
  const outcome = applyDamage(target(), parts, diceFrom(() => 0.999), { crit: true });
  assert.deepEqual(outcome.damage[0].dice, [6, 6, 6, 6], "the weapon's own dice double");
  assert.deepEqual(outcome.damage[1].dice, [], "the rider is a flat number");
  assert.equal(outcome.damageTotal, 24 + 4);
});

test("R53: the aftermath reaches the table — a mark on the target and a line in the log (D188)", async () => {
  const hub = new MemoryHub();
  const base = newCampaign("R53 시험", { userId: "dm", displayName: "DM" });
  const campaign = { ...base, joinCode: "R53AAA" };
  const cat = catalog();
  let first = true;
  const random = () => { if (first) { first = false; return 0.999; } return 0.999; };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random,
    attributeOf: (entry, link) => (link === "hp" ? { value: entry.runtime.hp.current, max: entry.runtime.hp.maxSeen } : undefined),
    pcCombatant: (entry) => pcCombatant(entry, derivedOf(entry, cat)), pcConcentrationKey,
    pcAttackSpec: (entry, attackId, riders) => pcAttackSpec(entry, derivedOf(entry, cat), attackId, riders, cat),
    pcAftermath: (entry, attackId, outcomes) => { const derived = derivedOf(entry, cat); const attack = derived.attacks.find((item) => item.id === attackId); return attack ? attackAftermath(derived, cat, attack, outcomes) : emptyAftermath(); },
    pcStats: (entry) => pcStats(derivedOf(entry, cat)) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "R53AAA", hostSecret: "s" });
  const alice = new TableClient(hub.connect("p1"), { userId: "alice", displayName: "앨리스", joinCode: "R53AAA", seat: "a" });
  await tick();
  const scene = newScene(campaign.id, "복도", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const made = build({ name: "챔피언", classes: "fighter", level: 5 }, { "class.2.subclass": ["dnd.srd521.subclass.fighter.champion"] });
  const runtime = addItem(initialRuntime(made.derived), { itemId: "dnd.srd521.item.weapon.greatsword", name: "대검" });
  const pc = newJournalCharacter(campaign.id, "alice", made.source, runtime, { owner: "alice" });
  alice.send({ type: "journal.put", entry: pc });
  const ogre = newJournalNpc(campaign.id, "dm", monsterById("dnd.srd521.monster.ogre")!);
  dm.send({ type: "journal.put", entry: ogre });
  await tick();
  const pcToken = tokenForCharacter(pc);
  const ogreToken = tokenForNpc(ogre);
  alice.send({ type: "token.put", pageId: scene.id, token: pcToken });
  dm.send({ type: "token.put", pageId: scene.id, token: ogreToken });
  await tick();
  const live = host.journal.find((entry) => entry.id === pc.id) as JournalCharacter;
  const sword = derivedOf(live, cat).attacks.find((attack) => attack.name === "대검")!;
  const me = { entryId: pc.id, pageId: scene.id, tokenId: pcToken.id };
  alice.send({ type: "act.attack", actor: me, attacker: me, targets: [{ entryId: ogre.id, pageId: scene.id, tokenId: ogreToken.id }], attack: { source: "weapon", attackId: sword.id } } as never);
  await tick();
  await tick();
  const card = [...host.archive].reverse().find((message) => message.action)!.action!;
  assert.equal(card.outcome, "crit", `${card.kept}`);
  assert.ok([...host.archive].some((message) => message.content.includes("기회 공격 없이 이동 속도의 절반")), [...host.archive].slice(-3).map((message) => message.content).join(" | "));
});
