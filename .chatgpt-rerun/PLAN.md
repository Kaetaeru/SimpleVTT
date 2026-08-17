# Rerun Plan — SimpleVTT

## Coordinates
- Repository: `Kaetaeru/SimpleVTT`
- Canonical watcher branch: `main`
- Work branch: `agent/108-production-play-session-ux`
- Issue #108; Draft PR #109 remains open/draft/unmerged
- run_id `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence `1`
- task_id `phase14-production-play-session-ux`
- dispatch recommendation: `needs_user`

## Preserved validated evidence — do not repeat unchanged boundaries
- Ready/start `bd1077b9bc61b86c2c0370543a16496c72f840c2`; Phase12 `31971618571`; UI `31971618534`; Main `31971618703`.
- reconnect/idempotency and lifecycle boundaries remain green at `84d1d39135c08a2094783fb336a606f294b1cf58`, `cf520d35acd1e21a0247fdeb2d3664ae8a334345`, `240592cb646bfbbfe9466f94047bc1e2f544dcf9`, `7ce39fe44b91009cb1fa660b5e45cb8cf54bfc6d`, and `b20ecf18015cec15ad3eb26aba5674e5c91013cb` with their recorded Phase12/Main gates.
- Fresh Character/Skills/attack+Dash/Inventory/spell boundaries remain validated at `8b162dd3b45e77f5a742badcdd7f03d613321497`, `c835963e918cce94bd535054a6553ead7e786262`, `5d48312289e2f01508b3860428ce98e2830d5f26`, `c61469c87f6343ff55601e60890d13a58b6a5536`, `868b8e37127ea644444630cb45a84f36664912ed`.
- Remote Inventory/Fire Bolt/Arcana remain validated at `00487d6f421a43b15fb5ef77419e87d8182c35d4`, `82933a63846dae55fd4183eef15c22ca3836f082`, `8f9dcdd083d15be392da1bdefe1e05a9815651ea`.
- P14.7 prepared Combatant `5462d703bbb2d4d41eab934588d7638cb91f6c3e`; live DM adjudication/Undo `9c93ad064f8da6dc72b0d0701cc6002171ec3975`; live Combatant theater-of-mind `e102a82060954f7b3a0fe21054ed8cae4b3daa5b`; Host preparation metadata/content `f155943d62efbbd6718f2b4b2b864031232d60cb`.
- P14.7 non-fixture live mechanics continuity: UI `31985185688` / `95258850432`; Main `31985232843` / `95258989930`.
- P14.10 mounted Play workspace: product/UI `9494bfb1e4813130be72a3bc62e87e4ee54f25ab`; UI `31985536934` / `95259805820`; previous Main `31985665543` / `95260172166`.

Do not manually repeat these gates unless their relevant source boundary changes.

## Completed this continuation — P14.10 role scoping and recovery guidance
Final work/PR head: `a750ae844c8a0ce831e4c873574d074616eab3c0`.
Final product boundary: `6e424ce156634956af4d9c90a9a5d4bc3f4755f6`; final head adds only the hook-order test correction required by the new role guard.

### Test-first evidence
- `503ebc3b51846783b74a5cafa2796c46af1f7b1b` expanded `productionPlayWorkspaceAccessibility.test.ts` for production role/surface scoping, reconnect/disconnect guidance, Host startup failure recovery, loading guidance, legacy Join-card suppression, and no Debug Dock dependency.
- UI `31986077333` / `95261238226` failed only the new fourth accessibility test at the first missing role-scoping assertion; the three pre-existing P14.10 structure assertions stayed green.
- Source inspection confirmed the mounted Play dock could appear during Host sessions; the Player lobby also lacked explicit reconnect/disconnect guidance; Host bind failure returned an offline incompatible snapshot and made the Host bridge disappear.
- The base Host path does not require top-level `snapshot.role === "dm"`; Host authority is represented by `snapshot.session.role === "host"`. The regression was corrected to preserve that existing authority model rather than inventing a new role invariant.

### Product repair
- `426c498523b0d29330900f21ce877128a62c63a5`: `PlaySessionDock` is now limited to top-level player role while excluding `session.role === "host"`; it exposes explicit client reconnecting/disconnected status guidance without changing runtime authority.
- `9d394448347bc82c76127498e8869c1d7aeabec2`: `ProductionPlayerLobbyBridge` uses the same player/non-host scoping and exposes visible `aria-live` reconnect/disconnect guidance.
- `6e424ce156634956af4d9c90a9a5d4bc3f4755f6`: `ProductionSessionLifecycleBridge` retains the existing Host authority condition and adds a visible Host-start-failure recovery card using the existing `compatibilityMessage`; normal Host connection labeling now reflects connected/reconnecting/disconnected state instead of always saying the server is open.
- No connected protocol, mechanics service, durable store, or source-of-truth was added.

### Test-contract correction
- Exact-head UI first failed in the older `playSessionDockStructure.test.ts` because that test searched only the literal string `if (!snapshot) return null;`; the combined hydration/role guard was not recognized.
- Logs showed no Hook-order defect: the same three local `useState` hooks remain before the first guard and no React hooks occur after it.
- `a750ae844c8a0ce831e4c873574d074616eab3c0` updates only that structure regression to locate the first `if (!snapshot...` guard while preserving the original Hook-order assertions.

### Exact validation
- UI push `31986324263`, frontend job `95261871414` at `a750ae844c8a0ce831e4c873574d074616eab3c0`: **completed success**. Named-rule, PlaySessionDock structure, P14.10 role/recovery accessibility, Host preparation metadata, live mechanics continuity, existing Phase14 production batch, creation/progression/spell regressions, Phase09 mechanics, TypeScript and production build all passed.
- Main Playable `31986326671`, playable-contract job `95261895056` at the same exact head: **completed success**. Full production build plus Phase11, Phase12, Phase13, prepared Combatant, live-DM adjudication/Undo, live Combatant theater-of-mind action, Host preparation metadata, live mechanics continuity, and P14.10 accessibility structure all passed.
- Automatic Windows job `95262238417` was in progress after the playable-contract succeeded. It is not human two-instance acceptance and must not be used to close P14.10/P14.13.

## Architecture constraints preserved
- Owning Client Character Library remains the durable Character source; Host projected Characters remain ephemeral.
- Host canonical content/runtime remains mechanics authority.
- Existing connected ledger, Scene/spatial/runtime, ResolutionEvent, reconnect/idempotency and event-native Undo remain authoritative.
- `productionJoinCharacters` remains the no-fixture Character entry policy.
- Host surface role scoping follows `session.role === "host"`; no new top-level DM role invariant was introduced.
- No fixture fallback, duplicate protocol, duplicate durable source, tactical-map subsystem, or merge was introduced.

## Blocking Next Exact Action — HUMAN acceptance required
Automated work has reached the recorded human gate. Do not finalize an artifact or claim full playability until this is completed against exact work head `a750ae844c8a0ce831e4c873574d074616eab3c0` (or a later head produced by a human-found fix).

1. Human P14.10 viewport/keyboard walkthrough on a production desktop build:
   - verify the player Play dock appears only on player/non-host surfaces and does not overlap Host preparation/live controls;
   - verify common desktop viewport, internal scrolling for long lists, keyboard focus for launcher/tabs/actions/targets/close controls, selected/disabled/focus states, and focus-accessible action detail;
   - verify reduced-motion still exposes authoritative results;
   - verify client reconnect/disconnect guidance and Host bind-failure recovery are understandable without Debug Dock/Ctrl+Shift+D.
2. Windows two-instance HUMAN P14.13 walkthrough:
   - Host actual bind -> preparation/lobby -> rules/content/Combatant review;
   - Client selects a persisted host-unknown Character and joins by actual Host address;
   - compatibility/projection -> Ready -> Host Freeform or Initiative start;
   - visible client action -> Host authoritative Resolution -> both sides converge;
   - disconnect/reconnect without duplicate/stale projection;
   - explicit session end -> clean Host restart; owning Client durable state remains correct.
3. Record the exact source SHA and concrete pass/fail notes. If any human issue is found, patch test-first and revalidate only the affected UI/Main boundary.
4. Only after both human gates pass and the source head is accepted: run/verify the exact-head Windows artifact, confirm `SimpleVTT.exe`, `BUILD.txt` exact SHA/run id, walkthrough contents, GitHub artifact `head_sha`, artifact digest/downloaded ZIP SHA-256, and inspected ZIP contents.
5. PR #109 remains draft/unmerged. No merge is authorized.

## Dispatch recommendation
`needs_user`
