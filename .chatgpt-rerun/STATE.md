# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `3`
- task_id: `v1-product-experience-overhaul`
- dispatch state: `needs_user`
- current milestone: **final exact-head automated validation complete; Windows human usability acceptance A-J is required next**
- repository: `Kaetaeru/SimpleVTT`
- canonical branch: `main`
- work branch: `agent/108-production-play-session-ux`
- issue: #108
- PR #109: open/draft/unmerged; no merge authorized

## Authorization and planning authority
The user explicitly authorized this same sequence through the consolidated V0.9 UI-first implementation plan in `.chatgpt-rerun/PLAN.md`.

All approved source implementation and automated convergence work is now complete on one exact source SHA. The remaining acceptance item is human Windows usability verification. Do not redo already validated slices or make additional source changes merely because rerun restarts.

## Validated checkpoints — do not repeat unless touched

### Walking skeleton
Exact source HEAD: `fbf37144d2ed56272429287419393bf221d83f44`
- UI run `32211000260`, frontend `95943502788`: **SUCCESS**

### Slice 4 — in-session Full Sheet reuse
Exact source HEAD: `d1641ae415f12e2b3604c42f34f65b3f0d947338`
- UI run `32212271658`, frontend `95947137481`: **SUCCESS**

### Slice 5 — in-session Rules + Activity
Exact source HEAD: `139ebcffcc537572ff198dd0140017a75dc21e97`
- UI run `32212781137`, frontend `95948568396`: **SUCCESS**

### Slice 6 — low-noise Freeform Main Focus
Exact source HEAD: `fe78030c1e705ff6de1e46124d9ef7eb78e60552`
- UI run `32213234658`, frontend `95949840012`: **SUCCESS**
- quiet Freeform center; at most one recent meaningful result; zero Player/empty Encounter valid; no permanent Actor wall/Activity/economy/action catalog.

### Slice 7 — intent-first Action Dock
Exact source HEAD: `2765beb7069e82fdb5d4ddf6284d8a81b79a9d86`
- UI run `32213526027`, frontend `95950668674`: **SUCCESS**
- Resting -> Intent -> Detail over canonical `OFFICIAL_PLAY_INTENTS`, `intentOptions()`, Actor `ActionVm[]`, existing `resolveAction()`; no second resolver/economy/target engine.

### Slice 8 — Target flow + canonical no-spatial fallback
Exact source HEAD: `1b0b156b09a6a957f19701dc9a4c53199738f6bd`
- UI run `32214271391`, frontend `95952727155`: **SUCCESS**
- target flow consumes canonical `eligibleTargetIds`; explicit `module:` spatial facts constrain, missing optional spatial facts do not block; no UI distance/LOS authority.

### Slice 9 — cinematic dice/result convergence
Exact source HEAD: `bcb267705ad526e54e6ca70f1193e6f500e4d268`
- UI run `32215116582`, frontend `95955048447`: **SUCCESS**
- one global/body-level authoritative cinematic dice replay; no Session dice stage; compact result; no-roll actions fabricate no dice; Activity/Undo authority preserved.

### Slice 10 — DM Encounter / Actor / Participants / Session tools
Exact source HEAD: `33b0049a482cbb65dda771f336dc591ba6d020d0`
- UI run `32215938914`, frontend `95957365219`: **SUCCESS**
- on-demand DM panes inside persistent Session Shell; existing Actor/Combatant/Initiative commands only; zero-Player/zero-Combatant active Freeform; no visible Ready/start/preparing gates; no second Scene/session/combatant authority.

### Slice 11 — Player reconnect / Session utilities
Exact source HEAD: `02c55b18a535b0f62bd0daabe0cb83e617324ffc`
- UI run `32218434349`, frontend `95964214046`: **SUCCESS**
- Phase 12 run `32218434325`, connected-protocol `95964214025`: authority step **SUCCESS** 49/49.
- healthy connection quiet; reconnect uses existing cursor retry; terminal rejoin explicit; leave uses `stopSession()`; no second connection/session protocol/store; Session context stays mounted.

### Slice 12 — Initiative expansion
Exact source HEAD: `9739da95521206116e9638c0459f541de46fdc31`
- UI run `32219100733`, frontend `95966108635`: **SUCCESS**
- same mounted Session root; canonical round/current Actor/order/status/economy projection; existing `endTurn()` / `endInitiative()`; display-only order; current-turn compact focus; existing Initiative Action Dock; Freeform unchanged.
- CI repair: old Freeform structure test was scoped to the Freeform branch after Initiative legitimately began reading canonical economy.

### Slice 13 — Handout integration
Exact source HEAD: `9f4d2f64cad008726e318a8ea43cb4f008ae962c`
- UI run `32219878491`, frontend `95968231474`: **SUCCESS**
- Phase 12 run `32219878487`, connected-protocol `95968231605`: authority step **SUCCESS** 49/49, including presentation-only handout reveal + compatible reconnect restoration.
- existing handout runtime/state/transfer only; runtime import remains before content parity; global body-level Handout UI mount removed; DM `자료` pane and Player transient viewer/contextual reopen owned by Session root; top-layer Escape and Action Dock suspension; no image manager/tactical map/mechanics authority.
- CI repairs were test-only stale presentation ownership assumptions: old Action Dock suspension literal and old expectation that global `SessionImageHandoutBridge` remained mounted.

### Slice 14 — responsive / keyboard / focus pass
Exact source HEAD: `ee76aaec6af10fc7b28e939ccfd66eacd4d19384`
- UI run `32220293621`, frontend `95969371848`: **SUCCESS**
- Player Handout dismissal restores focus to contextual `자료` reopen control; utility focus restoration and one-layer Escape order retained.
- narrow DM session termination remains reachable through the existing `세션` utility pane and canonical `stopSession()`.
- constrained-height Utility Rail and result layer remain scroll-reachable; Quick Sheet/DM/Handout/Action Dock constrained-width fallbacks retained.
- all prior UI/mechanics/lifecycle/Phase09 and production build regressions remained green.

### Slice 15 — final exact-head automated convergence
Exact source HEAD: `67a6a4843415d1a99a67b755cebf6011cd790ab5`

Known stale baseline resolved test-only:
- `phase11OfflineWalkthrough.test.ts` no longer treats presentation `target.distance` as authoritative range state;
- live target selection now follows canonical `ActionVm.eligibleTargetIds`;
- no-spatial execution expects `runtime:spatial:<source>-><target>:unconstrained:no-authoritative-module-fact` provenance;
- the test explicitly rejects fabricated authoritative `runtime:spatial:...:distance:` provenance when no spatial module is installed;
- no product mechanics/runtime code changed for this convergence.

All exact-head workflows completed **SUCCESS**:
- UI run `32222240768`, frontend `95974764908` — full Session/UI/mechanics regressions + TypeScript/build
- Rules Domain run `32222240848`, job `95974764984`
- Contract validation run `32222240773`, job `95974764787`
- Persistence run `32222240776`
  - application-contract `95974765198` — persistence contracts + production build
  - tauri-storage `95974764893` — immutable persistence stores + atomic Character recovery
- Phase 11 Playable run `32222240798`
  - offline-walkthrough `95974764921` — production-composed offline walkthrough + full frontend gate
  - windows-playable `95974940337` — Windows executable build + artifact upload
- Main Playable run `32222240805`
  - playable-contract `95974765297` — UI/Rules/TS/frontend + Phase11/12/13 + DM preparation/adjudication/combat mechanics
  - windows-playable `95974942440` — Tauri persistence/transport + Windows executable build + artifact upload
- Phase 12 Connected Session run `32222240777`
  - connected-protocol `95974764814` — connected authority + Phase11 offline + frontend gate
  - windows-connected-playable `95974952291` — Tauri transport/persistence + Windows connected-session executable + artifact upload

Windows artifacts for human acceptance:
- Main playable artifact id `9354472393`
  - name `SimpleVTT-Main-Playable-67a6a4843415d1a99a67b755cebf6011cd790ab5`
  - digest `sha256:df80475e789ec8b7688d867cd579e07f9d8191249ae6465f962b7ac118c3975c`
  - expires `2026-09-02`
- Phase12 connected artifact id `9354519085`
  - name `SimpleVTT-Phase12-Windows-67a6a4843415d1a99a67b755cebf6011cd790ab5`
  - digest `sha256:66099b1c339d0bbd63e59689bfce19a575d89ac9ab856f9d8c88edd0c3ef50f6`
  - expires `2026-09-02`

## Resolved CI baseline
The prior Phase11/Main/Phase12 failure on `phase11OfflineWalkthrough.test.ts` spatial provenance is resolved at `67a6a484...`. It was a stale acceptance assumption after the canonical no-spatial fallback and did not require restoring default distance tracking or changing mechanics authority.

## Remaining approved acceptance
Only **Windows human usability acceptance A-J** remains.

This environment does not provide a real Windows GUI session and therefore cannot honestly certify human usability interactions. Do not mark the task complete from automated evidence alone.

Human acceptance should exercise the existing A-J scenarios, including at minimum:
- Freeform -> Quick Sheet -> close with context preserved;
- Full Sheet -> roll -> cinematic dice -> close with context preserved;
- Rules lookup during an action and return to the same action state;
- DM Combatant/Encounter operation during active Freeform including zero-player operation;
- Initiative expansion and return to quiet Freeform;
- nested Sheet/Rules Escape/focus behavior;
- reconnect while preserving the persistent Session Shell;
- melee/attack action without a spatial module;
- constrained/narrow Windows window access to primary actions, Sheet, utilities and close controls;
- two-instance Host/Client handout reveal/dismiss/reopen/reconnect restoration.

## Next Exact Action
1. Do **not** change source code unless human Windows acceptance finds a concrete defect.
2. Run Windows human acceptance A-J using exact source/artifact SHA `67a6a4843415d1a99a67b755cebf6011cd790ab5`.
3. Prefer the Main playable artifact for general single-instance/usability checks and the Phase12 connected artifact for two-instance Host/Client checks.
4. Record pass/fail evidence for A-J. If any scenario fails, resume this same sequence from the exact failing interaction only and keep all unrelated validated slices untouched.
5. If all A-J scenarios pass, update STATE/STATUS and publish `control.json` status `complete` last. PR #109 remains draft/unmerged unless the user separately authorizes merge.

## Dispatch recommendation
`needs_user`
