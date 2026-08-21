export type DiceVisualPresetId =
  | "classic-metal"
  | "minimal-blank"
  | "rune-etched"
  | "obsidian-glow"
  | "bone-relic"
  | "arcane-sigil"
  | "crystal-core"
  | "neon-holo";

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
    opacity: number;
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
  "bone-relic",
  "arcane-sigil",
  "crystal-core",
  "neon-holo",
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
      opacity: 1,
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
      opacity: 1,
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
      opacity: 1,
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
      opacity: 1,
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
  "bone-relic": {
    id: "bone-relic",
    label: "뼈 유물",
    description: "상아색 · 오래된 유물",
    body: {
      color: 0xd7cfbf,
      emissive: 0x2f2417,
      emissiveIntensity: 0.08,
      roughness: 0.84,
      metalness: 0.03,
      opacity: 1,
    },
    edge: {
      color: 0x6b5841,
      opacity: 0.62,
    },
    marking: {
      mode: "number",
      fill: "#342617",
      stroke: "rgba(255, 245, 220, .2)",
      fontFamily: "Georgia, serif",
      glowColor: "transparent",
      glowBlur: 0,
    },
  },
  "arcane-sigil": {
    id: "arcane-sigil",
    label: "비전 문양",
    description: "자색 석재 · 마도 룬",
    body: {
      color: 0x261a32,
      emissive: 0x170c22,
      emissiveIntensity: 0.42,
      roughness: 0.44,
      metalness: 0.14,
      opacity: 1,
    },
    edge: {
      color: 0xb387ff,
      opacity: 0.74,
    },
    marking: {
      mode: "rune",
      fill: "#efe2ff",
      stroke: "rgba(19, 8, 31, .96)",
      fontFamily: "'Segoe UI Symbol', 'Noto Sans Symbols', sans-serif",
      glowColor: "rgba(179, 135, 255, .78)",
      glowBlur: 12,
    },
  },
  "crystal-core": {
    id: "crystal-core",
    label: "수정 코어",
    description: "반투명 수정 · 차가운 빛",
    body: {
      color: 0x9fc7ff,
      emissive: 0x2b4d6d,
      emissiveIntensity: 0.32,
      roughness: 0.08,
      metalness: 0.12,
      opacity: 0.58,
    },
    edge: {
      color: 0xe8f3ff,
      opacity: 0.84,
    },
    marking: {
      mode: "number",
      fill: "#f5fbff",
      stroke: "rgba(32, 76, 112, .92)",
      fontFamily: "Georgia, serif",
      glowColor: "rgba(200, 235, 255, .72)",
      glowBlur: 9,
    },
  },
  "neon-holo": {
    id: "neon-holo",
    label: "네온 홀로그램",
    description: "반투명 암면 · 전자광 숫자",
    body: {
      color: 0x0b1020,
      emissive: 0x091425,
      emissiveIntensity: 0.7,
      roughness: 0.12,
      metalness: 0.5,
      opacity: 0.78,
    },
    edge: {
      color: 0xff4fd8,
      opacity: 0.94,
    },
    marking: {
      mode: "number",
      fill: "#7df9ff",
      stroke: "rgba(6, 10, 24, .98)",
      fontFamily: "'Trebuchet MS', 'Segoe UI', sans-serif",
      glowColor: "rgba(125, 249, 255, .95)",
      glowBlur: 18,
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
