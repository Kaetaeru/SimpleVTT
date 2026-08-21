# UI Reference Prototype — Design Defaults

Status: **AI Design Default — reconciled to mapless integrated baseline**

Baseline: [`../INTEGRATED-PRODUCT-UX-PLAN.md`](../INTEGRATED-PRODUCT-UX-PLAN.md)

Rebuild contract: [`PROTOTYPE-REBUILD-CONTRACT.md`](PROTOTYPE-REBUILD-CONTRACT.md)

These defaults make the prototype concrete without forcing the owner to choose every visual token.

They may not override Product Decisions or Domain/Architecture truth.

---

# 1. Visual direction

Use a **desktop tabletop-tool aesthetic**:

- dark neutral surfaces by default;
- compact but readable Play density;
- restrained borders/elevation rather than mobile-card styling;
- warm accent for focus/high-value actions;
- semantic states use text/icon/shape support, never color alone;
- BG3-family interaction density/information grammar is acceptable inspiration for the bottom Command Center only;
- do not reproduce Baldur's Gate 3 art/assets/exact layout;
- do not import minimap, party rail, tactical-map, movement/LoS or other BG3 battlefield systems.

The prototype should feel like a serious desktop tabletop companion, not a SaaS dashboard and not a tactical-map game UI.

---

# 2. MAPLESS visual guard

The largest available Play region is a **Mapless Play Context / Tabletop Stage**.

It may use:

- subtle dark tabletop/material texture;
- gradient/depth lighting for physical dice;
- unobtrusive atmospheric decoration;
- current interaction/result/NOTICE/Handout content.

It MUST NOT use visual filler that implies a battlemap:

- square/hex grid;
- dungeon floor plan;
- tactical walls/doors/terrain;
- Actor tokens positioned around the stage;
- coordinates;
- movement arrows;
- range rings;
- AoE shapes;
- Fog of War;
- vision/LoS cones/lines;
- map camera/minimap affordance.

Visual empty space is acceptable. Do not invent a battlefield just to fill it.

---

# 3. First-run visual default

Fresh-run default presentation begins with the dedicated Tutorial/Onboarding window inside the product frame.

The Tutorial should feel like a focused first-use product panel, not like a permanent Home card.

Suggested composition:

- SimpleVTT identity/title;
- concise Standalone / Connected explanation;
- two clearly comparable Sheet presentation choices;
- short Character / Host / Join orientation;
- one clear complete/continue action;
- secondary skip only if consistent with current Tutorial completion contract;
- explicit `change later` copy for Sheet presentation.

After completion, Home becomes the normal starting surface.

---

# 4. Prototype token baseline

## Typography

Use local/system fonts only:

```css
font-family: "Segoe UI", "Noto Sans KR", system-ui, sans-serif;
```

Suggested scale:

| Token | Size | Use |
| --- | ---: | --- |
| `--text-xs` | 12px | metadata / secondary status |
| `--text-sm` | 13px | dense Play controls |
| `--text-md` | 14px | normal body/control text |
| `--text-lg` | 16px | strong labels/subheads |
| `--text-xl` | 20px | panel/page headings |
| `--text-2xl` | 28px | rare title use |

Rules:

- numeric resource/result information should scan cleanly;
- essential action labels remain legible;
- wrap/reflow before truncating critical meaning;
- Korean labels primary; English/source metadata secondary where useful.

## Spacing

Base: `4px`.

Preferred family:

```text
4 / 8 / 12 / 16 / 24 / 32
```

Play favors `4/8/12`; Product Shell/forms favor `8/12/16/24`.

## Radius

```text
4px  compact control/card
8px  normal panel/control group
12px large overlay/dialog only
```

Avoid excessive pill/mobile-card styling.

## Border/focus

- normal border: 1px;
- selected/current may add stronger border/background;
- keyboard focus ring clearly visible, visually at least ~2px;
- focus must not be removed for aesthetics.

---

# 5. Color-token baseline

Prototype starts neutral dark. Exact values remain tunable.

Suggested variables:

```css
--bg-root: #0f1216;
--bg-surface-1: #161b21;
--bg-surface-2: #1d242c;
--bg-surface-3: #252e38;
--border-subtle: #34404c;
--text-primary: #f0f3f6;
--text-secondary: #aeb8c3;
--text-muted: #7f8b98;
--accent: #d6ad62;
--success: #64b982;
--warning: #d7a454;
--danger: #d56d6d;
--info: #68a8d8;
--ally: #6ea8db;
--neutral: #a9adb4;
--hostile: #d77575;
--dm-only: #bd86cf;
```

Rules:

- `DM Only` includes explicit text/icon;
- Ally/Neutral/Hostile includes redundant label/icon/border treatment;
- current turn, selected, controlled, target-valid, target-invalid and target-selected are distinct;
- result color does not invent success/failure not supplied by fixture/authority.

---

# 6. Desktop viewport presets

Review presets, not canonical breakpoints:

| Preset | Viewport |
| --- | --- |
| Wide | 1600x1000 |
| Normal | 1366x768 |
| Narrow Desktop | 960x700 |

At Narrow Desktop:

- compress/reflow secondary information first;
- keep Actor Boards reachable;
- keep Command Center directly reachable;
- Actor cards stop shrinking at minimum useful width then horizontally overflow/page;
- contextual utility panes may narrow/overlay but remain desktop interactions;
- the mapless central context may shrink but does not become a map/minimap UI;
- mobile/touch-first patterns remain out of v1 scope.

---

# 7. Density rules

## Product Shell

Moderate density with clear hierarchy.

## Play

High useful information density at the edges/anchors, with intentional breathing room in the central mapless context.

Do **not** interpret visual breathing room as wasted space that must be filled by a battlemap.

- upper/lower Actor Boards are compact;
- Command Center remains stable;
- capabilities directly discoverable;
- explanation moves to hover/focus/detail;
- central stage is reserved for current interaction/dice/result/Handout.

## Character

Sheet can be dense but remains readable and usable as a standalone physical-table tool.

Character Create/Level Up structure remains the accepted canonical baseline and may only be visually harmonized.

---

# 8. Command Center default

BG3-family structural default:

- compact top row for meaningful economy/resources;
- lower-left controlled Actor status;
- larger lower/right Hotbar/capability region;
- contextual Execute/End Turn/Cancel.

Freeform:

- do not show fake per-turn economy;
- show resource/cost information truthfully when useful.

Initiative:

- authoritative economy may appear.

Hotbar:

- Mixed / Action / Spell / Item / custom examples;
- automatic capability discovery + customization;
- historical intent-first taxonomy is not the primary normal access model.

---

# 9. Actor Board default

Actor Cards are horizontally arranged board/list objects, never map tokens.

Default card content:

- portrait/identity;
- name;
- relation/side;
- authorized/useful HP/status;
- controlled/current/selected/target state.

Do not include full inspector/provenance/inventory/rules detail in every card.

Minimum usable width takes priority over fitting every card at once.

---

# 10. Control family defaults

Button variants:

- `Primary`;
- `Secondary`;
- `Quiet`;
- `Destructive`;
- `Icon` when accessibly named/discoverable.

Suggested heights:

```text
Compact Play: 30–32px
Normal:       36px
Large:        40px
```

Tabs change peer presentation, not gameplay authority by accident.

Inputs retain labels; validation stays near affected fields; blocking errors expose recovery where available.

---

# 11. Hover / focus explanation

Owner preference strongly favors rich hover explanations.

Default:

- compact unfamiliar controls explain on hover/focus;
- capability detail can use a larger anchored explanation frame;
- essential current state/action availability is never hover-only;
- keyboard focus receives equivalent detail access;
- right-click Actor menu remains supplementary; material information is reachable elsewhere.

Prototype tuning suggestion:

```text
small tooltip: ~300ms
rich explanation: ~350–450ms
```

These timings are defaults, not Product authority.

---

# 12. Panel / resize defaults

Demonstrate safe local resizing for selected utility panes.

Defaults:

- drag gutter;
- bounded min/max utility width;
- minimum Actor Card width;
- minimum Command Center usable height;
- central mapless context remains nonzero/useful;
- Reset Layout/default option when needed.

Do not define a `minimum battlemap size`; there is no Core battlemap.

Resize is local presentation state only.

---

# 13. Dice presentation defaults

Both Standalone and Connected dice use the same physical visual language.

Suggested experience:

1. begin smaller/farther in visual depth;
2. move toward user/front while rotating;
3. contact a visually tabletop-like but non-tactical plane;
4. short bounce/roll;
5. settle quickly;
6. compact result becomes readable;
7. dice clear without blocking normal use.

Standalone:

- current Sheet remains visible/stable underneath;
- no persistent dice panel/window.

Connected:

- central mapless Tabletop Stage is presentation space;
- authoritative result exists independently from physics.

Avoid long cinematic delays in routine play.

---

# 14. Motion defaults

Suggested tuning:

```text
micro transition: 120ms
panel/popover: 160–180ms
large layer: 220–240ms
```

Rules:

- motion supports orientation;
- dice/VFX may be expressive but non-authoritative;
- cosmetic animation does not unnecessarily lock useful controls;
- Reduced Motion removes nonessential movement while preserving result/order comprehension.

---

# 15. NOTICE / feedback hierarchy

Default priority:

1. blocking local problem -> inline/blocking surface;
2. persistent current condition -> NOTICE/banner;
3. immediate action/result -> current Sheet/Play context;
4. short acknowledgement -> toast;
5. durable history/detail -> Activity.

Do not duplicate every message everywhere.

---

# 16. Prototype quality bar

The next HTML must be polished enough to judge the intended product composition and interaction, not just a wireframe.

Spend prototype effort on:

- first-run flow;
- hierarchy;
- mapless Play composition;
- Actor/Command anchors;
- same-Sheet dice behavior;
- role/state differences;
- targeting/resolution;
- layers/utility coexistence;
- desktop reflow;
- accessibility;
- long-session visual comfort.

Do not spend prototype effort on:

- production backend/network/storage;
- final asset pipelines;
- real authoritative 3D dice physics implementation;
- production optimization;
- invented tactical-map visuals.
