# Owner Review — Visual System / Components / Content

Sheets: `UI-02`, `UI-03`, `UI-04`, `UI-05`, `CMP-01`, `CONTENT-01`

Instructions: choose one candidate code in `OWNER SELECT`, or use `CUSTOM` and describe the desired behavior in `OWNER NOTE`. Candidate options are scaffolding only. `AI STATUS` is AI-managed.

---

# UI-02 — Typography

### UI-02-01 — Product-wide type hierarchy

**질문:** 제품 전체 typography hierarchy는?

**선택지**
- `A` — Display / Page Title / Section Title / Body / Label / Caption의 명확한 semantic hierarchy.
- `B` — Heading / Subheading / Body / Caption의 단순 4단계 hierarchy.
- `C` — Product surfaces와 dense Play HUD가 서로 다른 type family/scale을 쓰되 semantic role 이름은 공유.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### UI-02-02 — Dense Play HUD typography

**질문:** Play HUD/Command Center의 dense information typography는?

**선택지**
- `A` — compact sans hierarchy + tabular numerals + strong value/label distinction.
- `B` — readable body type + 강조 숫자/핵심 action만 display/data style로 차별.
- `C` — labels는 compact sans, 수치/initiative/resource는 별도 data/mono-style 숫자 체계.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### UI-02-03 — Numeric/stat distinction

**질문:** stats, dice notation, modifiers, DC/AC, HP, resources, initiative numbers를 어떻게 구분할 것인가?

**선택지**
- `A` — semantic label + tabular numeral + weight/size 차이로 구분, 표기법은 일관된 data typography 사용.
- `B` — 주요 수치를 badge/chip/value block으로 그룹화하고 본문 숫자와 시각적으로 분리.
- `C` — HP/resources/initiative/dice 등 category별 distinct typography token을 사용하되 과도한 font family 분화는 금지.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### UI-02-04 — Korean / English / provenance coexistence

**질문:** 한국어 label, English original name, source/provenance를 어떻게 함께 보여줄 것인가?

**선택지**
- `A` — 한국어 user-facing label primary, English original secondary, source/provenance tertiary metadata.
- `B` — D&D/rules 고유명은 English primary + 한국어 설명 secondary, 일반 UI는 한국어 primary.
- `C` — user preference에 따라 Korean-first / bilingual을 전환하고 source는 항상 tertiary.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### UI-02-05 — Long-name wrapping/truncation

**질문:** 긴 Character/Actor/action/item/rule 이름은 어떻게 처리할 것인가?

**선택지**
- `A` — 주요 content surface는 최대 2줄 wrap 후 truncate, compact control은 1줄 ellipsis + full-name tooltip/focus text.
- `B` — 모든 compact/dense surface는 1줄 ellipsis, detail surface에서만 full wrap.
- `C` — 이름은 가능한 wrap을 우선하고 실제 공간이 매우 제한된 Hotbar/Tracker만 truncate.
- `CUSTOM` — surface별 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### UI-02-06 — Narrow-desktop text compaction

**질문:** narrow desktop에서 어떤 text가 축약되어도 되는가?

**선택지**
- `A` — secondary labels/metadata만 축약; primary action/identity/status meaning은 유지.
- `B` — 잘 알려진 compact controls는 icon+accessible name으로 전환 가능, 나머지는 text 유지.
- `C` — 축약보다 wrap/reflow를 우선하고 마지막 단계에서만 secondary text를 숨김.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### UI-02-07 — Critical text emphasis

**질문:** critical error/privacy/result text를 어떻게 더 강하게 강조할 것인가?

**선택지**
- `A` — semantic color + weight/size + icon/label redundancy.
- `B` — typography 자체는 일관되게 유지하고 placement/banner/chip으로 severity를 강조.
- `C` — error/privacy/authoritative result에 별도 emphasis token을 두되 과도한 all-caps/animation은 사용하지 않음.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

---

# UI-03 — Color & Semantic Color

### UI-03-01 — Appearance modes / accent

**질문:** 어떤 appearance mode와 accent customization을 지원할 것인가?

**선택지**
- `A` — System / Light / Dark + 제한된 accent color customization.
- `B` — Dark-first default + Light optional + accent customization.
- `C` — System/Light/Dark만 지원하고 accent customization은 v1에서 제외.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### UI-03-02 — Feedback semantic colors

**질문:** Success / Warning / Error / Info / Disabled / Pending의 color semantics는?

**선택지**
- `A` — 각 semantic state에 독립 color token을 두고 Product 전체에서 동일 의미 유지.
- `B` — neutral-first palette, Success/Warning/Error만 strong semantic color, Info/Pending/Disabled는 neutral variations.
- `C` — common semantic core는 공유하되 Play/Character/Product surface별 tone/intensity variant 허용.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### UI-03-03 — Focus / selection / turn / control / targeting distinction

**질문:** focus, selection, current turn, controlled Actor, targetable, selected target를 어떻게 서로 다르게 표시할 것인가?

**선택지**
- `A` — 각 state에 별도 outline/border/badge token을 두고 중첩 가능하게 설계.
- `B` — Focus는 accessibility ring, Control/Turn은 persistent badge, Targeting은 card border/glow family로 축을 분리.
- `C` — Authority/turn axis와 targeting/selection axis 두 semantic color family만 두고 icon/shape로 세부 state 구분.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### UI-03-04 — Ally / Neutral / Hostile representation

**질문:** ally/neutral/hostile 관계를 color-only가 되지 않게 어떻게 표현할 것인가?

**선택지**
- `A` — relationship color + icon/label/border pattern redundancy.
- `B` — side badge/icon을 primary, color는 secondary reinforcement.
- `C` — card shape/header marker + text label을 primary로 하고 color는 최소 사용.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### UI-03-05 — Economy / resource colors

**질문:** Action / Bonus Action / Reaction / Movement와 dynamic resources의 semantic color는?

**선택지**
- `A` — 네 fixed economy type은 각각 안정된 distinct token, dynamic resources는 neutral/category accent.
- `B` — economy는 하나의 visual family + distinct icon/label, color 차이는 최소화.
- `C` — fixed economy는 distinct token, dynamic resource는 source/class/item이 제공하는 accent를 제한적으로 허용.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### UI-03-06 — Public vs DM Only indicator

**질문:** Public vs DM Only를 지속적이고 모호하지 않게 어떻게 표시할 것인가?

**선택지**
- `A` — 항상 visible text label + privacy icon + semantic color.
- `B` — persistent segmented/toggle text + 별도 DM-only badge when private.
- `C` — Command Center privacy control + DM-only 상태일 때 persistent privacy strip/chip을 추가.
- `CUSTOM` — 직접 정의. Color-only 표시는 허용하지 않음.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### UI-03-07 — Result colors

**질문:** result color가 rules meaning을 임의 생성하지 않으면서 outcome을 어떻게 전달할 것인가?

**선택지**
- `A` — canonical outcome classification이 제공될 때만 success/failure/critical semantic color 사용; 그 외 neutral result.
- `B` — 기본적으로 모든 authoritative result는 neutral, explicit textual outcome만 강조.
- `C` — roll/result category별 visual treatment를 쓰되 semantic color는 canonical result metadata가 있을 때만 적용.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### UI-03-08 — Contrast / forced colors

**질문:** contrast와 forced/high-contrast mode의 product principle은?

**선택지**
- `A` — 일반 text/control은 WCAG AA 수준을 기본으로 하고 forced-colors/high-contrast에서도 semantic state가 유지되어야 함.
- `B` — AA를 최소로 하되 critical text/control은 가능한 범위에서 더 강한 contrast 목표.
- `C` — OS/system high-contrast mode를 명시 지원하고 custom appearance보다 accessibility mode를 우선.
- `CUSTOM` — 직접 정의. 정확한 token 값은 later contract에서 결정.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

---

# UI-04 — Iconography

### UI-04-01 — Icon visual style

**질문:** SimpleVTT icon의 기본 visual language는?

**선택지**
- `A` — clean tactical/fantasy line icon, compact UI에서 잘 읽히는 단순 silhouette.
- `B` — filled glyph 중심의 강한 silhouette icon.
- `C` — navigation/utility는 line, combat/action/status는 filled의 two-family system.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### UI-04-02 — Icon-only vs icon+label

**질문:** 언제 icon-only control을 허용할 것인가?

**선택지**
- `A` — universally recognizable/space-constrained control만 icon-only; 항상 accessible name, ambiguous control은 label 병행.
- `B` — primary/destructive/rare actions는 항상 icon+label, navigation/standard utilities만 icon-only 가능.
- `C` — dense Play에서는 icon-only를 넓게 허용하되 hover/focus tooltip + accessible name 필수.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### UI-04-03 — Economy/resource icon family

**질문:** Action/Bonus/Reaction/Movement/resources icon family는?

**선택지**
- `A` — 네 economy type에 고유 symbol, resources는 category/source icon.
- `B` — geometric token/badge + letter/short label로 economy를 단순화.
- `C` — D&D/BG3 계열의 의미를 연상시키되 독자적인 original icon family로 구성.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### UI-04-04 — Conditions / status / initiative icons

**질문:** conditions/status/current-turn/initiative 상태 icon은?

**선택지**
- `A` — condition pictogram + compact badges, current-turn은 별도 turn marker.
- `B` — monochrome status glyph + tooltip/label, tracker는 portrait/number 중심.
- `C` — 작은 icon + short text/initial을 병용해 모호성을 낮춤.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### UI-04-05 — Product / Session / DM utility icons

**질문:** Product Shell와 Session/DM utilities icon family는?

**선택지**
- `A` — 동일한 outline/filled 규칙을 공유하는 product-wide utility family.
- `B` — global navigation은 simple line, DM/session utilities는 stronger filled/context icon.
- `C` — utility icons는 최대한 단순하게 하고 대부분 label과 함께 사용.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### UI-04-06 — Public / DM Only iconography

**질문:** Public vs DM Only를 text 외에 어떤 icon으로 보강할 것인가?

**선택지**
- `A` — Public=eye/globe 계열, DM Only=lock/eye-off 계열 + 항상 text.
- `B` — privacy shield family + Public/DM Only text badge.
- `C` — icon보다 text badge를 primary로 두고 lock indicator만 DM-only에 추가.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### UI-04-07 — Custom/add-on action fallback icon

**질문:** custom/add-on action에 mapped icon이 없을 때 fallback은?

**선택지**
- `A` — category generic icon + action short label.
- `B` — generated letter/initial tile + full accessible name.
- `C` — neutral generic capability glyph + source/category badge.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### UI-04-08 — Tooltip / accessible names for compact icons

**질문:** compact/icon controls의 tooltip과 accessible name 원칙은?

**선택지**
- `A` — 모든 icon-only control은 accessible name 필수, hover/focus tooltip 제공.
- `B` — accessible name은 항상 필수, tooltip은 ambiguous/nonstandard icon에만.
- `C` — critical actions는 visible label을 우선하고 tooltip은 shortcut/detail 보조로 사용.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

---

# UI-05 — Density & Spacing

### UI-05-01 — Density families

**질문:** 하나의 density를 쓸지 Product/Play context-specific density를 쓸지?

**선택지**
- `A` — Product/Character는 comfortable, Play/Command Center는 compact의 두 density family.
- `B` — product-wide 단일 density scale로 최대한 일관성 유지.
- `C` — comfortable/compact 두 density mode를 공통 token으로 만들고 surface가 지정.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### UI-05-02 — Command Center compaction

**질문:** core capability discoverability를 유지하면서 Command Center에서 무엇을 compact할 수 있는가?

**선택지**
- `A` — secondary labels/metadata를 축소하고 icon, capability identity, economy/resource values, unavailable state는 유지.
- `B` — wide/normal에서는 full label, narrow에서는 known actions를 icon+tooltip로 전환.
- `C` — content를 줄이기보다 Hotbar paging/scroll을 사용하고 visible slot 정보 밀도는 유지.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### UI-05-03 — Actor Card / Initiative compactness

**질문:** Actor Card와 Initiative Entry의 compactness 원칙은?

**선택지**
- `A` — identity + required state/target/turn info를 minimum으로 고정하고 secondary details만 축소.
- `B` — full/compact 두 component variant를 명시적으로 사용.
- `C` — card width에 따라 progressive disclosure하되 identity/interaction state는 항상 유지.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### UI-05-04 — Character surface density relationship

**질문:** Library / Builder / Sheet / Level Up의 density 관계는?

**선택지**
- `A` — Library compact, Builder/Level Up comfortable, Sheet medium-dense.
- `B` — Character family 전체에서 동일 comfortable density.
- `C` — Sheet는 dense reference view, Builder/Level Up은 spacious task view, Library는 responsive card density.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### UI-05-05 — Spacing token categories

**질문:** spacing token category는 어떻게 구성할 것인가?

**선택지**
- `A` — `xs / sm / md / lg / xl`의 제한된 global scale.
- `B` — `control-gap / group-gap / section-gap / surface-padding` 같은 semantic spacing tokens.
- `C` — small/medium/large base scale + component semantic aliases.
- `CUSTOM` — 직접 정의. 정확한 px 값은 later design token contract에서 결정.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### UI-05-06 — Contextual pane/dialog density

**질문:** contextual pane/dialog에서 density와 scanability를 어떻게 균형 잡을 것인가?

**선택지**
- `A` — 정보는 compact하게, action group/section 경계는 충분한 spacing으로 분리.
- `B` — Product comfortable density를 그대로 사용해 modal/pane의 읽기 편의 우선.
- `C` — data-heavy DM/session pane만 compact, confirmation/form dialog는 comfortable.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### UI-05-07 — Narrow desktop compaction/reflow

**질문:** narrow desktop에서 무엇을 compress/reflow할 수 있는가?

**선택지**
- `A` — reflow를 먼저 하고 secondary label/metadata만 compact; touch/pointer target 크기는 유지.
- `B` — component compact variant로 먼저 전환하고 필요 시 horizontal scroll/paging.
- `C` — core regions는 유지하고 utilities/secondary columns를 drawer/pane으로 전환.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

---

# CMP-01 — Core Components

### CMP-01-01 — Button family

**질문:** Button family의 variants/states는?

**선택지**
- `A` — Primary / Secondary / Quiet / Destructive / Icon Button + common states.
- `B` — Primary / Secondary / Destructive의 단순 family, icon은 presentation option.
- `C` — A + Split/Menu Button을 명시적 variant로 포함.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### CMP-01-02 — Tabs / Segmented / Toggle contract

**질문:** tabs/segmented/toggle을 어떤 의미로 분리할 것인가?

**선택지**
- `A` — Tabs=peer views/navigation, Segmented=작은 exclusive mode choice, Toggle=즉시 boolean state.
- `B` — Tabs와 Segmented는 동일 component family로 통합하고 semantic role만 다르게 지정.
- `C` — visual family는 공유하되 keyboard/ARIA/commit behavior는 각 semantic role에 맞게 분리.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### CMP-01-03 — Search / filter / no-results contract

**질문:** Search, Filter, No Results의 공통 contract는?

**선택지**
- `A` — search 즉시/명시적 clear, filter chip/panel, active filter summary, no-results에 reset action.
- `B` — submit-based search + filter panel, result count/no-results를 한 영역에서 표시.
- `C` — surface가 instant/submit search를 선택하되 clear/reset/filter-state/no-results grammar는 공통.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### CMP-01-04 — Character Card contract

**질문:** reusable Character Card가 어떤 정보/action을 가져야 하는가?

**선택지**
- `A` — portrait/name/level-class or summary/status + primary Open + secondary overflow actions.
- `B` — A + key HP/core stat/session-link status를 card에 직접 노출.
- `C` — identity/summary만 card에 두고 모든 detail/actions는 open 후 Sheet에서 처리.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### CMP-01-05 — Actor Card contract

**질문:** reusable Actor Card가 어떤 state/interaction contract를 가져야 하는가?

**선택지**
- `A` — identity/portrait + HP/core status + control/turn/targeting states + left primary/right context interaction.
- `B` — identity/HP/status만 기본, economy/detail은 Command Center/tooltip에서만.
- `C` — compact/base/expanded variants를 두되 interaction/targeting semantics는 모두 동일.
- `CUSTOM` — 직접 정의. 기존 Actor interaction/targeting Reviewed 결정을 유지.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### CMP-01-06 — Command Center component boundaries

**질문:** Command Center / Hotbar / Economy / Resource Rail의 component boundary는?

**선택지**
- `A` — Command Center는 layout/orchestration, Hotbar/Economy/Resource Rail/Actor Summary는 독립 reusable child component.
- `B` — Command Center를 하나의 cohesive composite component로 보고 내부 세부는 private subcomponents.
- `C` — A처럼 분리하되 extension/add-on capability region을 explicit slot contract로 제공.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### CMP-01-07 — Initiative Entry contract

**질문:** Initiative Entry에 어떤 정보/state를 포함할 것인가?

**선택지**
- `A` — portrait + order/initiative + current marker + core condition icons + concise identity.
- `B` — portrait + initiative/order + current marker만 ultra-compact, conditions는 hover/detail.
- `C` — compact row with portrait/name/initiative/current/core condition summary.
- `CUSTOM` — 직접 정의. HP/economy는 tracker의 primary 정보가 아님.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### CMP-01-08 — Session/DM utility pane shell

**질문:** Quick Sheet/Rules/Participants 등 utility pane의 공통 shell contract는?

**선택지**
- `A` — shared header/title/context/close + standard padding/scroll/focus-return.
- `B` — shared header/focus semantics만 공통, body layout은 utility별 자유.
- `C` — shared pane shell + optional toolbar/footer slots + role/context badge.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### CMP-01-09 — Status / connection / warning indicators

**질문:** status, connection, warning, persistent indicator의 공통 component contract는?

**선택지**
- `A` — 하나의 Status Indicator family에 semantic severity/state/icon/text 규칙 통합.
- `B` — Connection Status와 Generic Status/Warning의 두 family로 분리.
- `C` — passive status chip과 actionable persistent banner를 별도 family로 분리.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### CMP-01-10 — File input / preview / validation / commit

**질문:** 파일 기반 import/save의 공통 component flow는?

**선택지**
- `A` — Choose file → Preview → Validate → explicit Install/Save/Import commit.
- `B` — Drag&Drop/Choose 통합 input → 자동 Preview/Validate → explicit commit.
- `C` — lightweight file은 choose 후 즉시 parse, issue가 있을 때만 Review; durable mutation 전에는 explicit commit.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### CMP-01-11 — Prevent domain/rules duplication in components

**질문:** reusable UI component가 rules/domain 계산을 중복하지 않도록 어떤 boundary를 둘 것인가?

**선택지**
- `A` — component는 canonical/projected view data + command callbacks만 받아 표시/입력만 수행.
- `B` — typed ViewModel/Presenter layer가 모든 derived display state를 계산하고 component는 순수 rendering.
- `C` — domain adapter/selectors를 UI boundary에 두고 component 자체에서는 named-rule 계산 금지.
- `CUSTOM` — architecture contract에 맞춰 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

---

# CONTENT-01 — UX Writing

### CONTENT-01-01 — Core product terminology

**질문:** Character, Actor, Combatant, Player, DM, Session, Scene, Encounter, Play의 user-facing 용어는?

**선택지**
- `A` — 캐릭터 / 액터 / 전투원 / 플레이어 / DM / 세션 / 장면 / 조우 / 플레이를 고정 용어로 사용.
- `B` — 캐릭터 / 말(Actor) / 전투 참가자 / 플레이어 / DM / 세션 / 장면 / 조우 / 플레이처럼 더 자연어 중심 번역.
- `C` — 한국어 primary + 첫 노출/도움말에서 canonical English term을 병기.
- `CUSTOM` — 용어별 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### CONTENT-01-02 — Primary action verb grammar

**질문:** primary action label의 기본 문법은?

**선택지**
- `A` — 짧은 명령형 동사 중심: 저장, 참가, 시작, 공격, 공개 등.
- `B` — object+verb가 필요한 경우 “세션 시작”, “캐릭터 저장”처럼 명확한 구문 사용.
- `C` — compact Play는 동사, Product/form flow는 object+verb를 사용하는 context-specific grammar.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### CONTENT-01-03 — Error message anatomy

**질문:** error message가 반드시 포함해야 하는 정보는?

**선택지**
- `A` — 무엇이 실패했는지 + 사용자 영향 + 가능한 recovery action.
- `B` — 짧은 실패 이유 + primary recovery action, 기술 detail은 expandable.
- `C` — A + 필요한 경우 source/reference/error code를 secondary detail로 제공.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### CONTENT-01-04 — Empty / no-results message anatomy

**질문:** empty/no-results message가 포함해야 하는 정보는?

**선택지**
- `A` — 현재 상태 설명 + 왜 비었는지 + 가능한 다음 action.
- `B` — 짧은 headline + 한 개의 primary CTA.
- `C` — Empty는 context+CTA, No Results는 query/filter 요약 + clear/reset action으로 분리.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### CONTENT-01-05 — Unavailable reason phrasing

**질문:** unavailable/disabled reason을 어떤 방식으로 표현할 것인가?

**선택지**
- `A` — 현재 막힌 원인 + 가능하면 사용자가 취할 수 있는 다음 행동.
- `B` — canonical reason을 짧고 직접적으로 표시하고 해결 action은 별도 control.
- `C` — compact surface는 짧은 reason, detail/focus/help에서는 full explanation.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### CONTENT-01-06 — Confirmation / cancel / retry / close grammar

**질문:** normal/destructive confirmation, cancel, retry, close를 어떤 문구 규칙으로 구분할 것인가?

**선택지**
- `A` — confirm button은 실제 action 이름 사용, destructive는 object/action 명시, Cancel/Retry/Close는 각각 의미대로 고정.
- `B` — dialog headline에 consequence를 설명하고 action button은 짧은 동사 사용.
- `C` — “예/아니오”는 사용하지 않고 모든 버튼을 실제 결과 동사로 표현.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### CONTENT-01-07 — Public / DM Only / disclosure terms

**질문:** Public, DM Only, later disclosure를 어떤 user-facing 용어로 표현할 것인가?

**선택지**
- `A` — `공개` / `DM 전용` / `전체 판정 공개` / `결과만 공개`.
- `B` — `Public` / `DM Only` English terms를 UI에 유지하고 한국어 설명 보조.
- `C` — `전체 공개` / `DM 비공개` / `전체 공개 전환` / `결과만 공개`.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### CONTENT-01-08 — Roll/result/adjudication vocabulary

**질문:** roll, total, outcome, effect, state change, adjudication, Undo를 어떻게 구분해 부를 것인가?

**선택지**
- `A` — 굴림 / 합계 / 결과 / 효과 / 상태 변경 / 판정 조정 / 되돌리기를 서로 다른 고정 용어로 사용.
- `B` — “굴림 결과”를 중심으로 단순화하고 adjudication/Undo만 별도 DM 용어로 분리.
- `C` — D&D/rules 용어는 English canonical term 병기, product operation은 한국어 용어 사용.
- `CUSTOM` — 용어별 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### CONTENT-01-09 — Connection-state vocabulary

**질문:** connected/reconnecting/disconnected/rejoin/leave 용어는?

**선택지**
- `A` — 연결됨 / 재연결 중 / 연결 끊김 / 다시 참가 / 세션 나가기.
- `B` — 온라인 / 연결 복구 중 / 오프라인 / 다시 연결 / 나가기.
- `C` — 상태는 짧은 label, action은 “다시 참가/연결 재시도/세션 나가기”처럼 별도 동사 사용.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### CONTENT-01-10 — First-use guidance tone

**질문:** 첫사용 가이드의 tone과 범위는?

**선택지**
- `A` — 짧고 task-first: “무엇을 할 수 있는지 + 바로 시작하는 action” 중심.
- `B` — step-by-step guided tutorial 형태.
- `C` — 최소한의 welcome/핵심 entry만 보여주고 자세한 도움은 Help/Rules로 분리.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### CONTENT-01-11 — Korean / English / source / IDs presentation

**질문:** 한국어 label, English original, source/provenance, ID/address를 어떻게 표시할 것인가?

**선택지**
- `A` — 한국어 primary, English original secondary, source tertiary; raw ID/address는 기술적으로 필요할 때만 노출.
- `B` — rules/content names는 bilingual, 일반 UI는 한국어; provenance는 항상 detail metadata.
- `C` — user-facing 기본은 한국어만, English/source/ID는 expandable detail/tooltip에서 제공.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`
