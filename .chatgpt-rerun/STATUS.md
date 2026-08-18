# Rerun Status

**Connection:** `main` coordination · V0.9 content parity validated

- Repository: `Kaetaeru/SimpleVTT`
- Canonical watcher branch: `main`
- Active work branch: `agent/108-production-play-session-ux`
- Run: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- Sequence: `3`
- Task: `v1-product-experience-overhaul`
- Control target: `continue`
- Issue: #108
- PR: #109 open/draft/unmerged
- Current validated source HEAD: `af19378149db97387e3cd364b38fe17e95078b39`

## Human summary

The V0.9 automatic Host-required declarative content-parity slice is now exact-head validated. The failing Phase 12 job was diagnosed from its actual Actions logs and fixed narrowly without repeating previously validated Play/Dice/VFX/Appearance/dual-Sheet/direct-IP work.

At `af193781...`:
- Client hello advertises installed content identity/revision inventory;
- Host transfers only missing/changed declarative entries before participant acceptance;
- Client uses the existing validator/repository/catalog-composition authority, then re-handshakes with the installed revision and refreshed Character SessionProjection;
- invalid/conflicting Host content fails closed and Ready remains blocked;
- matching reconnect does not re-transfer or rewrite installed content.

Validation:
- Phase 12 run `32186178904` / connected-protocol `95870203173`: **success**, including all 48 connected/parity tests, offline walkthrough and production frontend gate.
- UI run `32186178947` / frontend `95870203434`: **success**, including all reported product regressions and Typecheck/production build.
- Windows connected job `95870544914` for the same exact head is currently in progress and should not be manually rerun on watcher restart.

Validated slices now closed unless touched: Production Play, fast Visual Dice, composable Combat VFX, Appearance, dual Character Sheet/Official Spellcasting, direct-IP Session entry, and automatic validated content parity.

Next work is Character portrait + DM image handout/reconnect while preserving owning-Client Character durability and keeping handouts presentation-only. PR #109 remains draft and must not be merged without explicit user authorization.

`STATUS.md` is human-facing only. Authoritative reconciliation remains README -> control -> STATE -> PLAN.
