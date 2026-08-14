# Character Sheet V10 — official-structure digital sheet

## Intent

Use the 2024 D&D Character Sheet as the information-architecture reference while keeping SimpleVTT's own visual language and interaction model.

The implementation does not reproduce Wizards of the Coast artwork or decorative trade dress. It preserves the functional grouping players expect from the official sheet and adapts it for a digital VTT.

## Page 1 structure

- Identity: name, background, class, species, subclass, level.
- Combat durability: Armor Class, Hit Points, Hit Dice, Death Saves.
- Proficiency Bonus.
- Six ability blocks. Each ability owns its saving throw and associated skills instead of placing all skills in one unrelated list.
- Initiative, Speed, Size, Passive Perception.
- Weapons & Damage / Cantrips.
- Class Features as a dedicated large region.
- Species Traits as a dedicated region.
- Feats as a dedicated region.
- Other Traits as a dedicated region for background/other source choices.
- Equipment Training & Proficiencies.

## Page 2 structure

- Spellcasting ability, modifier, Spell Save DC, Spell Attack Bonus.
- Spell Slots.
- Cantrips & Prepared Spells.
- Appearance placeholder for the future identity/portrait model.
- Backstory & Personality, preserving Character Creation notes.
- Languages.
- Interactive Equipment.
- Coins.

## Interaction rules

- Dense data should remain scannable without forcing every rule paragraph into the sheet.
- Traits, feats, spells, and items expose detail on pointer hover and keyboard focus.
- Character Creation option cards use the same progressive-disclosure principle: compact selector first, rule detail on hover/focus.
- Popovers render in a fixed React portal so scrolling containers cannot clip them.
- Feat hover copy is derived from the pinned SRD 5.2.1 translation/mechanics.
- Spell hover uses materialized catalog description when available. The current repository does not yet contain full description materialization for all 339 spells; absent text remains an explicit catalog-coverage issue rather than invented prose.

## Structure Gate

`tests/ui/characterSheetV10Structure.test.ts` locks:

- distinct Class / Species / Feat / Other trait projections;
- saving throws and skills grouped under their governing ability;
- SRD-derived feat description availability;
- compact option-card and official-sheet structural CSS hooks.
