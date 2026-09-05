import type { EngagementRecord } from "../domain/engagement";

export const ENGAGEMENT_RANGED_IN_MELEE_SOURCE="engagement:ranged-in-melee";

declare module "./contracts" {
  interface SceneVm {
    /** T1-03: engagements inferred from resolved melee attacks (the only spatial relation SimpleVTT stores). */
    engagements?:EngagementRecord[];
  }
  interface SceneEntity {
    /** Projected for the boards: ids of the creatures this one is engaged with. */
    engagedWithIds?:string[];
  }
}
