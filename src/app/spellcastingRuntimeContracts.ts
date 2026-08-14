export type CombatSpellRuntimeSupport = "combat-executable" | "partial" | "legacy-item";

export interface SpellActionRuntimeVm {
  spellId: string;
  runtimeSupport: CombatSpellRuntimeSupport;
  baseLevel: number;
  castSource: "prepared" | "always-prepared" | "item" | "feature";
  disabledMechanicReason?: string;
}

export interface SpellSlotHudVm {
  level: number;
  current: number;
  max: number;
}

export interface SpellcastingHudVm {
  spellAttackModifier: number;
  spellSaveDc: number;
  spellcastingAbilityModifier: number;
  cantripSpellIds: string[];
  preparedSpellIds: string[];
  alwaysPreparedSpellIds: string[];
  slots: SpellSlotHudVm[];
  slottedSpellCastThisTurn: boolean;
}

declare module "./contracts" {
  interface ActionVm {
    spellCast?: SpellActionRuntimeVm;
  }

  interface SceneVm {
    spellcastingByActor?: Record<string, SpellcastingHudVm>;
  }
}

export {};
