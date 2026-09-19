/**
 * SRD_MODULE_PLAN.md S4: the side-by-side check — does the new SRD module say what the old channels say?
 *
 * Reads a built module (`content/modules/srd-5.2.1/<area>.module.json`) and the running app's catalog (still fed by
 * the old channels), and lists every field that differs, entry by entry. The new text comes from the SRD translation,
 * so a difference is either the old data being wrong (a fix for S6) or the builder reading the source badly (a builder
 * bug) — each is looked at, none is waved through.
 *
 *   npx tsx scripts/srd-compare.ts spells|characters [--out <report.json>]
 *
 * `characters` derives the same characters (every class at 1/3/5/11/20, every species choice, every background) on the
 * old catalog and on a catalog built from the new modules alone, and lists every field of the sheet that differs.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { ContentCatalog, createCatalog, slugOfId } from "../client/catalog";
import { CREATION_INDEX, PROGRESSION_CATALOG } from "../client/catalog/sources";
import { autofill } from "../client/character/autofill";
import { deriveCharacter } from "../client/character/derive";
import { emptySource } from "../client/character/source";
import type { CharacterSource, DerivedCharacter } from "../client/character/types";
import { featureRuleKey } from "../client/rules/activation";
import { spellExec } from "../client/compendium/spells";
import { MONSTERS } from "../client/compendium/monsters";
import type { RuleModuleJson } from "../client/catalog/types";

const [area, ...rest] = process.argv.slice(2);
const out = rest.includes("--out") ? rest[rest.indexOf("--out") + 1] : undefined;
const catalog = createCatalog([]);
const diffs: Array<{ id: string; field: string; old: unknown; new: unknown }> = [];
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const canonical = (value: unknown): unknown => (Array.isArray(value) ? value.map(canonical) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)])) : value);

function spells() {
  const module = JSON.parse(readFileSync("content/modules/srd-5.2.1/spells.module.json", "utf8")) as RuleModuleJson;
  for (const entry of module.content as unknown as Array<{ id: string; presentation: { originalName: string; locales: Record<string, { name: string }> }; mechanics: Array<{ kind: string; config: Record<string, unknown> }> }>) {
    const old = catalog.spellById(entry.id);
    if (!old) { diffs.push({ id: entry.id, field: "(entry)", old: undefined, new: "new" }); continue; }
    const def = entry.mechanics.find((item) => item.kind === "spell-definition")!.config;
    const pairs: Array<[string, unknown, unknown]> = [
      ["name", old.name, entry.presentation.locales["ko-KR"].name], ["nameEn", old.nameEn, entry.presentation.originalName],
      ["level", old.level, def.level], ["school", old.school, def.school], ["ritual", old.ritual, def.ritual],
      ["castingTime", old.castingTime, def.castingTimeText], ["range", old.range, def.rangeText], ["components", old.components, def.componentsText], ["duration", old.duration, def.durationText],
      ["classes", [...old.classes].sort(), def.classes],
    ];
    for (const [field, a, b] of pairs) if (!same(a, b)) diffs.push({ id: entry.id, field, old: a, new: b });
    const mechanic = entry.mechanics.find((item) => item.kind === "spell-mechanic")?.config;
    const exec = spellExec(entry.id);
    if (exec && mechanic) {
      const { spellId: _id, ...execRest } = exec as unknown as Record<string, unknown>;
      for (const key of new Set([...Object.keys(execRest), ...Object.keys(mechanic)])) {
        // The index parts were folded into the decision on purpose; the execution alone does not carry them.
        if (["sustain", "onHit", "weaponSpell", "creatures", "reaction", "repeatSave", "variants"].includes(key) && execRest[key] === undefined) continue;
        if (key === "trackedEffects") continue;
        if (!same(canonical(execRest[key]), canonical(mechanic[key]))) diffs.push({ id: entry.id, field: `mechanic.${key}`, old: execRest[key], new: mechanic[key] });
      }
    }
  }
  for (const spell of catalog.spells.filter((item) => item.scope === "builtin")) if (!module.content.some((entry) => entry.id === spell.id)) diffs.push({ id: spell.id, field: "(entry)", old: "old", new: undefined });
}

/**
 * The catalog the app will build once the old channels are gone (S5): the new SRD modules only — no generated
 * progression, no creation index beyond the table vocabulary (skills, languages, artisan tools), no extras.
 */
function newOnlyCatalog() {
  const modules = readdirSync("content/modules/srd-5.2.1").map((file) => JSON.parse(readFileSync(`content/modules/srd-5.2.1/${file}`, "utf8")) as RuleModuleJson);
  const index = { ...CREATION_INDEX, classes: {}, spellLists: {}, species: {} };
  const progression = { ...PROGRESSION_CATALOG, classes: [] };
  const extras = { classFeatures: {}, subclasses: [], species: {}, feats: {}, backgrounds: {}, spellLists: {}, classOptions: {} };
  return new ContentCatalog({ modules, installedModules: [], index, progression, spellPresentations: [], extras });
}

/** What a derived character is, reduced to what the table plays with — ids by their rule key, lists sorted. */
function digest(derived: DerivedCharacter) {
  const byKey = <T,>(items: T[], key: (item: T) => string) => [...items].map((item) => key(item)).sort();
  return {
    level: derived.level, hp: derived.hp.max, ac: derived.ac.value, speed: derived.speed.walk, initiative: derived.initiative, senses: derived.senses, size: derived.size,
    saves: Object.fromEntries(Object.entries(derived.saves).map(([key, save]) => [key, save.bonus])),
    skills: byKey(derived.skills, (skill) => `${skill.id}:${skill.bonus}`),
    proficiencies: derived.proficiencies,
    features: byKey(derived.features, (feature) => `${featureRuleKey(feature.id)} = ${feature.name}`),
    resources: byKey(derived.resources, (resource) => `${resource.id}:${resource.max}`),
    slots: derived.spellSlots, pact: derived.pactMagic,
    casting: byKey(derived.spellcasting, (entry) => `${entry.classId}:${entry.ability}:${entry.cantripsMax}/${entry.preparedMax}`),
    attacks: byKey(derived.attacks, (attack) => `${attack.name}:${attack.attackBonus}:${attack.damage}+${attack.damageBonus} ${attack.damageType}`),
    defenses: derived.defenses,
    riders: byKey(derived.attackRiders ?? [], (rider) => `${rider.key}:${rider.label}`),
    choices: byKey(derived.choices, (choice) => `${choice.id}:${choice.count}:${choice.options.length}`),
    blocking: derived.validation.blocking,
  };
}

function characters() {
  const next = newOnlyCatalog();
  const warnings = next.warnings.filter((line) => !line.includes("주문 목록"));
  if (warnings.length) console.log("new catalog warnings:", warnings.slice(0, 20));
  const sources: Array<{ label: string; source: CharacterSource }> = [];
  const build = (label: string, spec: { classes: string; level: number; species?: string; background?: string; choices?: Record<string, string[]> }) => {
    const base = emptySource({ name: label, origin: { speciesId: `dnd.srd521.species.${spec.species ?? "human"}`, backgroundId: `dnd.srd521.background.${spec.background ?? "soldier"}` }, abilities: { method: "manual", base: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 } }, tracks: Array.from({ length: spec.level }, () => ({ classId: `dnd.srd521.class.${spec.classes}`, hp: { kind: "fixed" as const } })), choices: spec.choices ?? {}, equipment: { mode: "loadout" } });
    sources.push({ label, source: autofill(base, catalog, { prefer: spec.choices ?? {} }).source });
  };
  for (const cls of catalog.classes) for (const level of [1, 3, 5, 11, 20]) build(`${cls.slug} ${level}`, { classes: cls.slug, level });
  for (const species of catalog.species) for (const choice of species.choices) {
    if (!Array.isArray(choice.options)) continue;
    for (const option of choice.options) build(`${slugOfId(species.id)} ${choice.id}=${option.id}`, { classes: "fighter", level: 5, species: slugOfId(species.id), choices: { [`origin.${choice.id}`]: [option.id] } });
  }
  for (const species of catalog.species) build(`${slugOfId(species.id)}`, { classes: "fighter", level: 5, species: slugOfId(species.id) });
  const count = (label: string, a: unknown[], b: unknown[]) => { if (a.length !== b.length) diffs.push({ id: "(catalog)", field: label, old: a.length, new: b.length }); };
  count("classes", catalog.classes, next.classes); count("subclasses", catalog.subclasses, next.subclasses); count("species", catalog.species, next.species);
  count("backgrounds", catalog.backgrounds, next.backgrounds); count("feats", catalog.feats, next.feats); count("spells", catalog.spells, next.spells);
  count("items", catalog.items, next.items); count("loadouts", catalog.loadouts, next.loadouts); count("monsters", MONSTERS, next.monsters);
  for (const [list, options] of Object.entries(catalog.classOptions)) count(`options ${list}`, options, next.classOptions[list] ?? []);
  for (const subclass of catalog.subclasses) {
    const other = next.subclassById(subclass.id);
    const features = (view: typeof subclass | undefined) => (view?.features ?? []).map((feature) => `${feature.level}:${featureRuleKey(feature.id)}`).sort();
    if (!same(features(subclass), features(other))) diffs.push({ id: subclass.id, field: "subclass features", old: features(subclass), new: features(other) });
    if (!same(subclass.spells, other?.spells)) diffs.push({ id: subclass.id, field: "subclass spells", old: subclass.spells, new: other?.spells });
  }
  for (const spell of catalog.spells) if (!same([...spell.classes].sort(), [...(next.spellById(spell.id)?.classes ?? [])].sort())) diffs.push({ id: spell.id, field: "spell classes", old: spell.classes, new: next.spellById(spell.id)?.classes });
  for (const background of catalog.backgrounds) build(`background ${slugOfId(background.id)}`, { classes: "wizard", level: 4, background: slugOfId(background.id) });
  let differing = 0;
  for (const { label, source } of sources) {
    const a = digest(deriveCharacter(source, catalog));
    const b = digest(deriveCharacter(source, next));
    for (const key of Object.keys(a) as Array<keyof typeof a>) {
      if (same(a[key], b[key])) continue;
      differing += 1;
      const left = Array.isArray(a[key]) ? (a[key] as string[]).filter((item) => !(b[key] as string[]).includes(item)) : a[key];
      const right = Array.isArray(b[key]) ? (b[key] as string[]).filter((item) => !(a[key] as string[]).includes(item)) : b[key];
      diffs.push({ id: label, field: key, old: left, new: right });
    }
  }
  console.log(`characters: ${sources.length} built, ${differing} differing fields`);
}

if (area === "spells") spells();
else if (area === "characters") characters();
else { console.error("usage: npx tsx scripts/srd-compare.ts spells|characters [--out report.json]"); process.exit(2); }
const byField: Record<string, number> = {};
for (const diff of diffs) byField[diff.field] = (byField[diff.field] ?? 0) + 1;
console.log(`${area}: ${diffs.length} differences`, byField);
if (out) writeFileSync(out, JSON.stringify(diffs, null, 1));
