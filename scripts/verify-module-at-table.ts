/**
 * Play an installed module at a table and report what does not reach it (D307).
 *
 *   node --import tsx --import ./tests/support/register-css.mjs scripts/verify-module-at-table.ts <module.json> [report.json]
 *
 * The grammar check (`check-module-grammar.ts`) proves a module can be read; this proves it can be played. Every
 * character the module makes — each subclass at 20th level, each feat, each background — sits at a host table beside
 * an ally and a training dummy, and everything a player can press is pressed the way the screens press it:
 *
 * - every feature button: the sheet's half (`activateFeature`) and the table's half (`act.contract`, targets named by
 *   token only, as the board sends them);
 * - every choice a hit opens (`act.onhit`) and every declaration before the dice (`riders.contracts`);
 * - every spell the module adds, cast with a slot, and its ↻ repeat when it has one;
 * - every window a hit on the character should open.
 *
 * Each use is sorted into: refused, nothing happened (pressable, and no sheet, token or table line changed beyond the
 * log), or reached. The module is read from outside the repository and nothing is written into it.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { newJournalCharacter, newJournalNpc, type JournalCharacter, type JournalEntry } from "../client/campaign/journal";
import { newCampaign } from "../client/campaign/model";
import { newScene, tokenForCharacter, tokenForNpc } from "../client/campaign/page";
import { createCatalog } from "../client/catalog";
import type { RuleModuleJson } from "../client/catalog/types";
import { activateFeature, usableFeatures } from "../client/character/activate";
import { autofill } from "../client/character/autofill";
import { rollFormula } from "../client/character/dice";
import { emptySource } from "../client/character/source";
import { initialRuntime } from "../client/character/runtime";
import type { CharacterRuntime, DerivedCharacter } from "../client/character/types";
import { parseCustomMonster } from "../client/compendium/customMonster";
import { spellExec, sustainOf } from "../client/compendium/spells";
import { featureRuleKey } from "../client/rules/activation";
import { riderFitsAttack } from "../client/rules/attackRiders";
import { tableOutcome } from "../client/rules/contractTable";
import { derivedOf } from "../client/rules/attackSpec";
import { castOptions } from "../client/screens/SheetView";
import { TableClient } from "../client/session/client";
import { TableHost } from "../client/session/host";
import { pcHostOptions } from "../client/session/pcHost";
import { MemoryHub } from "../client/session/transport";

type Verdict = "reached" | "nothing" | "refused" | "skipped";
interface Row { area: string; who: string; what: string; verdict: Verdict; detail: string }

// `--builtin` plays the content the app ships (the SRD) instead of an installed module's.
const BUILTIN = process.argv.includes("--builtin");
const [modulePath, reportPath] = process.argv.slice(2).filter((arg) => arg !== "--builtin");
if (!modulePath && !BUILTIN) { console.error("usage: … verify-module-at-table.ts <module.json> [report.json] | --builtin [report.json]"); process.exit(2); }
const module = modulePath && !BUILTIN ? JSON.parse(readFileSync(modulePath, "utf8")) as RuleModuleJson : undefined;
const reportOut = BUILTIN ? modulePath : reportPath;
const catalog = createCatalog(module ? [module] : []);
const SCOPE = BUILTIN ? "builtin" : "installed";
const rows: Row[] = [];
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
let seq = 0;

/** A quiet copy of a sheet's runtime: what a use may change, without the log and the clock. */
const shape = (runtime: CharacterRuntime) => JSON.stringify({ hp: runtime.hp, used: runtime.resourcesUsed, slots: runtime.slotsUsed, pact: runtime.pactSlotsUsed, effects: (runtime.effects ?? []).map((effect) => effect.key), conditions: runtime.conditions, inventory: runtime.inventory?.extra?.length, hitDice: runtime.hitDiceUsed });

async function table(source: ReturnType<typeof emptySource>) {
  seq += 1;
  const hub = new MemoryHub();
  const code = `V${String(seq).padStart(5, "0")}`;
  const campaign = { ...newCampaign("검증", { userId: "dm", displayName: "DM" }), joinCode: code };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => 0.5, ...pcHostOptions(() => catalog) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: code, hostSecret: "s" });
  const refusals: string[] = [];
  dm.onRefused((reason) => refusals.push(reason));
  await tick();
  const scene = newScene(campaign.id, "훈련장", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const made = autofill(source, catalog, { prefer: source.choices });
  const hero = newJournalCharacter(campaign.id, "dm", { ...made.source, name: "주인공" }, initialRuntime(made.derived));
  const allyMade = autofill(emptySource({ name: "동료", origin: { speciesId: "dnd.srd521.species.human", backgroundId: "dnd.srd521.background.soldier" }, abilities: { method: "manual", base: { str: 14, dex: 12, con: 14, int: 10, wis: 10, cha: 10 } }, tracks: Array.from({ length: 5 }, () => ({ classId: "dnd.srd521.class.fighter", hp: { kind: "fixed" as const } })), choices: {}, equipment: { mode: "loadout" } }), catalog);
  const allyRuntime = initialRuntime(allyMade.derived);
  const ally = newJournalCharacter(campaign.id, "dm", allyMade.source, { ...allyRuntime, hp: { ...allyRuntime.hp, current: 5 } });
  const dummy = newJournalNpc(campaign.id, "dm", (parseCustomMonster(JSON.stringify({ name: "허수아비", ac: 12, hp: 500, creatureType: "humanoid", abilities: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 }, actions: [{ name: "주먹", attack: { mode: "melee", bonus: 30, rangeFeet: 5, damage: [{ formula: "1d4", type: "bludgeoning" }] } }] })) as { monster: Parameters<typeof newJournalNpc>[2] }).monster);
  for (const entry of [hero, ally, dummy]) dm.send({ type: "journal.put", entry });
  await tick();
  const tokens = { hero: tokenForCharacter(hero), ally: tokenForCharacter(ally), dummy: tokenForNpc(dummy) };
  for (const token of Object.values(tokens)) dm.send({ type: "token.put", pageId: scene.id, token });
  await tick();
  const live = (id: string) => host.journal.find((entry) => entry.id === id) as JournalEntry;
  const allTokens = () => host.pageList.flatMap((page) => page.tokens);
  const dummyHp = () => allTokens().find((token) => token.id === tokens.dummy.id)?.bars[0]?.value;
  const dummyMarks = () => JSON.stringify(allTokens().find((token) => token.id === tokens.dummy.id)?.markers ?? []);
  const board = () => JSON.stringify(allTokens().map((token) => [token.id, token.bars[0]?.value, token.markers.length]));
  const ref = (key: keyof typeof tokens) => ({ pageId: scene.id, tokenId: tokens[key].id });
  const heroRef = { entryId: hero.id, pageId: scene.id, tokenId: tokens.hero.id };
  const dummyRef = { entryId: dummy.id, pageId: scene.id, tokenId: tokens.dummy.id };
  return { host, dm, hero, ally, dummy, tokens, live, allTokens, dummyHp, dummyMarks, board, ref, heroRef, dummyRef, refusals, derived: made.derived, messages: () => host.archive.length };
}
type Table = Awaited<ReturnType<typeof table>>;

const roll = async (spec: Parameters<typeof rollFormula>[0]) => rollFormula(spec, () => 0.5);
/**
 * The sheet a use starts from: half its hit points, one of every pool and slot level spent, charmed and frightened —
 * so that healing, recovering a use and ending a condition have something to do. `drained` spends every pool whole,
 * for the uses that give one back (a slot for a use).
 */
const fresh = async (t: Table, drained = false) => {
  const start = initialRuntime(t.derived);
  const resourcesUsed = Object.fromEntries(t.derived.resources.map((pool) => [pool.id, drained ? pool.max : pool.max >= 2 ? 1 : 0]));
  const slotsUsed = Object.fromEntries(Object.entries(t.derived.spellSlots).map(([level, max]) => [level, drained ? 0 : max >= 2 ? 1 : 0]));
  const runtime = { ...start, hp: { ...start.hp, current: Math.max(1, Math.floor(start.hp.current / 2)) }, resourcesUsed, slotsUsed, conditions: ["매혹", "공포"], updatedAt: new Date().toISOString() };
  t.dm.send({ type: "journal.put", entry: { ...(t.live(t.hero.id) as JournalCharacter), runtime } });
  await tick();
  return runtime;
};

/** Press every button the turn panel would show, each on a fresh sheet so one use cannot starve the next. */
async function pressFeatures(t: Table, who: string, only: (id: string) => boolean) {
  const derived = t.derived;
  for (const use of usableFeatures(derived, (t.live(t.hero.id) as JournalCharacter).runtime, catalog)) {
    if (!use.pressable || !only(use.feature.id)) continue;
    let runtime = await fresh(t);
    let beforeSheet = shape(runtime);
    const beforeBoard = t.board();
    const beforeAlly = shape((t.live(t.ally.id) as JournalCharacter).runtime);
    const beforeMessages = t.messages();
    const refusedBefore = t.refusals.length;
    const press = () => activateFeature(use.feature, { source: (t.live(t.hero.id) as JournalCharacter).source, catalog, derived, runtime, rollDice: roll, save: (updater) => { runtime = updater(runtime); }, askPoints: () => 1, confirmSelfHeal: () => true, askForm: (_name, options) => options[0]?.id ?? null });
    let outcome = await press();
    // A use that gives a pool back is refused while the pool is full; try it once more with every pool spent.
    if (outcome === "refused") { runtime = await fresh(t, true); beforeSheet = shape(runtime); outcome = await press(); }
    if (outcome === "refused") { rows.push({ area: "feature", who, what: use.feature.name, verdict: "refused", detail: "activateFeature refused on a fresh sheet" }); continue; }
    if (outcome !== "done") { rows.push({ area: "feature", who, what: use.feature.name, verdict: "skipped", detail: outcome }); continue; }
    t.dm.send({ type: "journal.put", entry: { ...(t.live(t.hero.id) as JournalCharacter), runtime } });
    await tick();
    const outcomeTable = tableOutcome(derived, catalog, featureRuleKey(use.feature.id));
    let tableLine = "";
    if (outcomeTable) {
      const helps = outcomeTable.party.tempHp || outcomeTable.party.heal || outcomeTable.party.healPool || outcomeTable.party.grants.length || outcomeTable.conditionsRemoved.length;
      t.dm.send({ type: "act.contract", actor: t.heroRef, ruleKey: featureRuleKey(use.feature.id), targets: [helps ? t.ref("ally") : t.ref("dummy")] });
      await tick();
      tableLine = t.host.archive.slice(beforeMessages).map((message) => message.content).join(" | ");
    }
    const sheetMoved = shape((t.live(t.hero.id) as JournalCharacter).runtime) !== beforeSheet;
    const boardMoved = t.board() !== beforeBoard || shape((t.live(t.ally.id) as JournalCharacter).runtime) !== beforeAlly;
    const refused = t.refusals.slice(refusedBefore);
    // A use that names a pool must spend it: a button that works but never counts down is the same defect as one
    // that does nothing.
    const pool = use.activation.resourceId;
    const heroNow = (t.live(t.hero.id) as JournalCharacter).runtime;
    const unspent = pool && derived.resources.some((item) => item.id === pool) && (heroNow.resourcesUsed[pool] ?? 0) <= (JSON.parse(beforeSheet).used?.[pool] ?? 0) && !use.activation.slotGain;
    const verdict: Verdict = refused.length ? "refused" : unspent ? "nothing" : sheetMoved || boardMoved ? "reached" : "nothing";
    rows.push({ area: "feature", who, what: use.feature.name, verdict, detail: refused.join(" / ") || (unspent ? `pool ${pool} not spent · ` : "") + tableLine.slice(0, 200) });
  }
}

/** Every choice a hit opens, and every declaration made before the dice, on a weapon it fits. */
async function swingRiders(t: Table, who: string, only: (key: string) => boolean) {
  const derived = derivedOf(t.live(t.hero.id) as JournalCharacter, catalog) as DerivedCharacter;
  for (const rider of derived.attackRiders ?? []) {
    if (!only(rider.key)) continue;
    if (rider.requiresEffects.length) { rows.push({ area: "rider", who, what: rider.label, verdict: "skipped", detail: `needs ${rider.requiresEffects.join(", ")}` }); continue; }
    const attack = derived.attacks.find((item) => riderFitsAttack(rider, item));
    if (!attack) { rows.push({ area: "rider", who, what: rider.label, verdict: "skipped", detail: `no weapon fits ${rider.scope}` }); continue; }
    await fresh(t);
    const hpBefore = t.dummyHp();
    const marksBefore = t.dummyMarks();
    const start = t.messages();
    const refusedBefore = t.refusals.length;
    const facts = rider.facts.map((fact) => fact.id);
    if (rider.moment === "pre-roll") {
      t.dm.send({ type: "act.attack", attacker: t.heroRef, targets: [t.ref("dummy")], attack: { source: "weapon", attackId: attack.id }, riders: { contracts: [rider.key], facts }, overrides: { outcome: "hit" } });
      await tick();
      const prompt = t.host.archive.slice(start).find((message) => message.type === "prompt" && message.prompt?.kind === "on-hit");
      if (prompt) { t.dm.send({ type: "act.onhit", messageId: prompt.id, choices: [] } as never); await tick(); }
    } else {
      t.dm.send({ type: "act.attack", attacker: t.heroRef, targets: [t.ref("dummy")], attack: { source: "weapon", attackId: attack.id }, overrides: { outcome: "hit" } });
      await tick();
      const prompt = t.host.archive.slice(start).find((message) => message.type === "prompt" && message.prompt?.kind === "on-hit");
      const offered = prompt?.prompt?.onHit?.offers.some((offer) => offer.key === rider.key);
      if (!prompt || !offered) { rows.push({ area: "rider", who, what: rider.label, verdict: "nothing", detail: `the hit window did not offer it (${prompt ? prompt.prompt!.onHit!.offers.map((offer) => offer.key).join(",") : "no window"})` }); continue; }
      t.dm.send({ type: "act.onhit", messageId: prompt.id, choices: [rider.key], facts } as never);
      await tick();
    }
    const refused = t.refusals.slice(refusedBefore);
    const later = t.host.archive.slice(start);
    const card = [...later].reverse().find((message) => message.action);
    const parts = card?.action?.damage.map((part) => part.part.label) ?? [];
    const carries = parts.length > 1;
    const spent = rider.resourceId ? ((t.live(t.hero.id) as JournalCharacter).runtime.resourcesUsed[rider.resourceId] ?? 0) > 0 : false;
    const text = later.map((message) => message.content).join(" | ");
    const moved = carries || spent || t.dummyMarks() !== marksBefore || /내성/.test(text);
    rows.push({ area: "rider", who, what: rider.label, verdict: refused.length ? "refused" : moved ? "reached" : "nothing", detail: refused.join(" / ") || `hp ${hpBefore}→${t.dummyHp()} · parts ${parts.join("+")} · ${text.slice(-140)}` });
  }
}

/** A hit on the character: the windows its own contracts declare for "an attack hit me" must open. */
async function takeHit(t: Table) {
  await fresh(t);
  const start = t.messages();
  t.dm.send({ type: "act.attack", attacker: t.dummyRef, targets: [t.heroRef], attack: { source: "npc", actionName: "주먹" }, overrides: { outcome: "hit" } });
  await tick();
  const prompt = t.host.archive.slice(start).find((message) => message.type === "prompt" && (message.prompt?.kind === "guard" || message.prompt?.kind === "shield"));
  return prompt?.prompt?.guard?.features.map((feature) => feature.name) ?? [];
}

/**
 * A species whose traits depend on a choice (드래곤본의 혈통, 골리앗의 거인 혈통) must offer only what that choice
 * gives. Each option is built in turn and the species uses it offers are compared: if two different picks offer the
 * same several uses, the uses are not reading the choice — every dragonborn could breathe every element.
 */
async function speciesChoices(base: (tracks: number, classId: string, choices: Record<string, string[]>, backgroundId?: string, speciesId?: string) => ReturnType<typeof emptySource>) {
  for (const species of catalog.species.filter((item) => item.scope === SCOPE)) {
    for (const choice of species.choices.filter((item) => Array.isArray(item.options) && item.options.length > 1)) {
      const offered: Record<string, string[]> = {};
      for (const option of choice.options as Array<{ id: string; name: string }>) {
        const t = await table(base(5, "dnd.srd521.class.fighter", { [choice.id]: [option.id] }, "dnd.srd521.background.soldier", species.id));
        const uses = usableFeatures(t.derived, (t.live(t.hero.id) as JournalCharacter).runtime, catalog).filter((use) => use.feature.id.includes(".trait.") || featureRuleKey(use.feature.id).startsWith("species."));
        offered[option.name] = uses.map((use) => use.feature.name).sort();
        await pressFeatures(t, `${species.name} (${option.name})`, (id) => id.includes(".trait.") || featureRuleKey(id).startsWith("species."));
      }
      const lists = Object.values(offered).map((list) => JSON.stringify(list));
      const same = lists.length > 1 && new Set(lists).size === 1 && JSON.parse(lists[0]).length > 1;
      rows.push({ area: "species-choice", who: species.name, what: choice.label, verdict: same ? "nothing" : "reached", detail: same ? `every pick offers the same ${JSON.parse(lists[0]).length} uses: ${JSON.parse(lists[0]).join(", ")}` : "uses follow the pick" });
    }
  }
}

const LEVEL_OF: Record<string, (level: number) => number> = { full: (level) => Math.max(1, level * 2 - 1), half: (level) => Math.max(1, level * 4 - 3), pact: (level) => Math.max(1, level * 2 - 1) };

async function castSpells() {
  for (const spell of catalog.spells.filter((item) => item.scope === SCOPE)) {
    const exec = spellExec(spell.id);
    // Pact Magic stops at 5th-level slots, so a higher spell goes to a class that has them.
    const casters = spell.classes.map((id) => catalog.classById(id)).filter((item) => item && item.casterKind !== "none");
    const cls = casters.find((item) => spell.level <= 5 || item!.casterKind !== "pact") ?? casters[0];
    if (!exec || !cls) { rows.push({ area: "spell", who: "-", what: spell.name, verdict: "skipped", detail: !exec ? "no execution" : `no casting class in ${spell.classes.join(",")}` }); continue; }
    const level = Math.min(20, LEVEL_OF[cls.casterKind]?.(Math.max(1, spell.level)) ?? 20);
    const pick = spell.level === 0 ? "class.0.cantrips" : "class.0.spells";
    const source = emptySource({ name: "시전자", origin: { speciesId: "dnd.srd521.species.human", backgroundId: "dnd.srd521.background.sage" }, abilities: { method: "manual", base: { str: 10, dex: 14, con: 14, int: 16, wis: 16, cha: 16 } }, tracks: Array.from({ length: level }, () => ({ classId: cls.id, hp: { kind: "fixed" as const } })), choices: { [pick]: [spell.id], "class.0.spellbook": [spell.id] }, equipment: { mode: "loadout" } });
    const t = await table(source);
    const options = castOptions(spell, t.derived, (t.live(t.hero.id) as JournalCharacter).runtime);
    const method = options.find((option) => option.method.kind === "slot" && option.method.level === Math.max(1, spell.level))?.method ?? options[0]?.method;
    if (!method) { rows.push({ area: "spell", who: cls.name, what: spell.name, verdict: "skipped", detail: `not castable by ${cls.name} ${level}` }); continue; }
    const selfOnly = exec.targeting.allowedRelations?.every((relation) => relation === "self");
    const friendly = ["healing", "temporary-hp", "maximum-hp", "full-healing", "revive"].includes(exec.primary.kind) || exec.targeting.allowedRelations?.every((relation) => relation === "self" || relation === "ally");
    // A spell that names no creature (a point, an object, an area the board cannot see) is cast with none, as the
    // screen sends it once the targeting window slices to the count the spell takes.
    const takes = exec.targeting.maxTargets;
    const targets = selfOnly || takes === 0 ? [] : [friendly ? t.ref("ally") : t.ref("dummy")];
    const before = t.board();
    const allyBefore = shape((t.live(t.ally.id) as JournalCharacter).runtime);
    const heroBefore = JSON.stringify({ hp: (t.live(t.hero.id) as JournalCharacter).runtime.hp, effects: ((t.live(t.hero.id) as JournalCharacter).runtime.effects ?? []).map((effect) => effect.key).filter((key) => key !== `spell:${spell.id}`) });
    const tokensBefore = t.allTokens().length;
    const start = t.messages();
    const refusedBefore = t.refusals.length;
    t.dm.send({ type: "act.cast", caster: t.heroRef, spellId: spell.id, targets, method, overrides: { outcome: "hit" } } as never);
    await tick();
    const card = t.host.archive.slice(start).find((message) => message.type === "spell" && message.spell);
    const refused = t.refusals.slice(refusedBefore);
    const summoned = t.allTokens().length > tokensBefore;
    const heroAfter = JSON.stringify({ hp: (t.live(t.hero.id) as JournalCharacter).runtime.hp, effects: ((t.live(t.hero.id) as JournalCharacter).runtime.effects ?? []).map((effect) => effect.key).filter((key) => key !== `spell:${spell.id}`) });
    const moved = t.board() !== before || shape((t.live(t.ally.id) as JournalCharacter).runtime) !== allyBefore || heroAfter !== heroBefore || summoned || Boolean(card?.spell?.targets.some((row) => row.effect || row.marks?.length || row.save || row.attack));
    rows.push({ area: "spell", who: `${cls.name} ${level}`, what: spell.name, verdict: refused.length ? "refused" : !card ? "nothing" : moved ? "reached" : "nothing", detail: refused.join(" / ") || (card ? card.content.slice(0, 160) : "no card") });
    const sustain = sustainOf(exec);
    if (sustain && !refused.length && card) {
      const again = t.messages();
      const boardAgain = t.board();
      const refusedAgain = t.refusals.length;
      t.dm.send({ type: "act.cast", caster: t.heroRef, spellId: spell.id, targets: sustain.target === "bound" ? [] : targets, method: { kind: "sustain" } } as never);
      await tick();
      const repeat = t.host.archive.slice(again).find((message) => message.type === "spell" && message.spell);
      const refusedRepeat = t.refusals.slice(refusedAgain);
      const repeatMoved = t.board() !== boardAgain || Boolean(repeat?.spell?.targets.some((row) => row.effect || row.save || row.attack || row.damage));
      rows.push({ area: "spell-repeat", who: `${cls.name} ${level}`, what: `${spell.name} ↻`, verdict: refusedRepeat.length ? "refused" : !repeat ? "nothing" : repeatMoved ? "reached" : "nothing", detail: refusedRepeat.join(" / ") || (repeat ? repeat.content.slice(0, 160) : "no card") });
    }
  }
}

async function main() {
  const base = (tracks: number, classId: string, choices: Record<string, string[]>, backgroundId = "dnd.srd521.background.soldier", speciesId = BUILTIN ? "dnd.srd521.species.human" : "phb2024.species.aasimar") => emptySource({ name: "주인공", origin: { speciesId, backgroundId }, abilities: { method: "manual", base: { str: 16, dex: 14, con: 14, int: 13, wis: 13, cha: 13 } }, tracks: Array.from({ length: tracks }, () => ({ classId, hp: { kind: "fixed" as const } })), choices, equipment: { mode: "loadout" } });

  for (const subclass of catalog.subclasses.filter((item) => item.scope === SCOPE)) {
    const t = await table(base(20, subclass.classId, { "class.2.subclass": [subclass.id] }));
    // An installed subclass is judged on its own features; the SRD is judged whole — class and subclass alike.
    const own = (id: string) => BUILTIN || id.startsWith(subclass.id) || id.startsWith("phb2024.option.") || id.startsWith("phb2024.species.") || id.includes("aasimar");
    await pressFeatures(t, subclass.name, own);
    await swingRiders(t, subclass.name, (key) => own(key.split("#")[0]));
    const windows = await takeHit(t);
    const declares = subclass.features.filter((feature) => catalog.contracts.get(featureRuleKey(feature.id))?.interceptors.some((item) => item.timing === "reaction.window" && item.trigger === "attack.hit-self"));
    for (const feature of declares) rows.push({ area: "reaction", who: subclass.name, what: feature.name, verdict: windows.includes(feature.name) ? "reached" : "nothing", detail: `window offered: ${windows.join(", ") || "none"}` });
  }
  // Feats: general ones at the 4th-level choice, epic boons at the 19th, fighting styles at the 1st, origin feats
  // through the backgrounds that give them.
  for (const feat of catalog.feats.filter((item) => item.scope === SCOPE)) {
    const slot = feat.tier === "epic-boon" ? "class.18.epic-boon" : feat.tier === "general" ? "class.3.asi" : feat.tier === "fighting-style" ? "class.0.fighting-style" : undefined;
    const background = feat.tier === "origin" ? catalog.backgrounds.find((item) => item.originFeat === feat.id)?.id : undefined;
    if (!slot && !background) { rows.push({ area: "feat", who: "-", what: feat.name, verdict: "skipped", detail: "no background gives it" }); continue; }
    const t = await table(base(20, "dnd.srd521.class.fighter", slot ? { [slot]: [feat.id] } : {}, background));
    if (!t.derived.feats.some((item) => item.id === feat.id)) { rows.push({ area: "feat", who: "-", what: feat.name, verdict: "skipped", detail: "autofill did not take it" }); continue; }
    const slug = feat.id.split(".").pop()!;
    await pressFeatures(t, feat.name, (id) => featureRuleKey(id).startsWith(`feat:${slug}`));
    await swingRiders(t, feat.name, (key) => key.startsWith(`feat:${slug}`));
  }
  if (BUILTIN) await speciesChoices(base);
  await castSpells();

  const count = (verdict: Verdict) => rows.filter((row) => row.verdict === verdict).length;
  console.log(JSON.stringify({ uses: rows.length, reached: count("reached"), nothing: count("nothing"), refused: count("refused"), skipped: count("skipped") }));
  for (const row of rows.filter((item) => item.verdict !== "reached")) console.log(`${row.verdict.toUpperCase()} [${row.area}] ${row.who} · ${row.what} — ${row.detail}`);
  if (reportOut) writeFileSync(reportOut, JSON.stringify(rows, null, 1));
}

main().then(() => process.exit(0), (error) => { console.error(error); process.exit(1); });
