# WO-UI-005 — BG3 icon Hotbar, pointer targeting, portrait Actors

Date: 2026-08-22
Status: IMPLEMENTED / OWNER QA PENDING
Authority: explicit Owner direction in the Connected Play session UI review

## 1. Objective

Refine the accepted WO-UI-003 mapless Connected Play composition without changing its global 41px chrome / upper Actor Board / flexible Play Context / lower Actor Board / Command Center topology.

This Work Order supersedes only these WO-UI-003 internal presentation details:

- approximately 70px named Hotbar cards;
- detached target-picker overlay;
- metadata-heavy Actor Cards.

## 2. Accepted interaction contract

### Hotbar

- Slots are small square 1:1 icons, not labeled cards.
- The matrix has 2 rows by default and the Player may choose 2–4 rows.
- Row count is a local presentation preference. It is not canonical capability order or Custom-page persistence.
- Hover and keyboard focus expose name, cost/economy, target, effect, summary, Main Hand relation, and unavailable reason when supplied.

### Attack and targeting

- Weapon attack entry uses the explicitly equipped `main-hand` ItemInstance relation.
- UI never chooses strongest attack and never falls back to offhand, unarmed, cantrip, spell, or the first available action.
- Selecting a targeted capability creates a cursor-following arrow/tether from the originating icon.
- The existing upper/lower Actor Cards are the target surface; no target-selection window opens.
- Validity is projected from `ActionVm.eligibleTargetIds`; UI does not calculate range, line of sight, relation, or legality.
- Single valid Actor click submits immediately. Multi-target selection retains explicit Execute.
- Escape or Cancel exits targeting.

### Actor Boards

- Resting Actor Cards display portrait/illustration only.
- Missing HP rises as a translucent red damage fill/frame over the portrait.
- Name, relation, HP/Temp HP, AC, current turn/control, and status are hover/focus detail.
- Valid, invalid, selected, controlled, and current-turn states use frame/ring treatment.
- Character portraits use the canonical portrait projection. Entities without a portrait projection use a presentation-only silhouette fallback; this fallback is not persistent Actor art.

## 3. Data boundary

`ItemInstanceVm.wieldSlot` is the canonical hand relation used by this surface:

```text
main-hand | off-hand | two-hand
```

Existing records without this field remain valid. A missing Main Hand relation is displayed as missing and is not inferred. New Character Creation loadouts mark the first selected weapon as Main Hand and a shield as Off Hand; durable runtime persistence round-trips the field.

## 4. Retained exclusions

- tactical map coordinates, pathing, range or line-of-sight calculation;
- new capability ordering/slot assignment persistence;
- invented invalid-target reasons;
- NPC portrait asset generation or network transport;
- DM-only privacy delivery changes;
- rules or resolution authority in React.

## 5. Acceptance

- 1:1 slots render in 2, 3, and 4 row modes and the choice survives reload.
- Icon hover/focus shows detailed action information.
- A targeted weapon action produces a pointer tether and no target overlay.
- Only authoritative eligible Actor Cards are clickable targets.
- A single target click reaches the existing `resolveAction(actionId, targetIds)` path.
- Actor Cards are portrait-only at rest, with damage fill and AC/details on hover/focus.
- typecheck, production build, structural tests, and browser interaction QA pass.

## Follow-up supersession

WO-UI-006 supersedes the fixed-width/height details of the Actor Board and Command Center presentation: Actor portraits are centered/taller, the command height grows for 3–4 rows, the page family expands to six product categories, and the Session consumes Home shell tokens. WO-UI-005 targeting, Main Hand, damage-frame, and authority boundaries remain in force.
