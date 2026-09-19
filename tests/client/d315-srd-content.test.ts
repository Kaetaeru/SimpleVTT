/**
 * V0.9 D315 (SRD_MODULE_PLAN.md S6): the SRD's content matched to its source, at the table.
 *
 * - A lasting spell effect may keep a condition off its bearer (`trackedEffects[].conditionImmunities`): under 영웅심
 *   a creature is immune to fear, so a 공포 spell that frightens its neighbour leaves it alone.
 * - A spell ends the conditions it names whatever else it does (`removesConditions` on every kind, not only on a
 *   lasting effect), and 회복의 마법 언어 ends the ones its own data lists instead of a list in the resolver.
 * - Spells the review found wrong: 동물 소환 deals nothing on a successful Dexterity save (it dealt half).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalCharacter } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter } from "../../client/campaign/page";
import { createCatalog } from "../../client/catalog";
import { autofill } from "../../client/character/autofill";
import { initialRuntime } from "../../client/character/runtime";
import type { JournalCharacter } from "../../client/campaign/journal";
import { spellExec } from "../../client/compendium/spells";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { pcHostOptions } from "../../client/session/pcHost";
import { MemoryHub } from "../../client/session/transport";
import { sourceOf } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const FEAR = "dnd.srd521.spell.fear";
const HEROISM = "dnd.srd521.spell.heroism";

test("D315: under 영웅심 a creature cannot be frightened — its neighbour can", async () => {
  const cat = createCatalog([]);
  const wizard = autofill(sourceOf({ name: "마법사", classes: "wizard", level: 5, abilities: { int: 18 }, choices: { "class.0.spells": [FEAR] } }), cat, { prefer: { "class.0.spells": [FEAR] } });
  const fighter = autofill(sourceOf({ name: "영웅", classes: "fighter", level: 5, abilities: { wis: 1 } }), cat);
  const other = autofill(sourceOf({ name: "구경꾼", classes: "fighter", level: 5, abilities: { wis: 1 } }), cat);
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("D315 시험", { userId: "dm", displayName: "DM" }), joinCode: "D315AA" };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => 0.1, ...pcHostOptions(() => cat) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "D315AA", hostSecret: "s" });
  await tick();
  const scene = newScene(campaign.id, "들판", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const heroic = { ...initialRuntime(fighter.derived), effects: [{ key: `spell:${HEROISM}`, name: "영웅심", source: "spell" as const, duration: "집중", concentration: false, elapsed: 0, startedAt: "", bearer: true }] };
  const entries = [newJournalCharacter(campaign.id, "dm", wizard.source, initialRuntime(wizard.derived)), newJournalCharacter(campaign.id, "dm", fighter.source, heroic), newJournalCharacter(campaign.id, "dm", other.source, initialRuntime(other.derived))];
  for (const entry of entries) dm.send({ type: "journal.put", entry });
  await tick();
  const tokens = entries.map((entry) => tokenForCharacter(entry));
  for (const token of tokens) dm.send({ type: "token.put", pageId: scene.id, token });
  await tick();
  const ref = (index: number) => ({ entryId: entries[index].id, pageId: scene.id, tokenId: tokens[index].id });
  dm.send({ type: "act.cast", caster: ref(0), spellId: FEAR, targets: [ref(1), ref(2)], method: { kind: "slot", level: 3 } });
  await tick();
  const conditions = (index: number) => (host.journal.find((entry) => entry.id === entries[index].id) as JournalCharacter).runtime.conditions;
  assert.ok(conditions(2).includes("공포"), `the bystander fails and is frightened: ${host.archive.map((message) => message.content).join(" | ")}`);
  assert.ok(!conditions(1).includes("공포"), "the heroic one is not");
});

test("D315: 동물 소환 deals its damage only on a failed Dexterity save", () => {
  const primary = spellExec("dnd.srd521.spell.conjure-animals")!.primary as { saveAbility?: string; successDamage?: string };
  assert.equal(primary.saveAbility, "dex", "민첩 내성 — the 근력 in the text is the caster's own advantage");
  assert.equal(primary.successDamage, "none");
});
