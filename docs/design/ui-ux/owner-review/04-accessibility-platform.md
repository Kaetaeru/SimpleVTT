# Owner Review — Accessibility / Desktop Responsive

Sheets: `A11Y-01`, `PLATFORM-01`

Instructions: choose one candidate code in `OWNER SELECT`, or use `CUSTOM` and describe the desired behavior in `OWNER NOTE`. Candidate options are scaffolding only. `AI STATUS` is AI-managed.

---

# A11Y-01 — Accessibility

### A11Y-01-01 — Product-wide keyboard / focus standard

**질문:** 제품 전체 keyboard navigation과 visible focus의 기본 standard는?

**선택지**
- `A` — 모든 material action keyboard reachable, 논리적 Tab order, 항상 visible focus indicator.
- `B` — A + composite controls(Hotbar/Grid/Menu)는 arrow-key roving focus를 표준으로 사용.
- `C` — B + 주요 Play action에 optional shortcut layer를 제공하되 shortcut은 유일한 접근 방식이 아님.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### A11Y-01-02 — Layer focus management

**질문:** layer category별 focus trap / initial focus / return rule은?

**선택지**
- `A` — Modal/required interrupt는 focus trap, Pane/Drawer는 non-trapping, Close 후 invoker/logical next로 focus return.
- `B` — Full Workspace도 내부 focus scope를 만들되 session/global status shortcut은 유지.
- `C` — trap 여부는 layer contract가 선언하고 initial/return focus 규칙만 product-wide로 강제.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### A11Y-01-03 — Actor Card / targeting / context-menu semantics

**질문:** Actor Card, targeting, context menu의 keyboard/semantic model은?

**선택지**
- `A` — Actor Card 자체가 focusable composite; Enter/Space는 현재 primary interaction, Shift+F10/Menu key는 context menu.
- `B` — Card는 focusable selection surface + 내부 explicit action controls를 별도 Tab/arrow navigation.
- `C` — Card container는 semantic group/article, primary/context actions는 명시적 내부 buttons로만 제공.
- `CUSTOM` — 직접 정의. Pointer-only interaction은 허용하지 않음.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### A11Y-01-04 — Hotbar / Command Center keyboard model

**질문:** Hotbar/Command Center와 targeting cancel의 keyboard model은?

**선택지**
- `A` — Hotbar를 toolbar/grid composite로 보고 arrow navigation + Enter/Space activate + Escape cancel targeting.
- `B` — Hotbar page는 tablist, 각 page slot은 grid/list navigation, contextual controls는 일반 Tab order.
- `C` — 모든 slot/control을 단순 Tab order로 유지하고 optional shortcut 숫자키만 보조 제공.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### A11Y-01-05 — Status / alert / live announcements

**질문:** loading/error/reconnect/result/interrupt 변화를 어떻게 screen-reader announcement로 구분할 것인가?

**선택지**
- `A` — nonurgent status/result는 status/polite, blocking error/required interrupt는 alert/assertive.
- `B` — only blocking/error/interrupt만 자동 announce하고 일반 result/status는 focusable text로 제공.
- `C` — 상태 category별 live-region policy를 정의: connection/pending=polite, authoritative required response=assertive, repeated roll feed는 deduplicated polite.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### A11Y-01-06 — Reduced-motion equivalents

**질문:** dice/VFX/overlay/result reveal의 reduced-motion equivalent는?

**선택지**
- `A` — motion path/bounce를 제거하고 짧은 fade/state transition으로 동일한 정보 순서를 유지.
- `B` — physical dice/VFX를 static result representation으로 대체하되 authoritative result/reveal order는 유지.
- `C` — per-category reduced motion: dice는 guided settle 최소화, combat VFX는 static impact marker, overlays는 no-slide/fade.
- `CUSTOM` — 직접 정의. 결과 자체는 절대 변경하지 않음.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### A11Y-01-07 — Non-color semantic redundancy

**질문:** target/side/status/DM-only 등의 state를 color 외 무엇으로 중복 전달할 것인가?

**선택지**
- `A` — icon + text/badge + border/shape를 상황에 맞게 조합.
- `B` — persistent text/badge를 primary, color/icon은 secondary.
- `C` — compact Play에서는 icon/shape, detail/hover/focus에서는 text label을 추가.
- `CUSTOM` — state별 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### A11Y-01-08 — Portrait / handout alternative text and zoom

**질문:** portrait/handout image의 alt/description 및 zoom/pan 접근성은?

**선택지**
- `A` — Character portrait는 identity name과 중복되지 않게 처리, Handout은 DM-provided title/description field를 지원; zoom/pan controls keyboard accessible.
- `B` — 모든 meaningful image에 explicit description field를 제공, decorative portrait는 empty alt 가능.
- `C` — Handout description은 optional but strongly surfaced; image 내용이 gameplay-essential이면 DM이 text description을 제공하도록 요구.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### A11Y-01-09 — Text scaling / zoom

**질문:** Product/Sheet/Play가 text scaling/browser/app zoom에서 무엇을 보장해야 하는가?

**선택지**
- `A` — 일반 desktop zoom/text scaling에서도 primary content/actions가 clipping 없이 reflow하고 horizontal page scroll을 최소화.
- `B` — OS/browser zoom 지원 + app 자체 text-size preference 제공.
- `C` — product-wide zoom은 system/browser에 맡기되 narrow-responsive layout이 확대 시에도 core anchors/actions를 보존.
- `CUSTOM` — 정확한 test 범위는 later acceptance contract에서 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### A11Y-01-10 — Compact/icon control labeling

**질문:** 어떤 compact/icon controls가 visible label, accessible name, discoverable help를 요구하는가?

**선택지**
- `A` — 모든 icon-only control은 accessible name; ambiguous/rare control은 tooltip/help; critical action은 visible label 우선.
- `B` — primary/destructive/privacy controls는 visible label 필수, standard navigation/utilities는 icon-only 가능.
- `C` — dense Play에서는 icon-only를 넓게 허용하되 first-use/help 및 hover/focus label을 항상 제공.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

---

# PLATFORM-01 — Desktop Responsive

### PLATFORM-01-01 — Supported width classes / mobile scope

**질문:** v1이 지원할 desktop width class와 mobile/touch-first scope는?

**선택지**
- `A` — Wide / Normal / Narrow Desktop만 공식 지원. Mobile/touch-first는 v1 out of scope.
- `B` — Wide / Normal / Narrow Desktop + tablet-like landscape width까지 지원, phone/mobile는 out of scope.
- `C` — desktop-first이지만 touch-capable narrow layout까지 고려, 별도 mobile IA는 만들지 않음.
- `CUSTOM` — 직접 정의. 정확한 breakpoint 숫자는 later token/layout contract에서 결정.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### PLATFORM-01-02 — Product Shell navigation reflow

**질문:** width가 좁아질 때 Product Shell primary navigation은 어떻게 변형되는가?

**선택지**
- `A` — full left rail → compact icon rail.
- `B` — wide left rail → narrow top/header navigation.
- `C` — full rail → compact rail → 필요 시 explicit navigation drawer.
- `CUSTOM` — UI-01/NAV 선택에 맞춰 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### PLATFORM-01-03 — Play Dual Anchor reflow

**질문:** narrow desktop에서도 Scene/Actor Context와 Command Center를 co-primary로 어떻게 유지할 것인가?

**선택지**
- `A` — Command Center는 bottom fixed, Scene은 남은 영역 사용; Actor Boards/card metadata만 compact/reflow.
- `B` — Scene + Actor Boards를 upper region, Command Center를 더 높은 two-row bottom region으로 재배치.
- `C` — Scene은 full center를 유지하고 Command Center 내부 content를 paging/compact variant로 바꿔 height 증가를 제한.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### PLATFORM-01-04 — Actor Boards / Initiative reflow

**질문:** Actor Boards와 top Initiative Tracker를 narrow desktop에서 어떻게 유지할 것인가?

**선택지**
- `A` — horizontal scroll/paging을 사용하고 card/entry의 essential identity/state는 유지.
- `B` — full card → compact card variant로 바꾸고 한 줄 structure 유지.
- `C` — Actor Boards는 compact rows, Initiative는 separate compact top strip로 서로 다른 reflow 전략 사용.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### PLATFORM-01-05 — Command Center / Hotbar reachability

**질문:** 좁은 폭에서 Command Center/Hotbar/Economy/Resource Rail의 reachability를 어떻게 보장할 것인가?

**선택지**
- `A` — bottom Command Center 유지 + Hotbar page/paging + economy/resources persistent compact strip.
- `B` — Hotbar horizontal scroll, economy/resources는 별도 fixed sub-row.
- `C` — two-row responsive Command Center: essential actor/economy top, capability pages bottom.
- `CUSTOM` — 직접 정의. Core capability를 generic drawer 뒤로 숨기지 않음.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### PLATFORM-01-06 — Contextual utility reflow

**질문:** Session/DM utility rail/pane은 narrow desktop에서 어떻게 변형되는가?

**선택지**
- `A` — side pane → overlay drawer, 한 번에 하나만 open.
- `B` — side pane → full-height contextual panel that overlays scene but leaves Command Center visible.
- `C` — utility launcher만 compact rail로 유지하고 실제 pane은 mode별 bounded overlay/full-height panel.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### PLATFORM-01-07 — Character surfaces reflow

**질문:** Character Sheet/Builder/Level Up/Full Sheet는 narrow desktop에서 어떻게 reflow하는가?

**선택지**
- `A` — multi-column → single/stacked columns, sticky summary/action region 유지.
- `B` — major sections를 tabs/accordion으로 전환해 vertical density 제어.
- `C` — Sheet는 tabbed/stacked, Builder/Level Up은 one-column wizard, Full Sheet는 single scroll workspace로 각각 최적화.
- `CUSTOM` — surface별 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### PLATFORM-01-08 — Handout modes on narrow desktop

**질문:** Overlay/Upper/Full Handout mode와 zoom/pan을 narrow desktop에서 어떻게 유지할 것인가?

**선택지**
- `A` — 각 mode의 의미는 그대로 유지하고 image fit/controls만 responsive하게 재배치.
- `B` — Overlay는 larger bounded viewer, Upper는 scene upper region 재할당, Full은 full workspace; zoom/pan controls 공통.
- `C` — mode별 minimum usable region을 정의하고 좁으면 scroll/pan을 허용하되 다른 mode로 자동 대체하지 않음.
- `CUSTOM` — 직접 정의. UI가 mode를 임의 변경하면 안 됨.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### PLATFORM-01-09 — Dice/result on narrow desktop

**질문:** physical dice/result presentation이 essential action을 가리지 않도록 narrow desktop에서 어떻게 적응하는가?

**선택지**
- `A` — dice scale/throw distance를 줄이고 central safe roll area를 유지, result는 same sequence.
- `B` — 3D dice는 가능한 범위에서 축소하고 공간이 부족하면 approved static/reduced presentation fallback 사용.
- `C` — scene 안에 bounded roll zone을 명확히 두고 Command Center/Actor Boards와 overlap 금지.
- `CUSTOM` — 직접 정의. Authoritative result는 presentation과 무관하게 동일.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`
