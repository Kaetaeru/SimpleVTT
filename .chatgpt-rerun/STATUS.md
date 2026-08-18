# Rerun Status

**Connection:** `main` coordination · V0.9 portrait/handout validated

- Repository: `Kaetaeru/SimpleVTT`
- Canonical watcher branch: `main`
- Active work branch: `agent/108-production-play-session-ux`
- Run: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- Sequence: `3`
- Task: `v1-product-experience-overhaul`
- Control target: `continue`
- Issue: #108
- PR: #109 open/draft/unmerged
- Current validated source HEAD: `28f3700eb92ab93bacb589dd07be792bf228b3a0`

## Human summary

The Character portrait + DM image handout/reconnect slice is now exact-head validated on the affected Linux/application gates without repeating earlier validated slices.

At `28f3700e...`:
- Character portrait supports bounded local PNG/JPEG/WebP, preview/replace/remove and focal position on both normal Sheet layouts;
- portrait persists through the owning Client Character Library without changing mechanics source/runtime revision authority;
- live Host gets contextual `이미지 보여주기` preview/reveal/withdraw;
- Clients can dismiss/reopen the active reveal;
- a final compatible reconnect handshake restores the current Host reveal;
- handouts stay on the existing session channel as presentation state only and do not enter ResolutionEvent/Undo/combat/participant-ledger authority.

Validation:
- UI run `32187690842` / frontend `95875015492`: **success**, including all reported product regressions and Typecheck/production build.
- Persistence run `32187690744` / application-contract `95875014950`: **success**, including portrait persistence/restart/revision coverage and production build.
- Phase 12 run `32187690780` / connected-protocol `95875015147`: **success**, including handout reveal/withdraw/dismiss/reconnect, existing connected/content-parity regression, offline walkthrough and frontend gate.
- The previous content-parity same-head Windows job `95870544914` is now confirmed **success**.
- Current-head Phase 12 Windows job `95875316302` and Persistence Windows job `95875014764` are still in progress; do not manually rerun them on watcher restart.

Validated slices now closed unless touched: Production Play, fast Visual Dice, composable Combat VFX, Appearance, dual Character Sheet/Official Spellcasting, direct-IP Session, automatic validated content parity, and Character portrait + DM image handout/reconnect.

Next work is contextual DM/Content/Rules polish plus proven dead-legacy cleanup, after first recording the two pending Windows job results. PR #109 remains draft and must not be merged without explicit user authorization.

`STATUS.md` is human-facing only. Authoritative reconciliation remains README -> control -> STATE -> PLAN.
