/**
 * V0.9 D318 (SRD_MODULE_PLAN.md §8): gaps in the grammar closed one at a time, each on the table's single path.
 *
 * - One use asking the same save twice is one save: 언데드 퇴치 frightens and incapacitates on one Wisdom save, so a
 *   creature is never frightened but free to act.
 * - A feature may give advantage on concentration saves (`saving-throw.concentration-advantage`): 엘드리치 정신.
 * - A spell may carry its own save DC (`primary.saveDc`): 이계 접촉 is DC 15 whatever the caster's DC.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalCharacter, newJournalNpc } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter, tokenForNpc } from "../../client/campaign/page";
import { createCatalog } from "../../client/catalog";
import { autofill } from "../../client/character/autofill";
import { initialRuntime } from "../../client/character/runtime";
import { parseCustomMonster } from "../../client/compendium/customMonster";
import { featureRuleKey } from "../../client/rules/activation";
import { applyDamage } from "../../client/rules/resolve";
import { resolveSpell } from "../../client/rules/spellcast";
import { spellExec } from "../../client/compendium/spells";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { pcHostOptions } from "../../client/session/pcHost";
import { MemoryHub } from "../../client/session/transport";
import { sourceOf } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test("D318: a concentration save may be rolled with advantage, from a feature's contract", () => {
  const cat = createCatalog([]);
  const choices = { "class.0.invocations": ["invocation.eldritch-mind"] };
  const made = autofill(sourceOf({ name: "워락", classes: "warlock", level: 2, choices }), cat, { prefer: choices });
  assert.ok(made.derived.concentrationAdvantage, made.derived.features.map((feature) => feature.name).join(", "));
  // At the resolver: with advantage the higher of two d20s keeps the spell (rolls 3 then 18 against DC 10).
  const rolls = [3, 18];
  const target = { id: "t", name: "t", kind: "pc" as const, ac: 10, hp: { current: 30, max: 30, temp: 0 }, conditions: [], defenses: { resistances: [], immunities: [], vulnerabilities: [] }, conSave: 0, effects: [], concentration: "주술", concentrationAdvantage: true };
  const outcome = applyDamage(target, [{ formula: "1d4", type: "fire", label: "불" }], { d: () => rolls.shift() ?? 1 }, { fixed: [[4]] });
  assert.equal(outcome.concentration?.success, true, JSON.stringify(outcome.concentration));
});

test("D318: a spell's own save DC wins over the caster's (이계 접촉: DC 15)", () => {
  const exec = spellExec("dnd.srd521.spell.contact-other-plane")!;
  const combatant = { id: "c", name: "c", kind: "pc" as const, ac: 10, hp: { current: 40, max: 40, temp: 0 }, conditions: [], defenses: { resistances: [], immunities: [], vulnerabilities: [] }, conSave: 0, effects: [] };
  const stats = { abilities: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }, saves: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }, skills: {}, proficiencyBonus: 2 } as never;
  const resolution = resolveSpell({ spec: { spellId: exec.spellId, name: "이계 접촉", level: 5, exec }, caster: combatant, casterStats: { saveDc: 19, attackBonus: 11, modifier: 5, level: 9 }, dice: { d: () => 10 }, targets: [{ combatant, stats }] });
  assert.equal(resolution.targets[0].save?.dc, 15);
  assert.equal(resolution.targets[0].save?.success, false, "10 against 15 fails");
  assert.ok((resolution.targets[0].damage?.damageTotal ?? 0) > 0, "and the 6d6 psychic lands");
});

test("D318: 언데드 퇴치 rolls one save for both of its conditions", async () => {
  const cat = createCatalog([]);
  const made = autofill(sourceOf({ name: "사제", classes: "cleric", level: 3, abilities: { wis: 16 } }), cat);
  const use = made.derived.features.find((feature) => feature.name === "언데드 퇴치");
  assert.ok(use, made.derived.features.map((feature) => feature.name).join(", "));
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("D318 시험", { userId: "dm", displayName: "DM" }), joinCode: "D318AA" };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => 0.1, ...pcHostOptions(() => cat) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "D318AA", hostSecret: "s" });
  await tick();
  const scene = newScene(campaign.id, "묘지", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const pc = newJournalCharacter(campaign.id, "dm", made.source, initialRuntime(made.derived));
  const zombie = newJournalNpc(campaign.id, "dm", (parseCustomMonster(JSON.stringify({ name: "좀비", ac: 8, hp: 15, creatureType: "undead", abilities: { str: 13, dex: 6, con: 16, int: 3, wis: 6, cha: 5 } })) as { monster: Parameters<typeof newJournalNpc>[2] }).monster);
  for (const entry of [pc, zombie]) dm.send({ type: "journal.put", entry });
  await tick();
  const tokens = { pc: tokenForCharacter(pc), zombie: tokenForNpc(zombie) };
  for (const token of Object.values(tokens)) dm.send({ type: "token.put", pageId: scene.id, token });
  await tick();
  const start = host.archive.length;
  dm.send({ type: "act.contract", actor: { entryId: pc.id, pageId: scene.id, tokenId: tokens.pc.id }, ruleKey: featureRuleKey(use!.id), targets: [{ pageId: scene.id, tokenId: tokens.zombie.id }] });
  await tick();
  const saves = host.archive.slice(start).filter((message) => message.type === "spell" && message.spell?.targets.some((row) => row.save));
  assert.equal(saves.length, 1, host.archive.slice(start).map((message) => message.content).join(" | "));
  const markers = host.pageList.flatMap((page) => page.tokens).find((item) => item.id === tokens.zombie.id)!.markers.map((marker) => marker.name);
  assert.ok(markers.includes("공포") && markers.includes("행동불능"), markers.join(", "));
});
