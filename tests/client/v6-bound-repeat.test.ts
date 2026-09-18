/**
 * V0.9 D306: the repeat of a bound spell (D302, 마녀 화살) lands on the creature it was first aimed at. The host compared
 * the command's own `entryId` with the bound creature, and a board click names only the token — so every repeat from
 * the sheet was refused with "처음 … 대상에게만", the right creature included, and no damage landed. A synthetic module
 * (CLAUDE.md §1.6), played through the host (§1.7).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalCharacter, newJournalNpc, type JournalCharacter } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter, tokenForNpc } from "../../client/campaign/page";
import { createCatalog } from "../../client/catalog";
import type { RuleModuleJson } from "../../client/catalog/types";
import { autofill } from "../../client/character/autofill";
import { initialRuntime } from "../../client/character/runtime";
import { parseCustomMonster } from "../../client/compendium/customMonster";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { pcHostOptions } from "../../client/session/pcHost";
import { MemoryHub } from "../../client/session/transport";
import { sourceOf } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const SPELL = "test.d306.spell.arc";
const MODULE = {
  moduleId: "test.d306", moduleVersion: "1",
  content: [{
    id: SPELL, category: "spell",
    presentation: { originalName: "Arc", defaultLocale: "ko-KR", locales: { "ko-KR": { name: "번개 호" } } },
    mechanics: [
      { kind: "spell-definition", config: { level: 1, school: "evocation", ritual: false, castingTimeText: "행동", rangeText: "60피트", componentsText: "V, S", durationText: "집중, 최대 1분", classes: ["wizard"] } },
      { kind: "spell-mechanic", config: {
        baseLevel: 1, castingEconomy: "action", targeting: { kind: "creature", rangeFeet: 60, minTargets: 1, maxTargets: 1 },
        primary: { kind: "attack-damage", damageType: "lightning", dice: { count: 2, sides: 12 } }, concentration: true,
        sustain: { economy: "bonus-action", target: "bound", endWhen: "사거리 밖", primary: { kind: "automatic-projectiles", damageType: "lightning", projectileDice: { sides: 12 }, baseProjectiles: 1 } },
      } },
    ],
  }],
} as unknown as RuleModuleJson;

async function table() {
  const catalog = createCatalog([MODULE]);
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("D306 시험", { userId: "dm", displayName: "DM" }), joinCode: "D306AA" };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => 0.5, ...pcHostOptions(() => catalog) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "D306AA", hostSecret: "s" });
  await tick();
  const scene = newScene(campaign.id, "탑", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const made = autofill(sourceOf({ classes: "wizard", level: 1, choices: { "class.0.spellbook": [SPELL], "class.0.spells": [SPELL] } }), catalog);
  const wizard = newJournalCharacter(campaign.id, "dm", { ...made.source, name: "마법사" }, initialRuntime(made.derived));
  const dummy = (name: string) => newJournalNpc(campaign.id, "dm", (parseCustomMonster(JSON.stringify({ name, ac: 30, hp: 60, creatureType: "construct", abilities: { str: 10, dex: 10, con: 10, int: 1, wis: 1, cha: 1 } })) as { monster: Parameters<typeof newJournalNpc>[2] }).monster);
  const [first, second] = [dummy("허수아비"), dummy("다른 허수아비")];
  for (const entry of [wizard, first, second]) dm.send({ type: "journal.put", entry });
  await tick();
  const tokens = { wizard: tokenForCharacter(wizard), first: tokenForNpc(first), second: tokenForNpc(second) };
  for (const token of Object.values(tokens)) dm.send({ type: "token.put", pageId: scene.id, token });
  await tick();
  // An NPC token that is not linked to its sheet carries its own hit points in the first bar.
  const hp = (id: string) => host.pageList.flatMap((page) => page.tokens).find((token) => token.represents === id)?.bars[0]?.value;
  const caster = { entryId: wizard.id, pageId: scene.id, tokenId: tokens.wizard.id };
  return { host, dm, scene, wizard, first, second, tokens, hp, caster };
}

test("D306: after a miss, the repeat from a board click (token only) lands on the first creature", async () => {
  const t = await table();
  // AC 30: the first bolt misses, and the arc is still the caster's to use.
  t.dm.send({ type: "act.cast", caster: t.caster, spellId: SPELL, targets: [{ entryId: t.first.id, pageId: t.scene.id, tokenId: t.tokens.first.id }], method: { kind: "slot", level: 1 } });
  await tick();
  assert.equal(t.hp(t.first.id), 60, "the first bolt missed");
  const effect = (t.host.journal.find((entry) => entry.id === t.wizard.id) as JournalCharacter).runtime.effects?.find((item) => item.key === `spell:${SPELL}`);
  assert.equal(effect?.target, t.first.id, "the arc is bound to the creature it was aimed at");

  // The sheet and the board send the token they clicked, without an entryId.
  t.dm.send({ type: "act.cast", caster: t.caster, spellId: SPELL, targets: [{ pageId: t.scene.id, tokenId: t.tokens.first.id }], method: { kind: "sustain" } });
  await tick();
  assert.ok((t.hp(t.first.id) ?? 60) < 60, `the repeat hit: ${t.host.archive.slice(-2).map((message) => message.content).join(" | ")}`);
});

test("D306: a repeat with no target goes to the bound creature, and another creature is refused", async () => {
  const t = await table();
  t.dm.send({ type: "act.cast", caster: t.caster, spellId: SPELL, targets: [{ entryId: t.first.id, pageId: t.scene.id, tokenId: t.tokens.first.id }], method: { kind: "slot", level: 1 } });
  await tick();
  t.dm.send({ type: "act.cast", caster: t.caster, spellId: SPELL, targets: [], method: { kind: "sustain" } });
  await tick();
  const afterFirst = t.hp(t.first.id);
  assert.ok((afterFirst ?? 60) < 60, `no target named: ${t.host.archive.slice(-3).map((message) => message.content).join(" | ")}`);

  t.dm.send({ type: "act.cast", caster: t.caster, spellId: SPELL, targets: [{ pageId: t.scene.id, tokenId: t.tokens.second.id }], method: { kind: "sustain" } });
  await tick();
  assert.equal(t.hp(t.second.id), 60, "another creature is refused");
  assert.equal(t.hp(t.first.id), afterFirst, "and the refused repeat does not land anywhere else");
});
