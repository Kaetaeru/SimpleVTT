# SimpleVTT UI Behavior Scenarios

Status: **Implementation/QA interpretation scenarios derived from accepted contracts**

이 문서는 실제 사용 흐름을 `시작 상태 -> 사용자 행동 -> UI 반응 -> 보존되어야 할 상태 -> 금지 동작`으로 설명한다.

새 규칙/권한을 만들지 않는다.

각 시나리오는 구현 전/후 QA에서 그대로 재사용할 수 있다.

---

# Scenario 01 — Fresh first run

## Start

```text
tutorialComplete = false
no live session
```

## User sees first

`Tutorial / Onboarding`.

Home이 먼저 interactive해지면 실패.

## Tutorial must explain

- SimpleVTT is a tabletop companion;
- Standalone Character use;
- Connected Host/Join;
- Official-style vs SimpleVTT Sheet presentation;
- presentation can change later;
- Character / Host / Join basics.

## User action

Select `Official-style` and Complete.

## Expected

```text
preference saved through canonical preference mechanism
-> Tutorial closes
-> Home appears
```

## Must not

- create a second Character;
- start a Session;
- treat Sheet choice as rules choice.

---

# Scenario 02 — Returning user opens Home

## Start

```text
tutorialComplete = true
no live session
```

## Expected Home priority

Primary:

- Characters;
- Create Character;
- Host Session;
- Join Session.

Secondary:

- Content;
- Rules;
- Settings/Help.

## Must not lead with

- Activity;
- raw protocol/session debug;
- package hashes;
- battlemap;
- Ready state.

---

# Scenario 03 — Reopen Tutorial

## Start

Returning user on Settings/Help.

## User action

`Tutorial / Help` reopen.

## Expected

Tutorial content opens as a focused product layer/surface.

Completing/closing it does not reset Character data, Session state or rules state.

---

# Scenario 04 — Character Library open exact Character

## Start

Multiple local Characters.

## User action

Click CharacterCard `Rowan Ash`.

## Expected

Exact canonical Rowan Character opens.

Current presentation preference determines initial Sheet layout unless user explicitly selects another supported layout.

## Must not

- open last-used different Character;
- clone Character;
- convert between separate Official/SimpleVTT data models.

---

# Scenario 05 — Switch Sheet presentation

## Start

Rowan open in Official-style Sheet.

## User action

Switch to SimpleVTT Sheet.

## Expected

Same canonical Character, same HP/resources/items/progression, different presentation.

## Must not

- rebuild Character;
- lose unsaved authoritative draft/state outside applicable lifecycle contract;
- change rules values merely because layout changed.

---

# Scenario 06 — Standalone skill roll

## Start

Offline Character Sheet visible.

## User action

Click an authoritative/local skill roll trigger.

## Expected sequence

```text
Sheet remains mounted
-> transient dice appear over/within Sheet viewport
-> physical presentation runs
-> supplied/local result settles
-> compact result is readable on same Sheet
-> transient layer clears
-> same Sheet remains usable
```

## Must not

- navigate to Dice page;
- open modal/drawer;
- push Sheet down with permanent tray;
- require Close/Back.

Same family applies to save/Initiative/attack/damage/common dice where supported.

---

# Scenario 07 — Host opens Session

## Start

No live Session.

## User action

Home -> Host Session -> valid Host Setup -> Open.

## Expected

```text
Host = DM
Session becomes live
mode = Freeform
Connected Play opens immediately
```

Zero Players is valid.

## Must not

- wait in Lobby;
- require DM Ready;
- require Start Session after Open;
- assign Host=Player.

---

# Scenario 08 — Player joins live Session

## Start

Host/DM Session already live.
Client has valid local Character.

## User action

Join -> connection info -> choose Character -> connect/sync.

## Expected

```text
Client = Player
selected Character projection joins
-> current authoritative live mode opens
```

If Host is in Initiative, Player enters current Initiative state; UI does not force Freeform first.

---

# Scenario 09 — Join with no valid Character

## Start

Client has no valid Character.

## Expected

Join is blocked before entering Play.

Recovery:

```text
Create Character
or
Import Character
```

Then user starts Join again.

## Must not

- create anonymous Player Actor automatically;
- join as Spectator;
- invent temporary Character.

---

# Scenario 10 — Connected Freeform baseline

## Expected structure

```text
Play chrome / connection status
Upper opposing Actor Board
Central Play Context
Lower allied Actor Board
Persistent Command Center
```

## Freeform semantic requirement

No active per-turn economy presentation.

Capabilities/resources remain usable according to authoritative projections.

## Must not

- show grid/token field;
- show fake current turn;
- show Action/Bonus/Movement as spent/available turn ledger.

---

# Scenario 11 — Start Initiative

## Start

Host/DM Freeform.

## User action

DM invokes authoritative Start Initiative flow.

## Expected

Same Play skeleton remains.

Added:

- compact top-edge Initiative Tracker;
- round/current turn;
- authoritative turn economy;
- End Turn/Next Turn controls where appropriate.

## Must not

- navigate to separate Combat page;
- replace Actor Boards;
- replace Command Center.

---

# Scenario 12 — Select an action and target one Actor

## Start

Player Initiative or Freeform where capability is authoritative-available.

## User action

Select single-target capability.

## Expected

- all ActorCards remain visible;
- valid/invalid projection appears;
- invalid Actors stay visible;
- invalid reason is discoverable.

User clicks one valid Actor.

## Expected

Immediate submit to ActionRequest/resolution path.

## Must not

- open routine confirmation dialog;
- infer validity from ActorBoard position;
- require map click.

---

# Scenario 13 — Multi-target action

## User action

Select multi-target capability.

## Expected

ActorCards can enter `target selected` independently.

Explicit `Execute` appears when a valid target set can be submitted according to supplied projection.

## Must not

- auto-submit first target;
- draw polygon/circle on central stage;
- use card order as spatial relation.

---

# Scenario 14 — Area-like action in mapless Core

## Start

Action requires multiple potential targets but no map module.

## Expected

Explicit manual target list / ActorCard selection.

Example:

```text
[x] Goblin A
[x] Goblin B
[ ] Ally A
[Resolve 2 targets]
```

## Must not

- create AoE circle/cone/template;
- invent target inclusion from screen position.

---

# Scenario 15 — Invalid target

## Start

Selected capability.
Authority says Actor B invalid with reason.

## Expected

Actor B remains visible.

UI shows invalid treatment + supplied reason.

Click does not submit.

## Must not

- remove Actor B from board;
- calculate a new reason;
- silently choose another Actor.

---

# Scenario 16 — Default hostile click with Main Hand available

## Preconditions

```text
no selected action
no active DM control mode
canonical Main Hand relation exists
clicked hostile is authoritative-valid
```

## Expected

Default Main Hand action request may be invoked.

---

# Scenario 17 — Main Hand unavailable

## Start

No selected action; hostile click; authority says Main Hand unavailable.

## Expected

Show supplied unavailable reason.

No action submitted.

## Must not fallback to

- another weapon;
- cantrip;
- spell;
- unarmed;
- first Hotbar item.

---

# Scenario 18 — DM control mode wins over hostile default click

## Start

Host/DM; no selected action; explicit DM control mode active.

## User action

Click hostile ActorCard.

## Expected

DM control/context changes according to authoritative session capability.

## Must not

Trigger Main Hand default attack first.

---

# Scenario 19 — DM control changes Command Center

## Start

DM controls NPC A, then changes control to NPC B.

## Expected

Controlled Actor summary, capabilities/resources that are actually provided for NPC B, and relevant context update together.

## Must not

Continue displaying Rowan/player resources as filler.

If authoritative projection lacks some NPC resource data, omit/neutralize it honestly.

---

# Scenario 20 — Resolving action

## Start

Action submitted; PendingResolution active.

## Expected persistent anchors

- upper Actor Board;
- lower Actor Board;
- Play Context;
- Command Center skeleton;
- connection/session status.

## Locking

Only authoritative/application-declared conflicting interactions lock.

## Must not

```text
if pendingResolution then disable entire application
```

UI must not calculate safe/conflicting controls itself.

---

# Scenario 21 — Reaction / Interrupt

## Start

Resolution requests explicit response.

## Expected

Focused response appears in current Play context/layer while surrounding orientation remains recognizable.

Show only authorized/supplied:

- trigger context;
- available choices;
- costs;
- decline/cancel if legal.

## Must not invent

- timer;
- legality;
- hidden opponent data;
- extra choices.

---

# Scenario 22 — Concentration response

## Expected

Same Play remains visible; response gets focus.

DC/modifier/result values come from authoritative/domain state.

UI does not independently calculate them.

---

# Scenario 23 — Connected dice and result

## Start

Authoritative roll/result already exists or is supplied to presentation.

## Expected

```text
central Play Context
-> physical dice presentation
-> settle to authoritative value
-> compact immediate result
-> durable detail available in Activity
```

Actor Boards and Command Center remain.

## Must not

- let physics generate authoritative result;
- navigate to Result screen;
- turn central area into battlemap.

---

# Scenario 24 — Open Activity as DM

## Expected

Contextual side pane opens without replacing Play.

DM can see authorized chronology including clearly marked DM-only items and public items.

Filters may include All / Public / DM Only.

---

# Scenario 25 — Open Activity as Player with DM-only events existing on host

## Expected Player projection

Only events delivered/authorized to Player are rendered.

## Must not render

```text
Hidden Event
Private event occurred
•••
```

or DOM rows that are merely CSS-hidden.

---

# Scenario 26 — Later disclosure of private result

## Start

Prior private authoritative event exists.
DM later discloses allowed full/result-only projection.

## Expected

New authorized public projection/event appears without rerolling original outcome.

Historical relationship may be visible according to Activity contract.

## Must not

Generate a new random result.

---

# Scenario 27 — Correction / reversal

## Start

Committed prior ResolutionEvent.

## Expected

Correction/reversal appends linked history.
Original remains inspectable.

## Must not

Silently delete/rewrite old Activity row as though it never happened.

---

# Scenario 28 — Handout Overlay

## Start

DM shares Overlay.

## Expected

Image presentation overlays current Play context.

Player may locally dismiss/minimize/reopen overlay without changing shared DM state.

## Must not

Allow token placement/targeting on image.

---

# Scenario 29 — Handout Upper / Full

## Expected

Shared presentation becomes larger/dominant according to mode while live Session context remains.

Local zoom/pan may exist.

## Must not

- create grid;
- create Actor tokens;
- use image coordinates for rules targeting.

---

# Scenario 30 — Advanced DM spatial facts

## Start

DM needs missing spatial fact.

## Expected utility

Form/list such as:

```text
Actor A
Actor B
Distance
Visibility
Cover
Fact source/provenance where supported
```

## Must not

Open coordinate canvas.

---

# Scenario 31 — Rules lookup during live Session

## User action

Open contextual Rules lookup.

## Expected

Play state remains authoritative/alive.

Rules pane shows composed authoritative rule content.

Closing returns focus/context safely.

## Must not

Recalculate Session state from UI text.

---

# Scenario 32 — Quick Sheet

## Expected

Lightweight Character detail over/alongside Play.

Live Session stays active.

Close returns to invoking context.

---

# Scenario 33 — Full Sheet in live Session

## Expected

Large Sheet layer opens while Session connection/state stays alive.

Close returns to exact live context.

If required reaction appears, UI must surface it safely without destroying Sheet/session state.

---

# Scenario 34 — Product navigation during live Host Session

## Start

Host/DM live Session.

## User action

Play -> Rules -> Return to Play.

## Expected preserved

```text
same session
Host = DM
same SessionMode
same controlled Actor where valid
same current turn
same authoritative state
```

## Must not

Return as Client/Player or start a fresh Session.

---

# Scenario 35 — Reconnecting

## Start

Connection interrupted.

## Expected

Persistent reconnect NOTICE/status while prior visible Session context remains where safe.

Only contract-declared unsafe submissions become unavailable.

## Must not

- blank the whole Play screen;
- create Lobby/Ready loop;
- pretend reconnection succeeded before transport says so.

---

# Scenario 36 — Disconnected

## Expected

Clear state + supported recovery/rejoin/leave path.

Do not silently mutate local Character/session state to guess reconciliation.

---

# Scenario 37 — Narrow desktop

Review target: roughly 960x700 class desktop.

Expected:

- ActorCards stop shrinking at usable minimum;
- boards horizontally overflow/page;
- Command Center remains reachable;
- utility pane may narrow/overlay appropriately;
- central Play Context remains nonzero;
- no mobile-only redesign;
- no minimap/grid introduced to save space.

---

# Scenario 38 — Reduced Motion

## Expected

- remove/reduce nonessential movement;
- dice may use simplified reveal/settle;
- same authoritative result/order;
- no information lost;
- focus/context preserved.

---

# Scenario 39 — Content update while live Session exists

## Expected

Current live Session continues using its captured content snapshot according to canonical contract.

Local Content page may show update.

UI should explain that update applies to future/new session state as defined by architecture.

## Must not

Hot-swap live authoritative content just because local library changed.

---

# Scenario 40 — Unsupported content/mechanic

## Expected

Explicit unsupported/blocking state with useful explanation/recovery where available.

## Must not

Silently approximate unsupported rule behavior.

---

# Scenario 41 — Destructive confirmation

Use for materially destructive actions such as ending/deleting where contract requires.

Expected:

- focused modal/layer;
- clear consequence;
- safe Cancel where valid;
- focus containment/return.

## Must not

Use destructive confirmation for every ordinary single-target attack.

---

# Scenario 42 — Actor right-click context menu

Allowed family:

- Inspect/details;
- local context management;
- DM context management where role-appropriate.

## Must not duplicate normal

- Attack;
- Spell;
- Item;
- Hotbar capability actions.

---

# Scenario 43 — Empty Actor Board

Zero Actors in a board is valid in some contexts.

Expected:

Intentional empty state preserving layout.

Do not add fake placeholder Actor/token just to fill space.

---

# Scenario 44 — Many Actors

Expected:

- useful card minimum width;
- horizontal scrolling/paging;
- target/current/control states remain readable.

Do not compress cards into unreadable portrait dots as the default fallback.

---

# Scenario 45 — Long names / many resources

Expected:

- hierarchy remains readable;
- critical names can wrap/reflow or expose full accessible text;
- Resource Rail scroll/reflows as designed;
- no overlap with Command Center primary actions.

---

# Scenario 46 — UI receives missing authoritative field

Example:

```text
targetEligibility unknown/missing
```

Expected:

UI must not guess `valid`.

Use explicit unavailable/loading/error state according to contract, or block the relevant action pending correct projection.

---

# Scenario 47 — UI receives stale/contradictory state

Expected:

Do not merge values heuristically.

Defer to authoritative application/session revision handling; expose stale/retry/recovery state if provided.

---

# Scenario 48 — Future optional map module exists

This scenario is outside current Core runtime scope but guards future integration.

Expected:

- module owns coordinates/token/grid/path/LoS;
- Core consumes rules-relevant fact contract;
- Core default remains fully usable without module;
- module does not rewrite Core rules formulas.

Current Core UI contracts must not pre-build a hidden battlemap architecture "for later".

---

# Scenario completion rule

A runtime slice touching one of these scenarios is not ready merely because the happy-path screenshot looks similar.

For every touched scenario verify:

```text
start state
input/action
state transition
visible result
preserved context
role/privacy behavior
error/unavailable behavior
keyboard/focus behavior where applicable
mapless boundary
source of authoritative truth
```

If any item is unknown, implementation must locate the owning contract or remain blocked rather than guess.
