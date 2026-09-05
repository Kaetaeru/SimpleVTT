/** V1.2 T1-05 — movement without feet: three declarations replace distances. */
export type MovementDeclarationKind="approach"|"withdraw"|"stay";

export interface MovementDeclarationVm {
  kind:MovementDeclarationKind;
  /** 접근 target */
  targetId?:string;
  round:number;
}

export interface WithdrawalOpportunityCandidateVm {
  reactorId:string;
  reactorName:string;
  actionId:string;
  actionName:string;
}

/** A creature declared 물러남 while engaged: the engaged enemies may take an opportunity attack. */
export interface PendingWithdrawalVm {
  actorId:string;
  actorName:string;
  round:number;
  candidates:WithdrawalOpportunityCandidateVm[];
}

declare module "./contracts" {
  interface SceneVm {
    movementDeclarations?:Record<string,MovementDeclarationVm>;
    pendingWithdrawal?:PendingWithdrawalVm;
  }
  interface SceneEntity {
    movementDeclaration?:MovementDeclarationVm;
  }
}
