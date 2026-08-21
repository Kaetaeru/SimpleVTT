# WO-UI-007 — Card-anchored combat feedback and health affordances

Date: 2026-08-22
Status: IMPLEMENTED / OWNER QA PENDING
Authority: explicit Owner follow-up to WO-UI-005 and WO-UI-006

## Objective

Make combat state readable from the portrait language already used by the Session, and make pointer targeting and combat VFX originate from the exact Actor Cards involved in the authoritative action.

## Health presentation

- The controlled Actor portrait at the left of the Action Bar repeats the portrait-card damage treatment.
- Missing HP fills upward in red while an opaque dark-red inner frame keeps the health affordance readable at every HP value.
- The controlled block includes exact `HP current/max`; it does not infer health from presentation pixels.
- Actor Card hover/focus detail includes an exact HP value and a compact HP bar in addition to AC, state, distance, and status.

## Target eligibility feedback

- The UI consumes `eligibleTargetIds` as authority; it does not recalculate legality.
- The authoritative reference projection may supply `eligibleTargetReasons` for excluded candidates.
- Invalid Actor Cards stay hoverable/focusable during targeting so the user can read the reason, but activation is ignored.
- Reference melee reasons include exact projected distance and weapon range when the target is out of range.

## Card-anchored targeting

- Selecting an Action still begins from the Action Bar, but the targeting tether begins at the acting Actor's scene card.
- The card is resolved by exact `data-actor-id`, never by list index or upper/lower visual order.
- The Action slot center is only a fallback if the acting Actor Card is absent from the mounted scene.

## Combat VFX geometry

- Source and impact points use the centers of the exact mounted Actor Cards identified by resolution `actorId` and `targetIds`.
- Removed legacy `.play-v09-*` selectors and peer-index mapping are prohibited.
- Generic stage fallback points remain only for a resolution whose Actor Card is not mounted.
- Visual effects remain presentation-only and do not mutate damage, targeting, or resolution state.

## Initiative stage

- The compact initiative order strip remains at the top of the central scene.
- The dominant center shows the authoritative current Actor's illustration and round label instead of explanatory demo copy.
- Economy and End Turn remain in the persistent Command Center.

## Retained boundaries

- no UI-side range, visibility, damage, or turn calculation;
- no tactical coordinates or map tokens;
- no fallback that silently makes an illegal target legal;
- no NPC portrait invention when no canonical asset exists;
- no combat VFX mechanics mutation.
