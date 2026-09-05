/**
 * V1.2 T1-07 — scene conditions and creature badges. Badges are public statuses with fixed labels so the boards,
 * the tooltip, and DM condition adjudication already show and edit them; the rules read them by label.
 */
export const SCENE_CONDITION_LABELS={ darkness:"어둠", fog:"안개" } as const;
export type SceneConditionKind=keyof typeof SCENE_CONDITION_LABELS;

export const CREATURE_BADGE_LABELS={ hidden:"숨음", invisible:"투명", "cover-half":"엄폐 ½", "cover-three-quarters":"엄폐 ¾" } as const;
export type CreatureBadgeKind=keyof typeof CREATURE_BADGE_LABELS;

/** Common conditions the DM toggles as narrative chips (labels match the turn runtime's condition labels). */
export const NARRATIVE_CONDITION_LABELS=["넘어짐","붙잡힘","중독됨","공포","실명","매혹됨","기절","무의식","포박","마비"] as const;

declare module "./contracts" {
  interface SceneVm {
    /** 어둠 / 안개 — scene-wide, narrative; both sides unseen cancel out, so no roll changes by themselves. */
    sceneConditions?:SceneConditionKind[];
  }
}
