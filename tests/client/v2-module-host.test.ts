/**
 * V0.9 V2 (ROLL20_TABLE_SPEC.md D254): content that exists only as JSON — a module subclass feature, a module spell,
 * a module reaction spell and a pasted NPC — plays at the table through the same host paths as the SRD, with the
 * host wired exactly as the app wires it (`pcHostOptions`).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { newJournalCharacter, newJournalNpc, type JournalCharacter } from "../../client/campaign/journal";
import { newCampaign, type ChatMessage } from "../../client/campaign/model";
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
const MODULE = JSON.parse(readFileSync("tests/fixtures/v09-module/module.json", "utf8")) as RuleModuleJson;

async function table() {
  const catalog = createCatalog([MODULE]);
  assert.deepEqual(catalog.warnings.filter((line) => line.includes("test.")), []);
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("V2 시험", { userId: "dm", displayName: "DM" }), joinCode: "V2AAAA" };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => 0.5, ...pcHostOptions(() => catalog) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "V2AAAA", hostSecret: "s" });
  await tick();
  const scene = newScene(campaign.id, "폭풍 언덕", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const pc = (name: string, spec: Parameters<typeof sourceOf>[0]) => {
    const made = autofill(sourceOf(spec), catalog);
    assert.deepEqual(made.derived.validation.blocking, [], `${name}: ${made.derived.validation.blocking.join(" / ")}`);
    return newJournalCharacter(campaign.id, "dm", { ...made.source, name }, initialRuntime(made.derived));
  };
  const fighter = pc("폭풍 검객", { name: "폭풍 검객", classes: "fighter", level: 3, choices: { "class.2.subclass": ["test.subclass.fighter.storm-blade"] } });
  const wizard = pc("서리 마법사", { name: "서리 마법사", classes: "wizard", level: 1, choices: { "class.0.spellbook": ["test.spell.frost-lance", "test.spell.bone-ward"], "class.0.spells": ["test.spell.frost-lance", "test.spell.bone-ward"] } });
  const parsed = parseCustomMonster(JSON.stringify({ name: "모래 거인", ac: 10, hp: 80, creatureType: "giant", abilities: { str: 16, dex: 8, con: 14, int: 6, wis: 10, cha: 6 },
    actions: [{ name: "주먹", attack: { mode: "melee", bonus: 6, rangeFeet: 5, damage: [{ formula: "1d8+3", type: "bludgeoning" }] } }] }));
  assert.ok("monster" in parsed, JSON.stringify(parsed));
  const giant = newJournalNpc(campaign.id, "dm", (parsed as { monster: Parameters<typeof newJournalNpc>[2] }).monster);
  for (const entry of [fighter, wizard, giant]) dm.send({ type: "journal.put", entry });
  await tick();
  const tokens = { fighter: tokenForCharacter(fighter), wizard: tokenForCharacter(wizard), giant: tokenForNpc(giant) };
  for (const token of Object.values(tokens)) dm.send({ type: "token.put", pageId: scene.id, token });
  await tick();
  const ref = (entryId: string, tokenId: string) => ({ entryId, pageId: scene.id, tokenId });
  const refs = { fighter: ref(fighter.id, tokens.fighter.id), wizard: ref(wizard.id, tokens.wizard.id), giant: ref(giant.id, tokens.giant.id) };
  const entry = <T,>(id: string) => host.journal.find((item) => item.id === id) as T;
  const messages = () => host.archive;
  const open = (kind: string) => { const answered = new Set(messages().map((message) => message.supersedes)); return messages().filter((message) => message.type === "prompt" && message.prompt?.kind === kind && !message.prompt.outcome && !answered.has(message.id)); };
  const cards = () => messages().filter((message): message is ChatMessage & { action: NonNullable<ChatMessage["action"]> } => message.type === "action" && Boolean(message.action));
  return { dm, refs, entry, open, cards, messages, fighter, wizard, giant, catalog };
}

test("V2: a module subclass feature's on-hit rider is offered after a hit and its damage lands (D254)", async () => {
  const t = await table();
  const derived = autofill(t.fighter.source, t.catalog).derived;
  assert.ok(derived.features.some((feature) => feature.name === "우레 일격"), derived.features.map((feature) => feature.name).join(", "));
  const weapon = derived.attacks.find((attack) => attack.itemId)!;
  t.dm.send({ type: "act.attack", attacker: t.refs.fighter, targets: [t.refs.giant], attack: { source: "weapon", attackId: weapon.id }, overrides: { outcome: "hit" } });
  await tick();
  const [prompt] = t.open("on-hit");
  const key = "test.feature.storm-blade.thunder-strike";
  assert.ok(prompt?.prompt?.onHit?.offers.some((offer) => offer.key === key), JSON.stringify(prompt?.prompt?.onHit?.offers));
  t.dm.send({ type: "act.onhit", messageId: prompt.id, choices: [key] });
  await tick();
  const card = t.cards().at(-1)!;
  const thunder = card.action.damage.find((part) => part.part.label === "우레 일격");
  assert.ok(thunder && thunder.dice.length === 1, JSON.stringify(card.action.damage.map((part) => part.part.label)));
});

test("V2: a module spell is cast at the table — the save, the damage, the slot (D254)", async () => {
  const t = await table();
  t.dm.send({ type: "act.cast", caster: t.refs.wizard, spellId: "test.spell.frost-lance", targets: [t.refs.giant], method: { kind: "slot", level: 1 } });
  await tick();
  const card = t.messages().filter((message) => message.type === "spell" && message.spell).at(-1)!;
  assert.equal(card.spell!.name, "서리 창");
  const row = card.spell!.targets[0];
  assert.equal(row.save?.ability, "con");
  assert.ok(row.damage && row.damage.damageTotal > 0, JSON.stringify(row));
  assert.equal(t.entry<JournalCharacter>(t.wizard.id).runtime.slotsUsed[1], 1);
});

test("V2: a module reaction spell answers a hit through its own effect contract (D254)", async () => {
  const t = await table();
  t.dm.send({ type: "act.attack", attacker: t.refs.giant, targets: [t.refs.wizard], attack: { source: "npc", actionName: "주먹" } });
  await tick();
  const [prompt] = t.open("shield");
  assert.equal(prompt?.prompt?.spellId, "test.spell.bone-ward", JSON.stringify(t.messages().at(-1)));
  t.dm.send({ type: "act.cast", caster: t.refs.wizard, spellId: "test.spell.bone-ward", targets: [t.refs.wizard], method: { kind: "slot", level: 1 }, reaction: prompt.id });
  await tick();
  const card = t.cards().at(-1)!;
  assert.equal(card.action.outcome, "miss", `AC ${card.action.targetAc}: the ward's +10 comes from its effect contract`);
  assert.ok(card.action.reasons.join(" ").includes("뼈 방벽"), JSON.stringify(card.action.reasons));
});
