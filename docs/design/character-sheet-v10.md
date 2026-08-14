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

- The character sheet owns its viewport scrolling explicitly because the app-level `.content` container clips overflow.
- Dense data should remain scannable without forcing every rule paragraph into the sheet.
- Traits, feats, spells, and items expose detail on pointer hover and keyboard focus.
- Character Creation option cards use the same progressive-disclosure principle: compact selector first, rule detail on hover/focus.
- Popovers render in a fixed React portal so scrolling containers cannot clip them.
- Feat hover copy is derived from the pinned SRD 5.2.1 translation/mechanics.
- Level-0 and level-1 spells use Korean primary names from the pinned `Kaetaeru/D-D-2024-` SRD translation, with the English original name retained as secondary metadata.
- `SRD 소마법` and `SRD 1레벨 주문` are spell-list metadata, not rules prose. They must never be presented as the spell description.
- Until full spell prose is materialized into the SimpleVTT presentation catalog, hover explicitly reports that the detailed SRD description is not yet connected instead of inventing or disguising fallback text.

## Structure Gate

`tests/ui/characterSheetV10Structure.test.ts` locks:

- distinct Class / Species / Feat / Other trait projections;
- saving throws and skills grouped under their governing ability;
- SRD-derived feat description availability;
- Korean primary spell names with English originals retained separately;
- generic spell-list metadata never masquerading as rules prose;
- explicit character-sheet viewport scroll ownership;
- compact option-card and official-sheet structural CSS hooks.
