/**
 * SRD_MODULE_PLAN.md S4: move the SRD's rule decisions out of the old channels into hand-editable JSON, once.
 *
 * Today one SRD spell's execution is spread over the generated execution catalog and eight indexes (sustain, on-hit,
 * lasting-effect dice, weapon spell, creatures, reaction, repeat save, variants), and its class lists over the creation
 * index and the extras. This reads all of them through the running app — so what is exported is exactly what plays —
 * and writes one decision per entry under `content/srd-authoring/`. From then on the decisions are edited there, and
 * `scripts/srd-build-modules.mjs` joins them with the source text. Nothing here reads rule text.
 *
 *   npx tsx scripts/srd-export-decisions.ts spells|rules|equipment|origins|classes|monsters
 *
 * `rules` (every option entry that carries a contract) and `equipment` (items and starting loadouts) are already rule
 * decisions in module form, so they move as they are — the old modules' entries, verbatim.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createCatalog } from "../client/catalog";
import { bearerPartsOf, creaturesOf, onHitOf, repeatSaveOf, spellExec, variantsOf, weaponSpellOf, type SpellExec } from "../client/compendium/spells";
import { MONSTERS } from "../client/compendium/monsters";
import { traitRules } from "../client/compendium/monsterTraits";
import sustainJson from "../content/indexes/dnd-srd-5.2.1.spell-sustain.json";
import reactionJson from "../content/indexes/dnd-srd-5.2.1.spell-reaction.json";

const area = process.argv[2];
const catalog = createCatalog([]);
const OUT = "content/srd-authoring";
mkdirSync(OUT, { recursive: true });

const sortKeys = (value: unknown): unknown => (Array.isArray(value) ? value.map(sortKeys) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, sortKeys(item)])) : value);

function spells() {
  const sustain = (sustainJson as unknown as { spells: Record<string, unknown> }).spells;
  const reaction = (reactionJson as unknown as { spells: Record<string, unknown> }).spells;
  const out: Record<string, { classes: string[]; mechanic?: Record<string, unknown> }> = {};
  for (const spell of catalog.spells.filter((item) => item.scope === "builtin")) {
    const exec = spellExec(spell.id);
    const decision: { classes: string[]; mechanic?: Record<string, unknown> } = { classes: [...spell.classes].sort() };
    if (exec) {
      const { spellId: _id, ...rest } = exec as SpellExec & Record<string, unknown>;
      const mechanic: Record<string, unknown> = { ...rest };
      // The index parts, folded in where the execution itself does not carry them.
      if (mechanic.sustain === undefined && spell.id in sustain) mechanic.sustain = sustain[spell.id];
      const onHit = onHitOf(exec);
      if (onHit) mechanic.onHit = onHit;
      const bearer = bearerPartsOf(spell.id);
      if (bearer.length) mechanic.trackedEffects = bearer;
      const weapon = weaponSpellOf(spell.id);
      if (weapon) mechanic.weaponSpell = weapon;
      const creatures = creaturesOf(spell.id);
      if (creatures) mechanic.creatures = creatures;
      if (reaction[spell.id]) mechanic.reaction = reaction[spell.id];
      const repeat = repeatSaveOf(exec);
      if (repeat) mechanic.repeatSave = repeat;
      const variants = variantsOf(spell.id);
      if (variants.length) mechanic.variants = variants;
      decision.mechanic = mechanic;
    }
    out[spell.id] = decision;
  }
  writeFileSync(`${OUT}/spells.json`, `${JSON.stringify(sortKeys(out), null, 1)}\n`);
  console.log(`spells: ${Object.keys(out).length} decisions → ${OUT}/spells.json`);
}

/** Every entry of the old SRD modules whose category passes the filter, verbatim, by id. */
function verbatim(name: string, keep: (entry: { id: string; category: string; mechanics?: Array<{ kind: string }> }) => boolean) {
  const out: Record<string, unknown> = {};
  for (const dir of readdirSync("content/modules").filter((item) => item.startsWith("dnd-srd-5.2.1.")).sort()) {
    const module = JSON.parse(readFileSync(`content/modules/${dir}/module.json`, "utf8")) as { content: Array<{ id: string; category: string; mechanics?: Array<{ kind: string }> }> };
    for (const entry of module.content) if (keep(entry)) out[entry.id] = entry;
  }
  writeFileSync(`${OUT}/${name}.json`, `${JSON.stringify(sortKeys(out), null, 1)}\n`);
  console.log(`${name}: ${Object.keys(out).length} entries → ${OUT}/${name}.json`);
}
/**
 * Species, backgrounds and feats: the definitions as they play today (a species' traits keyed as its rule keys, its
 * choices and their effects), each with the source heading its text is read from — `heading`, edited by hand when the
 * translation names it differently. The text itself is not exported; the builder reads it from the source.
 */
function origins() {
  const entryOf = (id: string) => catalog.entry(id);
  const defOf = (id: string, kind: string) => entryOf(id)?.mechanics.find((item) => item.kind === kind)?.config as Record<string, unknown> | undefined;
  const species = Object.fromEntries(catalog.species.filter((item) => item.scope === "builtin").map((view) => [view.id, {
    size: view.sizes, speed: view.speed, ...(view.darkvision ? { darkvision: view.darkvision } : {}),
    traits: view.traits.map((trait) => ({ key: trait.id.split(".trait.").pop(), heading: trait.name, nameEn: trait.nameEn, ...(trait.minLevel ? { minLevel: trait.minLevel } : {}) })),
    choices: view.choices, effects: view.effects, semantics: view.semantics,
  }]));
  const backgrounds = Object.fromEntries(catalog.backgrounds.filter((item) => item.scope === "builtin").map((view) => [view.id, { definition: defOf(view.id, "background-definition") }]));
  const feats = Object.fromEntries(catalog.feats.filter((item) => item.scope === "builtin").map((view) => [view.id, { heading: view.name, nameEn: view.nameEn, mechanics: entryOf(view.id)?.mechanics ?? [], tags: entryOf(view.id)?.tags ?? [] }]));
  writeFileSync(`${OUT}/origins.json`, `${JSON.stringify(sortKeys({ species, backgrounds, feats }), null, 1)}\n`);
  console.log(`origins: ${Object.keys(species).length} species, ${Object.keys(backgrounds).length} backgrounds, ${Object.keys(feats).length} feats → ${OUT}/origins.json`);
}
/**
 * Classes: the definition with its whole level table (features as entry ids or row roles, columns), creation choices
 * and spell counts; each class feature, subclass feature and class option as an entry with the source heading its text
 * is read from; the option lists with their gates. A class feature's entry id is `dnd.srd521.feature.<its old id>`, so
 * its rule key — and every contract, pool and saved policy keyed by it — stays the same.
 */
function classes() {
  const roleOf = (nameEn: string) => (nameEn === "Ability Score Improvement" ? "asi" : nameEn === "Epic Boon" ? "epic-boon" : nameEn === "Subclass Feature" ? "subclass-feature" : /Subclass$/.test(nameEn) ? "subclass" : undefined);
  const features: Record<string, { heading: string; nameEn: string; classId: string; level: number; fallback?: string }> = {};
  const defs: Record<string, unknown> = {};
  for (const view of catalog.classes.filter((item) => item.scope === "builtin")) {
    const def = (catalog.entry(view.id)?.mechanics.find((item) => item.kind === "class-definition")?.config ?? {}) as Record<string, unknown>;
    const levels = view.progression.map((row) => ({
      level: row.level, proficiencyBonus: row.proficiencyBonus, columns: row.columns,
      features: row.featureRecords.map((record) => {
        const role = roleOf(record.nameEn);
        if (role) return { role, name: record.name };
        const id = `dnd.srd521.feature.${record.id}`;
        features[id] ??= { heading: record.name, nameEn: record.nameEn, classId: view.id, level: row.level, ...(record.description ? { fallback: record.description } : {}) };
        return id;
      }),
    }));
    defs[view.id] = { ...def, casterKind: view.casterKind, skillOptions: view.skillChoice, level1Choices: view.level1Choices, ...(view.spells ? { spells: view.spells } : {}), multiclassGrants: view.multiclassGrants, levels };
  }
  const subclasses: Record<string, unknown> = {};
  for (const view of catalog.subclasses.filter((item) => item.scope === "builtin")) {
    const entry = catalog.entry(view.id);
    for (const feature of view.features) features[feature.id] ??= { heading: feature.name, nameEn: feature.nameEn, classId: view.classId, level: feature.level, ...(feature.description ? { fallback: feature.description } : {}) };
    subclasses[view.id] = {
      classId: view.classId, heading: view.name, nameEn: view.nameEn, ...(view.summary ? { summary: view.summary } : {}),
      definition: { choices: view.choices, spellsByOption: view.spellsByOption, spells: view.spells },
      features: view.features.map((feature) => ({ level: feature.level, id: feature.id })),
      mechanics: (entry?.mechanics ?? []).filter((item) => item.kind !== "subclass-definition"),
    };
  }
  const optionLists: Record<string, unknown> = {};
  const options: Record<string, unknown> = {};
  for (const [list, items] of Object.entries(catalog.classOptions)) {
    optionLists[list] = items.map((item) => ({ id: item.id, ...(item.minLevel ? { minLevel: item.minLevel } : {}), ...(item.prerequisiteOptionId ? { requires: item.prerequisiteOptionId } : {}), ...(item.cost ? { cost: item.cost } : {}), ...(item.repeatable ? { repeatable: true } : {}), ...(item.targetKind ? { targetKind: item.targetKind } : {}) }));
    for (const item of items) options[item.id] = { heading: item.name, nameEn: item.nameEn ?? item.name, ...(item.description ? { fallback: item.description } : {}) };
  }
  writeFileSync(`${OUT}/classes.json`, `${JSON.stringify(sortKeys({ classes: defs, features, subclasses, optionLists, options }), null, 1)}\n`);
  console.log(`classes: ${Object.keys(defs).length} classes, ${Object.keys(features).length} features, ${Object.keys(subclasses).length} subclasses, ${Object.keys(optionLists).length} option lists → ${OUT}/classes.json`);
}
/**
 * Monsters: every SRD stat block as the table keeps it, with the trait rules the SRD index kept by monster and trait
 * name written onto the traits themselves (`traits[].rules`) — the shape a module monster uses.
 */
function monsters() {
  const out: Record<string, unknown> = {};
  for (const monster of MONSTERS) {
    const traits = monster.traits.map((trait) => {
      const own = traitRules({ id: monster.id, traits: [trait] }).map((item) => item.rule);
      return own.length && !trait.rules ? { ...trait, rules: own } : trait;
    });
    const { id: _id, slug: _slug, name: _name, nameEn: _nameEn, ...block } = { ...monster, traits };
    out[monster.id] = { name: monster.name, nameEn: monster.nameEn, statBlock: block };
  }
  writeFileSync(`${OUT}/monsters.json`, `${JSON.stringify(sortKeys(out), null, 1)}\n`);
  console.log(`monsters: ${Object.keys(out).length} stat blocks → ${OUT}/monsters.json`);
}
const EQUIPMENT = new Set(["item", "ammunition", "focus", "armor", "shield", "adventuring-gear", "weapon", "tool", "starting-loadout"]);

if (area === "spells") spells();
else if (area === "rules") verbatim("rules", (entry) => entry.category === "option" && (entry.mechanics ?? []).some((item) => item.kind === "common-play"));
else if (area === "origins") origins();
else if (area === "classes") classes();
else if (area === "monsters") monsters();
else if (area === "equipment") verbatim("equipment", (entry) => EQUIPMENT.has(entry.category));
else { console.error("usage: npx tsx scripts/srd-export-decisions.ts spells|rules|equipment|origins|classes|monsters"); process.exit(2); }
