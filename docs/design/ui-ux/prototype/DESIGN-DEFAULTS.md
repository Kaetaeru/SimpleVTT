# UI Reference Prototype — Design Defaults

Status: **AI Design Default — prototype detail, not Product Decision**

These defaults exist so the Reference Prototype can be concrete without forcing the owner to choose every visual token.

The owner may override any of these in plain language. If an override becomes a material workflow/capability/authority choice, promote it through `OWNER-CONTROL-POLICY.md` rather than silently changing product behavior.

---

# 1. Visual direction

Use a **desktop tabletop-tool aesthetic**:

- dark neutral surfaces by default;
- compact but readable Play density;
- restrained borders/elevation rather than mobile-card styling;
- warm accent for primary focus/high-value actions;
- semantic states always include text/icon/shape support, never color alone;
- BG3-family interaction density/information grammar is acceptable inspiration, but do not reproduce Baldur's Gate 3 art, assets, exact layout, or pixel styling.

The prototype should feel like a serious desktop game tool, not a dashboard SaaS page and not a phone UI enlarged to desktop.

---

# 2. Prototype token baseline

These are prototype defaults, intentionally easy to tune after visual review.

## Typography

Use local/system fonts only in the prototype so it works offline:

```css
font-family: "Segoe UI", "Noto Sans KR", system-ui, sans-serif;
```

Suggested scale:

| Token | Size | Use |
| --- | ---: | --- |
| `--text-xs` | 12px | metadata, secondary status |
| `--text-sm` | 13px | dense Play controls |
| `--text-md` | 14px | normal body/control text |
| `--text-lg` | 16px | strong labels/subheads |
| `--text-xl` | 20px | panel/page headings |
| `--text-2xl` | 28px | rare page/title use |

Rules:

- numeric combat/resource information should align cleanly and scan quickly;
- dense Play UI may use `xs/sm`, but essential action labels must remain legible;
- avoid truncating critical action/state meaning when wrapping/reflow is safer;
- Korean labels are primary when the product UI is Korean; English names/source metadata may appear secondarily.

## Spacing

Base spacing unit: `4px`.

Preferred spacing family:

```text
4 / 8 / 12 / 16 / 24 / 32
```

Play favors `4/8/12`; Product Shell and forms favor `8/12/16/24`.

## Radius

```text
4px  — compact control/card
8px  — normal panel/control group
12px — large overlay/dialog only
```

Avoid excessive pill/rounded-card styling.

## Border / focus

- default border: 1px;
- selected/current state may use stronger border + background, not color alone;
- keyboard focus ring: clearly visible, minimum 2px visual weight;
- focus must never be removed merely for aesthetics.

---

# 3. Color-token baseline

Prototype starts with a neutral dark theme. Exact values are AI-managed and tunable.

Suggested CSS variables:

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

- `DM Only` always includes an explicit text/icon indicator, not purple alone;
- Ally/Neutral/Hostile always has a redundant label/icon/border treatment;
- current turn, selected Actor, valid target, invalid target, controlled Actor, and focus are visually distinguishable from each other;
- result color must not invent success/failure semantics not provided by authoritative mock/contract data.

---

# 4. Desktop viewport presets

These are **prototype review presets**, not canonical product breakpoints:

| Preset | Viewport |
| --- | --- |
| Wide | 1600×1000 |
| Normal | 1366×768 |
| Narrow Desktop | 960×700 |

The prototype must support all three without hiding core Command Center actions behind a generic mobile drawer.

At Narrow Desktop:

- reflow/compress secondary information first;
- keep Scene/Actor context reachable;
- keep Command Center directly reachable;
- horizontal paging/scroll is allowed for Actor Boards when cards hit minimum usable width;
- contextual utility panes may become narrower/overlay-like but must remain desktop interactions;
- mobile/touch-first navigation patterns are out of v1 scope.

---

# 5. Density rules

## Product Shell

Use moderate density and strong hierarchy. Pages should breathe enough for reading, forms and library scanning.

## Play Workspace

Use high information density without hiding capability:

- Command Center stays visually stable;
- compact controls are acceptable;
- secondary explanation belongs in hover/focus/detail frames;
- capabilities themselves remain discoverable/direct;
- avoid large decorative empty space that steals Scene/Table area.

## Character surfaces

Character Sheet may be denser than Product pages but less compressed than the bottom Command Center.

Existing Character Builder / Level Up UI structure remains the accepted baseline; the prototype may visually harmonize it without redesigning its workflow.

---

# 6. Control family defaults

## Button variants

Prototype component family:

- `Primary` — one main forward/commit action per local context where possible;
- `Secondary` — normal alternative action;
- `Quiet` — low-emphasis utility;
- `Destructive` — destructive/end/remove action;
- `Icon` — compact control only when meaning is discoverable/accessibly named.

Suggested heights:

```text
Compact Play: 30–32px
Normal:       36px
Large:        40px
```

These are prototype defaults, not hard production requirements.

## Tabs / segmented / toggles

- Tabs change peer content, not authoritative gameplay mode by accident.
- Segmented controls are for a small exclusive set.
- Toggles change explicit boolean/local preference state.
- Current selection must be obvious without relying on color only.

## Inputs

- labels remain visible for material form fields;
- placeholder text does not replace labels;
- validation appears next to the affected field/section;
- blocking errors include a clear recovery action when one exists.

---

# 7. Hover explanation defaults

The owner explicitly wants hover explanation frames used actively.

Default behavior:

- brief label/meaning appears on hover/focus for compact unfamiliar controls;
- richer capability explanation may open a larger anchored explanation frame;
- essential state/action availability is never hover-only;
- keyboard focus gets equivalent explanation access where the control itself is keyboard-reachable;
- Actor right-click context menu remains pointer-first per reviewed owner decision, but material information must exist elsewhere too.

Prototype timing suggestion:

```text
small tooltip: ~300ms delay
rich explanation: ~350–450ms delay
```

Do not bake these numbers into product authority; they are tuning defaults.

---

# 8. Panel and resize defaults

The owner selected user-adjustable major panels where safe.

Prototype should demonstrate:

- drag gutter for selected utility/side-panel widths;
- minimum Scene/Table size;
- minimum Command Center usable height;
- minimum Actor Card width before horizontal board paging/scroll;
- layout resets through a clear reset/default action if resize becomes awkward.

Panel resizing is local presentation state and must not affect authoritative game/session state.

---

# 9. Motion defaults

Suggested prototype timing:

```text
micro state transition: 120ms
panel/popover:          160–180ms
large layer transition: 220–240ms
```

Rules:

- motion supports orientation, not spectacle;
- dice/VFX may be more expressive but authoritative result exists independently;
- important controls do not remain locked just to wait for cosmetic animation;
- reduced-motion mode removes nonessential transforms and keeps result/order comprehension intact.

---

# 10. Notice / feedback hierarchy

Use the owner's `NOTICE UI` concept as a persistent status region for important current conditions.

Default priority:

1. blocking local problem -> inline/blocking surface near the task;
2. important persistent current condition -> NOTICE UI / persistent status area;
3. immediate action/result -> close to current Scene/task;
4. short non-blocking acknowledgement -> toast;
5. durable event/history/detail -> Activity.

Do not duplicate every message in every channel.

---

# 11. Prototype styling rule

The first HTML should be **complete and polished enough to judge layout**, but all visual tokens remain easy to tune.

Do not spend prototype effort on:

- production asset pipelines;
- final illustration packs;
- actual 3D dice physics;
- backend wiring;
- perfect animation physics;
- production performance optimization.

Spend prototype effort on:

- composition;
- hierarchy;
- interaction clarity;
- state coverage;
- role differences;
- layering;
- responsive desktop behavior;
- owner-visible polish.