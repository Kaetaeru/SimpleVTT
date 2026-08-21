# WO-UI-009 — Semantic Action Bar icons

Date: 2026-08-22
Status: IMPLEMENTED / OWNER QA PENDING
Authority: Owner direction during Connected Play Action Bar review

## Objective

Replace placeholder text glyphs in every Action Bar slot with a shared semantic vector-icon projection. Icons improve rapid recognition but do not become rules authority.

## Projection order

For a magic capability:

1. use the first represented damage property that has a canonical icon;
2. if no damage property is represented, use the localized canonical spell presentation to select its school icon;
3. if the action is healing, use the healing effect icon;
4. only a magic action without canonical spell metadata may use the generic magic fallback.

For other capabilities, use represented physical damage type, healing, Item cost, or resolution kind. Every action has a generic semantic fallback, so a placeholder character is never required.

## Shared vocabulary

Elemental and school shapes are the same SVG vocabulary already used by Spellbook/Spell detail UI:

- fire, cold, lightning, acid, poison, psychic, radiant, necrotic, force, thunder, healing;
- abjuration, conjuration, divination, enchantment, evocation, illusion, necromancy, transmutation.

Weapon actions distinguish slashing, piercing, and bludgeoning. Item use, ability checks, saving throws, generic attacks, and general actions also have dedicated shapes.

## Authority boundary

- Icon choice reads `ActionVm`, its `DamageSpecVm`, and canonical `spellCast.spellId` presentation metadata.
- The icon does not determine action availability, targets, cost, damage, school, or resolution.
- Action names are not used to infer a mechanic.
- Hover/focus repeats the projected icon meaning in text.

## Acceptance

- every mounted Action Bar slot contains a semantic SVG icon;
- a damaging magic action uses its attack property icon;
- a non-damaging canonical spell uses its school icon;
- non-spell action families retain distinct recognizable icons;
- unavailable, selected, Main Hand, targeting, cost, and hover states remain intact;
- typecheck, structural tests, production build, and browser QA pass.
