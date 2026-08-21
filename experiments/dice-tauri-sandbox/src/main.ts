import "./styles.css";
import { DiceWorld, type DieSides, type PhysicsSettings, type WorldStats } from "./dice-world";

const DIE_TYPES: DieSides[] = [4, 6, 8, 10, 12, 20];

const PRESETS: Record<string, PhysicsSettings> = {
  default: {
    gravity: 20,
    floorFriction: 0.48,
    restitution: 0.22,
    linearDamping: 0.14,
    angularDamping: 0.17,
    throwSpeed: 13.5,
    spinSpeed: 21,
    spawnHeight: 3.15,
  },
  weighty: {
    gravity: 24,
    floorFriction: 0.58,
    restitution: 0.12,
    linearDamping: 0.17,
    angularDamping: 0.22,
    throwSpeed: 12,
    spinSpeed: 17,
    spawnHeight: 2.75,
  },
  bouncy: {
    gravity: 18,
    floorFriction: 0.32,
    restitution: 0.46,
    linearDamping: 0.09,
    angularDamping: 0.11,
    throwSpeed: 13.5,
    spinSpeed: 22,
    spawnHeight: 3.45,
  },
  fast: {
    gravity: 25,
    floorFriction: 0.62,
    restitution: 0.15,
    linearDamping: 0.2,
    angularDamping: 0.24,
    throwSpeed: 16,
    spinSpeed: 25,
    spawnHeight: 2.7,
  },
};

function element<T extends HTMLElement>(id: string) {
  const node = document.getElementById(id);
  if (!node) throw new Error(`필수 UI를 찾을 수 없습니다: ${id}`);
  return node as T;
}

const canvas = element<HTMLCanvasElement>("dice-stage");
const diceTypeButtons = element<HTMLDivElement>("dice-type-buttons");
const countInput = element<HTMLInputElement>("dice-count");
const countValue = element<HTMLElement>("count-value");
const presetSelect = element<HTMLSelectElement>("preset-select");
const collisionInput = element<HTMLInputElement>("dice-collision");
const keepPreviousInput = element<HTMLInputElement>("keep-previous");
const debugBoundsInput = element<HTMLInputElement>("debug-bounds");
const throwButton = element<HTMLButtonElement>("throw-button");
const mixedButton = element<HTMLButtonElement>("mixed-button");
const clearButton = element<HTMLButtonElement>("clear-button");
const statusText = element<HTMLElement>("status-text");
const statsText = element<HTMLElement>("stats-text");
const controlPanel = element<HTMLElement>("control-panel");
const hideControlsButton = element<HTMLButtonElement>("hide-controls");
const showControlsButton = element<HTMLButtonElement>("show-controls");
const rollLabelInput = element<HTMLInputElement>("roll-label");
const modifierInput = element<HTMLInputElement>("roll-modifier");
const authoritativeInput = element<HTMLInputElement>("authoritative-values");
const resultPresentation = element<HTMLElement>("result-presentation");
const resultLabel = element<HTMLElement>("result-label");
const resultNotation = element<HTMLElement>("result-notation");
const resultReel = element<HTMLElement>("result-reel");
const resultFormula = element<HTMLElement>("result-formula");
const resultModifier = element<HTMLElement>("result-modifier");
const resultTotal = element<HTMLElement>("result-total");
const resultNatural = element<HTMLElement>("result-natural");

let selectedSides: DieSides = 20;
let settings: PhysicsSettings = { ...PRESETS.default };
let lastReportedSettle: number | null = null;
let lastPhase: WorldStats["phase"] = "idle";
let reelTimer: number | null = null;

type ResultPresentation = {
  sides: DieSides[];
  values: number[];
  notation: string;
  rawTotal: number;
  modifier: number;
  total: number;
  tone: "normal" | "natural-20" | "natural-1";
};

let pendingResult: ResultPresentation | null = null;

const world = new DiceWorld(canvas, settings);

function renderDiceButtons() {
  diceTypeButtons.replaceChildren();
  for (const sides of DIE_TYPES) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `d${sides}`;
    button.className = sides === selectedSides ? "active" : "";
    button.setAttribute("aria-pressed", sides === selectedSides ? "true" : "false");
    button.addEventListener("click", () => {
      selectedSides = sides;
      renderDiceButtons();
    });
    diceTypeButtons.append(button);
  }
}

function physicsInputs() {
  return Array.from(document.querySelectorAll<HTMLInputElement>("[data-physics]"));
}

function syncPhysicsControls() {
  for (const input of physicsInputs()) {
    const key = input.dataset.physics as keyof PhysicsSettings | undefined;
    if (!key) continue;
    input.value = String(settings[key]);
    const valueLabel = document.querySelector<HTMLElement>(`[data-value-for="${key}"]`);
    if (valueLabel) valueLabel.textContent = Number(settings[key]).toFixed(key === "gravity" || key === "throwSpeed" || key === "spinSpeed" ? 1 : 2);
  }
}

function applyPreset(name: string) {
  const preset = PRESETS[name] ?? PRESETS.default;
  settings = { ...preset };
  world.setSettings(settings);
  syncPhysicsControls();
  statusText.textContent = `${presetSelect.selectedOptions[0]?.textContent ?? "기본"} 프리셋 적용`;
}

function secureDieRoll(sides: DieSides) {
  const sample = new Uint32Array(1);
  const range = 0x1_0000_0000;
  const limit = Math.floor(range / sides) * sides;
  do crypto.getRandomValues(sample); while ((sample[0] ?? 0) >= limit);
  return ((sample[0] ?? 0) % sides) + 1;
}

function authoritativeValuesFor(sides: DieSides[]) {
  const source = authoritativeInput.value.trim();
  if (!source) return sides.map(secureDieRoll);
  const values = source.split(/[\s,]+/).filter(Boolean).map(Number);
  if (values.length !== sides.length) {
    statusText.textContent = `권위 면값은 주사위 ${sides.length}개와 같은 개수여야 합니다.`;
    authoritativeInput.focus();
    return null;
  }
  const invalidIndex = values.findIndex((value, index) => !Number.isInteger(value) || value < 1 || value > (sides[index] ?? 0));
  if (invalidIndex >= 0) {
    statusText.textContent = `${invalidIndex + 1}번째 권위 면값은 d${sides[invalidIndex]} 범위여야 합니다.`;
    authoritativeInput.focus();
    return null;
  }
  return values;
}

function notationFor(sides: DieSides[]) {
  const first = sides[0];
  if (first && sides.every((side) => side === first)) return `${sides.length === 1 ? "" : sides.length}d${first}`;
  return sides.map((side) => `d${side}`).join(" + ");
}

function beginResultPresentation(sides: DieSides[], values: number[]) {
  if (reelTimer !== null) window.clearInterval(reelTimer);
  const modifier = Number.isFinite(Number(modifierInput.value)) ? Number(modifierInput.value) : 0;
  const rawTotal = values.reduce((sum, value) => sum + value, 0);
  const natural = sides.length === 1 && sides[0] === 20 ? values[0] : null;
  pendingResult = {
    sides,
    values,
    notation: notationFor(sides),
    rawTotal,
    modifier,
    total: rawTotal + modifier,
    tone: natural === 20 ? "natural-20" : natural === 1 ? "natural-1" : "normal",
  };

  resultPresentation.hidden = false;
  resultPresentation.dataset.phase = "rolling";
  resultPresentation.dataset.tone = "normal";
  resultLabel.textContent = rollLabelInput.value.trim() || "테스트 판정";
  resultNotation.textContent = pendingResult.notation;
  resultReel.textContent = "—";
  resultFormula.textContent = "권위 결과 대기 중";
  resultModifier.textContent = "물리 연출 수렴 중";
  resultTotal.textContent = "—";
  resultNatural.textContent = "";

  const upper = Math.max(2, sides.reduce((sum, side) => sum + side, 0));
  reelTimer = window.setInterval(() => {
    resultReel.textContent = String(1 + Math.floor(Math.random() * upper));
  }, 42);
}

function resolveResultPresentation() {
  if (!pendingResult || resultPresentation.dataset.phase === "resolved") return;
  if (reelTimer !== null) window.clearInterval(reelTimer);
  reelTimer = null;
  resultPresentation.dataset.phase = "resolved";
  resultPresentation.dataset.tone = pendingResult.tone;
  resultReel.textContent = String(pendingResult.rawTotal);
  resultFormula.textContent = `${pendingResult.notation} · 원시 합 ${pendingResult.rawTotal}`;
  resultModifier.textContent = `${pendingResult.modifier >= 0 ? "+" : "−"} ${Math.abs(pendingResult.modifier)} 수정치`;
  resultTotal.textContent = String(pendingResult.total);
  resultNatural.textContent = pendingResult.tone === "natural-20" ? "NATURAL 20" : pendingResult.tone === "natural-1" ? "NATURAL 1" : "";
}

function hideResultPresentation() {
  if (reelTimer !== null) window.clearInterval(reelTimer);
  reelTimer = null;
  pendingResult = null;
  resultPresentation.hidden = true;
}

function throwSelected() {
  const count = Number(countInput.value);
  const sides = Array.from({ length: count }, () => selectedSides);
  const authoritativeValues = authoritativeValuesFor(sides);
  if (!authoritativeValues) return;
  world.throw({
    sides,
    authoritativeValues,
    keepPrevious: keepPreviousInput.checked,
    diceCollision: collisionInput.checked,
  });
  beginResultPresentation(sides, authoritativeValues);
  lastReportedSettle = null;
  lastPhase = "rolling";
  statusText.textContent = `d${selectedSides} × ${count} · 권위 결과 수신 후 물리 투척`;
}

function throwMixed() {
  const sides = [...DIE_TYPES];
  const authoritativeValues = authoritativeValuesFor(sides);
  if (!authoritativeValues) return;
  world.throw({
    sides,
    authoritativeValues,
    keepPrevious: keepPreviousInput.checked,
    diceCollision: collisionInput.checked,
  });
  beginResultPresentation(sides, authoritativeValues);
  lastReportedSettle = null;
  lastPhase = "rolling";
  statusText.textContent = "6종 혼합 · 권위 결과 수신 후 물리 투척";
}

function clearDice() {
  world.clear();
  lastReportedSettle = null;
  lastPhase = "idle";
  hideResultPresentation();
  statusText.textContent = "테이블 정리됨";
  statsText.textContent = "주사위 0개";
}

function setControlsVisible(visible: boolean) {
  controlPanel.hidden = !visible;
  showControlsButton.hidden = visible;
}

function updateStats(stats: WorldStats) {
  const moving = stats.movingCount > 0 ? ` · 움직임 ${stats.movingCount}` : "";
  if (stats.elapsedMs === null) {
    statsText.textContent = `주사위 ${stats.diceCount}개${moving}`;
    return;
  }

  if (stats.settledMs !== null) {
    statsText.textContent = `주사위 ${stats.diceCount}개 · 수렴 ${(stats.settledMs / 1000).toFixed(2)}초`;
    if (lastReportedSettle !== stats.settledMs) {
      lastReportedSettle = stats.settledMs;
      resolveResultPresentation();
      statusText.textContent = `권위 면 ${stats.authoritativeValues.join(", ")} 수렴 완료 · ${(stats.settledMs / 1000).toFixed(2)}초`;
    }
    return;
  }

  if (stats.phase === "converging" && lastPhase !== "converging") {
    statusText.textContent = "자연 물리 감속 → 권위 면 수렴 중";
  }
  lastPhase = stats.phase;
  const phaseText = stats.phase === "converging" ? " · 수렴 중" : "";
  statsText.textContent = `주사위 ${stats.diceCount}개${moving}${phaseText} · ${(stats.elapsedMs / 1000).toFixed(2)}초`;
}

countInput.addEventListener("input", () => {
  countValue.textContent = countInput.value;
});

presetSelect.addEventListener("change", () => applyPreset(presetSelect.value));

for (const input of physicsInputs()) {
  input.addEventListener("input", () => {
    const key = input.dataset.physics as keyof PhysicsSettings | undefined;
    if (!key) return;
    settings = { ...settings, [key]: Number(input.value) };
    world.setSettings(settings);
    const valueLabel = document.querySelector<HTMLElement>(`[data-value-for="${key}"]`);
    if (valueLabel) valueLabel.textContent = Number(settings[key]).toFixed(key === "gravity" || key === "throwSpeed" || key === "spinSpeed" ? 1 : 2);
    presetSelect.value = "";
    statusText.textContent = "사용자 물리값 적용";
  });
}

collisionInput.addEventListener("change", () => {
  world.setDiceCollision(collisionInput.checked);
  statusText.textContent = collisionInput.checked ? "주사위끼리 자연 충돌 켜짐" : "비교용: 주사위끼리 충돌 꺼짐";
});

debugBoundsInput.addEventListener("change", () => {
  world.setDebugBounds(debugBoundsInput.checked);
  statusText.textContent = debugBoundsInput.checked ? "보이지 않는 화면 경계를 디버그 표시 중" : "경계 표시 숨김";
});

throwButton.addEventListener("click", throwSelected);
mixedButton.addEventListener("click", throwMixed);
clearButton.addEventListener("click", clearDice);
hideControlsButton.addEventListener("click", () => setControlsVisible(false));
showControlsButton.addEventListener("click", () => setControlsVisible(true));

window.addEventListener("keydown", (event) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
  if (event.code === "Space") {
    event.preventDefault();
    throwSelected();
  } else if (event.key.toLowerCase() === "m") {
    throwMixed();
  } else if (event.key.toLowerCase() === "r") {
    clearDice();
  } else if (event.key.toLowerCase() === "h") {
    setControlsVisible(controlPanel.hidden !== false);
  }
});

world.onStats(updateStats);
renderDiceButtons();
syncPhysicsControls();
world.setDebugBounds(false);

window.addEventListener("beforeunload", () => {
  hideResultPresentation();
  world.destroy();
});
