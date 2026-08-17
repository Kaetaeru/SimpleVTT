# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch state: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch: `main`
- work branch: `agent/108-production-play-session-ux`
- issue: #108
- PR #109: open/draft/unmerged; no merge authorized

## Current work head
`81fe7349f45ebe7d48537faeffcecfcfff156e0f`

This is the current PR head after expanding `.agents/PHASE14_PLAYER_EXPERIENCE_REDESIGN.md` with the Character portrait, DM image handout and one-SHA Definition of Done. It is not yet a release acceptance head.

## Historical validated boundaries
- broad production UX redesign at `f1adaae4f81ef3dd98840189b9c7c606a9133ba7`: UI/Main exact-head automation passed;
- Session viewport scrolling repair at `706d71ae8675f8b285e582cc48b992141a48d9b9`: affected UI exact-head automation passed.

Those remain evidence for unchanged mechanics/session boundaries but do not validate the later reopened player-experience implementation.

## Reopened player-experience work already present
Compared with `706d71ae...`, the work branch contains in-progress implementation for:
- WebGL/physics dice (`PhysicsDice3D.tsx`) and shared VisualDice integration;
- standalone Character sheet play surface (`CharacterSheetPlayScreen.tsx`);
- intent-first Player/DM play surface (`ProductionPlayScreen.tsx`, `playerExperienceModel.ts`);
- UI/physics regression tests and dependencies;
- `.agents/PHASE14_PLAYER_EXPERIENCE_REDESIGN.md`.

Current source search did not find an existing explicit Character portrait/image model or DM image reveal implementation, so those are newly required incomplete boundaries.

## User scope expansion — images and final completion definition
The user explicitly requires both:
1. Character Sheet image/portrait functionality.
2. DM ability to show an image to connected players.

The final product definition now treats images as presentation assets rather than rules/mechanics authority.

### Character portrait requirements
- local PNG/JPEG/WebP choose + preview;
- integrated sheet identity portrait rather than a separate permanent manager window;
- crop/focal-position, replace and remove;
- persists with the owning Character and works offline/after restart;
- Host cannot silently mutate the owning Client source portrait;
- safe type/dimension/payload limits and recoverable invalid-image UI;
- session thumbnails may reuse the same portrait source but must not create a second image store/editor.

### DM image reveal requirements
- contextual `이미지 보여주기` control, not a permanent panel;
- local PNG/JPEG/WebP choose + preview, optional title/caption/alt description;
- explicit reveal to all connected Clients and explicit withdraw;
- Client lightbox/handout can be minimized/dismissed and reopened while reveal remains active;
- fit/zoom/pan are local presentation controls;
- reconnecting Client receives the currently active reveal;
- reveal/hide is connected presentation state, not ResolutionEvent/Undo state;
- works without public URL/cloud hosting;
- bounded validation/downscale/transfer/cleanup;
- no tactical map/grid/token/fog/path/LOS expansion.

## Final one-SHA completion gate
Phase 14 is not complete until one exact source SHA passes all of these:
- standalone sheet contains normal play information and direct ability/save/skill/Initiative/attack/damage/common-die rolls;
- Hit Dice, spell slots and normal resources are operable from the sheet;
- Character portrait survives offline/restart and ownership rules;
- d4/d6/d8/d10/d12/d20 are actual WebGL physics dice and cannot change connected authoritative outcomes;
- exploration/freeform is intent-first and visually quiet, with skills nested under relevant intent rather than exposed as a primary wall;
- Initiative adds combat-only turn/order/economy/target information as needed;
- DM image reveal/hide and reconnect convergence work without permanent image clutter;
- Host authority, owning-Client durability, ephemeral Host projection, ResolutionEvent, Undo, reconnect/idempotency and existing mechanics remain correct;
- no second Character store/combat resolver/mechanics ledger/tactical-map/cloud-image dependency;
- TypeScript/build/UI/mechanics/connected tests and exact-head Windows build are green;
- human Windows acceptance covers sheet-only physical-table use and two-instance Host/Client play including image reveal/reconnect.

## Next Exact Action
Resume on `agent/108-production-play-session-ux` at current head `81fe7349f45ebe7d48537faeffcecfcfff156e0f`:

1. Reconcile/finish current player-experience implementation and close any existing TypeScript/build issue before widening source changes.
2. Test-first Character portrait persistence/ownership/offline restart/image validation/cleanup.
3. Implement Character portrait storage and sheet-integrated UX without a second Character store.
4. Test-first DM reveal/hide/reconnect presentation state and bounded asset transfer.
5. Implement DM handout transport plus Client focused viewer/minimize/reopen, without ResolutionEvent or tactical-map semantics.
6. Finish remaining standalone sheet and authoritative intent-action gaps.
7. Remove temporary integration workflow/script once no longer required.
8. Targeted tests -> UI/Main/connected exact-head validation -> Windows build -> same-SHA human acceptance.
9. PR #109 remains draft/unmerged; no merge authorized.

## Coordination write batch
- PLAN written first: `7f27434eb878a367c332b76b71eae43f2ed3befd`.
- This STATE write is second.
- `control.json` must be written last with status `continue`.

## Dispatch recommendation
`continue`
