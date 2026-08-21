# SimpleVTT Owner Control Policy

Status: canonical process policy for deciding **what the owner must choose** versus **what AI may safely design**.

The purpose of this policy is to keep product control with the owner **without turning UI/UX planning into hundreds of manual questions**.

## 1. Three kinds of unresolved work

### A. Owner Checkpoint — ask the owner

Ask only when the answer materially changes one of these:

- the user's mental model or major workflow;
- whether a meaningful product capability exists in v1;
- what is permanently visible vs hidden/secondary in a way users will strongly feel;
- DM vs Player authority, privacy, or disclosure behavior;
- destructive/data-loss/irreversible behavior;
- product/platform scope with material implementation consequences;
- two viable choices that would make SimpleVTT feel meaningfully different to use.

Owner Checkpoints are intentionally few. They may be grouped in a lightweight worksheet with AI recommendations.

### B. AI Design Default — do not burden the owner

AI may resolve lower-risk design details when the answer can be derived safely from Reviewed decisions, accepted existing UI, standard UX/accessibility practice, and the design system.

Examples:

- typography hierarchy and exact token values;
- spacing/density tokens;
- button variants and ordinary hover/focus/pressed states;
- icon family and ordinary accessible labels;
- routine empty/loading/error presentation;
- ordinary responsive reflow/compaction;
- component boundaries that do not change product behavior;
- exact placement/spacing inside an already-approved region model;
- ordinary keyboard/focus behavior unless the owner explicitly selected an exception;
- low-risk confirmation wording and feedback copy;
- animation timing/polish that does not affect authority, comprehension order, or accessibility.

These details belong in the prototype/design system and later Surface/Component/Motion contracts, not in the owner Decision Ledger unless the owner explicitly changes them into a product decision.

### C. Domain / Architecture Contract — never ask the owner to guess technical truth

Do not turn missing authoritative mechanics into UI preference questions.

Examples:

- attack legality or canonical Main Hand relation;
- target eligibility;
- command conflict/safe-interaction semantics;
- network privacy/data delivery;
- reconnect/event projection;
- persistence/schema/security guarantees;
- compatibility calculation.

These become Domain/Architecture gaps/contracts.

## 2. Escalation rule

AI should escalate an AI Design Default into an Owner Checkpoint only when at least one is true:

1. the alternatives create clearly different user workflows or mental models;
2. a capability would be added/removed/hidden in a material way;
3. the choice changes DM/Player authority, privacy, disclosure, or data-loss behavior;
4. the choice contradicts an existing Reviewed/Frozen Decision;
5. the owner previously expressed a specific preference that cannot be reconciled safely;
6. a choice has large scope/cost consequences the owner should knowingly accept.

Do **not** escalate merely because multiple acceptable visual/technical solutions exist.

## 3. Recommendation bundle

A lightweight owner worksheet may include:

```text
전체 추천안 사용: YES
```

When the owner explicitly writes `YES`, each unanswered Owner Checkpoint in that worksheet takes its stated `AI 추천` as explicit owner input. Any question with an explicit `OWNER SELECT` overrides the bundle recommendation.

A recommendation is not product truth until the owner explicitly accepts the bundle or selects that option.

## 4. Technical Decision Maps remain coverage, not homework

`review-plan.md` may keep complete detailed Decision Maps so AI can verify coverage.

That does **not** mean the owner must answer every row.

A detailed map row may be resolved by:

- an existing canonical Decision Card;
- an Owner Checkpoint;
- an AI Design Default recorded in the prototype/design system/appropriate contract;
- a Domain/Architecture contract;
- `N/A` when its declared condition is false.

If a detailed row can be handled safely by AI Design Default, do not surface it as a separate owner question.

## 5. Owner override is always easy

The owner may change any AI-managed detail in plain language at any time.

AI then:

1. identifies the affected contract/default/prototype catalog/Decision;
2. checks for conflicts and authority boundaries;
3. updates the smallest canonical source;
4. refreshes derived documentation and prototype when applicable;
5. asks follow-up only if a material ambiguity remains.

The owner never needs to repair cross-references manually.

## 6. No-invention boundary remains strict

This lighter workflow does **not** permit AI to invent:

- D&D/rules semantics;
- network/privacy behavior;
- authoritative game state;
- unsupported mechanics;
- material product capability scope;
- destructive behavior;
- a preference that contradicts explicit owner input.

Ease of owner control is achieved by delegating safe design detail, not by weakening authority or correctness.

## 7. Current owner workload

The large foundation worksheet and the lightweight 10-item checkpoint have been completed and reconciled into `decisions.md`.

Current mandatory owner question count:

```text
0
```

The next owner role is **visual/interaction review of the standalone UI Reference Prototype**, not answering hundreds of detailed Decision Map rows.

Prototype specification lives under:

```text
docs/design/ui-ux/prototype/
```

The prototype HTML is not built yet.

## 8. Prototype review should stay easy

When the Reference Prototype is built, the owner should give natural-language product feedback such as:

- "이 패널이 너무 넓어."
- "이 버튼은 항상 보였으면 좋겠어."
- "DM 도구는 오른쪽에서 열자."
- "이 상태는 NOTICE에 계속 보여줘."
- "좁은 화면에서 Actor 카드가 너무 작아."

AI must not respond by making the owner edit token tables, z-index matrices, component schemas, or every individual state.

Classify feedback:

- low-risk visual/layout detail -> update AI Design Default/prototype directly;
- material workflow/capability/authority change -> Owner Checkpoint / Decision;
- technical truth -> Domain/Architecture contract.

This keeps the prototype iterative without recreating the original questionnaire burden.

## 9. Prototype acceptance is a meaningful owner action

The owner should explicitly accept the overall Reference Prototype before broad runtime UI preparation begins.

Prototype acceptance means:

- the owner has seen the whole UI system in an interactive example;
- the main layout/interaction direction is acceptable enough to extract implementation contracts.

Prototype acceptance does **not** mean:

- all Product Decisions are Frozen;
- technical gaps are solved;
- runtime implementation is automatically authorized.

That separation is intentional.