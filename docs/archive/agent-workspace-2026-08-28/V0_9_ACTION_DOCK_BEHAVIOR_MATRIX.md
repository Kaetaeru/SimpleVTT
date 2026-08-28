# SimpleVTT V0.9 Freeform / Initiative Action Dock Behavior Matrix

## 0. Purpose

The Action Dock is the Session-time interface for expressing player/DM intent without turning the screen into a permanent action catalog.

It groups existing canonical `ActionVm` entries through the approved official intent vocabulary. It does not become a second mechanics engine.

Primary flow:

```text
Resting -> Intent -> Action Detail -> Target if needed -> Pending -> Resolution
```

Rules/Sheet may open during the flow without resetting it when the underlying action remains valid.

---

# 1. Canonical sources

Intent vocabulary/grouping:
- `OFFICIAL_PLAY_INTENTS`;
- `intentOptions(intentId, actions)`.

Action legality/details:
- current actor `ActionVm[]` from `snapshot.scene.actionsByActor[actor.id]`;
- `ActionVm.available`;
- `ActionVm.disabledReason`;
- `ActionVm.target`;
- `ActionVm.eligibleTargetIds`;
- `ActionVm.maxTargets`;
- attack/check/save/damage/healing/resource/item detail fields.

Execution:
- existing `resolveAction(actionId, targetIds)`.

The Dock must not reimplement attack bonuses, damage rules, target legality, action economy or resource legality.

---

# 2. State machine

## Resting
Shows 4-6 high-frequency/contextual intents plus `모든 행동`.

Freeform default candidates:
- Attack;
- Magic;
- Search;
- Influence;
- Help;
- All Actions.

Initiative default candidates:
- Attack;
- Magic;
- Dash;
- Disengage;
- Dodge;
- Help;
- All Actions.

Current Character/Actor-specific quick actions may replace at most 1-2 secondary slots when useful.

## Intent selected
Show actions returned by `intentOptions` for the current actor.

Each option displays:
- name;
- concise effect/formula;
- resource/economy where useful;
- availability;
- disabled reason;
- Rules affordance where a rule reference can be resolved.

## Detail selected
If the action needs no user choice beyond confirmation, resolve or advance immediately according to action target semantics.

If it requires a target, enter Target state.

## Target
Use canonical `eligibleTargetIds` only.

Single target:
- click valid target -> pending resolve.

Multi target:
- toggle valid targets;
- show `n / max` progress;
- explicit `실행` confirms.

## Pending
Disable duplicate execution of the same command and show a local pending indicator at the action location.

## Resolution
Canonical `snapshot.resolution` / activity presentation takes over. The Dock may collapse or keep a compact selected-action summary depending on stage, but must not calculate the result itself.

---

# 3. Common visual behavior

Resting height: ~64-72px.

Intent/detail expansion: normally ~120-180px, not a permanent quarter-screen catalog.

Every expanded state has:
- visible back/cancel;
- Escape -> one interaction step back;
- no Session exit.

Opening Rules:
- keeps current intent/action selection;
- closing Rules restores focus to the relevant action option/detail.

Opening Quick/Full Sheet:
- preserves the current flow when the authoritative action remains valid.

Changing DM acting Actor:
- cancels the old actor's action flow and starts clean in the newly selected actor context.

---

# 4. Per-intent behavior matrix

| Intent | Option source | Typical target step | Detail priority | Freeform resting | Initiative resting | Rules link |
|---|---|---|---|---|---|---|
| Attack | weapon actions or `resolutionKind=attack` | According to `ActionVm.target`; usually enemy | attack bonus, damage, resource/item cost, availability | Primary | Primary | Attack/weapon rule when resolvable |
| Dash | `action.dash` | Normally none/self as action defines | movement/effect, economy | All Actions/contextual | Primary | Dash rule |
| Disengage | `action.disengage` | Normally none/self | effect duration, economy | All Actions/contextual | Primary | Disengage rule |
| Dodge | `action.dodge` | Normally none/self | effect duration, economy | All Actions/contextual | Primary | Dodge rule |
| Help | `action.help` | According to action; often ally/target | help effect, target, economy | Primary | Primary | Help rule |
| Hide | Stealth skill action mapping | Usually action-defined/self; do not invent target | Stealth bonus, effect, availability | All Actions/contextual | All Actions/contextual | Hide/Stealth rule |
| Influence | mapped Deception/Intimidation/Performance/Persuasion/Animal Handling skill actions | Action-defined; target only if canonical action requires it | skill name/bonus, approach, availability | Primary | Secondary/All Actions | Influence/skill rule |
| Magic | all `category=magic` actions | Entirely from each spell/action target | spell/action name, level/source, save/attack, damage/healing, slots/resources | Primary | Primary | Spell/feature rule |
| Ready | `action.ready` | As canonical Ready action defines | trigger/effect contract, economy | All Actions/contextual | All Actions/contextual | Ready rule |
| Search | mapped Insight/Medicine/Perception/Survival skill actions | Usually no target unless action defines one | skill/approach and bonus | Primary | Secondary/All Actions | Search/skill rule |
| Study | mapped Arcana/History/Investigation/Nature/Religion skill actions | Usually no target unless action defines one | skill/approach and bonus | All Actions/contextual | Secondary/All Actions | Study/skill rule |
| Utilize | `action.utilize` | According to action/item/environment contract | object/action effect and cost | All Actions/contextual | All Actions/contextual | Utilize/item rule |

The table describes UI grouping only. `ActionVm` remains the source of actual legality and target semantics.

---

# 5. Attack flow

Resting:
`공격`

Intent state example:

```text
← 공격
[Longsword +5 · 1d8+3]
[Shortbow +4 · 1d6+2]
[Unarmed +5]
```

Selecting an attack:
- if unavailable, do not advance; show `disabledReason`;
- if `target=none`, resolve with no target;
- if `target=self`, use current actor as canonical self target;
- otherwise show Target chooser from `eligibleTargetIds`.

### Range fallback
The Dock never computes distance itself.

Canonical runtime requirement:
- without an installed authoritative spatial/range module, otherwise-valid targets must remain in `eligibleTargetIds`;
- missing distance must not become out-of-range;
- no fake distance value is displayed.

If runtime returns `5 ft 내 대상 없음` solely because spatial facts are absent, that is a mechanics/runtime defect to fix at the canonical eligibility source, not a UI workaround with a second target engine.

---

# 6. Magic flow

`Magic` shows current actor magic `ActionVm` entries.

Option row/card:
- spell/feature name;
- spell level/type/source when known;
- attack bonus or save DC where projected;
- compact damage/healing/effect;
- resource/slot/item cost;
- availability/disabled reason;
- `규칙 보기`.

Recommended filters when list is long:
- search;
- prepared/available first;
- level filter;
- action economy filter only in an expanded filter surface, not permanent tabs.

Do not recreate the old permanent `주문` hotbar tab.

After Rules close, the same spell/action remains selected.

---

# 7. Skill-based intent flows

Hide, Influence, Search and Study may expose skill/approach choices.

UI labels use human-readable skill names and current bonus.

Example:

```text
찾기
[지각 +4] [통찰 +2] [생존 +4] [의학 +2]
```

Selecting a skill uses the mapped canonical action.

Do not expose raw `action.skill.*` IDs.

If a mapped action is unavailable, show the reason rather than silently removing every clue that the action exists.

---

# 8. No-roll intents

Dash, Disengage, Dodge, Help, Ready, Utilize may resolve without a die depending on their canonical `ActionVm.resolutionKind`.

The UI still provides:
- selected feedback;
- pending feedback if a command roundtrip exists;
- concise result/effect presentation.

Do not force cinematic dice when the canonical resolution has no roll.

---

# 9. All Actions launcher

`모든 행동` is a launcher, not an action category hotbar.

It opens the complete official intent vocabulary:
- Attack
- Dash
- Disengage
- Dodge
- Help
- Hide
- Influence
- Magic
- Ready
- Search
- Study
- Utilize

Each intent shows:
- label;
- one-line purpose;
- available option count or clear unavailable state.

Selecting an intent returns to the normal intent/detail flow.

It does not expose permanent `common/class/spells/items/passives/custom` tabs.

---

# 10. Quick actions / recents

At most 1-2 quick actions may be shown beside resting intents.

Eligibility:
- action exists in current actor canonical `ActionVm[]`;
- action remains available or a useful disabled state can be explained;
- it is genuinely frequent/recent/favorite presentation state.

Quick action click may jump directly to Action Detail, but it still uses:
- canonical availability;
- canonical target selection;
- canonical resolve command.

It never bypasses mechanics.

---

# 11. Freeform vs Initiative differences

## Freeform
Do not display action/bonus/reaction/movement economy as permanent HUD.

Actions remain usable according to canonical rules, but the Dock is intent-oriented and low-noise.

## Initiative
Add compact current-actor economy near Main Focus/Initiative strip.

The Dock may prioritize combat intents.

Do not independently disable actions by re-calculating economy in the Dock; use canonical `ActionVm.available/disabledReason`, with economy projection as explanation/status.

---

# 12. DM Actor behavior

DM Action Dock always acts as the currently selected DM Actor.

Actor switch:
- one-click actor switcher;
- changing actor clears old intent/action/target UI state;
- new actor's `actionsByActor` drives the Dock.

DM may act in Freeform with zero connected Players.

DM action availability must not depend on a visible `Host Preparing` stage.

---

# 13. Target chooser behavior

Only appears for target-requiring actions.

Display each candidate with:
- name;
- side/role as useful;
- current compact status/HP only when relevant;
- selected state.

Do not permanently render the whole Actor board to make targets clickable.

Invalid candidates:
- usually omit when they are not canonical candidates;
- if displayed for explanatory value, clearly disabled with a reason.

Multi-target:
- preserve selection while Rules/Quick Sheet opens if still valid;
- remove only targets invalidated by new snapshot state.

---

# 14. Disabled and error language

Good:
- `주문 슬롯이 없습니다.`
- `현재 턴에 행동을 이미 사용했습니다.`
- `이 대상에게 사용할 수 없습니다.`
- `상태가 변경되어 이전 대상 선택을 취소했습니다.`

Avoid:
- `ActionVm unavailable`;
- `eligibleTargetIds empty`;
- `resolution rejected`.

If no mapped action exists for an official intent, distinguish:
- current Character genuinely has no option;
- installed rules/module does not expose an implementation.

Do not disguise an implementation gap as a fictional D&D rule.

---

# 15. Pending / idempotency UX

After execute:
- triggering control shows pending;
- duplicate click is disabled until command settles;
- authoritative resolution/reconnect/idempotency remains runtime-owned.

If reconnect begins during pending action:
- do not submit a second speculative copy;
- preserve visible pending/recovery status;
- reconcile against recovered authoritative snapshot/event state.

---

# 16. Action Dock implementation acceptance

Pass only when:
- resting Freeform is compact and not a category hotbar;
- all official intents remain reachable within one additional `모든 행동` step;
- intent options come from existing `intentOptions` / current `ActionVm[]`;
- legality/disabled reason comes from canonical actions;
- Rules can open/close without losing valid action context;
- target UI appears only when required;
- target execution uses canonical `eligibleTargetIds` and `resolveAction`;
- no-spatial-module range fallback is enforced at canonical target eligibility rather than a duplicate UI calculation;
- Freeform hides permanent economy; Initiative reveals compact economy;
- no-roll actions do not force dice;
- pending clicks do not duplicate commands;
- actor switch resets only actor-specific interaction state;
- resolution presentation reads the existing authoritative resolution projection.