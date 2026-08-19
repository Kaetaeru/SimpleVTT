# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `3`
- task_id: `v1-product-experience-overhaul`
- dispatch state: `needs_user`
- current milestone: **V0.9**
- repository: `Kaetaeru/SimpleVTT`
- canonical branch: `main`
- work branch: `agent/108-production-play-session-ux`
- issue: #108
- PR #109: open/draft/unmerged; no merge authorized

## Current exact validated work head
`bed3119c3e7ae5ac8663b29e7202fc0bdbd64994`

PR #109 was rechecked open/draft/unmerged at the prior source head immediately before the fix write, and the work branch then advanced only by the one observed-failure fix commit:
- `5c70b3028aed70b0fc5ddafafe119f40174df833` — `Remove unreachable legacy App surfaces`
- `bed3119c3e7ae5ac8663b29e7202fc0bdbd64994` — `Update UI rule baseline after legacy removal`

No runtime/mechanics/UI source was changed by the second commit; it updates only `.agents/UI_NAMED_RULE_BASELINE.json` to remove obsolete entries for deleted legacy `App.tsx` code.

## User coordination instruction — durable
- `STATUS.md` and human-facing watcher status text must be written in **Korean**; exact technical identifiers may remain in original form.
- GitHub work must invoke the matching GitHub plugin skill first rather than using direct `gh` CLI as an independent/default workflow.
- Prefer the most specific plugin skill (`github`, `gh-fix-ci`, `gh-address-comments`, `yeet`, etc.).
- For CI failures, invoke `gh-fix-ci` first. If that skill cannot inspect Actions because `gh` is missing or unauthenticated, the user explicitly authorizes the GitHub connector `fetch_workflow_job_logs` plus related run/job/status APIs as a fallback.
- The connector fallback is only for obtaining exact failure evidence after the plugin skill has been invoked. It does not authorize speculative fixes.
- Do not independently install or directly invoke `gh` as the primary workflow.

## Mandatory preflight for this execution
Read from `main` in exact protocol order before project work:
1. `.chatgpt-rerun/README.md`
2. `.chatgpt-rerun/control.json`
3. `.chatgpt-rerun/STATE.md`
4. `.chatgpt-rerun/PLAN.md`

Reconciled coordinates at start:
- run_id `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence `3`
- task `v1-product-experience-overhaul`
- dispatch `continue`
- durable work HEAD `5c70b3028aed70b0fc5ddafafe119f40174df833`

Validated slices 1–9 and the previous reachability audit were not repeated.

## Resolved unfinished CI failure
The unfinished point was Main Playable run `32189591188`, job `95880814298`, failing at `Verify full UI, rules, TypeScript, and production frontend`.

Execution path:
1. Invoked installed GitHub plugin `gh-fix-ci` first.
2. Its required `gh` dependency was unavailable (`gh: command not found`).
3. Used the user-authorized GitHub connector fallback to fetch the exact workflow job log.
4. The log showed a single policy/configuration drift in `test:ui-rule-boundary`:
   - `src/App.tsx::ability-modifier-arithmetic`: baseline 1, current 0
   - `src/App.tsx::point-buy-cost-symbol`: baseline 5, current 0
   - `src/App.tsx::point-buy-cost-table`: baseline 1, current 0
   - `src/App.tsx::standard-ability-array-literal`: baseline 1, current 0
5. These four occurrences were intentionally removed with the already-audited unreachable legacy Sheet/Create/Scene code. The baseline still described that deleted legacy debt.
6. `.agents/UI_NAMED_RULE_BASELINE.json` was updated to remove only those four obsolete `src/App.tsx` entries. Remaining `CharacterSheetV10.tsx` and `CombatSpellHud.tsx` presentation-debt entries were preserved unchanged.

No speculative source fix was made.

## Exact-head automated validation at `bed3119c...`
All automatic workflows associated with the exact source HEAD completed **success**:

- UI `32202359225`: success, including `Verify UI named-rule boundary`, production UX regressions, TypeScript and production build.
- Rules Domain `32202359177`: success.
- Contract validation `32202359173`: success.
- Persistence `32202359176`: success.
  - application-contract `95918637454`: success.
  - tauri-storage `95918637462`: success.
- Phase 11 Playable `32202359213`: success.
  - offline-walkthrough `95918637574`: success.
  - windows-playable `95918778475`: success, including Windows executable build/stage/upload.
- Phase 12 Connected Session `32202359183`: success.
  - connected-protocol `95918637353`: success.
  - windows-connected-playable `95918775214`: success, including Tauri transport/persistence verification and Windows build/stage/upload.
- Main Playable `32202359188`: success.
  - playable-contract `95918637735`: success, including full UI/rules/TypeScript/frontend, offline, connected, SessionProjection, DM prepared/live, Undo and accessibility contracts.
  - windows-playable `95918801170`: success, including Tauri persistence/session transport verification and Windows build/stage/upload.

No known automatic job remains pending for `bed3119c...`.

## Validated V0.9 slices — do not repeat unless touched
1. Production Play.
2. Fast production Visual Dice.
3. Composable Combat VFX.
4. Appearance preferences.
5. Dual Character Sheet + Official Spellcasting.
6. Direct-IP Session entry/configuration.
7. Automatic validated Host-required declarative content parity before Ready.
8. Character portrait + DM image handout/reconnect.
9. Contextual DM/Content polish + production dead-wiring cleanup at `04d8af30...`, including complete same-head Windows evidence.
10. Proven-unreachable legacy `App.tsx` Sheet/Create/Scene cleanup plus named-rule baseline alignment, exact automated-green HEAD `bed3119c...`.

## Remaining acceptance
The only remaining V0.9 acceptance is **human Windows acceptance at exact HEAD `bed3119c...`**. Automated Windows builds are green, but Definition of Done requires a person to exercise both product modes.

### Required human pass A — standalone Sheet-at-table
- open the Windows playable build/artifact for `bed3119c...`;
- verify normal Character Sheet routine rolls (ability/save/skill/Initiative/attack/damage/common dice);
- verify Hit Dice, spell slots/resources and local roll history;
- verify portrait preview/focal position/replace/remove and persistence after restart;
- confirm both normal sheet layouts remain practical and free of routine debug/provenance clutter.

### Required human pass B — two-instance Host/Client
- start Host and join from a second Windows instance using a saved Character;
- verify direct-IP/session-name and required-content parity reach Ready before play;
- start play and exercise freeform/initiative intent-first mechanics while Host authority remains correct;
- reveal a local DM image, receive it on Client, dismiss/reopen it, withdraw it;
- reconnect Client with a current reveal active and confirm the reveal restores;
- confirm no tactical grid/token/fog/path/LOS/cloud dependency appears.

Record exact SHA and pass/fail observations. If a failure occurs, capture the precise UI action and observed result.

## Next Exact Action
1. Perform mandatory watcher preflight and trust GitHub if `main`, control, work branch or PR #109 moved.
2. If control remains `needs_user`, do not edit source or rerun validated automation.
3. Obtain the human Windows acceptance result for exact HEAD `bed3119c...` using the two required passes above.
4. If both passes succeed, record the evidence and set control `complete` last for V0.9. Keep PR #109 draft/unmerged unless merge is separately authorized.
5. If a human acceptance defect is found, record the exact repro, return this same sequence to `continue`, and fix only the observed defect with affected-gate validation.
6. Never merge PR #109 without explicit user authorization.

## Coordination writes for this checkpoint
- PLAN was written first on `main` as commit `f4c7b60d63547fee2bcf0822d7d3a91737fae2f2`.
- STATE is this durable checkpoint and is written after PLAN.
- STATUS must be refreshed in Korean next.
- control must be written last with sequence `3`, status `needs_user`.

## Dispatch recommendation
`needs_user`
