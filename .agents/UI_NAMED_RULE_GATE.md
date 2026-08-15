# UI Named-Rule Structural Gate

Phase 09 Step 6의 목적은 React/TSX를 **presentation + interaction layer**로 유지하고, D&D named-rule 계산의 새 소유권이 UI에 생기지 않도록 구조적으로 차단하는 것이다.

## Source of truth

- Scanner: `scripts/check-ui-rule-boundary.mjs`
- Frozen debt snapshot: `.agents/UI_NAMED_RULE_BASELINE.json`
- Scanner regression: `tests/ui/uiNamedRuleBoundary.test.mjs`
- Production gate: `npm run test:ui-rule-boundary` (also required by `npm run build`)

## Policy

1. Baseline은 **허용 목록이 아니라 기존 부채 스냅샷**이다.
2. 새 UI named-rule 계산 때문에 CI가 실패하면 baseline count를 늘려 통과시키지 않는다.
3. 가능하면 계산을 domain/application service로 옮기고 TSX는 projected fact를 소비한다.
4. baseline count는 부채를 제거할 때 감소할 수 있다.
5. type-only domain imports는 runtime rule ownership이 아니므로 scanner 대상이 아니다.
6. layout math, string formatting, list counts, React state, animation timing은 named-rule 계산으로 취급하지 않는다.

## Migrated in Step 6

### LevelUpV10

UI에서 제거:
- multiclass eligibility calculation
- progression class catalog rule lookup
- fixed HP gain formula
- direct domain choice/progression imports

Application boundary:
- `src/app/levelUpV10Presentation.ts`

### V09Abilities

UI에서 제거:
- ability modifier formula
- point-buy cost/budget calculation
- point-buy increment eligibility
- standard-array rule literal ownership
- 8–15 / 1–30 rule range ownership

Application boundary:
- `src/app/characterCreationAbilityPresentation.ts`

## Frozen debt

현재 baseline에 남은 항목은 다음 legacy/presentation surface에만 있다.

- `src/App.tsx`
  - legacy creation/sheet ability + point-buy calculations
- `src/CharacterSheetV10.tsx`
  - displayed ability/save/spellcasting calculation debt
- `src/CombatSpellHud.tsx`
  - selected slot-level presentation calculation debt

이 항목들은 후속 cleanup에서 application projection으로 이동시키고 baseline count를 줄인다. 새 발생 위치/횟수를 추가하지 않는다.

## Explicitly blocked examples

- React에서 domain value resolver/calculator 직접 import
- ability modifier formula 재구현
- point-buy cost table/budget arithmetic 재구현
- multiclass eligibility 계산
- LevelUp fixed-HP formula 재구현
- concentration DC/check 계산

## Mapless boundary

이 gate는 UI rule ownership만 다룬다. movement/map/grid/token/path/LOS 기능을 추가하거나 Core에 공간 계산을 도입하는 근거가 아니다.
