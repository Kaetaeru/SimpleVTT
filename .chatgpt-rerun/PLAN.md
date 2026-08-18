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
SimpleVTT v1 launches as one coherent tabletop product. Preserve the canonical Character/content/session/mechanics engines; rebuild launch, global information architecture and routine UX so every production capability is discoverable without repository knowledge or Debug Dock.

Authoritative design:
- `.agents/V1_PRODUCT_EXPERIENCE.md`
- `.agents/V1_PLAY_SURFACE_REVISION.md`
- `.agents/PHASE14_PLAYER_EXPERIENCE_REDESIGN.md`

When play-surface composition conflicts, the newest explicit user direction and `V1_PLAY_SURFACE_REVISION.md` win.

## Stable global information architecture
`홈 · 캐릭터 · 세션 · 콘텐츠 · 규칙 · 설정`

Play, Encounter/Combatants, Activity/history, DM correction and image handouts are contextual tools, not permanent global destinations.

## Demo-first UX contract
The desktop demo is not disposable decoration. Before a production slice is treated as approved, the demo must act as an executable product guide for that slice:
- all global destinations are reachable and representative;
- important controls are interactive rather than static screenshots;
- hover/focus states explain icon-only actions;
- Host/Join networking fields and content-sync states are represented honestly;
- Character Sheet view-mode switching is represented before production implementation;
- Play layout, Initiative, Scene Actors, Action Hotbar and theme choices must match the accepted desktop demo before code migration.

## Play UX — icon-first BG3-style action HUD
The bottom action HUD keeps the RVTT/Baldur's Gate-style information hierarchy but must be adapted to SimpleVTT rather than copied literally.

### Action buttons
- Every executable action/capability receives its own purpose-built icon asset.
- Hotbar buttons are square `1:1` icon-only controls in their resting state; do not print action names inside the button.
- Hover **and keyboard focus** open a detailed tooltip/card with:
  - localized action name;
  - action economy cost (`Action`, `Bonus Action`, `Reaction`, movement, slot/resource cost);
  - source (`Common`, class, species, feat, spell, item, NPC action, addon/custom);
  - range/targeting summary when known;
  - attack/save/check formula where public to that viewer;
  - damage/healing/effect summary where known;
  - resource consumption and recovery summary;
  - disabled reason if currently unavailable.
- Disabled capabilities remain visible when useful for comprehension, but clearly explain why they cannot be used.
- Tooltips must never expose hidden DM-only mechanics, secret AC, undiscovered resistances or other information outside the existing projection authority.
- Hotbar interaction must be fully usable with mouse and keyboard; icon-only controls require accessible names/labels.

### Common tab grouping
The `Common` tab is a curated combined shelf, not an undifferentiated list. Visually divide it into labeled/icon-separated groups in a BG3-like manner, while keeping buttons themselves icon-only:
- Common/basic actions;
- Class/Feature actions;
- Spells/Cantrips;
- Items/Consumables;
- situational/other actions.

Dedicated category tabs remain available for deeper browsing, for example `Common · Class · Spells · Items · Passives · Custom`. Capability ownership remains canonical; tabs/groups are presentation filters only.

### Hotbar generation
- Build entries from the Actor's actual `CapabilitySnapshot`/authoritative presentation data rather than hardcoded class-name UI branches.
- Basic actions, class/species/feat capabilities, spells, weapon actions, items, NPC actions and validated addon content share the same action-entry pipeline.
- User customization may later include drag/drop, pinned slots and quick-slot persistence, but the first v1 acceptance target is correct automatic grouping and icon/tooltip behavior.

## Play UX — Initiative and Scene Actors
### Initiative strip
- Reserve the very top of the Play surface for a horizontal Baldur's Gate-style Initiative card strip.
- Before Initiative exists, the strip may remain collapsed/quiet rather than inventing an order.
- Once combat/Initiative starts, the strip is the single canonical visible Initiative order.
- Each card can show portrait/identity, side frame, initiative score, current-turn emphasis, completed state, major visible statuses and group-turn state.
- Do not duplicate the same Initiative order in a sidebar or second tracker.

### Scene Actors composition
Restore the earlier scene-theater composition instead of a flat row of equal cards:
- NPC/hostile/scene actors occupy the upper scene region;
- Player/party actors occupy the lower scene region;
- central space remains visually readable for the current scene and targeting feedback;
- Actor cards remain compact scene objects, not permanent inspectors.

Freeform and combat still preserve the current mode-aware image behavior:
- Freeform DM image reveal replaces the Actor scene surface while active.
- Combat DM image reveal appears as a modal/lightbox over the persistent Initiative/combat state.
- local dismiss and DM withdrawal remain distinct operations.

## Themes and Settings
Restore explicit theme selection in Settings and make it a first-class v1 preference.

Required initial themes:
1. **SimpleVTT Dark** — current neutral dark product theme.
2. **D&D parchment** — official-character-sheet-inspired parchment/paper presentation with serif/document treatment and warm ink tones. Use original SimpleVTT assets and avoid copied logos/trademark artwork.
3. **Crimson / Red** — full-product dark red/crimson theme, not merely a red accent color.

Theme requirements:
- apply consistently to Home, Character Library, Sheet, Session, Content, Rules, Settings and Play chrome;
- preserve readable contrast and keyboard focus;
- persist across restart as a UI preference;
- Play-specific state colors (hostile, ally, current turn, success/error) must remain distinguishable under every theme.

## Character Library and Sheet presentation modes
The Character tab must let the user choose how a Character Sheet is presented without changing the underlying Character data.

### View mode selector
Provide at least two presentation modes:
1. **Official sheet layout** — D&D 5e official-sheet-inspired information architecture and paper layout, using original SimpleVTT rendering/assets.
2. **SimpleVTT layout** — the application-native interactive sheet optimized for digital use.

The selected layout is a presentation preference, not a second Character model/store.

### Official-layout interaction
The official-layout mode is not a static PDF image. It must retain functional controls:
- clickable ability checks and saving throws;
- clickable skills;
- Initiative roll;
- attacks and damage;
- Hit Dice/resource operations;
- equipment and item interactions where supported;
- spell slot/resource controls;
- local roll history / 3D dice presentation through the shared roll service.

### Spell sheet
- Spell presentation in official-layout mode follows the familiar dedicated spell-sheet organization: spellcasting summary plus spells grouped by cantrip/level, prepared/known state and slot availability.
- Spell rows remain interactive for spell attack/save/damage/use flows where runtime support exists.
- SimpleVTT layout may present spells differently, but both layouts operate on the same canonical spell/progression/resource state.

## Session Host / Join networking UX
Restore explicit network address entry instead of hiding the connection coordinate.

### Host
Host setup must expose:
- bind/listen IP or interface selection where relevant;
- port;
- session name;
- the address/IP + port that players should enter;
- copyable connection coordinates;
- Host/start/stop lifecycle and connected-player/Ready state.

### Join
Join setup must expose:
- Host IP/address input;
- port input;
- Character selection;
- Connect/Disconnect;
- Ready state and connection errors.

Do not replace IP/port with a fake invitation code unless a real discovery/invite transport is implemented in addition to direct addressing.

## Automatic Host module/addon parity
Before a Client can become Ready, the session performs content-manifest reconciliation against the Host.

### Host manifest
Host advertises the exact content set required for the session, including enough identity to compare safely:
- module/package ID;
- version;
- schema/rules profile;
- content hash/revision;
- dependency/conflict metadata;
- transfer size/capability metadata where applicable.

### Client reconciliation
On Join:
1. Client compares its installed/available declarative modules/addons with the Host manifest.
2. Missing packages are automatically transferred/synchronized from the Host when the package type is supported.
3. Version/hash mismatches are replaced or staged with the Host-required version for the session.
4. Every received package runs through the existing RuleModule parser, size/type bounds, dependency/conflict/capability validation and installed-content composition path before activation.
5. The UI shows concise sync progress (`checking → receiving → validating → ready`) without requiring the player to manually hunt for files.
6. If a package cannot be validated or reconciled, Ready is blocked with an exact recoverable reason instead of continuing with divergent mechanics/content.
7. Reconnect repeats manifest comparison idempotently and only transfers changed/missing content.

### Safety/architecture constraints
- Auto-sync applies to the existing declarative validated content/module architecture; do **not** introduce arbitrary JavaScript/native code execution from a Host.
- Host mechanics authority, owning-Client Character durability and installed-content validation remain canonical.
- Do not create a second addon store or second content protocol merely for session sync.
- Prefer content-addressed/hash-based transfer and reuse existing package identities so equal packages are not duplicated.

## v1 Definition of Done
One exact source SHA must pass together:
- first-launch Home/title/guide and feature reachability;
- Character create/import/edit/level-up/restart durability;
- Character Sheet view-mode switch between official-layout and SimpleVTT layout, with both remaining interactive;
- official-layout spell sheet and shared spell/resource operations;
- standalone physical-table Sheet, direct rolls/resources and durable portrait;
- declarative addon local-file install/preview/validation/restart composition;
- direct-IP Host/Join/Ready/start/stop/reconnect;
- automatic Host module/addon manifest reconciliation and validated client sync before Ready;
- scene-theater layout with NPCs above and party actors below;
- top Initiative card strip with one canonical order in combat;
- icon-only `1:1` Hotbar controls, generated action icons, detailed hover/focus descriptions and Common-tab category grouping;
- contextual DM Combatants/adjudication/history and image handout;
- selectable SimpleVTT Dark, parchment and full Crimson/Red themes;
- actual WebGL physics dice without changing authoritative connected outcomes;
- full frontend/mechanics/persistence/connected/Windows gates;
- human Windows first-launch/sheet-layout-switch/theme/session-content-sync/play/addon/two-instance acceptance;
- PR stays draft/unmerged until explicit merge authorization.

## Current v1 source slice
Current reconciled work head: `571761c169b1f7da0fa4c4fee48435f84cee7a74`.

Implemented so far:
- `.agents/V1_PRODUCT_EXPERIENCE.md` v1 contract;
- `.agents/V1_PLAY_SURFACE_REVISION.md` scene-first Play revision;
- Home/title and dismissible first-use guide;
- stable global v1 shell/navigation and contextual `플레이로 돌아가기`;
- first-class Content/Addons screen using the existing RuleModule importer with local JSON picker, 5MB/type guard, preview/validation/install and supported-addon guide;
- explicit production `CharacterSheetPlayScreen` and `CharacterCreateScreenV10` routes;
- removed hidden Vite route-string rewriting;
- updated v1 and progression structure contracts for explicit source composition;
- temporary shell integration workflow/script removed after source landed.

## Current validation boundary
Exact source `24a228d3418d1de553fa2b5749351cdf0f2ab3cd`, UI `32037896937` / frontend `95411828599`:
- v1 shell contract passed;
- Session, standalone-sheet/physics-dice/intent-play, non-Character UX, Host metadata, live DM continuity, lifecycle/ownership/inventory/spell batch and creation ChoiceDefinition checks passed;
- `Verify progression choice schedule regression` failed; later TypeScript/build steps were skipped.

The temporary isolated progression diagnostic omitted `npm run generate:content`, producing a missing generated catalog error. That result does **not** explain the normal UI failure because normal UI does generate content first. Do not treat it as product evidence.

## Next Exact Action
1. Instrument the **normal UI workflow's** `Verify progression choice schedule regression` step to capture the test's assertion output after the existing `Generate content dependencies` step, using the same annotation pattern as the frontend build diagnostic.
2. Rerun from a direct-authored work head and read that annotation. Fix only the exact failing assertion/fixture. Do not restore the removed Vite source transform.
3. Delete `.github/workflows/v1-progression-diagnostic.yml` once the normal-workflow diagnostic is available.
4. Obtain an exact-head green UI TypeScript/production build before broadening the slice.
5. Bring the **desktop demo/product guide** up to the newly specified v1 contract before migrating the next production UX slice:
   - icon-only 1:1 action buttons + generated icon set + hover/focus detail tooltips;
   - Common tab grouped into Common/Class/Spells/Items/situational sections;
   - Play top Initiative card strip;
   - Scene Actors with NPCs/hostiles above and party actors below;
   - theme chooser with SimpleVTT Dark, parchment and Crimson/Red;
   - Character Sheet layout chooser and interactive official-layout spell sheet;
   - Host/Join direct IP + port fields;
   - Host-content manifest comparison and automatic validated addon/module sync states.
6. Implement those accepted demo boundaries in production in architecture-safe slices:
   - Play theater/Initiative/action HUD;
   - Settings/themes;
   - Character Library + dual Sheet presentation + spell sheet;
   - Session direct-IP UX + manifest handshake/content sync;
   - remaining Sheet Initiative/Hit Dice/spell slots/resources and portrait;
   - DM handout transport/viewer/reconnect;
   - contextual Combatants/Activity/adjudication;
   - Rules polish and dead legacy UI/CSS removal.
7. Add structural and behavioral tests for each new contract, especially icon tooltip accessibility, single Initiative order, dual-sheet state parity, theme persistence, direct-IP fields, manifest mismatch reconciliation, validation failure blocking Ready and reconnect idempotency.
8. Targeted test each slice; then one exact-head full UI/Main/connected/persistence/Windows validation and human first-launch + both sheet layouts + all themes + direct-IP two-instance content-sync + Play + addon acceptance.
9. Keep PR #109 draft/unmerged.

## Architecture preserved
- Owning Client Character Library is durable authority; Host projections remain ephemeral.
- Existing installed-content composition/RuleModule validation is the addon engine.
- Host remains connected mechanics authority; ledger/reconnect/idempotency/Scene runtime/ResolutionEvent/Undo remain canonical.
- Fresh Host remains empty; official Combatants are deliberate and not silently rebalanced.
- Theme and Sheet layout are presentation preferences, not new mechanics or durable Character stores.
- Session addon synchronization must reuse declarative validated content/package identities and cannot execute arbitrary Host-provided code.
- No second stores/protocols/mechanics runtime, tactical map/Fog/LOS, or cloud dependency.

## Dispatch recommendation
`continue`
