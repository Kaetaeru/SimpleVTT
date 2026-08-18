# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `2`
- task_id: `v1-product-experience-overhaul`
- dispatch state: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch: `main`
- work branch: `agent/108-production-play-session-ux`
- issue: #108
- PR #109: open/draft/unmerged; no merge authorized

## Current work head
`3a2c83541857591ecb30aa03aa0a6285e23b7677`

## Scope
SimpleVTT v1 is a full product-experience overhaul built on the already validated Character persistence, installed-content composition, Host authority, Scene/runtime mechanics, ResolutionEvent/Undo, reconnect/idempotency and owning-Client Character architecture. Product UX is being rebuilt without replacing those canonical engines.

## Progress completed this execution
### Rerun reconciliation
- Read `.chatgpt-rerun/README.md`, `control.json`, `STATE.md`, `PLAN.md` from `main` in the mandatory order.
- `run_id`, sequence `2`, task ID and `continue` authorization agree.
- Reconciled stale STATE head against GitHub. PR #109 remained open/draft/unmerged and the actual starting work head was `571761c169b1f7da0fa4c4fee48435f84cee7a74`.

### Progression CI root cause and repair
Normal UI workflow logs were inspected rather than repeating validated mechanics tests.

Exact old-head failure:
- UI run `32050231323`, job `95447587258`.
- Failing subtest: `final app adapter plan has no phantom ASI at Monk 2 and requires subclass exactly at Monk 3`.
- Earlier canonical row/choice assertions in the same regression passed.
- Root cause was an obsolete fixture call to nonexistent `adapter.setLevelUpChoice(...)`, not a progression schedule/runtime defect.

Repair:
- `tests/ui/progressionChoiceScheduleRegression.test.ts` now calls the current adapter contract:
  `setProgressionChoice(choiceId,{ kind:"options", optionIds:[subclassId] })`.
- Fix commit: `1d0a132f2941b131451e5a98715a2088d614fd42`.
- Removed temporary `.github/workflows/v1-progression-diagnostic.yml` after normal-workflow logs supplied the real evidence.
- Removal commit / clean UI baseline head: `25c767893583da1809aa06bc0c875c14b8602154`.

Validation at `25c767893583da1809aa06bc0c875c14b8602154`:
- UI run `32162614993`, frontend job `95769907698`: success.
- Progression regression passed.
- Subsequent progression/spell/runtime UI gates passed.
- TypeScript and production build passed.

### Desktop demo/product guide
Added repository-durable executable UX reference:
- `docs/design/v1-desktop-demo/index.html` — commit `3488b7c18f7804164eccf117d6e91710c2b2a2ba`
- `docs/design/v1-desktop-demo/styles.css` — commit `f935950436d116716dad4e85d4d615b1b11a2e18`
- `docs/design/v1-desktop-demo/app.js` — commit `3a2c83541857591ecb30aa03aa0a6285e23b7677`

The demo represents:
- all v1 global destinations;
- SimpleVTT vs official-sheet-inspired Character Sheet modes with interactive official-style spell sheet;
- direct Host/Join IP + port;
- automatic Host manifest sync states `checking → receiving → validating → ready` with Ready gating;
- top single Initiative card strip;
- Scene Actors with NPC/hostiles above and party below;
- icon-only square Hotbar, generated SVG action icons, Common grouping and detailed tooltips;
- Dark / parchment / Crimson themes;
- WebGL icosahedron d20 renderer proof while production dice remain the existing PhysicsDice3D authority path.

Docs-head validation at `3a2c83541857591ecb30aa03aa0a6285e23b7677`:
- UI run `32163607516`, frontend job `95797936721`: success.
- Progression regression passed again.
- TypeScript and production build passed.
- Contract validation run `32163607702` also completed successfully while the broader docs-head workflows were running.

## Next Exact Action
1. Perform targeted QA of only the new desktop-demo contract, with priority on keyboard accessibility for icon-only/disabled actions, detailed disabled-reason focus behavior, Common grouping, one Initiative order, actor-theater layout, live theme switch, dual Sheet interaction, IP/port fields and manifest-sync Ready gating.
2. Fix demo-only acceptance issues if found. Do not broaden into already validated mechanics.
3. After demo acceptance, migrate the Play slice first into production: top single Initiative strip; NPC-above/party-below scene theater; icon-only capability-generated Hotbar; detailed accessible hover/focus descriptions; no permanent Play sidebars; preserve existing authoritative action/initiative APIs and freeform non-consumption semantics.
4. Add targeted Play structural/behavioral regressions for the new contract.
5. Continue themes → dual Sheet/spell sheet → direct-IP Session + validated content manifest sync → remaining Sheet resources/portrait → DM handout transport/reconnect → contextual DM tools/Rules cleanup.
6. PR #109 stays draft/unmerged.

## Architecture preserved
- Owning Client Character Library remains durable authority; Host projections remain ephemeral.
- Existing installed-content store/composition and declarative RuleModule validation remain addon authority.
- Host remains connected mechanics authority; ledger/reconnect/idempotency/Scene runtime/ResolutionEvent/event-native Undo remain canonical.
- Fresh Host remains empty by default and official Combatants are not silently UI-rebalanced.
- Freeform actions do not consume Initiative economy; Combat does.
- Theme and Sheet layout are presentation preferences only.
- Session addon synchronization may transfer only supported declarative validated packages and may not execute arbitrary Host-provided code.
- No second store/protocol/mechanics engine, tactical map/Fog/LOS or cloud dependency introduced.

## Dispatch recommendation
`continue`
