export type DiceVisualPresetId =
  | "classic-metal"
  | "minimal-blank"
  | "rune-etched"
  | "obsidian-glow";

export type DiceFaceMarkingMode = "number" | "none" | "rune";

export type DiceVisualPreset = {
  id: DiceVisualPresetId;
  label: string;
  description: string;
  body: {
    color: number;
    emissive: number;
    emissiveIntensity: number;
    roughness: number;
    metalness: number;
  };
  edge: {
    color: number;
    opacity: number;
  };
  marking: {
    mode: DiceFaceMarkingMode;
    fill: string;
    stroke: string;
    fontFamily: string;
    glowColor: string;
    glowBlur: number;
  };
};

export const DICE_VISUAL_PRESET_ORDER: DiceVisualPresetId[] = [
  "classic-metal",
  "minimal-blank",
  "rune-etched",
  "obsidian-glow",
];

export const DICE_VISUAL_PRESETS: Record<DiceVisualPresetId, DiceVisualPreset> = {
  "classic-metal": {
    id: "classic-metal",
    label: "클래식 금속",
    description: "청동 · 숫자 각인",
    body: {
      color: 0xb87333,
      emissive: 0x3c1e0d,
      emissiveIntensity: 0.16,
      roughness: 0.3,
      metalness: 0.33,
    },
    edge: {
      color: 0x3a1f10,
      opacity: 0.72,
    },
    marking: {
      mode: "number",
      fill: "#f8e2bc",
      stroke: "rgba(29, 13, 4, .86)",
      fontFamily: "Georgia, serif",
      glowColor: "transparent",
      glowBlur: 0,
    },
  },
  "minimal-blank": {
    id: "minimal-blank",
    label: "미니멀 무표식",
    description: "숫자 없음 · 무광 솔리드",
    body: {
      color: 0xd6d3ca,
      emissive: 0x17191b,
      emissiveIntensity: 0.04,
      roughness: 0.72,
      metalness: 0.04,
    },
    edge: {
      color: 0x585d61,
      opacity: 0.28,
    },
    marking: {
      mode: "none",
      fill: "#ffffff",
      stroke: "transparent",
      fontFamily: "sans-serif",
      glowColor: "transparent",
      glowBlur: 0,
    },
  },
  "rune-etched": {
    id: "rune-etched",
    label: "룬 각인",
    description: "암녹석 · 룬 문자",
    body: {
      color: 0x263a33,
      emissive: 0x10241d,
      emissiveIntensity: 0.3,
      roughness: 0.62,
      metalness: 0.08,
    },
    edge: {
      color: 0x71967d,
      opacity: 0.58,
    },
    marking: {
      mode: "rune",
      fill: "#d8f3d2",
      stroke: "rgba(3, 15, 10, .96)",
      fontFamily: "'Segoe UI Symbol', 'Noto Sans Symbols', sans-serif",
      glowColor: "rgba(135, 236, 178, .65)",
      glowBlur: 7,
    },
  },
  "obsidian-glow": {
    id: "obsidian-glow",
    label: "흑요석 발광",
    description: "검은 유리 · 청록 숫자",
    body: {
      color: 0x05080b,
      emissive: 0x082a35,
      emissiveIntensity: 0.72,
      roughness: 0.18,
      metalness: 0.58,
    },
    edge: {
      color: 0x41d7ef,
      opacity: 0.9,
    },
    marking: {
      mode: "number",
      fill: "#a9f7ff",
      stroke: "rgba(0, 15, 20, .98)",
      fontFamily: "Georgia, serif",
      glowColor: "rgba(63, 222, 255, .95)",
      glowBlur: 16,
    },
  },
};

const RUNES = [
  "ᚠ", "ᚢ", "ᚦ", "ᚨ", "ᚱ", "ᚲ", "ᚷ", "ᚹ", "ᚺ", "ᚾ",
  "ᛁ", "ᛃ", "ᛇ", "ᛈ", "ᛉ", "ᛋ", "ᛏ", "ᛒ", "ᛖ", "ᛗ",
] as const;

export function getDiceVisualPreset(id: DiceVisualPresetId) {
  return DICE_VISUAL_PRESETS[id];
}

export function diceFaceLabel(preset: DiceVisualPreset, value: number) {
  if (preset.marking.mode === "none") return "";
  if (preset.marking.mode === "rune") return RUNES[(value - 1) % RUNES.length] ?? String(value);
  return String(value);
}
