# Core Systems UX — Candidate Prototype Extension

Status: **BUILT — OWNER VISUAL / FLOW REVIEW PENDING — NOT ACCEPTED REFERENCE YET**

Planning source:

`docs/design/ui-ux/CORE-SYSTEMS-UX-PLAN.md`

Review entry:

`docs/design/ui-ux/prototype/app/core-systems-reference.html`

Supporting files:

- `core-systems-reference.css`;
- `core-systems-reference.js`;
- existing accepted `integrated-reference.css` for shared Play visual grammar.

---

# Purpose

This candidate answers two questions before runtime implementation:

1. Where should Inventory, Spells, Features, Conditions, Rest, Party Stash, and DM Library/Quick live in the product?
2. How can live play use those systems without opening their full management UI?

The proposal uses one grammar:

```text
MANAGE -> Sheet / Library / Party detail
USE    -> Command Center
STATUS -> Actor Card / Resource Rail / current response
QUICK  -> Ctrl+K / + Quick
```

---

# Relationship to accepted Play

The existing Owner-accepted Connected Play reference remains valid and is not replaced by this candidate.

Live scenarios intentionally reuse the accepted visual family:

- compact Play chrome;
- upper opposing Actor Board;
- broad mapless Stage;
- lower allied Actor Board;
- persistent Command Center.

New candidate additions are limited to system presentation/entry points such as the small DM Quick launcher, command palette, status chips, and contextual Rest/Status layers.

---

# Review scenarios

## SYS-SCN-00 — Product placement map

Review the proposed role split before individual screens.

Expected:

- `MANAGE` points to Sheet/Library/Party detail;
- `USE` points to Command Center;
- `STATUS` points to Actor/Resource/current response;
- `QUICK` points to command palette.

## SYS-SCN-01 — Character Inventory management

Review:

- Inventory lives inside Character Sheet;
- Equipped / Consumables / Containers / Magic & Other organization;
- quantity, equipment state, container relationship;
- `Use` exists but full Inventory is not the live Hotbar;
- Potion quantity can be exercised as a fixture interaction.

## SYS-SCN-02 — Spellbook + Features management

Review:

- complete known/prepared/available spell record;
- Features split visually between passive and executable;
- resource summaries;
- explicit `PASSIVE != HOTBAR` relationship.

## SYS-SCN-03 — Player live Quick Use

Review:

- accepted Play skeleton remains;
- Resource Rail shows current operational state;
- Command Center tabs switch between Mixed / Spell / Item;
- Item page shows executable item capabilities only;
- full Inventory/Spellbook/Features do not fill the Stage;
- compact Poisoned / Concentration state remains visible.

## SYS-SCN-04 — DM unified Quick Search

Review:

- small DM-only `+` launcher in Play chrome;
- `Ctrl+K` opens/closes palette;
- empty query emphasizes Recent/Favorites;
- typed results include Actor/Image/Item/Condition/Rule;
- action verbs are explicit:
  - Actor `+1`;
  - Image `View` / `Reveal`;
  - Item `Give` / `Party`;
  - Condition `Apply`;
  - Rule `Open`;
- Nightcrow `+1` creates a new Actor card without opening Encounter management;
- Image `View` is private preview and does not imply reveal.

## SYS-SCN-05 — Party Stash / loot transfer

Review:

- shared stash is separate from one Character inventory;
- item/currency list;
- transfer destination + quantity;
- before/after preview;
- explicit Give action;
- no claim that the current prototype defines durable grant mechanics.

## SYS-SCN-06 — Rest preview / commit

Review:

- Rest appears as contextual Activity over preserved Play;
- Short/Long tabs;
- authoritative-effect preview concept;
- only real choices are requested;
- explicit Complete action instead of blind reset.

## SYS-SCN-07 — Condition / concentration response

Review:

- compact status on Actor/Command Center;
- detail/response appears only when the state needs attention;
- no permanent full status dashboard;
- UI does not calculate save DC/legality.

---

# Supersession note for first DM Library candidate

The earlier `dm-library-reference.html` remains useful for **offline preparation-surface** review.

Its heavier live scenarios (`Encounter -> Add Actor -> Library picker -> quantity -> Add`) are no longer the preferred primary live UX after Owner feedback.

For live invocation, this Core Systems candidate is the active review direction:

```text
Ctrl+K / + Quick -> explicit result action
```

Detailed Encounter/Library navigation remains a fallback.

---

# Candidate acceptance questions

Owner review should answer:

1. Does the four-role grammar feel understandable without documentation?
2. Is Inventory deep enough for management while keeping Play clean?
3. Does Spellbook/Features separation make passive vs executable state obvious?
4. Is the small `+` + `Ctrl+K` entry sufficiently discoverable but unobtrusive?
5. Are `View` and `Reveal` sufficiently distinct to prevent image spoilers?
6. Is Actor `+1` fast enough for ordinary DM use?
7. Does Party Stash feel like a shared store rather than another Character inventory?
8. Does Rest preview feel safer/more informative than a blind reset?
9. Are Conditions/Concentration visible enough without occupying permanent screen space?
10. Does every live scenario still feel like the already-accepted SimpleVTT Play scene?

Do not promote this candidate into the accepted consolidated reference until the Owner explicitly accepts or amends these points.
