import type { AppSnapshot, DamageComponentView, ResolutionView, SceneEntity } from "./contracts";
import { MockAdapter } from "./mockAdapter";

type BeforeSnapshot = {
  scene: { entities: SceneEntity[] };
  activeCharacter: AppSnapshot["activeCharacter"];
};

type CompletionState = {
  resolution: ResolutionView | null;
  scene: AppSnapshot["scene"];
  lastBefore: BeforeSnapshot | null;
  lastResolutionId: string | null;
  _undoPreviewArmed?: boolean;
  getSnapshot(): Promise<AppSnapshot>;
};

const originalScenario = MockAdapter.prototype.loadReferenceScenario;
const originalUndo = MockAdapter.prototype.undoLastResolution;
const originalDismiss = MockAdapter.prototype.dismissResolution;

function typedDefenseComponent(type: string, raw: number, adjusted: number, adjustment: string): DamageComponentView {
  return {
    type,
    roll: `Reference ${raw}`,
    raw,
    adjusted,
    adjustment,
    source: "Typed Defense → Temp HP → HP",
  };
}

MockAdapter.prototype.loadReferenceScenario = async function loadReferenceScenario(id) {
  await originalScenario.call(this, id);
  if (id !== "typed-damage") return this.getSnapshot();

  const state = this as unknown as CompletionState;
  const guardian = state.scene.entities.find((entity) => entity.id === "combatant.training-guardian");
  if (!guardian) return this.getSnapshot();

  guardian.tempHp = 0;
  guardian.hp = 18;
  const components = [
    typedDefenseComponent("천둥", 9, 4, "천둥 저항 9 → 4"),
    typedDefenseComponent("독", 7, 0, "독 면역 7 → 0"),
    typedDefenseComponent("냉기", 6, 12, "냉기 취약 6 → 12"),
  ];

  state.resolution = {
    id: "resolution.reference.typed-defense",
    actorId: "char.mira",
    targetIds: [guardian.id],
    actionId: "reference.typed-defense",
    actionName: "Typed Defense Reference",
    rollKind: "damage",
    stage: "complete",
    authoritativeDice: [9, 7, 6],
    saveResults: [],
    damageComponents: components,
    compact: "저항 4 · 면역 0 · 취약 12 · 임시 HP 4 → 0 · HP 30 → 18",
    detail: [
      "천둥 9 → 저항으로 4 → 임시 HP 4가 전부 흡수",
      "독 7 → 면역으로 0",
      "냉기 6 → 취약으로 12 → HP 30 → 18",
    ],
    provenance: [
      "훈련용 수호체 · Reference Mock",
      "damage.type defense registry",
      "적용 순서: Resistance/Immunity/Vulnerability → Temp HP → HP",
    ],
    calculatedOutcome: "최종 실피해 16",
    finalOutcome: "최종 실피해 16",
    stateChanges: ["임시 HP 4 → 0", "HP 30 → 18"],
    adjudicated: false,
    canAdvance: false,
  };

  return this.getSnapshot();
};

function undoPreviewLines(state: CompletionState): string[] {
  const before = state.lastBefore;
  if (!before) return [];
  const lines: string[] = [];

  for (const oldEntity of before.scene.entities) {
    const current = state.scene.entities.find((entity) => entity.id === oldEntity.id);
    if (!current) continue;
    if (current.hp !== oldEntity.hp) lines.push(`${current.name} HP ${current.hp} → ${oldEntity.hp}`);
    if (current.tempHp !== oldEntity.tempHp) lines.push(`${current.name} 임시 HP ${current.tempHp} → ${oldEntity.tempHp}`);
    if (current.status.join("|") !== oldEntity.status.join("|")) lines.push(`${current.name} 상태 [${current.status.join(", ") || "없음"}] → [${oldEntity.status.join(", ") || "없음"}]`);
  }

  const currentCharacter = state.scene.entities.find((entity) => entity.id === before.activeCharacter.id);
  if (currentCharacter && currentCharacter.ac !== before.activeCharacter.ac) {
    lines.push(`${before.activeCharacter.name} AC ${currentCharacter.ac} → ${before.activeCharacter.ac}`);
  }

  return lines.length ? lines : ["HP / 임시 HP / 자원 / 아이템 / 행동경제를 Resolution 직전 snapshot으로 복원합니다."];
}

MockAdapter.prototype.undoLastResolution = async function undoLastResolution() {
  const state = this as unknown as CompletionState;
  if (!state.lastBefore || !state.lastResolutionId) return originalUndo.call(this);

  if (!state._undoPreviewArmed) {
    const lines = undoPreviewLines(state);
    state._undoPreviewArmed = true;
    state.resolution = {
      id: `undo-preview.${state.lastResolutionId}`,
      actorId: "system",
      targetIds: [],
      actionId: "system.undo-preview",
      actionName: "되돌리기 Preview",
      rollKind: "effect",
      stage: "complete",
      authoritativeDice: [],
      saveResults: [],
      damageComponents: [],
      compact: "아직 아무 상태도 변경하지 않았습니다. 아래 복원 내용을 확인하세요.",
      detail: ["다시 '안전하게 되돌리기'를 누르면 복원을 확정합니다.", ...lines],
      provenance: ["captured pre-resolution snapshot", `undoOf: ${state.lastResolutionId}`],
      calculatedOutcome: "현재 상태 유지",
      finalOutcome: "복원 Preview",
      stateChanges: lines,
      adjudicated: false,
      canAdvance: false,
    };
    return state.getSnapshot();
  }

  state._undoPreviewArmed = false;
  return originalUndo.call(this);
};

MockAdapter.prototype.dismissResolution = async function dismissResolution() {
  const state = this as unknown as CompletionState;
  if (state.resolution?.id.startsWith("undo-preview.")) state._undoPreviewArmed = false;
  return originalDismiss.call(this);
};
