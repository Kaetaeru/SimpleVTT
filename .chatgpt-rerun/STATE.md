# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch state: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch: `main`
- work branch: `agent/108-production-play-session-ux`
- issue: #108
- PR #109: open/draft/unmerged

## Preflight reconciliation for this continuation
Required coordination files were read from `main` in exact order after loading the GitHub skill:
1. `.chatgpt-rerun/README.md`
2. `.chatgpt-rerun/control.json`
3. `.chatgpt-rerun/STATE.md`
4. `.chatgpt-rerun/PLAN.md`

Coordinates matched:
- run_id `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence `1`
- task `phase14-production-play-session-ux`
- status `continue`

Actual GitHub state at preflight:
- canonical `main`: `a1ee188a1d62dfce2faf381555d58e503a4b82ad`
- work/PR head: `8f9dcdd083d15be392da1bdefe1e05a9815651ea`
- PR #109 open/draft/unmerged; mergeable observed true

Previously validated remote Inventory, Fire Bolt, Arcana, local P14.6 spell, fresh Character/Skills/Actions/Inventory/Spells and unchanged connected lifecycle gates were not manually repeated.

## Preserved immediately prior completed slice — P14.8 remote skill/check authority
Validated work head `8f9dcdd083d15be392da1bdefe1e05a9815651ea`; Phase12 `31981974278` / job `95250255600`; Main `31981974175` / job `95250270963`, all success. Host-derived Arcana +5, authoritative d20/event-native commit, Freeform no-economy cost, exactly-once Client apply, idempotency and Host-library isolation remain authoritative evidence.

## Completed this continuation — P14.7 DM prepared Combatant flow
Final work/PR head: `5462d703bbb2d4d41eab934588d7638cb91f6c3e`.
Product/test boundary: `f9d9a86c5b3b2c09c33863129c87e8b1d2be2175`; final commit only wires Main Playable to the focused regression.

### Test-first progression
- `a41e165f17fe5f22d1b3327a1b2b2ca0c16b92fe` added `tests/ui/productionDmPreparedCombatantFlow.test.ts`.
- `70d58aee68579d0d5dd37a086dd349fe71e7d7d9` added it to UI's Phase 14 production batch.
- Test-first UI `31982279957` / job `95251090138` failed only on the new slice, exposing two real product gaps:
  1. no preparation-time `removeCombatant` operation;
  2. no visible Combatant preparation/add/remove controls in `ProductionSessionLifecycleBridge`.
- All preceding named-rule/PlaySessionDock checks and the pre-existing production tests in that batch remained green until the focused failure.

### Product repair
- `ce5ce284c3842ad588e1ad44f0acf8ed7902350c`: added `productionCombatantPreparationAdapter.ts`. It permits removal only in Host `preparing`, removes Scene entity/action/economy together, safely falls back actor selection, rejects pending-resolution removal, and rejects live-session removal.
- `44a6cddf0815f170d1deb0b52c4fb4b82407043b`: exposed `removeCombatant` through AppProvider.
- `d4141b068171c7e89a50623f28225f8d1410f2dd`: added visible `Combatant 준비` Definition add/prepared-instance remove controls and Combatant count to the production Host preparation surface.
- UI at `d4141b…` then passed the visible bridge assertion; its sole remaining failure was test-harness-only (`MockAdapter` regression had not imported the new adapter composition).
- `f9d9a86c5b3b2c09c33863129c87e8b1d2be2175`: test-only import correction.
- `5462d703bbb2d4d41eab934588d7638cb91f6c3e`: added `Verify Phase 14 DM prepared Combatant flow` to Main Playable.

### Final validation
- UI `31982491883`, frontend job `95251647686` at `f9d9a86c5b3b2c09c33863129c87e8b1d2be2175`: **completed success**. New prepared-Combatant regression, existing Phase14 production batch, Phase09 mechanics and final TypeScript/build all green.
- Main Playable `31982512637`, playable-contract job `95251703554` at final head `5462d703bbb2d4d41eab934588d7638cb91f6c3e`: **completed success**. Full UI/rules/TypeScript/build, Phase11, Phase12, Phase13, and the new Phase14 DM prepared-Combatant flow all green.
- Main Windows job may run automatically but is not used as the required two-instance human release acceptance.

### Proven behavior
- Host enters `preparing`, imports/instantiates a non-fixture Combatant and receives its actual runtime action data (`단검`, +5, `1d4+3`).
- Host can remove the prepared instance before start; entity, actions and economy disappear together.
- Host can re-add it and start Initiative; the prepared Combatant survives into the live Scene with runtime action/economy intact.
- Preparation-only removal is blocked after live start.
- The visible Host preparation surface exposes Definition-based add and prepared-instance remove controls without reference/debug setup.
- Existing participant Ready/start/lifecycle state and ordinary Scene/runtime model are reused; no parallel Scene/session source was added.

## Checklist documentation note
Additional P14.8 remote action/Inventory/Spell/Skill credit and the newly proven P14.7 prepared-Combatant statements remain to be reflected in `.agents/PHASE14_CHECKLIST.md`. The current connector path only offers full-file replacement for that large authoritative file, so no risky partial/truncating write was attempted. Apply those checkboxes only with a full-file-preserving write and remain conservative on all broader wording.

## Architecture preserved
- Owning Client Character Library remains the durable Character source; Host projected Characters remain ephemeral.
- Host canonical content/runtime remains connected mechanics authority.
- Prepared Combatants use the existing Scene/runtime instance model.
- Existing connected ledger/ResolutionEvent/client-apply/reconnect/idempotency semantics are unchanged.
- No fixture fallback, parallel connected protocol, duplicate durable source, tactical map/grid/path/LOS scope, or merge was introduced.

## Current actual state before coordination completion
- validated work branch / PR head: `5462d703bbb2d4d41eab934588d7638cb91f6c3e`
- PR #109 remains open/draft/unmerged; no merge performed or authorized
- coordination PLAN was written first on `main` as commit `32ff0f2589b33cdfa8b067e7615e6f5474a29151`
- this STATE write is second as required

## Remaining work / Next Exact Action
1. Do not rerun remote Inventory, Fire Bolt, Arcana, local P14.6 spell, prepared-Combatant flow, or unchanged lifecycle gates unless their relevant source boundary changes.
2. When a safe full-file-preserving checklist write is available, credit only directly proven P14.8 remote and P14.7 prepared-Combatant statements; leave broader wording unchecked.
3. Continue P14.7 test-first at the next uncovered live-DM boundary: preferably DM selection + correction/adjudication + Activity/Undo against a non-fixture live Scene/Combatant through existing production/domain services.
4. Patch product only for a real exposed gap; validate the smallest changed boundary with UI/Main once.
5. Then complete remaining P14.7 preparation metadata/rules-content visibility if still open, P14.10 UX/accessibility, Windows two-instance human acceptance, and final exact-head artifact verification.
6. PR #109 remains draft/unmerged; no merge is authorized.

## Dispatch recommendation
`continue`

## 2026-08-17 sequence 1 continuation — completed P14.7 live DM adjudication + event-native Undo
This continuation again began by reading `.chatgpt-rerun/README.md`, `control.json`, `STATE.md`, and `PLAN.md` from `main` in the required order after loading the GitHub skill, then reconciling live refs/PR before work. Previously validated remote actions, prepared-Combatant flow and unchanged lifecycle gates were not independently rerun.

Final validated work/PR head: `9c93ad064f8da6dc72b0d0701cc6002171ec3975`.
Product/test boundary: `19602c0b0bdd41a3f284698709c96ec21fd9f06b`; the final head changes only the Main Playable workflow.

### Focused test-first progression
- `dca18fdab2faa5bb726cc2e023c5eb7a2a4f834a`: added `productionDmLiveAdjudicationFlow.test.ts` for local production DM with a non-fixture saved Character and imported non-fixture Combatant.
- `9b99b1693d520f1244658b7aa35bc9415b2bb7be`: wired the regression into the canonical UI Phase14 production batch.
- UI `31982909260` / `95252768878` first exposed only a test-stage assumption; `6c525f0d2132794df749fdfa32228516296918b0` aligned the regression with the actual production atomic-attack stage contract.
- UI `31982959450` / `95252900407` exposed a separate targeting prerequisite: a fresh instantiated Combatant has no pairwise structured spatial relation. No arbitrary product default was added because this slice was scoped to adjudication/Undo.
- `ef35ad26d851b19455b5ad346b1fc797c3b6c85d` attempted to isolate that prerequisite with an explicit 5-foot test relation but wrote it to a snapshot clone; UI `31983017304` / `95253054490` identified that test-only mistake.
- `cfa445c86280522f270c387646e65e4bcfce20bb` installs the explicit relation on the authoritative adapter Scene. UI `31983078395` / `95253218046` then reached the actual product defect: attack and DM correction committed, but Undo left HP `10` instead of restoring `20`.

### Real product gap and repair
The real defect was event-history drift. The canonical attack was event-native, but post-commit DM HP correction directly mutated the Scene outside that runtime resolution history. Event-native Undo therefore encountered current HP that no longer matched the attack event's `after` state and correctly refused to reverse it.

- `b21e21ac3ec1cf52923cfdbdd2cb97e97477b3aa` added `dmAdjudicationResolutionEventAdapter.ts`.
- Post-commit damage/healing corrections now append a canonical `dm-correction` ResolutionEvent to the **same** runtime resolution history when such a history exists.
- The event records explicit HP before/after and provenance; Combatant HP remains session-runtime/session write-back, Character HP remains character-durable/character write-back.
- Existing reverse-order event-native Undo now reverses correction first and the original canonical resolution second. Existing correction Activity/UI behavior is preserved.
- `19602c0b0bdd41a3f284698709c96ec21fd9f06b` installs this adapter in canonical offline production composition directly after the real runtime attack adapter.
- No snapshot fallback, second event history, special DM network protocol, fixture path or tactical map subsystem was introduced.
- `9c93ad064f8da6dc72b0d0701cc6002171ec3975` wires the focused live-DM regression into Main Playable.

### Exact validation
- UI `31983195850`, frontend `95253536996` at `19602c0b0bdd41a3f284698709c96ec21fd9f06b`: **completed success**. The new prepared/live DM batch, all existing UI production regressions, Phase09 mechanics and final TypeScript/build passed.
- Main Playable `31983292944`, playable-contract `95253811047` at `9c93ad064f8da6dc72b0d0701cc6002171ec3975`: **completed success**. Full build, Phase11, Phase12, Phase13, prepared Combatant and the new `Verify Phase 14 live DM adjudication and Undo` step all passed.
- The automatic Windows job is not treated as the required human two-instance acceptance.

### Proven behavior
- Local production DM can run with a non-fixture saved Character and no Aelar/Mira dependency.
- DM safely selects the real Character and an instantiated non-fixture Combatant.
- Given an explicit authoritative spatial relation, the real Character resolves its canonical runtime attack against that live Combatant and produces Activity.
- Post-commit DM damage correction applies to the live Combatant, marks the Resolution adjudicated, and records correction Activity/ruling/reason.
- Event-native Undo reverses the DM correction plus the original canonical attack back to exact pre-resolution HP and records Undo Activity.

### Separate remaining P14.7 gap discovered
A newly instantiated Combatant does not yet have a production-authored pairwise structured spatial relation to the live Character. Canonical targeting therefore rejects Combatant/Character attacks until such a relation is supplied. The current focused test uses an explicit **test-only** 5-foot relation solely to isolate adjudication; this is not a product default or completion evidence for no-debug Combatant action.

## Current actual state before this coordination completion
- validated work branch / PR head: `9c93ad064f8da6dc72b0d0701cc6002171ec3975`
- PR #109 remains draft/unmerged; no merge performed or authorized
- PLAN was written first for this continuation as required
- this STATE write is second

## Remaining work / Next Exact Action after live-DM adjudication
1. Do not rerun this live-DM adjudication/Undo slice, prepared-Combatant flow, remote Inventory/Fire Bolt/Arcana, local P14.6 spell or unchanged lifecycle gates unless their relevant source boundary changes.
2. Continue P14.7 test-first on **live Combatant action placement/targeting without debug setup**. Inspect first for an existing production theater-of-mind distance/spatial-relation authoring path. If present, use it to prove an instantiated non-fixture Combatant can execute its actual imported runtime action against the real live Character. If absent, add only the smallest explicit production theater-of-mind relation input needed for legal targeting; never invent silent default distances and do not expand into grid/path/LOS/tactical-map scope.
3. The focused Combatant-action regression must prove imported action facts, canonical authoritative targeting/attack/damage, Activity and event-native Undo. Patch only gaps it exposes.
4. Then continue remaining unchecked P14.7 preparation metadata/rules-content visibility and broader conditions/typed-defense/reaction/concentration/life-state coverage, followed by P14.10 UX/accessibility, Windows two-instance human acceptance and final exact-head artifact verification.
5. Checklist checkbox credit remains deferred until a safe full-file-preserving write is available; credit only directly proven wording.
6. PR #109 remains draft/unmerged; no merge is authorized.

## Dispatch recommendation
`continue`
