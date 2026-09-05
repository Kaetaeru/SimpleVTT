# Authored spell mechanics

Reviewed `SpellMechanicDefinition` JSON for builtin spells (V1.1 roadmap, gate X1-04). The generator
`scripts/generate-spell-authored.ts` validates every file with `parseSpellMechanicFile`
(`src/domain/spellMechanicDefinitionRuntime.ts`) and emits `src/generated/spellAuthoredMechanics.generated.json`;
`src/domain/spellMechanics.ts` gives an authored definition precedence over the reviewed TypeScript definitions
and over prose derivation.

## Rules

- One directory per rules profile (`dnd-srd-5.2.1/`), one file per spell (or a small group), `definitions[]` inside.
- `spellId` must be a canonical catalog spell id. A duplicate id across files fails generation.
- No rules prose is copied here; the `source.review` note records what the definition enforces and what it does not
  (`executionScope` carries the same statement into the runtime presentation).
- The same JSON shape is what an installed add-on carries as a `spell-mechanic` content mechanic on a spell entry.

## Coverage

`SPELL_EXECUTION_COVERAGE` in `src/domain/spellMechanics.ts` counts `authored`, `reviewed`, `derivedCombat`, and
`tracked` separately; `tests/domain/spellExecutionCoverage.test.ts` pins the totals.
