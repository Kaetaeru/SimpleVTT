/**
 * SRD_MODULE_PLAN.md S4: move the SRD's rule decisions out of the old channels into hand-editable JSON, once.
 *
 * Today one SRD spell's execution is spread over the generated execution catalog and eight indexes (sustain, on-hit,
 * lasting-effect dice, weapon spell, creatures, reaction, repeat save, variants), and its class lists over the creation
 * index and the extras. This reads all of them through the running app — so what is exported is exactly what plays —
 * and writes one decision per entry under `content/srd-authoring/`. From then on the decisions are edited there, and
 * `scripts/srd-build-modules.mjs` joins them with the source text. Nothing here reads rule text.
 *
 *   npx tsx scripts/srd-export-decisions.ts spells
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createCatalog } from "../client/catalog";
import { bearerPartsOf, creaturesOf, onHitOf, repeatSaveOf, spellExec, variantsOf, weaponSpellOf, type SpellExec } from "../client/compendium/spells";
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

if (area === "spells") spells();
else { console.error("usage: npx tsx scripts/srd-export-decisions.ts spells"); process.exit(2); }
