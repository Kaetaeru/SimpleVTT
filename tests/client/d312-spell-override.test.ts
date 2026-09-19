/**
 * V0.9 D312 (SRD_MODULE_PLAN.md S3): a module's `spell-mechanic` is the execution of the spell it names, SRD or not.
 *
 * The generated SRD execution catalog always won — a module that fixed an SRD spell's dice, or gave it a repeat, was
 * silently ignored; and a patch that carried only some parts dropped the lasting effect's dice, the weapon it is cast
 * through and its cast-time choices. Now a whole mechanic replaces the SRD's, a patch lays its parts over it, and
 * building the catalog without the module brings the SRD's back (CLAUDE.md §1.6, §1.7).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalCharacter, newJournalNpc } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter, tokenForNpc } from "../../client/campaign/page";
import { createCatalog } from "../../client/catalog";
import type { RuleModuleJson } from "../../client/catalog/types";
import { autofill } from "../../client/character/autofill";
import { initialRuntime } from "../../client/character/runtime";
import { parseCustomMonster } from "../../client/compendium/customMonster";
import { spellExec, variantsOf } from "../../client/compendium/spells";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { pcHostOptions } from "../../client/session/pcHost";
import { MemoryHub } from "../../client/session/transport";
import { sourceOf } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const BOLT = "dnd.srd521.spell.fire-bolt";
const BLESS = "dnd.srd521.spell.bless";
const spell = (id: string, name: string, config: Record<string, unknown>) => ({ id, category: "spell", presentation: { originalName: name, defaultLocale: "ko-KR", locales: { "ko-KR": { name } } }, mechanics: [{ kind: "spell-mechanic", config }] });

const MODULE = {
  moduleId: "test.d312", moduleVersion: "1",
  content: [
    // A whole execution: the SRD bolt made a 5d10 save for half.
    spell(BOLT, "Fire Bolt", { baseLevel: 0, castingEconomy: "action", targeting: { kind: "creature", minTargets: 1, maxTargets: 1, rangeFeet: 120 }, primary: { kind: "save-damage", saveAbility: "dex", damageType: "fire", dice: { count: 5, sides: 10 }, successDamage: "half" } }),
    // A patch: only a cast-time choice, laid over the SRD's execution.
    spell(BLESS, "Bless", { variants: [{ id: "wide", label: "넓게", patch: { targeting: { maxTargets: 5 } } }] }),
  ],
} as unknown as RuleModuleJson;

test("D312: a module's whole mechanic replaces an SRD spell's, and a patch adds to it", () => {
  const srdBolt = spellExec(BOLT)!;
  const srdBless = spellExec(BLESS)!;
  createCatalog([MODULE]);
  assert.equal(spellExec(BOLT)?.primary.kind, "save-damage");
  assert.deepEqual((spellExec(BOLT)?.primary as { dice: unknown }).dice, { count: 5, sides: 10 });
  assert.equal(spellExec(BLESS)?.primary.kind, srdBless.primary.kind, "the patch keeps the SRD's own effect");
  assert.deepEqual(variantsOf(BLESS).map((variant) => variant.id), ["wide"]);
  createCatalog([]);
  assert.equal(spellExec(BOLT)?.primary.kind, srdBolt.primary.kind, "without the module the SRD's is back");
  assert.deepEqual(spellExec(BLESS)?.variants, srdBless.variants);
});

test("D312: at the table the SRD spell casts as the module wrote it", async () => {
  const cat = createCatalog([MODULE]);
  const made = autofill(sourceOf({ classes: "wizard", level: 1, abilities: { int: 16 }, choices: { "class.0.cantrips": [BOLT] } }), cat, { prefer: { "class.0.cantrips": [BOLT] } });
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("D312 시험", { userId: "dm", displayName: "DM" }), joinCode: "D312AA" };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => 0.5, ...pcHostOptions(() => cat) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "D312AA", hostSecret: "s" });
  await tick();
  const scene = newScene(campaign.id, "과녁", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const pc = newJournalCharacter(campaign.id, "dm", made.source, initialRuntime(made.derived));
  const dummy = newJournalNpc(campaign.id, "dm", (parseCustomMonster(JSON.stringify({ name: "허수아비", ac: 30, hp: 60, creatureType: "construct", abilities: { str: 10, dex: 1, con: 10, int: 1, wis: 1, cha: 1 } })) as { monster: Parameters<typeof newJournalNpc>[2] }).monster);
  for (const entry of [pc, dummy]) dm.send({ type: "journal.put", entry });
  await tick();
  const tokens = { pc: tokenForCharacter(pc), dummy: tokenForNpc(dummy) };
  for (const token of Object.values(tokens)) dm.send({ type: "token.put", pageId: scene.id, token });
  await tick();
  dm.send({ type: "act.cast", caster: { entryId: pc.id, pageId: scene.id, tokenId: tokens.pc.id }, spellId: BOLT, targets: [{ pageId: scene.id, tokenId: tokens.dummy.id }], method: { kind: "cantrip" } });
  await tick();
  const card = host.archive.find((message) => message.type === "spell" && message.spell);
  assert.ok(card?.spell?.targets.some((row) => row.save), `a save, not an attack roll against AC 30: ${card?.content}`);
  const hp = host.pageList.flatMap((page) => page.tokens).find((item) => item.id === tokens.dummy.id)!.bars[0]?.value ?? 0;
  assert.ok(hp < 60, card?.content);
  createCatalog([]);
});
