/**
 * R74 (ROLL20_TABLE_SPEC.md D209): a custom NPC pasted as JSON into the journal.
 *
 * NPCs came only from the SRD compendium. Now the DM pastes a short stat block — written by hand or by a coding agent
 * from docs/guides/CUSTOM_NPC_JSON.md — and it becomes an NPC entry the host resolves like any SRD monster.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalCharacter, newJournalNpc } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter, tokenForNpc } from "../../client/campaign/page";
import { initialRuntime } from "../../client/character/runtime";
import { CUSTOM_MONSTER_EXAMPLE, damageFromFormula, parseCustomMonster } from "../../client/compendium/customMonster";
import { pcStats } from "../../client/rules/actions";
import { derivedOf, pcAttackSpec, pcCombatant, pcConcentrationKey } from "../../client/rules/attackSpec";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { MemoryHub } from "../../client/session/transport";
import { build, catalog } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test("R74: the example parses into a full stat block with derived numbers (D209)", () => {
  const parsed = parseCustomMonster(JSON.stringify(CUSTOM_MONSTER_EXAMPLE));
  assert.ok("monster" in parsed, JSON.stringify(parsed));
  assert.deepEqual(parsed.warnings, []);
  const { monster } = parsed;
  assert.ok(monster.id.startsWith("custom.monster.bog-bandit-captain."));
  assert.equal(monster.proficiencyBonus, 2);
  assert.equal(monster.saves.dex, 5, "+3 and proficient");
  assert.equal(monster.saves.str, 2, "+2, not proficient");
  assert.equal(monster.initiativeBonus, 3);
  assert.equal(monster.passivePerception, 11);
  const scimitar = monster.actions.find((action) => action.name === "시미터")!;
  assert.deepEqual(scimitar.attack!.damage, [{ dice: "1d6", count: 1, sides: 6, flat: 3, average: 6, type: "slashing" }]);
  const multi = monster.actions.find((action) => action.kind === "multiattack")!;
  assert.equal(multi.multiattack!.count, 2);
  const bottle = monster.actions.find((action) => action.kind === "save")!;
  assert.deepEqual([bottle.save!.ability, bottle.save!.dc, bottle.save!.failConditions, bottle.timing!.recharge!.min], ["con", 13, ["poisoned"], 5]);
});

test("R74: what is wrong is said — hard errors refuse, soft ones warn (D209)", () => {
  assert.ok("error" in parseCustomMonster("{ name: 1 }"));
  assert.match((parseCustomMonster(JSON.stringify({ name: "x", ac: 10, hp: 5, abilities: { str: 10 } })) as { error: string }).error, /dex·con·int·wis·cha/);
  const soft = parseCustomMonster(JSON.stringify({ name: "x", ac: 10, hp: 5, size: "big", abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, actions: [{ name: "물기", attack: { bonus: 2, damage: [{ formula: "2d", type: "bite" }], conditions: ["sleepy"] } }] }));
  assert.ok("monster" in soft);
  assert.equal(soft.monster.size, "medium");
  assert.equal(soft.warnings.length, 4, soft.warnings.join("\n"));
  assert.deepEqual(damageFromFormula("2d6 - 1", "fire"), { dice: "2d6", count: 2, sides: 6, flat: -1, average: 6, type: "fire" });
  assert.equal(damageFromFormula("7", "cold")?.average, 7);
});

test("R74: the host rolls a custom NPC's attack like an SRD monster's (D209)", async () => {
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("R74 시험", { userId: "dm", displayName: "DM" }), joinCode: "R74AAA" };
  new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => 0.5,
    attributeOf: (entry, link) => (link === "hp" ? { value: entry.runtime.hp.current, max: entry.runtime.hp.maxSeen } : undefined),
    pcCombatant: (entry) => pcCombatant(entry, derivedOf(entry, catalog())), pcConcentrationKey,
    pcAttackSpec: (entry, id, riders) => pcAttackSpec(entry, derivedOf(entry, catalog()), id, riders, catalog()),
    pcStats: (entry) => pcStats(derivedOf(entry, catalog())) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "R74AAA", hostSecret: "s" });
  await tick();
  const scene = newScene(campaign.id, "늪", 0);
  dm.send({ type: "page.put", page: scene });
  const parsed = parseCustomMonster(JSON.stringify(CUSTOM_MONSTER_EXAMPLE));
  assert.ok("monster" in parsed);
  const captain = newJournalNpc(campaign.id, "dm", parsed.monster);
  const made = build({ name: "파이터", classes: "fighter", level: 3 });
  const pc = newJournalCharacter(campaign.id, "dm", made.source, initialRuntime(made.derived));
  dm.send({ type: "journal.put", entry: captain });
  dm.send({ type: "journal.put", entry: pc });
  await tick();
  const captainToken = tokenForNpc(captain);
  const pcToken = tokenForCharacter(pc);
  dm.send({ type: "token.put", pageId: scene.id, token: captainToken });
  dm.send({ type: "token.put", pageId: scene.id, token: pcToken });
  await tick();
  const before = made.derived.hp.max;
  dm.send({ type: "act.attack", attacker: { entryId: captain.id, pageId: scene.id, tokenId: captainToken.id }, targets: [{ entryId: pc.id, pageId: scene.id, tokenId: pcToken.id }], attack: { source: "npc", actionName: "시미터" }, overrides: { outcome: "hit" } });
  await tick();
  const card = [...dm.snapshot!.chat].reverse().find((message) => message.type === "action")!;
  assert.equal(card?.action?.outcome, "hit", JSON.stringify(dm.snapshot!.chat.slice(-3)));
  const after = dm.snapshot!.journal.find((entry) => entry.id === pc.id)!;
  assert.ok(after.kind === "character" && after.runtime.hp.current < before, `the scimitar hurt: ${after.kind === "character" ? after.runtime.hp.current : "?"} of ${before}`);
});
