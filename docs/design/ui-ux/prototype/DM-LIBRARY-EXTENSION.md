# Integrated Reference Extension — DM Library

Status: **OWNER-DIRECT CANDIDATE EXTENSION — VISUAL/FLOW ACCEPTANCE PENDING**

Product plan:

`docs/design/ui-ux/DM-LIBRARY-PLAN.md`

Architecture boundary:

`docs/design/dm-library-persistence.md`

Existing accepted reference:

`docs/design/ui-ux/prototype/app/integrated-reference.html`

Candidate review entry:

`docs/design/ui-ux/prototype/app/dm-library-reference.html`

---

# 1. Governance

The 2026-08-21 accepted `integrated-reference.html` remains accepted for the already-reviewed product and Connected Play scenes.

This extension adds a newly requested product concept that was absent from that accepted candidate.

Therefore:

- do **not** retroactively claim that the old accepted prototype already covered DM Library;
- do **not** invalidate unrelated accepted scenes;
- review the new DM Library extension separately;
- after Owner acceptance, integrate its surfaces/flows into the next consolidated Integrated Reference baseline.

Runtime implementation is not authorized merely because this prototype exists.

---

# 2. Visual relationship to existing product

DM Library is part of the same Product Shell visual language.

Global top navigation remains:

```text
Home | Characters | Session | Content | Rules | Settings
```

`DM Library` is contextual to Session and is not a seventh global destination.

The dedicated preparation surface uses:

```text
Product top nav
Session context header
────────────────────────────────────────────────────────────
Collection rail     Library results/grid     Detail/preview
────────────────────────────────────────────────────────────
```

Collections:

```text
Images
PC Actors
NPC Actors
```

The design should feel like a fast campaign-preparation shelf, not a filesystem explorer.

---

# 3. Shared visual states

Every DM Library preparation view must clearly expose these distinctions:

- `LOCAL · NOT SHARED` for private durable preparation material;
- `IN CURRENT SESSION` only after an Actor has been instantiated;
- `REVEALED` only after explicit image reveal;
- validation/problem badges without silently repairing definitions;
- private notes visually identified as DM-local/private.

Do not label the Offline user as a connected DM role merely because the surface is called DM Library.

---

# 4. Candidate prototype scenarios

## DMLIB-SCN-01 — Offline Images

Surface:

`Session -> DM Library -> Images`

Show:

- top Product Shell navigation with Session active;
- breadcrumb/context: `Session / DM Library`;
- `LOCAL · NOT SHARED` status;
- search;
- favorites/recent quick filters;
- small folder collection rail;
- image cards with thumbnails/titles/tags;
- selected image detail/large preview;
- Edit / Duplicate / Favorite / Delete;
- Add/Import Image;
- no `Reveal` button when no Session is live.

Synthetic sample assets may represent:

- sealed letter;
- cult emblem;
- forest shrine;
- suspect portrait;
- location illustration.

No image may be presented as a tactical map.

---

## DMLIB-SCN-02 — Offline NPC Actor Definitions

Surface:

`Session -> DM Library -> NPC Actors`

Show:

- folders such as Bandits / Undead / Named NPC;
- search/tags;
- reusable definition cards;
- portrait/name/role summary;
- compact HP/AC/action count only as fixture presentation;
- selected definition details;
- Edit / Duplicate / Favorite / Delete;
- New NPC / Import;
- one validation warning example for missing/disabled content dependency.

Must explain visually/textually:

`Reusable source definition — Session HP/state changes do not modify this preset.`

---

## DMLIB-SCN-03 — Offline PC Actor Presets

Surface:

`Session -> DM Library -> PC Actors`

Show:

- pre-generated guest/ally examples;
- explicit descriptor: `Host-prepared Actor preset`;
- explicit non-ownership note: `Not a Player-owned Character`;
- portrait/name/class-like summary where fixture provides it;
- Edit / Duplicate / Favorite / Delete;
- New PC Actor Preset / Import.

The surface must not reuse Character Library copy suggesting that these records are canonical Player Characters.

---

## DMLIB-SCN-04 — Live Encounter / Add from Library

Context:

Existing accepted Host/DM Freeform Play scene.

Flow:

```text
Encounter
  -> Add Actor
  -> From DM Library
  -> NPC Actors
  -> search/select Nightcrow Archer
  -> Quantity: 3
  -> Add to Session
```

Presentation:

- accepted Actor Boards / Stage / Command Center remain visible beneath/alongside the contextual utility;
- Library picker lives inside the Encounter task, not as a full Product route change;
- selected source definition shows `LOCAL SOURCE`;
- pending add summary shows `Creates 3 independent Session Actors`;
- explicit Add action;
- after fixture transition, three new Session Actor cards appear independently.

Do not show source-definition HP changing when Session Actor HP changes.

---

## DMLIB-SCN-05 — Live Handout / Reveal from Library

Context:

Existing accepted Host/DM Freeform Play scene.

Flow:

```text
Session / Handout
  -> Choose Image
  -> DM Library
  -> select sealed letter
  -> Private Preview
  -> Reveal to Players
```

Presentation requirements:

- preview state clearly says `PRIVATE PREVIEW · NOT SHARED`;
- no Player projection before explicit Reveal;
- Reveal activates the existing accepted Handout presentation semantics;
- Withdraw remains a Session presentation action, not deletion from Library.

Prototype mocks delivery only. Real transport remains blocked by Handout architecture work.

---

## DMLIB-SCN-06 — Player non-delivery

Context:

Client/Player Play.

Show:

- no DM Library launcher;
- no folders/tags/library metadata;
- no secret prepared asset names;
- no placeholder indicating unrevealed library entries;
- an instantiated Actor may appear only as authorized Session projection;
- a revealed image may appear only after shared Handout fixture is active.

This is a privacy/non-delivery presentation test, not proof of network security implementation.

---

# 5. Collection navigation

Preferred preparation navigation:

```text
DM Library
[Images] [PC Actors] [NPC Actors]
```

A left rail may combine collection/folder filters if it remains quick and compact.

Core collection switching must remain directly visible and must not be hidden behind a generic kebab/drawer.

---

# 6. Search and filtering

The candidate should demonstrate:

- one persistent search field;
- collection-aware search results;
- favorites;
- recent;
- folders;
- tag chips/filters;
- clear reset/All behavior.

Search is fixture-driven in the prototype and does not define indexing implementation.

---

# 7. Cards and details

## Image card

Minimum visible information:

- thumbnail;
- name;
- a small tag/folder hint;
- favorite state.

## Actor source card

Minimum visible information:

- portrait/initials;
- name;
- PC preset vs NPC definition kind;
- compact source summary;
- validation badge if needed.

Do not overload cards with full stat blocks. Full detail belongs in the selected detail/preview region.

---

# 8. Live invocation rule

Dedicated DM Library preparation is a Product Shell surface.

Live use should normally invoke a contextual picker from the current task:

- Encounter requests Actor source;
- Handout requests Image source.

The user should not have to leave live Play, navigate to the Product DM Library page, then manually return just to add an Actor or reveal an image.

The same underlying local Library is used by both preparation and live pickers.

---

# 9. Responsive review

Review at the existing prototype presets:

- Wide 1600x1000;
- Normal 1366x768;
- Narrow 960x700.

At Narrow:

- collection switching remains directly reachable;
- result cards remain usable;
- detail panel may become an explicit detail layer/pane;
- live Encounter picker must not obscure every Play anchor simultaneously;
- no mobile-only navigation model is introduced.

---

# 10. Acceptance questions

Owner review should answer:

1. Does `Session -> DM Library` feel like the correct preparation location?
2. Are Images / PC Actors / NPC Actors the right first-class categories?
3. Is private/local state unmistakable?
4. Is the Actor source -> Session instance distinction understandable?
5. Is adding repeated NPCs during Encounter fast enough?
6. Is image preview -> explicit Reveal safe and obvious?
7. Does Player view reveal nothing about unused Library contents?
8. Does the live picker preserve the already-accepted Connected Play scene?

---

# 11. Acceptance consequence

If Owner accepts this extension:

- mark these DM Library surfaces/flows accepted;
- update the consolidated prototype manifest and surface/scenario catalogs;
- add DM Library to the integrated Product/UX baseline;
- materialize runtime contracts;
- create a scoped runtime Work Order.

Do not reopen or redesign the already-accepted Connected Play geometry unless the new picker exposes a concrete conflict.
