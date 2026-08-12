# RulesProfile Index

RulesProfiles define ruleset-specific semantics on top of the Common Rule Definition Specification.

## Initial profile

- `dnd-srd-5.2.1.md` — SimpleVTT's initial D&D profile, sourced from System Reference Document 5.2.1 and versioned independently as a SimpleVTT implementation contract.
- `../localization.md` — common localization contract. The initial SRD experience is Korean-first and uses the owner's reviewed D&D 2024/SRD Korean reference repository for terminology and SRD-derived prose.

## Boundary

A RulesProfile defines semantics such as properties, stacking, rounding, D20 rules, action economy, timing, damage interpretation, progression, recovery, activation, and validation.

Named classes, subclasses, species, backgrounds, feats, spells, items, and Combatants belong in compatible RuleModules rather than the resolver or profile code.

Localized names and descriptions are presentation data layered over stable content IDs and structured mechanics. For the initial `dnd.srd-5.2.1.core` module, `ko-KR` is the required default presentation locale for bundled player-visible content.

The initial profile's source is licensed under CC-BY-4.0. Any SRD-derived content that SimpleVTT distributes must carry the attribution required by the source document. Non-SRD proprietary translations from the private reference repository are not part of the distributable default module unless separate redistribution rights are established.
