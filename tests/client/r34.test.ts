/**
 * R34 (ROLL20_TABLE_SPEC.md D171–D173): the common-play contracts are executed, not just imported.
 *
 * `content/**` ships eight declarative contracts — what a feature costs, what pressing it does, what it may do to
 * somebody else's roll. The new client imported those modules and read none of them: the same features were written
 * out by hand in `activation.ts`, and nothing checked that the two agreed. This slice adds the reader, pins the two
 * paths against each other, and makes the first contract operation real at the table (행동 폭증's extra action).
 *
 * The frozen lists below are the point of the exercise: a gap that has a name is a gap somebody can close.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalCharacter } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter } from "../../client/campaign/page";
import { newTurn } from "../../client/campaign/tracker";
import { initialRuntime } from "../../client/character/runtime";
import { featureActivation, featureRuleKey } from "../../client/rules/activation";
import { CLASS_RESOURCES } from "../../client/rules/classes";
import { pcStats } from "../../client/rules/actions";
import { derivedOf, pcCombatant, pcConcentrationKey } from "../../client/rules/attackSpec";
import { characterScope, economyBucketOf, evaluate, interceptorsFor, resourceIdOf, runEntryPoint } from "../../client/rules/contract";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { MemoryHub } from "../../client/session/transport";
import { build, catalog } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const contract = (key: string) => catalog().contractFor(key)!;

test("contracts: all eight SRD contracts are read, and what this executor cannot run is named (D171)", () => {
  // R38 added a second family of contracts (standing effects, keyed `spell:`/`feature:`); these are the feature ones.
  // R51 (D186) added a third, keyed `feat:` — the same grammar, reached through the feat's own rule key.
  const all = new Map([...catalog().contracts].filter(([key]) => !key.startsWith("spell:") && !key.startsWith("feature:") && !key.startsWith("feat:")));
  assert.deepEqual([...all.keys()].sort(), [
    "bard.college-of-lore.cutting-words",
    "bard.college-of-lore.peerless-skill",
    "combat.unarmed-strike.shove-prone",
    "dnd.srd521.feat.fighting-style.archery",
    "fighter.action-surge",
    "fighter.indomitable",
    "fighter.tactical-mind",
    "warlock.fiend.dark-ones-own-luck",
  ]);
  // Six of the eight run whole. The two that do not are the ones that ask where everyone is standing, which a
  // scene without positions cannot answer — so the table decides those, and the app says so instead of guessing.
  const gaps = [...all.entries()].filter(([, item]) => item.unsupported.length).map(([key, item]) => [key, item.unsupported] as const);
  assert.deepEqual(gaps.map(([key]) => key), ["bard.college-of-lore.cutting-words"]);
  assert.deepEqual(contract("bard.college-of-lore.cutting-words").unsupported, [
    "interceptors[0].factQueries.same-trigger: identity.same-entity",
    "interceptors[0].factQueries.trigger-distance: spatial.distance-feet",
    "interceptors[0].factQueries.source-sees-trigger: sense.can-see",
    "interceptors[1].factQueries.same-trigger: identity.same-entity",
    "interceptors[1].factQueries.trigger-distance: spatial.distance-feet",
    "interceptors[1].factQueries.source-sees-trigger: sense.can-see",
  ]);
});

test("contracts: a contract's payment and the hand-written activation spend the same pool (D172)", () => {
  // Each contract is measured on a character who actually has the feature — a bard's pool on a bard, not on a fighter.
  const owners: Record<string, ReturnType<typeof build>> = {
    "fighter.action-surge": build({ name: "f", classes: "fighter", level: 9 }),
    "fighter.indomitable": build({ name: "f", classes: "fighter", level: 9 }),
    "fighter.tactical-mind": build({ name: "f", classes: "fighter", level: 9 }),
    "bard.college-of-lore.cutting-words": build({ name: "b", classes: "bard", level: 6 }, { "class.2.subclass": ["dnd.srd521.subclass.bard.college-of-lore"] }),
    "bard.college-of-lore.peerless-skill": build({ name: "b", classes: "bard", level: 14 }, { "class.2.subclass": ["dnd.srd521.subclass.bard.college-of-lore"] }),
    "warlock.fiend.dark-ones-own-luck": build({ name: "w", classes: "warlock", level: 6 }, { "class.2.subclass": ["dnd.srd521.subclass.warlock.fiend-patron"] }),
    // R51 (D186): a feat's pool is granted by the feat's own config, and its contract spends that same id.
    "feat:epic.fate": build({ name: "f", classes: "fighter", level: 19 }, { "class.18.epic-boon": ["dnd.srd521.feat.epic.fate"] }),
  };
  const gaps: string[] = [];
  for (const [key, item] of catalog().contracts) {
    const resources = item.payments.filter((payment) => payment.kind === "resource" && payment.resourceId).map((payment) => payment.resourceId!);
    if (!resources.length) continue;
    const derived = owners[key]?.derived;
    assert.ok(derived, `${key}: 이 계약을 가진 캐릭터를 시험에 넣어야 합니다`);
    const feature = derived.features.find((candidate) => featureRuleKey(candidate.id) === key);
    const activation = feature ? featureActivation(feature, derived) : undefined;
    // The hand-written path must spend a pool the contract also names — that is the agreement that matters.
    if (activation?.resourceId && !resources.includes(activation.resourceId)) gaps.push(`${key}: 코드가 쓰는 ${activation.resourceId}가 계약에 없습니다`);
    for (const resourceId of resources) if (!derived.resources.some((resource) => resource.id === resourceId)) gaps.push(`${key}: ${resourceId} 자원이 없습니다`);
  }
  // Nothing disagrees. 어둠의 존재의 행운's pool did not exist anywhere in the client until this slice created it;
  // what is left is Action Surge's once-a-turn limiter, which this engine does not model.
  assert.deepEqual(gaps.sort(), ["fighter.action-surge: resource.fighter.action-surge.turn 자원이 없습니다"], gaps.join("\n"));
  const warlock = owners["warlock.fiend.dark-ones-own-luck"].derived;
  assert.equal(warlock.resources.find((resource) => resource.id === "resource.warlock.fiend.dark-ones-own-luck")?.max, Math.max(1, warlock.abilities.cha.modifier));
  // It arrives at 6, not before, and it is tied to the patron — the SRD ships one warlock subclass, so the
  // subclass gate is asserted on the rule itself rather than on a second patron that does not exist yet.
  const younger = build({ name: "w", classes: "warlock", level: 5 }, { "class.2.subclass": ["dnd.srd521.subclass.warlock.fiend-patron"] }).derived;
  assert.equal(younger.resources.some((resource) => resource.id === "resource.warlock.fiend.dark-ones-own-luck"), false);
  assert.equal(CLASS_RESOURCES.find((rule) => rule.id === "resource.warlock.fiend.dark-ones-own-luck")?.subclassId, "dnd.srd521.subclass.warlock.fiend-patron");
  assert.equal(resourceIdOf("resource:bard.bardic-inspiration"), "resource.bard.bardic-inspiration");
});

test("contracts: expressions are evaluated against the character (D171)", () => {
  const fighter = build({ name: "f", classes: "fighter", level: 9, abilities: { str: 16 } }).derived;
  const scope = characterScope(fighter);
  // 밀치기: DC 8 + 숙련 보너스 + 근력 수정치, and the target picks the better of Strength and Dexterity.
  const shove = runEntryPoint(contract("combat.unarmed-strike.shove-prone"), "use", scope)!;
  assert.equal(shove.testDc, 8 + fighter.proficiencyBonus + fighter.abilities.str.modifier);
  assert.equal(shove.test!.choose, "highest");
  assert.deepEqual(shove.test!.properties, ["save.str.modifier", "save.dex.modifier"]);
  // The 넘어짐 only lands when the save fails; the same contract with a successful save does nothing.
  assert.deepEqual(runEntryPoint(contract("combat.unarmed-strike.shove-prone"), "use", characterScope(fighter, { "test.outcome": "failure" }))!.effects, [{ kind: "condition", condition: "prone", target: "target" }]);
  assert.deepEqual(runEntryPoint(contract("combat.unarmed-strike.shove-prone"), "use", characterScope(fighter, { "test.outcome": "success" }))!.effects, []);
  // 불굴 adds the fighter's own class level, read out of the character rather than written into the code.
  const indomitable = contract("fighter.indomitable").interceptors[0];
  assert.equal(evaluate(indomitable.operations[1].kind === "roll.modify" ? indomitable.operations[1].value : undefined, scope), 9);
  assert.equal(evaluate({ op: "all", args: [{ op: "lte", left: { value: 3 }, right: { value: 5 } }, { op: "eq", left: { ref: "proficiency.bonus" }, right: { value: 4 } }] }, scope), true);
  assert.equal(evaluate({ ref: "없는.참조" }, scope), undefined);
});

test("contracts: the d20 rescues are found by family and outcome (D173)", () => {
  // These four all say the same thing in the data: after a d20 of this family went this way, ask the owner, pay, add.
  const fails = (key: string, family: string) => interceptorsFor(contract(key), "d20.outcome-determined", family, "failure");
  assert.equal(fails("fighter.indomitable", "saving-throw").length, 1);
  assert.equal(fails("fighter.indomitable", "ability-check").length, 0, "불굴 is saves only");
  assert.equal(fails("fighter.tactical-mind", "ability-check").length, 1);
  assert.equal(fails("fighter.tactical-mind", "attack-roll").length, 0);
  assert.equal(fails("bard.college-of-lore.peerless-skill", "attack-roll").length, 1);
  assert.equal(fails("warlock.fiend.dark-ones-own-luck", "saving-throw").length, 1);
  // Cutting Words is the odd one: it fires on somebody else's *success*.
  assert.equal(interceptorsFor(contract("bard.college-of-lore.cutting-words"), "d20.outcome-determined", "attack-roll", "success").length, 1);
  assert.equal(fails("bard.college-of-lore.cutting-words", "attack-roll").length, 0);
  // Every one of them asks its owner first — none of these spends a pool behind the player's back.
  for (const key of ["fighter.indomitable", "fighter.tactical-mind", "bard.college-of-lore.peerless-skill", "warlock.fiend.dark-ones-own-luck"]) {
    assert.ok(contract(key).interceptors.every((item) => item.asks), key);
  }
});

test("contracts: 행동 폭증's economy.modify gives the turn its action back (D171)", async () => {
  const hub = new MemoryHub();
  const base = newCampaign("R34 시험", { userId: "dm", displayName: "DM" });
  const campaign = { ...base, joinCode: "R34AAA" };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => 0.6,
    attributeOf: (entry, link) => (link === "hp" ? { value: entry.runtime.hp.current, max: entry.runtime.hp.maxSeen } : undefined),
    pcCombatant: (entry) => pcCombatant(entry, derivedOf(entry, catalog())), pcConcentrationKey,
    pcStats: (entry) => pcStats(derivedOf(entry, catalog())) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "R34AAA", hostSecret: "s" });
  const alice = new TableClient(hub.connect("p1"), { userId: "alice", displayName: "앨리스", joinCode: "R34AAA", seat: "a" });
  await tick();
  const scene = newScene(campaign.id, "복도", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const made = build({ name: "전사", classes: "fighter", level: 9 });
  const pc = newJournalCharacter(campaign.id, "alice", made.source, initialRuntime(made.derived), { owner: "alice" });
  alice.send({ type: "journal.put", entry: pc });
  await tick();
  const token = tokenForCharacter(pc);
  alice.send({ type: "token.put", pageId: scene.id, token });
  await tick();
  dm.send({ type: "tracker.set", tracker: { open: true, round: 1, current: 0, sorted: true, turns: [newTurn({ name: "전사", initiative: 15, tokenId: token.id, pageId: scene.id, entryId: pc.id })] } });
  await tick();
  const me = { entryId: pc.id, pageId: scene.id, tokenId: token.id };
  const row = () => host.tracker.turns[0];
  // The action is spent, as it would be after an Attack action.
  alice.send({ type: "act.spend", actor: me, which: "action" });
  await tick();
  assert.equal(row().actionUsed, true);
  // 행동 폭증's contract is the whole rule: `economy.modify action.extra.non-magic +1`.
  const surge = contract("fighter.action-surge");
  const run = runEntryPoint(surge, "activate", characterScope(made.derived))!;
  assert.deepEqual(run.effects, [{ kind: "economy", bucket: "action.extra.non-magic", amount: 1 }]);
  assert.equal(economyBucketOf("action.extra.non-magic"), "action");
  assert.equal(economyBucketOf("reaction"), "reaction");
  assert.equal(economyBucketOf("legendary"), null, "a bucket this engine does not keep is not silently an action");
  alice.send({ type: "act.spend", actor: me, which: "action", grant: true, source: "행동 폭증" });
  await tick();
  assert.equal(row().actionUsed, false, "the turn has an action again");
  assert.ok(host.archive.some((message) => message.content.includes("행동 폭증") && message.content.includes("행동 하나를 더")), host.archive.map((message) => message.content).join("|"));
  // Only the character's own seat may hand it back.
  const refusals: string[] = [];
  const bob = new TableClient(hub.connect("p2"), { userId: "bob", displayName: "밥", joinCode: "R34AAA", seat: "b" });
  bob.onRefused((reason) => refusals.push(reason));
  await tick();
  alice.send({ type: "act.spend", actor: me, which: "action" });
  await tick();
  bob.send({ type: "act.spend", actor: me, which: "action", grant: true, source: "행동 폭증" });
  await tick();
  assert.equal(row().actionUsed, true, "somebody else's contract does not pay for this turn");
  assert.ok(refusals.length, "and the refusal is said out loud");
});
