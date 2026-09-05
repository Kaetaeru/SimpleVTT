/** V1.2 T1-04 — encounter groups: identical monsters added together act as one unit on the DM's board. */
export interface SceneGroupVm {
  id:string;
  label:string;
  definitionId?:string;
  memberIds:string[];
  /** Shared initiative total: members roll once and act together. */
  initiative:number;
}

declare module "./contracts" {
  interface SceneVm {
    groups?:Record<string,SceneGroupVm>;
  }
  interface SceneEntity {
    groupId?:string;
  }
}
