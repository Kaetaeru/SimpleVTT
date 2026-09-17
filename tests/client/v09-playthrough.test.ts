/**
 * V0.9 V3 (ROLL20_TABLE_SPEC.md D255): the playthrough. A party of four — a fighter, a wizard, a cleric and a rogue,
 * all level 5 — meets an ogre and two goblins at a table run only by host commands, wired as the app wires it
 * (`pcHostOptions`). Initiative, a concentration buff, an area spell with saves, a hit that opens the on-hit window,
 * a monster's hit answered by a reaction spell, the fight's end and a short rest: at each step the computed numbers
 * are checked, and every question the table asked is one of the windows a player answers with a click.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalCharacter, newJournalNpc, type JournalCharacter } from "../../client/campaign/journal";
import { newCampaign, type ChatMessage } from "../../client/campaign/model";
import { newScene, tokenForCharacter, tokenForNpc } from "../../client/campaign/page";
import { autofill } from "../../client/character/autofill";
import { initialRuntime } from "../../client/character/runtime";
import { monsterById } from "../../client/compendium/monsters";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { pcHostOptions } from "../../client/session/pcHost";
import { MemoryHub } from "../../client/session/transport";
import { catalog, sourceOf } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
/** The windows a player answers with a click (CLAUDE.md §1.2–1.4). */
const CLICK_WINDOWS = new Set(["opportunity", "shield", "counterspell", "death-save", "rescue", "guard", "on-hit", "trigger"]);

async function table() {
  const cat = catalog();
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("V0.9 통과", { userId: "dm", displayName: "DM" }), joinCode: "V9AAAA" };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => 0.5, ...pcHostOptions(() => cat) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "V9AAAA", hostSecret: "s" });
  await tick();
  const scene = newScene(campaign.id, "오거의 동굴", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const character = (name: string, spec: Parameters<typeof sourceOf>[0]) => {
    const made = autofill(sourceOf({ ...spec, name }), cat);
    assert.deepEqual(made.derived.validation.blocking, [], `${name}: ${made.derived.validation.blocking.join(" / ")}`);
    return { entry: newJournalCharacter(campaign.id, "dm", { ...made.source, name }, initialRuntime(made.derived)), derived: made.derived };
  };
  const party = {
    fighter: character("브론", { classes: "fighter", level: 5, abilities: { str: 16, dex: 14, con: 14 } }),
    wizard: character("엘라", { classes: "wizard", level: 5, abilities: { str: 8, dex: 14, con: 14, int: 16 }, choices: { "class.0.spellbook": ["dnd.srd521.spell.fireball", "dnd.srd521.spell.shield"], "class.0.spells": ["dnd.srd521.spell.fireball", "dnd.srd521.spell.shield"] } }),
    cleric: character("토린", { classes: "cleric", level: 5, abilities: { str: 14, dex: 10, con: 14, wis: 16 }, choices: { "class.0.spells": ["dnd.srd521.spell.bless"] } }),
    rogue: character("미라", { classes: "rogue", level: 5, abilities: { str: 10, dex: 16, con: 14 } }),
  };
  const monsters = {
    ogre: newJournalNpc(campaign.id, "dm", monsterById("dnd.srd521.monster.ogre")!),
    goblinA: newJournalNpc(campaign.id, "dm", monsterById("dnd.srd521.monster.goblin-warrior")!, { name: "고블린 1" }),
    goblinB: newJournalNpc(campaign.id, "dm", monsterById("dnd.srd521.monster.goblin-warrior")!, { name: "고블린 2" }),
  };
  for (const entry of [...Object.values(party).map((item) => item.entry), ...Object.values(monsters)]) dm.send({ type: "journal.put", entry });
  await tick();
  const tokenOf: Record<string, ReturnType<typeof tokenForNpc>> = {};
  for (const [key, item] of Object.entries(party)) tokenOf[key] = tokenForCharacter(item.entry);
  for (const [key, entry] of Object.entries(monsters)) tokenOf[key] = tokenForNpc(entry);
  for (const token of Object.values(tokenOf)) dm.send({ type: "token.put", pageId: scene.id, token });
  await tick();
  const entryIds: Record<string, string> = { ...Object.fromEntries(Object.entries(party).map(([key, item]) => [key, item.entry.id])), ...Object.fromEntries(Object.entries(monsters).map(([key, entry]) => [key, entry.id])) };
  const ref = (key: string) => ({ entryId: entryIds[key], pageId: scene.id, tokenId: tokenOf[key].id });
  const sheet = (key: string) => host.journal.find((item) => item.id === entryIds[key]) as JournalCharacter;
  const tokenNow = (key: string) => host.pageList.find((page) => page.id === scene.id)!.tokens.find((token) => token.id === tokenOf[key].id)!;
  const hp = (key: string) => tokenNow(key).bars[0].value ?? 0;
  const markers = (key: string) => tokenNow(key).markers.map((marker) => marker.name);
  const answered = () => new Set(host.archive.map((message) => message.supersedes));
  const open = (kind?: string) => host.archive.filter((message) => message.type === "prompt" && (!kind || message.prompt?.kind === kind) && !message.prompt?.outcome && !answered().has(message.id));
  const cards = () => host.archive.filter((message): message is ChatMessage & { action: NonNullable<ChatMessage["action"]> } => message.type === "action" && Boolean(message.action));
  const spells = () => host.archive.filter((message) => message.type === "spell" && message.spell);
  const refusals: string[] = [];
  dm.onRefused((reason, commandType) => refusals.push(`${commandType}: ${reason}`));
  const refused = () => refusals;
  return { host, dm, party, monsters, ref, sheet, hp, markers, open, cards, spells, refused, tokenOf, entryIds, scene };
}

test("V0.9: four adventurers, an ogre and two goblins — initiative to a short rest, by host commands alone (D255)", async () => {
  const t = await table();
  const { dm } = t;

  // 1. Initiative: the host rolls 1d20 + the sheet's bonus for everyone (the d20 is 11 here).
  const order = ["fighter", "wizard", "cleric", "rogue", "ogre", "goblinA", "goblinB"];
  for (const key of order) {
    const bonus = key in t.party ? t.party[key as keyof typeof t.party].derived.initiative : 0;
    dm.send({ type: "tracker.add", turn: { name: key, tokenId: t.tokenOf[key].id, pageId: t.scene.id, entryId: t.entryIds[key] }, rollBonus: bonus });
  }
  await tick();
  const turns = t.host.state.tracker!.turns;
  assert.equal(turns.length, order.length, JSON.stringify(turns));
  for (const key of ["fighter", "wizard", "cleric", "rogue"]) {
    const turn = turns.find((item) => item.entryId === t.entryIds[key])!;
    assert.equal(turn.initiative, 11 + t.party[key as "fighter"].derived.initiative, `${key} initiative`);
  }
  dm.send({ type: "tracker.next" });
  await tick();

  // 2. The cleric blesses the fighter and the rogue: the effect lands on both sheets, concentration on the cleric.
  dm.send({ type: "act.cast", caster: t.ref("cleric"), spellId: "dnd.srd521.spell.bless", targets: [t.ref("fighter"), t.ref("rogue")], method: { kind: "slot", level: 1 } });
  await tick();
  assert.equal(t.refused().length, 0, JSON.stringify(t.refused()));
  for (const key of ["fighter", "rogue"]) assert.ok(t.sheet(key).runtime.effects.some((effect) => effect.key === "spell:dnd.srd521.spell.bless"), `${key} is blessed: ${JSON.stringify(t.sheet(key).runtime.effects)}`);
  assert.ok(t.sheet("cleric").runtime.effects.some((effect) => effect.concentration), "the cleric concentrates");
  assert.equal(t.sheet("cleric").runtime.slotsUsed[1], 1);

  // 3. The wizard's fireball: every target saves against the wizard's DC, the damage follows the save.
  const goblinHp = t.hp("goblinA");
  const ogreHp = t.hp("ogre");
  dm.send({ type: "act.cast", caster: t.ref("wizard"), spellId: "dnd.srd521.spell.fireball", targets: [t.ref("ogre"), t.ref("goblinA"), t.ref("goblinB")], method: { kind: "slot", level: 3 } });
  await tick();
  const fireball = t.spells().at(-1)!.spell!;
  assert.equal(fireball.targets.length, 3);
  for (const row of fireball.targets) {
    assert.ok(row.save, "a save per target");
    assert.equal(row.save!.dc, t.party.wizard.derived.spellcasting[0].saveDc);
  }
  const ogreRow = fireball.targets.find((row) => row.target.id === t.entryIds.ogre)!;
  assert.equal(t.hp("ogre"), Math.max(0, ogreHp - ogreRow.damage!.damageTotal), "the ogre's bar follows the card");
  assert.equal(t.hp("goblinA"), Math.max(0, goblinHp - fireball.targets.find((row) => row.target.id === t.entryIds.goblinA)!.damage!.damageTotal));
  assert.equal(t.sheet("wizard").runtime.slotsUsed[3], 1);
  for (const key of ["goblinA", "goblinB"]) if (t.hp(key) === 0) assert.ok(t.markers(key).includes("사망"), `${key} at 0 HP is marked dead: ${t.markers(key)}`);

  // 4. The rogue's hit opens the on-hit window with 암습; taken, its dice land on the card.
  const blade = t.party.rogue.derived.attacks.find((attack) => attack.properties.includes("finesse"))!;
  dm.send({ type: "act.attack", attacker: t.ref("rogue"), targets: [t.ref("ogre")], attack: { source: "weapon", attackId: blade.id }, overrides: { outcome: "hit" } });
  await tick();
  const [onHit] = t.open("on-hit");
  assert.ok(onHit?.prompt?.onHit?.offers.some((offer) => offer.key === "rogue.sneak-attack"), JSON.stringify(onHit?.prompt?.onHit?.offers));
  const beforeSneak = t.hp("ogre");
  dm.send({ type: "act.onhit", messageId: onHit.id, choices: ["rogue.sneak-attack"], facts: ["sneak-advantage"] });
  await tick();
  const sneakCard = t.cards().at(-1)!;
  assert.equal(sneakCard.action.damage.find((part) => part.part.label === "암습")?.dice.length, 3, "level 5: 3d6");
  assert.ok(JSON.stringify(sneakCard.action).includes("축복"), "Bless adds its d4 to the blessed rogue's attack");
  assert.equal(t.hp("ogre"), Math.max(0, beforeSneak - sneakCard.action.damageTotal));

  // 5. The ogre hits the wizard, who answers with Shield from the reaction window.
  dm.send({ type: "act.attack", attacker: t.ref("ogre"), targets: [t.ref("wizard")], attack: { source: "npc", actionName: t.monsters.ogre.statBlock.actions.find((action) => action.kind === "attack")!.name } });
  await tick();
  const [shield] = t.open("shield");
  if (shield) {
    assert.equal(shield.prompt!.spellId, "dnd.srd521.spell.shield");
    dm.send({ type: "act.cast", caster: t.ref("wizard"), spellId: "dnd.srd521.spell.shield", targets: [t.ref("wizard")], method: { kind: "slot", level: 1 }, reaction: shield.id });
    await tick();
    const blocked = t.cards().at(-1)!;
    assert.equal(blocked.action.targetAc, t.party.wizard.derived.ac.value + 5, "Shield's +5 from its effect contract");
  }

  // 5b. The ogre hits the concentrating cleric: the concentration save is rolled by the host, and the sheet follows it.
  const clericHp = t.sheet("cleric").runtime.hp.current;
  dm.send({ type: "act.attack", attacker: t.ref("ogre"), targets: [t.ref("cleric")], attack: { source: "npc", actionName: t.monsters.ogre.statBlock.actions.find((action) => action.kind === "attack")!.name }, overrides: { outcome: "hit" } });
  await tick();
  const clubbed = t.cards().at(-1)!;
  assert.ok(clubbed.action.concentration, `a concentration save on the card: ${JSON.stringify(clubbed.action)}`);
  assert.equal(clubbed.action.concentration!.dc, Math.max(10, Math.floor(clubbed.action.damageTotal / 2)));
  assert.equal(t.sheet("cleric").runtime.hp.current, clericHp - clubbed.action.damageTotal);
  assert.equal(t.sheet("cleric").runtime.effects.some((effect) => effect.concentration), clubbed.action.concentration!.success, "the sheet keeps concentration only on a success");
  assert.equal(t.sheet("fighter").runtime.effects.some((effect) => effect.key === "spell:dnd.srd521.spell.bless"), clubbed.action.concentration!.success, "and Bless on its targets with it");

  // 5c. A round goes by: effects that count rounds count them.
  const blessBefore = t.sheet("fighter").runtime.effects.find((effect) => effect.key === "spell:dnd.srd521.spell.bless");
  for (let step = 0; step < order.length; step += 1) { dm.send({ type: "tracker.next" }); await tick(); }
  const blessAfter = t.sheet("fighter").runtime.effects.find((effect) => effect.key === "spell:dnd.srd521.spell.bless");
  if (blessBefore) assert.ok(blessAfter && blessAfter.elapsed === blessBefore.elapsed + 1, `a round passed on Bless: ${JSON.stringify([blessBefore, blessAfter])}`);

  // 6. The fighter finishes the ogre.
  const sword = t.party.fighter.derived.attacks.find((attack) => attack.itemId && !attack.range)!;
  for (let swing = 0; swing < 12 && t.hp("ogre") > 0; swing += 1) {
    dm.send({ type: "act.attack", attacker: t.ref("fighter"), targets: [t.ref("ogre")], attack: { source: "weapon", attackId: sword.id }, overrides: { outcome: "hit" } });
    await tick();
    for (const prompt of t.open("on-hit")) dm.send({ type: "act.decline", messageId: prompt.id });
    await tick();
  }
  assert.equal(t.hp("ogre"), 0, "the ogre is down");
  assert.ok(t.markers("ogre").includes("사망"), `${t.markers("ogre")}`);

  // 7. A short rest: the table's windows ask, nothing is typed.
  dm.send({ type: "table.rest", kind: "short" });
  await tick();
  for (const prompt of t.open()) assert.ok(CLICK_WINDOWS.has(prompt.prompt!.kind), `${prompt.prompt!.kind} is a click window`);

  // Every question the table asked during the fight was a window a player answers with a click.
  for (const message of t.host.archive.filter((item) => item.type === "prompt")) assert.ok(CLICK_WINDOWS.has(message.prompt!.kind), message.content);
  assert.equal(t.refused().length, 0, JSON.stringify(t.refused()));
});
