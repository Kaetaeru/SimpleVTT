# Owner Review — D&D Experience

Sheets: `DND-01`, `DND-02`, `DND-03`, `DND-04`

Existing Reviewed D&D/Play seeds remain binding. These questions only cover the still-Draft details from `review-plan.md`.

Instructions: choose one candidate code in `OWNER SELECT`, or use `CUSTOM` and describe the desired behavior in `OWNER NOTE`. Candidate options are scaffolding only. `AI STATUS` is AI-managed.

---

# DND-01 — Character Presentation

### DND-01-01 — Character Library Card contents

**질문:** Character Library card에 어떤 정보/action을 직접 노출할 것인가?

**선택지**
- `A` — portrait/name + level/class summary + last/session status + primary Open + secondary menu.
- `B` — A + HP/core stat summary와 quick Roll/Edit/Level Up actions.
- `C` — identity/summary + Open만 card에 두고 모든 action은 Sheet에서 수행.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### DND-01-02 — Builder modes / step structure

**질문:** Guided / Quick / Import / Edit Builder mode와 top-level step structure는?

**선택지**
- `A` — Guided / Quick / Import / Edit를 모두 first-class entry로 두고 마지막 Review/Save 구조는 공유.
- `B` — Guided + Quick을 primary creation mode, Import/Edit은 별도 secondary workflow.
- `C` — Guided를 기본/주요 mode로 두고 Quick은 expert shortcut, Import/Edit은 existing Character flow에서만 진입.
- `CUSTOM` — mode/step structure 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### DND-01-03 — Dependent choices

**질문:** species/class/subclass/feat/spell 등 dependent choice를 UI가 hidden rule logic 없이 어떻게 보여줄 것인가?

**선택지**
- `A` — canonical available options만 projection하고 unavailable option은 이유/요건을 함께 표시.
- `B` — dependency가 생기는 시점에 다음 choice section을 명시적으로 활성화하고 upstream choice 변경 시 affected choices를 review 대상으로 표시.
- `C` — 모든 relevant section을 보이되 canonical eligibility에 따라 enabled/unavailable state와 reason을 투영.
- `CUSTOM` — 직접 정의. UI 자체 rule 계산은 금지.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### DND-01-04 — Unsaved create/edit/import exit

**질문:** create/edit/import 중 unsaved changes가 있을 때 exit behavior는?

**선택지**
- `A` — material dirty state에서 workflow 이탈 시 Save/Discard/Cancel confirmation.
- `B` — recoverable draft/autosave를 유지하고 exit는 허용, 저장 실패/복구 불가일 때만 block.
- `C` — step 내부 이동은 자유, Character workspace를 완전히 떠날 때만 explicit unsaved confirmation.
- `CUSTOM` — INT-03 policy와 함께 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### DND-01-05 — Standalone Sheet hierarchy

**질문:** Standalone Character Sheet의 information/action hierarchy는?

**선택지**
- `A` — identity/HP/core stats + common actions/rolls를 상단/고정, detailed record를 아래/sections에 배치.
- `B` — full character record를 중심으로 하고 roll/actions는 각 relevant stat/feature section에 contextual하게 배치.
- `C` — Summary / Actions / Features / Inventory / Spells 등 major tabs + persistent identity/HP strip.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### DND-01-06 — Sheet layout productization

**질문:** v1에서 Character Sheet layout을 하나로 할지 여러 selectable layout을 둘지?

**선택지**
- `A` — 하나의 canonical SimpleVTT layout만 productize.
- `B` — SimpleVTT + Official-style 두 layout을 user-selectable first-class로 productize.
- `C` — 하나를 canonical v1 layout으로 정하고 다른 layout은 compatibility/migration-only로 유지.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### DND-01-07 — Standalone roll interaction/result

**질문:** Standalone Character Sheet에서 roll을 어떻게 실행하고 결과를 어디에 보여줄 것인가?

**선택지**
- `A` — stat/skill/action control을 직접 클릭 → physical dice → sheet 가까운 compact result panel.
- `B` — sheet control 클릭 → central/global roll area → result strip + Activity-like local history.
- `C` — 각 section inline roll affordance + shared physical dice presentation + persistent recent-results rail.
- `CUSTOM` — 직접 정의. Standalone은 DM/Player role이 없음.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### DND-01-08 — Portrait experience / ownership

**질문:** portrait add/edit/remove/focal-point experience와 data ownership은?

**선택지**
- `A` — upload/replace/remove + focal point/crop control을 제공하고 Character-owned durable presentation data로 저장.
- `B` — upload/replace/remove만 v1 제공, crop/focal은 자동 fit 또는 future scope.
- `C` — portrait는 optional; local Character data에 저장하되 connected session projection은 canonical Character presentation contract가 결정.
- `CUSTOM` — 직접 정의. network projection semantics가 필요하면 contract gap으로 처리.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### DND-01-09 — Level Up stages

**질문:** Level Up의 stage/preview/choice/commit/cancel 구조는?

**선택지**
- `A` — Eligibility/Summary → Choices → Preview → Commit의 명시적 staged flow.
- `B` — choice category별 wizard steps + persistent resulting-character preview + final Review/Commit.
- `C` — one-page choice workspace + sticky before/after preview + explicit Commit/Cancel.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### DND-01-10 — Character import recovery

**질문:** import data에 unsupported/missing/invalid fields가 있으면 어떻게 복구할 것인가?

**선택지**
- `A` — Import Review에서 valid/missing/unsupported를 분류하고 사용자 mapping/fix가 필요한 항목을 표시; blocking issue 해결 전 commit 금지.
- `B` — safely importable fields는 preview하고 나머지는 warning/blocking으로 분리; unsupported rules는 추정하지 않음.
- `C` — strict import: required canonical fields/semantics가 불완전하면 전체 import를 block하고 원인 목록 제공.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### DND-01-11 — Empty / no-Character outside Join

**질문:** 아직 Character가 하나도 없을 때 일반 Product 경험은?

**선택지**
- `A` — Character Library empty state에서 Create Character / Import Character primary CTAs.
- `B` — Home과 Character Library 모두 first-character CTA를 제공.
- `C` — lightweight Getting Started guide + Create/Import 선택을 함께 제공.
- `CUSTOM` — 직접 정의. Session entry를 universal Character prerequisite로 만들면 안 됨.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### DND-01-12 — Character actions during active Session

**질문:** Character가 active Session에 연결돼 있을 때 어떤 standalone Sheet action을 허용할 것인가?

**선택지**
- `A` — read/inspect/allowed local presentation/standalone-safe roll만 허용; durable gameplay-affecting edits는 live session 동안 block 또는 session-authoritative flow로 이동.
- `B` — domain contract가 safe로 선언한 Character edits는 허용하고 즉시 session projection/reconciliation.
- `C` — connected Character의 gameplay-affecting mutation은 모두 Session/authoritative command를 통해서만 허용, standalone Sheet는 projection/editor shell 역할.
- `CUSTOM` — domain/session contract와 함께 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

---

# DND-02 — Roll & Dice UX

### DND-02-01 — Immediate result vs Activity detail

**질문:** immediate result feedback와 Activity detail에 각각 무엇을 보여줄 것인가?

**선택지**
- `A` — immediate: actor/action, dice total/outcome, 핵심 state consequence. Activity: formula/components/modifiers/provenance/full detail.
- `B` — immediate는 total/outcome만 최소 표시, 나머지는 Activity.
- `C` — immediate에 dice breakdown + outcome + 핵심 effect까지 풍부하게, Activity는 durable audit/history.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### DND-02-02 — Standalone vs connected roll presentation

**질문:** Standalone Character roll과 connected shared roll은 어떻게 달라야 하는가?

**선택지**
- `A` — dice/result visual grammar는 최대한 동일, connected만 authority/visibility/shared Activity 요소 추가.
- `B` — standalone은 더 간결한 local result panel, connected는 scene-integrated shared resolution.
- `C` — 동일 physical dice layer를 쓰되 result destination만 standalone Sheet vs connected Play로 다르게 배치.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### DND-02-03 — Reveal sequence

**질문:** roll start부터 outcome/state change까지 reveal sequence는?

**선택지**
- `A` — authoritative resolution ready → physical dice presentation → total/outcome reveal → canonical effects/state-change feedback.
- `B` — dice motion과 compact pending/result shell을 동시에 시작 → settle 시 total/outcome reveal → effects.
- `C` — result summary shell을 먼저 준비하되 값은 dice settle/reveal point에서 표시 → effects/state update.
- `CUSTOM` — 직접 정의. Authoritative result는 presentation 이전에 이미 결정될 수 있다는 Reviewed rule 유지.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### DND-02-04 — 3D dice/VFX fallback

**질문:** 3D dice/VFX가 렌더되지 않을 때 visual fallback은?

**선택지**
- `A` — static/2D dice faces + same result reveal.
- `B` — dice presentation을 skip하고 즉시 canonical result feedback으로 진행.
- `C` — simplified non-physics motion/2D roll animation 사용.
- `CUSTOM` — 직접 정의. Gameplay result는 동일.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### DND-02-05 — Reduced-motion information order

**질문:** reduced motion에서 정보 순서를 어떻게 보존할 것인가?

**선택지**
- `A` — throw/bounce를 제거하고 die appearance → final face → result → effect 순서를 짧은 fade/state transition으로 유지.
- `B` — static dice/result를 즉시 표시하되 result/effect ordering은 동일.
- `C` — physical dice는 최소 settle만 남기고 combat VFX/overlay movement는 static markers로 교체.
- `CUSTOM` — A11Y policy와 함께 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### DND-02-06 — Natural 20 / Natural 1 treatment

**질문:** natural-20/natural-1/ordinary roll을 rules meaning을 잘못 만들지 않으면서 어떻게 표현할 것인가?

**선택지**
- `A` — die face 자체의 natural 20/1을 distinct visual flourish로 표시하되 success/failure 의미는 canonical outcome이 따로 제공할 때만 표시.
- `B` — natural face는 작은 label/icon만 표시하고 결과 styling은 canonical outcome에만 기반.
- `C` — natural roll marker와 outcome marker를 완전히 분리된 두 visual channel로 사용.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### DND-02-07 — Combat VFX vs dice/result sequence

**질문:** combat delivery/impact VFX는 dice/result와 어떤 관계를 가질 것인가?

**선택지**
- `A` — dice/outcome reveal 후 authoritative effect에 맞는 delivery/impact VFX.
- `B` — delivery VFX는 dice와 병행 가능, impact/result emphasis는 authoritative outcome reveal과 동기화.
- `C` — VFX는 optional presentation layer로 결과 뒤에 짧게 재생하고 result comprehension을 지연시키지 않음.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### DND-02-08 — Skip / advance / dismiss controls

**질문:** authoritative result를 바꾸지 않으면서 어떤 presentation skip/advance/dismiss control을 허용할 것인가?

**선택지**
- `A` — local presentation skip 허용; 즉시 authoritative result/result feedback으로 진행.
- `B` — normal mode에서는 자동 sequence, reduced-motion/accessibility preference에서만 skip/shorten.
- `C` — dice/VFX는 local skip 가능, blocking required response/result acknowledgement는 해당 contract에 따라 유지.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### DND-02-09 — Complex dice / save / damage presentation

**질문:** multiple dice, advantage/disadvantage, saves, concentration, damage components, legacy aggregates는 어떻게 보여줄 것인가?

**선택지**
- `A` — authoritative per-die/component metadata를 그룹별로 표시하고 kept/discarded/total/outcome을 명확히 구분.
- `B` — immediate에는 aggregate/kept result 중심, full per-die/components는 expandable detail/Activity.
- `C` — roll type별 standardized result card를 사용하되 physical dice는 실제 canonical dice count/type만 표시.
- `CUSTOM` — 직접 정의. UI가 advantage/damage formula를 자체 계산하지 않음.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

---

# DND-03 — Action UX

### DND-03-01 — Hotbar page contents

**질문:** Mixed / Action / Spell / Item + custom pages의 exact grouping은?

**선택지**
- `A` — Mixed=자주/사용자 배치 capability, Action=non-spell actions, Spell=spells/cantrips, Item=usable items, Custom=user pages.
- `B` — A + Favorites/Recent 개념을 Mixed 안의 자동 section으로 포함.
- `C` — 기본 category pages는 canonical discovery list, Custom pages만 user-curated execution layout으로 명확히 분리.
- `CUSTOM` — 기존 최소 page family를 유지하면서 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### DND-03-02 — Hotbar customization operations

**질문:** 어떤 Hotbar customization을 지원하고 discovery가 무엇을 절대 overwrite하면 안 되는가?

**선택지**
- `A` — assign/remove/reorder/move between slots/pages/create custom page; discovery는 user slot/order를 절대 자동 덮어쓰지 않음.
- `B` — category pages는 read-only discovered capabilities, Custom pages만 자유롭게 assign/reorder.
- `C` — default discovered layout + user pin/favorite/reorder; 새 capability는 unassigned/discovery area에만 추가.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### DND-03-03 — Hotbar Slot information

**질문:** Slot에 직접 보일 정보와 hover/focus/detail에 보낼 정보는?

**선택지**
- `A` — Slot: icon/name-short/cost or economy marker/availability/charges; detail: full description, range/target/source.
- `B` — Slot: icon + cost/resource + unavailable marker만, name/detail은 hover/focus.
- `C` — Slot: icon + short name + resource/count; exact rules detail은 dedicated detail/Rules link.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### DND-03-04 — Unavailable action/resource presentation

**질문:** unavailable actions/resources/cost를 capability를 숨기지 않으면서 어떻게 보여줄 것인가?

**선택지**
- `A` — slot은 그대로 visible, dim/disabled + canonical reason on hover/focus + cost/resource deficit 표시.
- `B` — slot visible + lock/unavailable marker, detail panel에서 full reason.
- `C` — availability state를 slot border/icon/resource token 모두로 중복 표시하고 reason은 focus/tooltip/inline context에 제공.
- `CUSTOM` — 직접 정의. Smart fallback로 다른 action을 실행하지 않음.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### DND-03-05 — Cancel selected capability/targeting

**질문:** selected capability/targeting을 unrelated context를 잃지 않고 어떻게 cancel할 것인가?

**선택지**
- `A` — Escape + persistent Cancel control, cancel하면 이전 Play state로 복귀.
- `B` — Escape / selected Hotbar slot 재클릭 / explicit Cancel 모두 허용.
- `C` — Escape는 top-priority cancel, Command Center에 contextual Cancel만 추가하고 다른 click은 target/selection semantics 유지.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### DND-03-06 — Target-selection feedback

**질문:** Actor Cards에서 target-selection feedback은?

**선택지**
- `A` — valid 강조, invalid dim/disabled, selected target distinct border/check, authoritative reason on invalid focus/hover.
- `B` — A + scene/card 연결 reticle/target marker를 추가.
- `C` — 모든 cards 유지 + valid/invalid/selected를 icon+border+opacity 세 채널로 구분.
- `CUSTOM` — 직접 정의. Eligibility는 UI가 계산하지 않음.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### DND-03-07 — No-target / self-target execution

**질문:** no-target/self-target action은 어떻게 실행할 것인가?

**선택지**
- `A` — valid no-target/self action은 Hotbar click 즉시 authoritative command 실행.
- `B` — self-target은 actor self state를 짧게 강조한 뒤 즉시 실행, no-target은 즉시 실행.
- `C` — high-consequence action만 별도 preview/confirm contract가 있을 수 있고, 일반 no-target/self는 즉시 실행.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### DND-03-08 — Canonical Main Hand relation

**질문:** default hostile click이 사용하는 canonical Main Hand executable action relation을 어떤 contract로 제공할 것인가?

**선택지**
- `A` — Actor/session projection에 explicit `mainHandActionId` 또는 equivalent executable-action reference 제공.
- `B` — equipped Main Hand item이 canonical executable action reference를 제공하고 Actor projection은 그 relation을 노출.
- `C` — domain/application selector가 `defaultMainHandAction` projection을 제공하고 UI는 opaque action ID만 사용.
- `CUSTOM` — architecture/domain contract 방식 직접 정의. UI heuristic derivation은 금지.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### DND-03-09 — Safe interactions during resolution/interrupt

**질문:** resolution/interrupt 중 어떤 interaction이 safe이고 어떤 interaction이 conflicting인가?

**선택지**
- `A` — inspect/navigation/local presentation utilities는 유지, 새로운 gameplay command/targeting 등 conflict action만 lock.
- `B` — read-only Play/Sheet/Rules/Activity는 유지, 모든 새로운 authoritative mutation command는 resolution 완료까지 lock unless interrupt response.
- `C` — authoritative contract가 command별 conflict capability를 제공하고 UI는 그 projection대로 선택적으로 lock.
- `CUSTOM` — 직접 정의. Entire HUD blanket disable은 금지.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### DND-03-10 — Rules/detail access from action UI

**질문:** action UI에서 Rules/detail에 어떻게 접근할 것인가?

**선택지**
- `A` — hover/focus detail + explicit `자세히/Rules` link to contextual Rules pane.
- `B` — Hotbar slot context/detail popover에서 description/source/rules link 제공.
- `C` — persistent Action Inspector/Detail pane을 선택적으로 열어 현재 capability detail을 표시.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

---

# DND-04 — Combat UX

### DND-04-01 — Enter Initiative

**질문:** Initiative에 어떻게 진입하고 UI가 즉시 어떻게 변하는가?

**선택지**
- `A` — DM/authoritative command로 진입 → top Initiative Tracker 추가, Actor Boards/Command Center 유지.
- `B` — canonical runtime이 Initiative mode를 시작하면 UI가 자동 전환; DM control은 그 event를 유발하는 command만 제공.
- `C` — manual DM Start Initiative와 domain-triggered entry를 모두 지원하고 UI transition은 동일.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### DND-04-02 — Turn/control/order distinction

**질문:** current turn, controlled Actor, order, round, off-turn state를 어떻게 구분할 것인가?

**선택지**
- `A` — Initiative Tracker가 order/round/current-turn의 primary source, Actor Card/Command Center가 control/current-turn을 mirror.
- `B` — Actor Cards에서 current-turn/control을 강하게 표시하고 tracker는 order/round 중심.
- `C` — Tracker=current turn/order, Command Center=controlled actor/actionability, Actor Cards=target/relationship의 세 역할로 분리.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### DND-04-03 — End Turn / Next Turn controls

**질문:** Player와 DM에게 End Turn / Next Turn을 어디서 언제 제공할 것인가?

**선택지**
- `A` — Player는 자신이 제어하는 current-turn Actor일 때 Command Center에 End Turn; DM은 current actor에 관계없이 DM controls에서 Next/End Turn authority.
- `B` — Player/DM 모두 Command Center에 turn control을 두되 canonical authority에 따라 enabled/action label이 다름.
- `C` — Player End Turn은 Command Center, DM Next/Turn management는 Initiative Tracker/DM utility에 분리.
- `CUSTOM` — canonical turn authority contract에 맞춰 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### DND-04-04 — Off-turn interactions

**질문:** 자기 turn이 아닐 때 어떤 interaction을 유지할 것인가?

**선택지**
- `A` — inspect/navigation/Rules/Activity/allowed local utilities + canonical reactions/interrupt response; normal turn actions unavailable.
- `B` — canonical service가 legal로 제공한 off-turn capability는 Hotbar에서 그대로 available, 나머지만 unavailable.
- `C` — off-turn에는 일반 capability selection을 최소화하고 reaction/interrupt prompt와 read-only inspection 중심.
- `CUSTOM` — 직접 정의. UI가 turn legality를 계산하지 않음.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### DND-04-05 — Reaction / Interrupt prompt

**질문:** Reaction/Interrupt prompt의 response/timeout/return model은?

**선택지**
- `A` — blocking required-response prompt; Respond/Decline 후 동일 Play context로 복귀. UI 자체 timeout은 없음 unless authoritative contract provides one.
- `B` — authoritative timeout이 제공될 때 visible countdown + default expiration result를 projection, 그렇지 않으면 no-timeout.
- `C` — prompt는 Command Center/scene-integrated layer로 표시하고 unrelated safe inspection은 유지.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### DND-04-06 — Manual movement-reaction input

**질문:** manual movement-reaction input을 v1 first-class로 둘지, 누가 호출할 수 있는가?

**선택지**
- `A` — DM-only advanced adjudication/control tool로 productize.
- `B` — canonical authority가 허용한 DM 또는 controlling Player가 사용할 수 있는 contextual input.
- `C` — v1 product UX에서는 제외하고 현재 구현은 legacy/compatibility candidate로 분류.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### DND-04-07 — Combat transition feedback

**질문:** combat entry/round/turn transition feedback은?

**선택지**
- `A` — Tracker movement/current marker + compact round/turn status, 불필요한 toast 최소화.
- `B` — round/turn 시작 시 scene-integrated short banner + tracker update.
- `C` — tracker/card state를 primary로 하고 transition history는 Activity에 기록.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### DND-04-08 — Combat VFX relationship

**질문:** combat VFX가 Actor positions/cards, result reveal, reduced motion과 어떻게 관계하는가?

**선택지**
- `A` — source Actor/card에서 target Actor/card 방향의 delivery/impact presentation + authoritative result reveal에 맞춤.
- `B` — scene 중심 VFX보다 Actor Card/target marker emphasis를 우선하고 physical dice/result comprehension을 방해하지 않음.
- `C` — VFX는 optional enhancement; reduced-motion에서는 static source-target/impact indicator로 교체.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### DND-04-09 — Exit Initiative

**질문:** Initiative를 어떻게 종료하고 confirmation은 언제 필요한가?

**선택지**
- `A` — DM explicit End Initiative/Combat + 항상 confirmation, 종료 후 Freeform으로 복귀.
- `B` — pending resolution/participants/important state가 있을 때만 confirm, otherwise explicit End action 즉시 수행.
- `C` — canonical runtime event로 자동 종료될 수 있고 DM manual End도 지원; manual high-impact 종료만 confirmation.
- `CUSTOM` — authoritative combat lifecycle contract에 맞춰 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`
