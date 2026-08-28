# SimpleVTT V0.9 Quick Sheet Information Architecture

## 0. Purpose

Quick Sheet is the fastest Session-time Character reference surface.

It is not a miniature Character builder and it is not a second Character store. It reads canonical Character/Scene/action projections and starts existing mechanics commands where available.

Primary goal:

> A Player should be able to answer most immediate table questions and start the most common Character actions without leaving the Session or opening Full Sheet.

---

# 1. Open/close contract

Open:
- one click on the Player Character Identity Chip;
- one click on the Sheet icon in Utility Rail may open the same surface.

Desktop:
- right anchored pane, target ~360px, allowed ~320-420px.

Narrow:
- full-height drawer.

Close:
- close button;
- repeat Sheet launcher;
- Escape when Quick Sheet is the top dismissible layer.

Close restores previous Session focus/scroll/action context.

---

# 2. Data-source rule

Quick Sheet never maintains its own mutable Character copy.

Canonical sources:
- identity/build/core stats -> `snapshot.activeCharacter`;
- session status/conditions -> matching `snapshot.scene.entities` Character projection;
- legal Session actions -> `snapshot.scene.actionsByActor[character.id]`;
- spellcasting runtime facts -> existing spellcasting projection when available;
- recent authoritative outcomes -> `snapshot.activity` / `snapshot.resolution`;
- portrait -> existing canonical Character portrait presentation contract.

When the Character or Scene snapshot changes, Quick Sheet rerenders from the new snapshot.

---

# 3. First-viewport information hierarchy

The first desktop viewport should prioritize, in this order:

1. Identity
2. HP / AC
3. Core reference stats
4. Conditions/status
5. Key resources
6. Frequent attacks
7. Common ability/save/skill access

Spells/features/items may continue below the first viewport.

The user should not need to scroll simply to answer `현재 HP?`, `AC?`, `이니셔티브 보너스?`, `이 상태가 걸려 있나?`, `주 공격 보너스가 뭐지?`.

---

# 4. Section A — Identity header

Display:
- portrait;
- Character name;
- class + level;
- subclass when meaningful;
- species;
- optional compact concentration/status indicator when authoritative presentation provides it.

Actions:
- `전체 시트`;
- layout indicator/switch: `SimpleVTT` / `공식 시트 스타일`;
- close.

Do not place Character build Edit or Level Up as equal-priority Session controls.

---

# 5. Section B — HP / AC

Primary row:

```text
HP 24 / 31   +0 임시        AC 17
```

Display:
- current HP;
- max HP;
- temp HP only when nonzero or when compact display has room;
- AC.

Interaction:
- read-only unless a canonical session-safe HP/resource command exists.

Do not introduce a Quick-Sheet-local HP setter merely for convenience.

If DM adjudication is needed, that remains a DM-authorized flow through existing adjudication mechanics, not Player Quick Sheet mutation.

---

# 6. Section C — Core reference stats

Compact grid:
- Speed;
- Initiative modifier;
- Proficiency Bonus;
- Passive Perception.

Optional secondary facts when already canonically projected and space allows:
- spell save DC;
- spell attack modifier;
- passive Insight/Investigation if product rules later expose them canonically.

Do not recompute named rules ad hoc in the component when an existing projection/helper owns them.

---

# 7. Section D — Conditions / status

Source:
- matching Scene Character entity `status` projection;
- other existing presentation-only status contracts as applicable.

Display:
- compact chips;
- no chips when no current conditions;
- current concentration may be visually separated if supported.

Each recognized condition may expose `규칙 보기` -> in-session Rules pane.

Do not make the Quick Sheet a condition editor for Players.

---

# 8. Section E — Key resources

Source:
- `activeCharacter.resources`;
- existing spell-slot/spellcasting runtime projection where available;
- item charge projection for important equipped/attuned items when relevant.

Order:
1. resources that are currently spendable by visible actions;
2. spell slots for spellcasters;
3. Hit Dice / rest resources;
4. other class/species/item resources.

Display example:

```text
Second Wind       1 / 1
Action Surge      0 / 1
Spell Slot 1      ● ● ○ ○
Hit Dice          3 / 5
```

Interaction rule:
- if spending a resource is part of an authoritative action, start that action rather than manually decrementing the number;
- generic resource editing is not added unless an existing canonical command supports that exact operation.

---

# 9. Section F — Frequent attacks

Purpose: start a routine attack without opening Full Sheet or a permanent weapon catalog.

Source priority:
1. current actor `ActionVm[]` weapon/attack actions for legality and target facts;
2. Character attack summary for familiar labels/reference when useful.

Each row:
- attack name;
- attack bonus or relevant formula;
- compact damage expression;
- availability/disabled reason;
- `공격` action.

Interaction:
- selecting an available attack enters the same Session Action Dock detail/target flow;
- it does not run an independent Sheet attack resolver;
- target chooser appears only if the authoritative action requires a target;
- missing spatial module never removes otherwise-valid targets merely because distance is unknown.

Disabled attack:
- remains understandable;
- show a domain-language reason;
- no silent click.

---

# 10. Section G — Ability / Save / Skill access

Quick Sheet should support fast reference and a direct roll start where a canonical path exists.

Collapsed default:
- six ability modifiers in a compact strip/grid;
- `능력·내성·기술` expand action.

Expanded:
- ability modifier;
- save bonus/proficiency;
- skills grouped by ability or searchable compact list.

### Session roll routing
When a corresponding authoritative `ActionVm` exists, Quick Sheet starts/resolves through the existing Session action path.

If no authoritative Session action exists:
- the number may still be shown as reference;
- do not pretend a local random roll is an authoritative connected-session mechanics result.

A clearly labeled local/generic tabletop die may exist only as presentation convenience and must not write authoritative Session state.

### Standalone difference
Standalone Character Sheet may continue to support local ability/save/skill rolls because no connected Host authority is involved.

---

# 11. Section H — Spells / features quick access

Show only a compact useful subset initially:
- prepared/available spells relevant to current play;
- recent/favorite spells/features when such presentation data exists;
- class/species features that have a mapped current action.

Each actionable row:
- name;
- level/type;
- resource/cost summary;
- availability;
- `사용` / action start;
- `규칙 보기`.

Selecting an action routes into the shared Action Dock flow.

Rules opens over the current Quick Sheet/Session context and returns to it when closed.

Features with no mechanics action are reference-only and may deep-link to Rules.

---

# 12. Section I — Items

Quick Sheet does not duplicate the entire inventory.

Show only:
- equipped/wielded items relevant to immediate play;
- consumables with a current use action;
- important charged/attuned magic items.

Existing item commands such as equip/attune/use remain canonical when those operations are surfaced.

Full inventory management belongs to Full Sheet, not Quick Sheet.

---

# 13. Section J — Navigation footer

Always easy to reach:
- `전체 시트`;
- current layout indicator/switch;
- optional `규칙` shortcut if not already obvious in Utility Rail.

Do not add:
- `플레이로 돌아가기`;
- Character route navigation;
- Session leave/end;
- Character build wizard as a primary action.

---

# 14. Roll presentation contract

Quick Sheet never contains a dice canvas/tray/result stage.

On a local or authoritative roll presentation:
- body/app-level cinematic dice enter from screen depth;
- Quick Sheet stays in place;
- compact result appears as Session presentation;
- authoritative connected result comes from the existing resolution projection;
- standalone local result remains local and clearly does not mutate connected mechanics.

---

# 15. Empty/edge states

No attacks:
- show `현재 사용할 공격이 없습니다.` as a small reference state;
- do not hide the rest of Quick Sheet.

No spells:
- omit/collapse spell section rather than showing a large empty card.

No resources:
- omit/collapse resource section.

Disconnected/reconnecting:
- Quick Sheet remains readable from current snapshot;
- actions that require a network/Host roundtrip show disabled/pending recovery status as appropriate;
- do not throw the user to Lobby/Ready.

Character no longer present in recovered Session projection:
- close invalid action context;
- retain Character reference if owning local Character is still available;
- show recovery/domain explanation rather than stale target/action controls.

---

# 16. Accessibility and pointer rules

- rows that perform actions have ~40-44px usable hit area where possible;
- roll/action controls are buttons, not hover-only text;
- condition/resource abbreviations have accessible labels;
- opening Full Sheet/Rules transfers focus logically;
- closing nested tools returns focus to the triggering Quick Sheet control when possible.

---

# 17. Quick Sheet implementation acceptance

Pass only when:
- one click opens it during Session;
- first viewport shows identity, HP/AC, core stats, status and routine attack/resource facts;
- it reads canonical snapshot state with no duplicated Character store;
- routine attacks enter the shared authoritative action flow;
- it does not invent generic HP/resource mutations;
- connected rolls do not become local-authority rolls by accident;
- Rules deep-links preserve Quick Sheet/action context;
- Full Sheet opens from it and closes back to the same Session context;
- no embedded dice frame exists;
- narrow Windows drawer keeps close and primary actions reachable.