import "./progression";

declare module "./progression" {
  interface ProgressionCharacterState {
    weaponMasteryIds?: string[];
    weaponMasterySources?: Record<string, string>;
    fightingStyleFeatIds?: string[];
    fightingStyleFeatSources?: Record<string, string>;
  }
}
