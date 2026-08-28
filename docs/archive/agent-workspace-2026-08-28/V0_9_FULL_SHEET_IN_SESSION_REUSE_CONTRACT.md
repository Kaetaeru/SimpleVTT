# SimpleVTT V0.9 Full Sheet In-Session Reuse Contract

## 0. Purpose

Full Character Sheet must be usable in two environments without creating two Character Sheet products:

1. Standalone physical-table mode in Library Mode;
2. In-session workspace layer inside the persistent Session Shell.

Both environments use the same canonical Character and the same SimpleVTT / Official-style presentation preference.

---

# 1. Target component architecture

```text
CharacterSheetWorkspaceController
├─ layout preference
├─ Character/view projection
├─ sheet page state
├─ roll/action callback interface
└─ shared content
   ├─ SimpleVttSheetContent
   └─ OfficialSheetContent
      ├─ OfficialCharacterSheetPage
      └─ OfficialSpellcastingSheetPage

Hosts
├─ StandaloneCharacterSheetHost
└─ SessionFullSheetHost
```

The hosts own navigation/chrome. The shared content owns Character Sheet presentation.

---

# 2. Reuse requirement

Do not build a new Session-only Character Sheet implementation.

Reuse/extract from the current implementation:
- `projectOfficialSheet` and existing rule projections;
- SimpleVTT ability/save/skill sections;
- attacks/resources/features/equipment/spells sections;
- `OfficialCharacterSheetPage`;
- `OfficialSpellcastingSheetPage`;
- item equip/attune/use commands;
- current SimpleVTT/Official layout preference.

Refactor out of reusable content:
- route callbacks such as `onScene`;
- `기기로 플레이` button;
- assumption that Edit/Level Up are always primary toolbar actions;
- embedded `sheet-roll-result` / `VisualDiceTray`;
- page-level shell that conflicts with Session LayerHost.

---

# 3. Shared controller inputs

Suggested conceptual interface:

```text
mode: standalone | session
character: canonical active Character projection
layout: simplevtt | official
onLayoutChange(layout)
onOpenRules(ruleRef?)
onClose?()                  // session host only
onEditCharacter?()          // standalone/explicit flow
onLevelUp?()                // standalone/explicit flow
rollController
itemCommands
```

The exact TypeScript shape may differ, but mode-specific navigation must be injected rather than hard-coded in Sheet content.

---

# 4. Standalone host contract

Standalone physical-table Sheet remains a Library Mode route.

It may expose:
- Character Edit;
- Level Up;
- layout switch;
- local common dice;
- local ability/save/skill/attack/damage rolls;
- local roll history.

Standalone local rolls are not Session mechanics and may use local randomness.

Presentation still uses the same app/body-level cinematic dice language; a permanent embedded dice stage is not restored.

---

# 5. Session Full Sheet host contract

Full Sheet opens as a large workspace layer over mounted SessionModeRoot.

Toolbar:
- Character identity;
- `SimpleVTT | 공식 시트 스타일`;
- `Rules`;
- `시트 닫기` / close icon.

Not primary Session toolbar actions:
- `기기로 플레이`;
- normal route navigation;
- Character build Edit;
- Level Up.

Edit/Level Up may exist only as explicit advanced/out-of-session transitions with clear implications, not as routine Session-time actions.

---

# 6. Session state preservation

Opening Full Sheet must preserve where still valid:
- Freeform / Initiative mode;
- selected DM Actor;
- Player identity;
- current intent;
- selected action detail;
- eligible selected targets;
- Main Focus scroll;
- prior utility tool context.

Full Sheet has its own internal view state:
- SimpleVTT/Official layout;
- Official character/spellcasting page;
- sheet-local scroll/tab position;
- expanded/collapsed sections.

Closing Full Sheet returns to the previous Session state instead of navigating to a `scene` route.

---

# 7. Layout switch contract

`SimpleVTT` and `공식 시트 스타일` are presentation modes over the same Character.

Switching layout:
- does not create/copy Character data;
- does not alter mechanics revision;
- does not close Session;
- does not reset current Session intent/action context;
- persists using the existing sheet layout preference mechanism.

When practical, preserve the user's approximate semantic location; exact pixel scroll parity between very different layouts is not required.

---

# 8. Roll controller boundary

The current Sheet components mix roll generation with presentation. This must be separated.

Conceptual roll controller supports requests such as:
- ability check;
- saving throw;
- skill check;
- attack;
- damage;
- common raw die;
- spell/action use where mapped.

## Standalone controller
May perform local random rolls and publish local presentation/history.

## Session controller
Must not treat local `crypto.getRandomValues` rolls as authoritative connected mechanics.

Session roll policy:
1. if the requested Sheet interaction maps to an existing authoritative `ActionVm`, route through the canonical action/resolution path;
2. if canonical runtime already exposes an equivalent authoritative roll command, use it;
3. if the product requires an authoritative Sheet roll but no canonical command exists, add that capability to the existing mechanics/ResolutionEvent authority rather than creating a Sheet-only resolver;
4. until such authority exists, the UI may show the modifier/reference or an explicitly local non-authoritative die, but must not present it as the shared Session outcome.

---

# 9. Dice/result presentation

Both hosts publish roll presentation to the app/body-level dice/result layer.

Required behavior:
- dice enter from screen depth toward the user;
- Sheet size/position does not change;
- no Sheet-local dice tray;
- authoritative Session result settles to the authoritative outcome;
- local standalone result uses the same visual language;
- result history lives in the appropriate existing activity/local presentation system, not inside a duplicate mechanics ledger.

---

# 10. Rules from Full Sheet

Any ability, condition, item, feature or spell may expose `규칙 보기` when a resolvable rule reference exists.

In Session:
- Rules opens above/on the side of Full Sheet through LayerHost;
- Full Sheet remains mounted;
- first Escape closes Rules;
- next Escape closes Full Sheet;
- Session Shell remains mounted throughout.

Standalone:
- may use an equivalent overlay/pane or Library Rules navigation, but shared content should invoke `onOpenRules` rather than hard-code routing.

---

# 11. Item interactions

Keep existing canonical commands for:
- equip/unequip;
- attunement;
- item use.

In Session:
- commands that mutate canonical Character/runtime state must still pass through AppProvider/runtime adapters;
- if an item use corresponds to an authoritative action, prefer the action flow rather than an unrelated local effect;
- display pending/error state at the triggering control.

---

# 12. Resources and spell slots

Full Sheet displays canonical resource/spellcasting projections.

Do not add arbitrary local `+/-` controls unless an existing canonical command defines that operation.

Spending via spell/action use should occur through the same mechanics action path that owns resource consumption.

Standalone-only tracking operations may be added later only if they update the owning Character through the existing Character authority.

---

# 13. Official-style reuse details

`OfficialCharacterSheetPage` and `OfficialSpellcastingSheetPage` are preferred reuse units.

Refactor their parents so that:
- page tabs are owned by shared sheet workspace state;
- d20/damage callbacks come from the injected roll controller;
- Rules links can call the host;
- item operations remain injected canonical commands;
- no route navigation is required by leaf pages.

---

# 14. SimpleVTT reuse details

Extract the current SimpleVTT sections from the route-level `LegacyCharacterSheetPlayScreen` into reusable content.

Preserve:
- ability/save/skill readability;
- attacks/damage reference;
- resources/features/equipment/spells;
- common dice access in Standalone mode.

Replace:
- route toolbar;
- embedded roll-result tray;
- route-owned history as the only history surface.

Session mode may reduce or move common raw dice if it conflicts with Session action priority, but must keep Character reference complete.

---

# 15. Responsive behavior

Wide desktop:
- large centered workspace layer, ~88-94% viewport width;
- Session Bar may remain visible.

Medium/narrow:
- Full Sheet becomes full workspace overlay;
- toolbar remains pinned/reachable;
- Sheet content scrolls internally;
- no double body scroll caused by the overlay.

Very low height:
- compact toolbar;
- close/layout/Rules remain visible;
- content gets internal scrolling.

---

# 16. Failure/reconnect behavior

Reconnect while Full Sheet is open:
- keep Sheet open when local/canonical Character remains available;
- refresh Session-backed action/resource state from recovered snapshot;
- disable actions requiring unavailable network authority while reconnecting;
- do not send the Player to Lobby/Ready/Start.

If authoritative state makes an in-progress Sheet action invalid, cancel only that action and explain why.

---

# 17. Migration acceptance

Full Sheet reuse is accepted only when:
- Standalone and Session hosts render the same underlying Character Sheet content family;
- SimpleVTT/Official switch works in both without copying Character data;
- Session Full Sheet is a layer, not a Character route;
- closing returns to the same Session context;
- existing Official leaf pages are reused rather than duplicated;
- route toolbar/`기기로 플레이` is absent from Session host;
- connected Session rolls do not use a Sheet-only authoritative resolver;
- body-level cinematic dice replace the embedded tray;
- Rules layers correctly over Full Sheet;
- narrow Windows viewport retains close/layout/Rules controls.