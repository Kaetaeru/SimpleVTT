# V2 · Table Runtime (세션 플레이 층 재작성)

Status: **DESIGN — owner-approved direction (2026-09-07)**

Owner decision (2026-09-07): "지금 파악안된 오류가 너무 많을게 뻔해서 전면 재작성을 해보자." Recommended direction accepted in
full: Host single authority · keep domain/UI · core-first switch-over · same repo, new branch (`work/v2-table`).

Read with: `docs/design/session-runtime.md` (authority matrix — V2 realigns the implementation with §3),
`docs/design/theater-of-mind-play.md` (mapless play), `docs/design/v2/DM_WORKSPACE.md` (DM UI),
`docs/roadmap/V2_TABLE_REWRITE.md` (gates).

---

## 1. 왜 다시 쓰는가 (measured 2026-09-07, `work/v1-composite` @ cfd72792)

| 층 | 파일 | 줄 | 판정 |
| --- | ---: | ---: | --- |
| `src/domain` 규칙 엔진 | 158 | 29,171 | 남긴다 (tests/domain 146) |
| `src/app` 세션 플레이 층 (런타임·해결·연결·어댑터 사슬) | ≈ 190 | ≈ 30,000 | **버린다** |
| `src/app` 생성·레벨업·라이브러리·캠페인·휴식 | ≈ 60 | ≈ 14,000 | 남긴다 |
| `src/*.tsx` 화면 | 58 | 7,733 | 남긴다 (스냅샷 계약 유지) |

- 125 files patch `MockAdapter.prototype`; `resolveAction` has 31 layers and `getSnapshot` 41, ordered by import.
  Which layer changed a value is discoverable only by reading the chain backwards.
- The same truth lives in four places (scene VM, `RulesRuntimeState`, character library, remote projection).
  Seven of the ten defects scenario 2 surfaced were copy-of-truth drift.
- Clients resolved their own characters and the Host applied their events (owner-local resolution). That contradicts
  `session-runtime.md` §3 ("HP/resources/item charges — connected authority: host event sequence") and needed
  reconstruction, journals, projection refresh and undo-compensation code (≈ 11k lines) to stay consistent.

## 2. 원칙

1. **진실 한 곳.** `TableState` is the only mutable play state. Everything the UI shows is a pure projection of it.
2. **입구 하나.** Every table mutation is a `TableCommand` through `dispatch()`. The result is either `committed`
   (events + optional result card) or `refused` (code, Korean reason). No other path mutates state.
3. **호스트 단일 권위.** The Host runs `dispatch()`. Clients send commands and apply events. A client never resolves.
4. **이벤트가 기록이다.** State after event *n* is a pure function of the ledger. Replay, reconnect, undo, parity and
   tests all use the same `applyEvent`.
5. **거부는 결과다.** Availability, targets, economy and rules are checked in one place before resolution, in the
   rules' words, in Korean; the same check produces both the tile's `disabledReason` and the refusal.
6. **DM 재량은 1급 명령.** DM rulings (damage, conditions, 유리/불리, 영감, life state, resources, corrections, undo)
   are commands like any other, replicated and undoable.
7. **어댑터 사슬 금지.** Features register handlers in a table. Nothing patches a prototype. Import order is not a
   semantic.

## 3. 모듈 (`src/table/`)

```
src/table/
  state.ts          TableState, Actor, Peer, Question, LogEntry (+ RulesRuntimeState from domain)
  commands.ts       TableCommand union (every table mutation), TableRefusal
  events.ts         TableEvent union, applyEvent(state, event) → state   (pure, shared by Host and replicas)
  dispatch.ts       dispatch(runtime, command, origin) → Outcome          (Host only)
  handlers/         one file per command family; each exports (state, command, ctx) → {events, result?} | refusal
    actors.ts       add/remove/group/rename/side/hidden
    turns.ts        mode, initiative start/end, end-turn, order edit
    attack.ts       weapon & unarmed attacks (domain d20/damage), riders, engagement
    checks.ts       ability checks, saves, contests, DC questions
    spells.ts       cast (domain spellcasting kernel), slots, concentration, counterspell questions
    reactions.ts    opportunity attack, shield, ready, questions/answers
    standard.ts     dodge, disengage, help, hide, search, influence, stabilize, death save, utilize/interact
    conditions.ts   canonical 2024 conditions with mechanics (domain/conditions), durations, exhaustion
    ruling.ts       DM palette: damage/heal/temp/max HP, conditions, adv/dis next roll, inspiration,
                    prone/stand, life state, engagement, badges, resources; post-hoc corrections
    items.ts        equip/wield/don/doff/use/give/stash (domain commonPlayInventoryRuntime)
    rest.ts         short/long rest (existing rest services)
    handouts.ts     reveal/hide, notes, visibility defaults
    undo.ts         undo last resolution / ruling
  project.ts        project(state, viewer) → AppSnapshot-compatible view (scene, actions, economy, activity,
                    resolution, refusal, session); DM-only facts filtered by viewer
  availability.ts   availabilityOf(state, actorId, action) → {available, reason} (turn, economy, 0 HP, resources,
                    components/hands, targets) — used by project() and by dispatch() pre-check
  dice.ts           Dice source (real RNG, queued d20 for tests, DM-forced values)
  wire.ts           hello / command / event-batch / snapshot / question messages; version
  host.ts           TableHost: transport peers, ledger, broadcast, reconnect (snapshot + events after cursor)
  client.ts         TableClient: send command, apply batches, cursor, rejoin
  writeBack.ts      owner write-back: character durable changes → owner's library (client side)
  facade.ts         SimpleVttApi implementation over the runtime (what the screens call)
```

The rules engine is called only from `handlers/*` (`resolvePendingResolution`, `compileSpellCast`/
`resolveCompiledSpellCast`, `resolveD20Test`, `resolveDamage`, `createEffect`/`terminateEffects…`,
`conditionD20Adjustments`…). Handlers are pure over `TableState` + `ctx` (dice, catalog, rules profile, clock).

## 4. 상태

```ts
interface TableState {
  sessionId: string; revision: number;                    // revision = last applied event sequence
  mode: "freeform" | "initiative"; round: number; order: string[]; currentActorId: string | null;
  rules: RulesRuntimeState;                               // domain truth: combatants (hp/temp/resources/life),
                                                          // effects, concentration, clock, artifacts, zones
  actors: Record<string, Actor>;                          // identity + presentation + source, never HP
  peers: Record<string, Peer>;                            // participantId, name, characterId, connection
  questions: Question[];                                  // pending table questions (reaction? DC? target cap?)
  activeResolution: ResolutionRecord | null;              // the card being presented (host-decided stages)
  log: LogEntry[];                                        // activity (public / dm-only)
  handouts: Handout[]; visibility: { defaultRollVisibility: "public" | "dm" };
}
interface Actor {
  id: string; kind: "character" | "npc"; name: string; side: "ally" | "enemy";
  controllerPeer?: string;                                // owner (PC) or DM-assigned
  source: { kind: "character"; sheet: CharacterSheet; sourceRevision: number }   // uploaded at join
        | { kind: "monster"; definitionId: string; stat: MonsterStatBlock };
  portrait?: PortraitRef; groupId?: string; hidden?: boolean; badges: Badge[]; engagement: string[];
}
```

`rules.combatants[id]` is the only place HP, temp HP, resources, death saves and life flags live. `Actor.source.sheet`
is the *durable* character (items, spells, level) as last uploaded/written back; the Host mutates it only through
item/rest handlers and emits write-back events for the owner.

## 5. 명령 → 이벤트 → 투영

```
dispatch(runtime, command, origin):
  1. authorize(command, origin)         DM may do anything; a player may only command actors they control
  2. availability / target pre-check    one function, Korean reasons  → refused
  3. handler(state, command, ctx)       pure; may return questions instead of finishing (reaction windows)
  4. events → applyEvent (host)         state' ; ledger.append; history push {seq, stateBefore}
  5. broadcast event-batch              replicas applyEvent identically
  6. Outcome                            {committed, events, result} | {refused, refusal}
```

- **Result cards.** A resolution is atomic on the Host; the card (`ResolutionRecord`: dice, contributions, outcome,
  damage components, state changes, provenance) is an event payload. Presentation (roll animation, floats, stage
  stepping) is local UI state over the record, never table state. The old `advanceResolution` chain disappears.
- **Questions.** When a rule needs a decision (reaction window: shield/opportunity attack/counterspell; DM: DC for an
  improvised action, target-cap choice, hidden-target attack), the handler emits `question-asked` with the frozen
  partial computation. `answer-question` (from the asked peer or the DM) continues the same handler. Questions time
  out to the DM.
- **Undo.** `undo` restores the Host's stored `stateBefore` of the last committed command and emits
  `state-restored {state}`; replicas replace their state. Undo is refused with a reason when a later event depends
  on the undone one in a way the table cannot unwind (rest, level-up).
- **Reconnect.** A client hellos with its cursor; the Host answers with `snapshot {state}` when the cursor is older
  than history retention, else `event-batch` after the cursor. Parity is by construction: replicas run the same
  `applyEvent` and `project`.
- **Owner write-back.** Events tagged `durable:true` for a character (HP, resources, item quantity/charges, wield
  state, spent slots, rest results) are applied by the owner's client to its library through the existing
  character library repository; the sheet's `runtimeRevision` follows the event sequence. The Host is the truth
  during the session; the library is the truth between sessions.

## 6. 남기는 것과 잇는 방법

- **Domain** unchanged. New handlers call it directly; no `phase09*` bridges.
- **Character creation / level-up / library / campaign / rest** keep their `MockAdapter` implementation for now. The
  V2 facade composes: `TableFacade` (session commands, snapshot) + the existing non-session methods. At switch-over
  `main.tsx` imports only non-session adapters plus the table facade; the ≈ 125 session adapters are deleted.
- **UI** keeps `AppSnapshot`/`useSimpleVtt()`; `project()` fills `scene`, `activity`, `resolution`, `refusal`,
  `session`. Screens that imported `mockAdapter` directly are re-pointed to the facade. The DM screens are replaced
  per `DM_WORKSPACE.md`.
- **Runners** (`scripts/run-tauri-e2e-*.mjs`) keep their scenario bodies; their helper header is re-targeted from
  `mockAdapter.*` calls to facade calls (`table.dispatch`, `table.snapshot`). Scenario documents are the acceptance
  oracle; each gate lists which runner sections must be green.

## 7. 테스트 전략

- `tests/table/*.test.ts` — handler unit tests (given state, command → events/refusal), `applyEvent` round trips,
  replay-equals-state property over recorded ledgers, projection parity (host view vs replica view for the same
  ledger), availability truth (tile reason == refusal reason).
- Windows H+P1+P2 runners unchanged in intent: play matrix M1–M9, TOM1, TOM2, C1-MP, plus scenario 3 (DM 재량).
- Legacy execution boundary: `src/table/**` is classified `GENERIC_ENGINE` glue; nothing in it may contain rules
  numbers (the boundary check script extends to the new directory).
