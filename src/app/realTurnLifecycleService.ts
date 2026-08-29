import { SIMPLEVTT_APP_RULES_PROFILE } from "./realResolutionService";
import type { TurnRuntimeSession } from "./realTurnRuntimeService";
import { resolvePendingResolution } from "../domain/resolution";
import type { ResolutionEvent } from "../domain/resolutionTypes";
import type { ResolutionOperation } from "../domain/resolutionTypes";

export type TurnRuntimeLifecycleOperationCompiler=(input:{
  state:TurnRuntimeSession["state"];
  resolutionId:string;
  kind:"turn-start"|"turn-end";
  actorId:string;
  round:number;
})=>ResolutionOperation[];

export type TurnRuntimeLifecycleAdvanceResult =
  | {
      status:"committed";
      activeActorId:string;
      round:number;
      resolutionId:string;
      additionalOperationCount:number;
      events:ResolutionEvent[];
    }
  | {
      status:"rejected";
      error:string;
    };

export function advanceTurnRuntimeLifecycle(session:TurnRuntimeSession,compileAdditional?:TurnRuntimeLifecycleOperationCompiler):TurnRuntimeLifecycleAdvanceResult {
  if (!session.initiativeOrder.length) return { status:"rejected",error:"turn runtime has no initiative actors" };
  const currentActorId=session.state.clock.activeActorId ?? session.initiativeOrder[session.activeIndex];
  const currentIndex=session.initiativeOrder.indexOf(currentActorId);
  if (currentIndex<0) return { status:"rejected",error:`active actor is not in initiative order: ${currentActorId}` };
  const nextIndex=(currentIndex+1)%session.initiativeOrder.length;
  const nextActorId=session.initiativeOrder[nextIndex];
  const nextRound=session.state.clock.round+(nextIndex===0 ? 1 : 0);
  const expectedRevision=session.state.revision;
  const resolutionId=`turn-runtime:${expectedRevision}:${currentActorId}->${nextActorId}`;
  const endState=structuredClone(session.state);
  endState.clock={...endState.clock,round:session.state.clock.round,activeActorId:currentActorId,phase:"end"};
  const beginState=structuredClone(session.state);
  beginState.clock={...beginState.clock,round:nextRound,activeActorId:nextActorId,phase:"start"};
  const afterEnd=compileAdditional?.({state:endState,resolutionId,kind:"turn-end",actorId:currentActorId,round:session.state.clock.round})??[];
  const afterBegin=compileAdditional?.({state:beginState,resolutionId,kind:"turn-start",actorId:nextActorId,round:nextRound})??[];
  const resolved=resolvePendingResolution(SIMPLEVTT_APP_RULES_PROFILE,session.state,{
    id:resolutionId,
    actorId:currentActorId,
    sourceId:"app:turn-runtime:lifecycle",
    expectedRevision,
    operations:[
      {
        id:`${resolutionId}:end`,
        kind:"end-turn",
        actorId:currentActorId,
        round:session.state.clock.round,
      },
      ...afterEnd,
      {
        id:`${resolutionId}:begin`,
        kind:"begin-turn",
        actorId:nextActorId,
        round:nextRound,
      },
      ...afterBegin,
    ],
  });
  if (resolved.status==="rejected") return { status:"rejected",error:resolved.error };
  session.state=resolved.state;
  session.activeIndex=nextIndex;
  return {
    status:"committed",
    activeActorId:nextActorId,
    round:nextRound,
    resolutionId,
    additionalOperationCount:afterEnd.length+afterBegin.length,
    events:resolved.events.map((event)=>structuredClone(event)),
  };
}
