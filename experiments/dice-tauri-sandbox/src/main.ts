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

let selectedSides: DieSides = 20;
let settings: PhysicsSettings = { ...PRESETS.default };
let lastReportedSettle: number | null = null;

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

function throwSelected() {
  const count = Number(countInput.value);
  world.throw({
    sides: Array.from({ length: count }, () => selectedSides),
    keepPrevious: keepPreviousInput.checked,
    diceCollision: collisionInput.checked,
  });
  lastReportedSettle = null;
  statusText.textContent = `d${selectedSides} × ${count} 투척`;
}

function throwMixed() {
  world.throw({
    sides: [...DIE_TYPES],
    keepPrevious: keepPreviousInput.checked,
    diceCollision: collisionInput.checked,
  });
  lastReportedSettle = null;
  statusText.textContent = "d4 · d6 · d8 · d10 · d12 · d20 혼합 투척";
}

function clearDice() {
  world.clear();
  lastReportedSettle = null;
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
    statsText.textContent = `주사위 ${stats.diceCount}개 · 정지 ${(stats.settledMs / 1000).toFixed(2)}초`;
    if (lastReportedSettle !== stats.settledMs) {
      lastReportedSettle = stats.settledMs;
      statusText.textContent = `자연 정지 ${(stats.settledMs / 1000).toFixed(2)}초 · 결과 강제 보정 없음`;
    }
    return;
  }

  statsText.textContent = `주사위 ${stats.diceCount}개${moving} · ${(stats.elapsedMs / 1000).toFixed(2)}초`;
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
    setControlsVisible(controlPanel.hidden);
  }
});

world.onStats(updateStats);
renderDiceButtons();
syncPhysicsControls();
world.setDebugBounds(false);

window.addEventListener("beforeunload", () => world.destroy());
