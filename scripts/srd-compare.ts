/**
 * SRD_MODULE_PLAN.md S4: the side-by-side check — does the new SRD module say what the old channels say?
 *
 * Reads a built module (`content/modules/srd-5.2.1/<area>.module.json`) and the running app's catalog (still fed by
 * the old channels), and lists every field that differs, entry by entry. The new text comes from the SRD translation,
 * so a difference is either the old data being wrong (a fix for S6) or the builder reading the source badly (a builder
 * bug) — each is looked at, none is waved through.
 *
 *   npx tsx scripts/srd-compare.ts spells [--out <report.json>]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createCatalog } from "../client/catalog";
import { spellExec } from "../client/compendium/spells";
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

if (area === "spells") spells();
else { console.error("usage: npx tsx scripts/srd-compare.ts spells [--out report.json]"); process.exit(2); }
const byField: Record<string, number> = {};
for (const diff of diffs) byField[diff.field] = (byField[diff.field] ?? 0) + 1;
console.log(`${area}: ${diffs.length} differences`, byField);
if (out) writeFileSync(out, JSON.stringify(diffs, null, 1));
