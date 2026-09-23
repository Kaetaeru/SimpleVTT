/**
 * V0.9 D360 (ITEM_GRAMMAR_V2_PLAN.md IG-4): who may attune, and curses.
 *
 * `attunementRequires` names who may attune (a spellcaster, a class); the sheet's attune button says why not.
 * `curse` holds its bearer (`cannotUnattune`) and lays its own `grants` on them (a penalty, a vulnerability) while the
 * item works, until the curse is lifted — the DM's call, a button on the bag row. `vulnerabilities` is a field of
 * any item, and the table doubles that damage on the bearer.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalCharacter, newJournalNpc } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter, tokenForNpc } from "../../client/campaign/page";
import { createCatalog } from "../../client/catalog";
import { autofill } from "../../client/character/autofill";
import { attunementProblem, parseCustomItem } from "../../client/character/customItem";
import { addItem, liftCurse, toggleAttune } from "../../client/character/play";
import { initialRuntime } from "../../client/character/runtime";
import type { CharacterRuntime } from "../../client/character/runtime";
import { parseCustomMonster } from "../../client/compendium/customMonster";
import { derivedOf } from "../../client/rules/attackSpec";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { pcHostOptions } from "../../client/session/pcHost";
import { MemoryHub } from "../../client/session/transport";
import type { JournalCharacter } from "../../client/campaign/journal";
import { sourceOf } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const ORB = { name: "학자의 구슬", type: "wondrous", rarity: "rare", attunement: true, attunementRequires: { spellcaster: true }, bonus: { spellDc: 1 } };
const RING = { name: "탐욕의 반지", type: "ring", rarity: "rare", attunement: true, bonus: { ac: 1 }, curse: { cannotUnattune: true, grants: { bonus: { saves: -2 }, vulnerabilities: ["fire"] }, note: "끼면 뺄 수 없다" } };

function hero(classes: string, background = "sage") {
  const cat = createCatalog([]);
  const made = autofill(sourceOf({ name: "모험가", classes, level: 5, background, abilities: { int: 16, str: 14 } }), cat);
  const derive = (runtime: CharacterRuntime) => derivedOf({ source: made.source, runtime } as never, cat);
  const item = (json: object) => { const read = parseCustomItem(JSON.stringify(json), cat); if ("error" in read) throw new Error(read.error); assert.deepEqual(read.warnings, []); return read.item; };
  return { cat, made, derive, item, start: initialRuntime(made.derived) };
}

test("D360: only a spellcaster may attune to the orb", () => {
  const fighter = hero("fighter");
  const orb = fighter.item(ORB);
  assert.equal(attunementProblem(orb, fighter.derive(fighter.start)), "주문 시전자만 조율할 수 있습니다");
  const wizard = hero("wizard");
  assert.equal(attunementProblem(orb, wizard.derive(wizard.start)), undefined);
});

test("D360: the cursed ring holds on, lays its penalty, and lets go once the curse is lifted", () => {
  const { derive, item, start } = hero("fighter");
  let runtime = addItem(start, { name: RING.name, custom: item(RING) });
  const ring = derive(runtime).inventory.find((line) => line.name === RING.name)!;
  runtime = toggleAttune(runtime, ring.instanceId, 3, ring.magic);
  const cursed = derive(runtime);
  const plain = derive(start);
  assert.equal(cursed.saves.wis.bonus, plain.saves.wis.bonus - 2, "the curse's penalty");
  assert.equal(cursed.ac.value, plain.ac.value + 1, "and the ring's own bonus");
  assert.ok(cursed.defenses.vulnerabilities.some((line) => line.startsWith("화염")), JSON.stringify(cursed.defenses));
  runtime = toggleAttune(runtime, ring.instanceId, 3, ring.magic);
  assert.ok(derive(runtime).inventory.find((line) => line.instanceId === ring.instanceId)!.attuned, "it will not let go");
  runtime = liftCurse(runtime, ring.instanceId);
  const lifted = derive(runtime);
  assert.equal(lifted.saves.wis.bonus, plain.saves.wis.bonus, "penalty gone");
  assert.equal(lifted.defenses.vulnerabilities.length, 0);
  runtime = toggleAttune(runtime, ring.instanceId, 3, ring.magic);
  assert.equal(derive(runtime).inventory.find((line) => line.instanceId === ring.instanceId)!.attuned, false, "now it comes off");
});

test("D360: at the table fire hurts the cursed bearer twice as much", async () => {
  // A soldier: no spell of their own to answer the swing with, so the hit lands at once.
  const { cat, made, derive, item, start } = hero("fighter", "soldier");
  let runtime = addItem(start, { name: RING.name, custom: item(RING) });
  const ring = derive(runtime).inventory.find((line) => line.name === RING.name)!;
  runtime = toggleAttune(runtime, ring.instanceId, 3, ring.magic);
  const lost = async (sheet: CharacterRuntime) => {
    const hub = new MemoryHub();
    const campaign = { ...newCampaign("D360 시험", { userId: "dm", displayName: "DM" }), joinCode: "D360AA" };
    const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => 0.5, ...pcHostOptions(() => cat) });
    const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "D360AA", hostSecret: "s" });
    await tick();
    const scene = newScene(campaign.id, "화산", 0);
    dm.send({ type: "page.put", page: scene });
    dm.send({ type: "page.ribbon", pageId: scene.id });
    const pc = newJournalCharacter(campaign.id, "dm", made.source, sheet);
    const imp = newJournalNpc(campaign.id, "dm", (parseCustomMonster(JSON.stringify({ name: "불꽃 정령", ac: 10, hp: 20, creatureType: "elemental", abilities: { str: 10, dex: 10, con: 10, int: 6, wis: 10, cha: 6 }, actions: [{ name: "불꽃 손길", attack: { bonus: 30, damage: [{ formula: "2d6", type: "fire" }] } }] })) as { monster: Parameters<typeof newJournalNpc>[2] }).monster);
    for (const entry of [pc, imp]) dm.send({ type: "journal.put", entry });
    await tick();
    const tokens = { pc: tokenForCharacter(pc), imp: tokenForNpc(imp) };
    for (const token of Object.values(tokens)) dm.send({ type: "token.put", pageId: scene.id, token });
    await tick();
    dm.send({ type: "act.attack", attacker: { entryId: imp.id, pageId: scene.id, tokenId: tokens.imp.id }, targets: [{ entryId: pc.id, pageId: scene.id, tokenId: tokens.pc.id }], attack: { source: "npc", actionName: "불꽃 손길" } });
    await tick();
    return sheet.hp.current - (host.journal.find((entry) => entry.id === pc.id) as JournalCharacter).runtime.hp.current;
  };
  const cursed = await lost(runtime);
  const lifted = await lost(liftCurse(runtime, ring.instanceId));
  assert.ok(lifted > 0);
  assert.equal(cursed, lifted * 2, `${cursed} vs ${lifted}`);
});
