export interface RuntimeLifeVm {
  deathSaves:{ successes:number; failures:number };
  stable:boolean;
  unconscious:boolean;
  dead:boolean;
}

declare module "./contracts" {
  interface SceneEntity {
    runtimeLife?:RuntimeLifeVm;
  }
}
