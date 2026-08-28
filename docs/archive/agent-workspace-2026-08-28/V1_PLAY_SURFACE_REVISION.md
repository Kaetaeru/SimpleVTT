# SimpleVTT v1 Play Surface Revision

This document supersedes conflicting play-surface composition in `V1_PRODUCT_EXPERIENCE.md` and `PHASE14_PLAYER_EXPERIENCE_REDESIGN.md` while preserving the existing rules/runtime authority boundaries.

## Core decision
The Play screen must feel like a tabletop scene first and a control panel second.

Restore the useful structure of the earlier Freeform/Combat scene surface: a large central stage with scene participants and a compact action console beneath it. Remove the permanent left/right side columns that previously duplicated participant, initiative, Inspector, session and Activity information.

There is exactly one primary scene tracker at a time:

- **Freeform:** the stage shows the Scene Actors as cards/portraits.
- **Initiative:** the stage shows the Initiative order as the primary tracker, including current turn and compact combat state.

Do not show a second initiative list, participant rail, selected-actor inspector or recent-activity rail beside the stage.

## Freeform composition
The central stage is the scene.

Default state:
- session/scene name and minimal mode controls at the top;
- Scene Actor cards in the main stage;
- each Actor card exposes only immediately useful identity/status information;
- selecting an Actor may set the acting creature or target where the current role/action allows it;
- the action console sits below the stage and may retain intent-first action grouping, with skills/weapons/spells/items revealed only after needed;
- connected/session status is compact and does not become a permanent side panel.

### Freeform DM image behavior
When the DM reveals an image during Freeform, the shared image **replaces the Actor-card stage** for all connected participants.

The Play screen keeps its header and action console. The stage switches between:
1. `Scene Actors`, or
2. `Shared Image`.

The image is therefore treated as the current scene focus, not as an extra window layered beside the scene.

DM can withdraw the image to restore Actor cards. Clients may zoom/pan and may collapse the image locally; a clear `장면 보기` / `이미지 다시 열기` affordance returns to the current shared-image state without adding a permanent image manager.

## Initiative / Combat composition
Entering Initiative changes the same central stage rather than opening another combat workspace.

The stage becomes a single Initiative tracker:
- round and current turn;
- ordered Actor cards;
- initiative value;
- immediately relevant HP/status;
- strong current-turn highlight;
- DM can select the acting creature where authoritative controls allow it;
- turn controls remain in the header or immediately adjacent to the tracker.

Action economy and targeting appear close to the action console only when needed. They must not create a second persistent tracker.

### Combat DM image behavior
When the DM reveals an image during Initiative, **do not replace the Initiative stage**. Combat context must remain visible.

Instead, reveal the image in a modal/lightbox overlay:
- centered over Play;
- dismiss/minimize locally on the Client;
- reopen while the DM reveal remains active;
- zoom/pan locally;
- DM withdraw closes the shared reveal for everyone;
- reconnect restores the currently active reveal state.

The underlying Initiative tracker remains the single combat tracker.

## Actor cards
Actor cards are visual scene objects, not inspectors. Default information should be bounded:
- portrait/image when available, otherwise identity fallback;
- name;
- relation/side when useful;
- HP summary where appropriate;
- visible conditions/status;
- selected/current-turn/target state.

Do not put provenance, rules metadata, inventory, full ability summaries or Activity history into the stage cards.

## Action console
The earlier scene-first layout is restored, but the previous flat skill/action wall is not.

The console remains compact and can use the v1 intent model:
- Attack / Magic / Influence / Search / Study / Hide / etc. are first-level choices;
- relevant skills, weapons, spells, items and targets appear as the next step;
- freeform checks do not consume Initiative economy;
- Initiative actions use the existing authoritative action/turn runtime.

The console must read as something the player reaches for after seeing the scene, not as the visual center of the Play screen.

## Removed permanent chrome
Routine Play must not reserve left/right columns for:
- participant list;
- duplicate Initiative order;
- Inspector;
- session state;
- recent Activity;
- image management;
- debug/provenance.

Those functions are contextual overlays, popovers, details, Session tools or DM tools when genuinely needed.

## Acceptance examples
### Freeform without DM image
A user opens Play and immediately sees who is in the scene. The Actor stage visually dominates. Actions are available below it without hiding the scene.

### Freeform with DM image
DM reveals a tavern/letter/NPC illustration. Actor cards disappear from the stage and the shared image becomes the scene focus. Withdrawing the reveal restores the exact Actor stage.

### Initiative without DM image
The central stage shows one Initiative order only. The current turn is obvious. No duplicate side-list or Inspector competes with it.

### Initiative with DM image
The Initiative order stays visible underneath. The image appears as a dismissible/reopenable lightbox. Closing it never loses combat context.

## Authority constraints
This revision changes presentation only. Existing Host authority, ResolutionEvent history/Undo, connected convergence/reconnect, Character ownership/durability, rules runtime, target eligibility and installed-content composition remain canonical. Shared images remain connected presentation state, not ResolutionEvent or combat mechanics state.
