# Rerun Plan — SimpleVTT v1

## Coordinates
- Repository: `Kaetaeru/SimpleVTT`
- Canonical watcher branch: `main`
- Work branch: `agent/108-production-play-session-ux`
- Issue #108; PR #109 remains open/draft/unmerged
- run_id `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence `2`
- task_id `v1-product-experience-overhaul`
- dispatch recommendation: `continue`

## v1 product goal
SimpleVTT v1 must launch as one coherent tabletop product. Preserve the canonical Character/content/session/mechanics engines and rebuild launch, information architecture and routine UX so every production capability is discoverable without repository knowledge or Debug Dock.

Authoritative design:
- `.agents/V1_PRODUCT_EXPERIENCE.md`
- `.agents/V1_PLAY_SURFACE_REVISION.md`
- `.agents/PHASE14_PLAYER_EXPERIENCE_REDESIGN.md`

When Play composition conflicts, the newest explicit user direction and `V1_PLAY_SURFACE_REVISION.md` win.

## Stable global information architecture
`홈 · 캐릭터 · 세션 · 콘텐츠 · 규칙 · 설정`

Play, Encounter/Combatants, Activity/history, DM correction and image handouts are contextual tools, not permanent global destinations.

## Demo-first UX contract
The desktop demo is an executable product guide, not disposable decoration. Before the next production UX slice is treated as accepted, the demo must represent and exercise the intended flow.

Repository demo:
- `docs/design/v1-desktop-demo/index.html`
- `docs/design/v1-desktop-demo/styles.css`
- `docs/design/v1-desktop-demo/app.js`

Current demo head: `3a2c83541857591ecb30aa03aa0a6285e23b7677`.

The guide now includes working navigation and interactive representations of:
- Home / Character / Session / Play / Content / Rules / Settings;
- Character Sheet presentation switching between SimpleVTT and official-sheet-inspired layouts;
- an interactive official-sheet-inspired spell sheet;
- direct Host/Join IP + port entry;
- Host content manifest comparison and `checking → receiving → validating → ready` synchronization states;
- a top Play Initiative card strip;
- Scene Actors theater with NPC/hostile actors above and party actors below;
- icon-only square action Hotbar with Common/Class/Spells/Items/Passives/Custom tabs, Common sub-grouping, generated SVG icons and detailed hover/focus tooltips;
- SimpleVTT Dark, parchment and full Crimson/Red theme choices;
- a real WebGL icosahedron d20 renderer proof in Settings. Production dice authority remains the existing PhysicsDice3D path.

## Play UX contract
### Icon-first action HUD
- Every executable capability receives a purpose-built icon asset.
- Resting Hotbar controls are square `1:1` icon-only buttons; action names do not appear inside the button.
- Hover and keyboard focus expose a detailed tooltip/card containing localized name, Action/Bonus Action/Reaction/movement/slot/resource cost, source, public range/targeting, public attack/save/check formula, damage/healing/effect summary, resource consumption/recovery and disabled reason.
- Disabled capabilities remain understandable and must still expose their disabled reason accessibly.
- Tooltips may not expose hidden DM-only mechanics, secret AC, undiscovered resistance/immunity or any information outside the existing projection authority.
- Common is a curated combined shelf visibly grouped into Common/basic, Class/Feature, Spells/Cantrips, Items/Consumables and situational/other groups.
- Dedicated `Common · Class · Spells · Items · Passives · Custom` filters remain presentation only; capability ownership remains canonical.
- Production entries must be generated from actual CapabilitySnapshot/presentation data, not hardcoded class-name UI branches.

### Initiative and Scene Actors
- The very top of Play reserves a horizontal BG3-style Initiative card strip.
- Before Initiative it is quiet/collapsed; during combat it becomes the single canonical visible Initiative order.
- Never duplicate the same order in a sidebar or second tracker.
- Scene Actors restores theater composition: NPC/hostile/scene actors above, Player/party actors below, readable central scene space between them.
- Actor cards remain compact scene objects, not permanent inspectors.
- Freeform DM image reveal replaces the Actor scene surface.
- Combat DM image reveal is a modal/lightbox over persistent Initiative/combat state; local dismiss and DM withdrawal are distinct.

## Themes and Settings
Required product themes:
1. **SimpleVTT Dark** — neutral dark product theme.
2. **D&D parchment** — official-character-sheet-inspired paper/serif/warm-ink presentation using original SimpleVTT rendering/assets, not copied logos or trademark artwork.
3. **Crimson / Red** — full-product dark crimson/red theme, not merely a red accent.

Theme selection is a UI preference, persists across restart, applies consistently across all product destinations and preserves contrast/current-turn/hostile/ally/success/error distinctions.

## Character Library and Sheet modes
The Character tab exposes at least:
1. **Official sheet style** — D&D 5e official-sheet-inspired information architecture and paper layout, rendered by SimpleVTT.
2. **SimpleVTT layout** — application-native interactive digital sheet.

Both are presentation modes over the same canonical Character data. The official-style mode is not a static image/PDF: ability checks, saves, skills, Initiative, attacks/damage, Hit Dice/resources, supported item operations, spell slots/resources and shared roll/3D-dice presentation remain interactive.

Official-style spell presentation uses a dedicated spell-sheet organization with spellcasting summary, cantrip/level grouping, known/prepared state and slot availability. Supported spell rows remain actionable.

## Session direct networking and automatic addon parity
### Host
Expose bind/listen IP or interface, port, session name, copyable player connection address, Host/start/stop lifecycle and connected-player/Ready state.

### Join
Expose Host IP/address, port, Character, Connect/Disconnect, Ready and actionable errors. Do not replace direct IP/port with a fake invitation code unless a real discovery/invite transport exists in addition.

### Content reconciliation before Ready
Host advertises package ID, version, schema/rules profile, content hash/revision, dependency/conflict and relevant transfer metadata. On Join:
1. Client compares its available declarative modules/addons with the Host manifest.
2. Missing supported packages transfer automatically from Host.
3. Version/hash mismatch is staged/replaced with the Host-required session version.
4. Received packages use the existing RuleModule parser, size/type bounds, dependency/conflict/capability validation and installed-content composition path.
5. UI reports `checking → receiving → validating → ready`.
6. Validation/reconciliation failure blocks Ready with an exact recoverable reason.
7. Reconnect repeats comparison idempotently and transfers only changed/missing content.

Auto-sync cannot introduce arbitrary Host-provided JavaScript/native execution, a second addon store, or a second mechanics/content protocol.

## v1 Definition of Done
One exact source SHA must pass together:
- first-launch Home/title/guide and feature reachability;
- Character create/import/edit/level-up/restart durability;
- both interactive Sheet presentation modes and official-style spell sheet;
- standalone physical-table Sheet direct rolls/resources and durable portrait;
- local RuleModule install/preview/validation/restart composition;
- direct-IP Host/Join/Ready/start/stop/reconnect;
- automatic Host manifest reconciliation and validated client content sync before Ready;
- NPC-above / party-below scene theater;
- one top Initiative order;
- icon-only `1:1` capability Hotbar, generated icons, detailed accessible descriptions and Common grouping;
- contextual DM Combatants/adjudication/history and image handout;
- Dark / parchment / Crimson themes;
- actual WebGL physics dice without changing authoritative connected outcomes;
- full frontend/mechanics/persistence/connected/Windows gates;
- human Windows acceptance covering first launch, both sheet modes, all themes, direct-IP two-instance content sync, Play and addon flows;
- PR stays draft/unmerged until explicit merge authorization.

## Current work and validation
Current work head: `3a2c83541857591ecb30aa03aa0a6285e23b7677`.

Completed in this execution:
- reconciled mandatory Rerun files and actual PR/head state;
- diagnosed the progression regression from normal UI run logs rather than repeating historical validations;
- found the exact failure was a stale test fixture calling nonexistent `adapter.setLevelUpChoice(...)`, while canonical Monk/subclass/ASI assertions before it already passed;
- changed that fixture to the current `setProgressionChoice(choiceId,{ kind:"options", optionIds:[...] })` API at commit `1d0a132f2941b131451e5a98715a2088d614fd42`;
- removed temporary `.github/workflows/v1-progression-diagnostic.yml` at `25c767893583da1809aa06bc0c875c14b8602154`;
- exact-head UI run `32162614993`, job `95769907698`, passed progression regression, TypeScript and production build;
- added the repository desktop product guide in three commits ending at `3a2c83541857591ecb30aa03aa0a6285e23b7677`;
- docs-head UI run `32163607516`, job `95797936721`, again passed progression regression, TypeScript and production build.

Validated historical mechanics/persistence/network boundaries remain evidence and must not be rerun unless touched.

## Next Exact Action
1. Treat `docs/design/v1-desktop-demo/` as the current desktop UX reference and perform targeted demo QA only for the newly added contract: icon-only keyboard accessibility including disabled-reason focus, Common grouping, single Initiative order, actor theater, theme switching, dual Sheet interaction, direct-IP fields and manifest-sync Ready gating. Fix demo-only issues before production migration.
2. Migrate the accepted Play slice first into production: top single Initiative strip + NPC-above/party-below theater + icon-only generated capability HUD + detailed accessible hover/focus descriptions, while preserving `resolveAction`, `selectDmActor`, `startInitiative`, `endInitiative`, `endTurn` and freeform non-consumption semantics.
3. Add structural/behavioral tests for one Initiative order, no permanent Play sidebars, icon-only accessible labels/tooltips, disabled reasons, Common grouping and freeform-vs-combat economy behavior.
4. Then implement Settings themes → Character Library dual Sheet modes/spell sheet → Session direct-IP UX + manifest handshake/content sync → remaining Sheet resources/portrait → DM handout transport/reconnect → contextual Combatants/Activity/adjudication → Rules polish/dead legacy cleanup.
5. Targeted-test each touched slice; later obtain one exact-head full UI/Main/connected/persistence/Windows validation and human acceptance.
6. Keep PR #109 draft/unmerged.

## Architecture preserved
- Owning Client Character Library is durable authority; Host projections remain ephemeral.
- Existing installed-content composition/RuleModule validation remains the addon engine.
- Host remains connected mechanics authority; ledger/reconnect/idempotency/Scene runtime/ResolutionEvent/event-native Undo remain canonical.
- Fresh Host remains empty; official Combatants are deliberate and not silently rebalanced.
- Theme and Sheet layout are presentation preferences, not new mechanics or durable Character stores.
- Session addon synchronization must reuse declarative validated package identities and cannot execute arbitrary Host-provided code.
- No second stores/protocols/mechanics runtime, tactical map/Fog/LOS or cloud dependency.

## Dispatch recommendation
`continue`
