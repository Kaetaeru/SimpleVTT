import { SIMPLEVTT_APP_RULES_PROFILE } from "./realResolutionService";
import type { TurnRuntimeSession } from "./realTurnRuntimeService";
import { resolvePendingResolution } from "../domain/resolution";
import type { ResolutionEvent } from "../domain/resolutionTypes";

export type TurnRuntimeLifecycleAdvanceResult =
  | {
      status:"committed";
      activeActorId:string;
      round:number;
      events:ResolutionEvent[];
    }
  | {
      status:"rejected";
      error:string;
    };

export function advanceTurnRuntimeLifecycle(session:TurnRuntimeSession):TurnRuntimeLifecycleAdvanceResult {
  if (!session.initiativeOrder.length) return { status:"rejected",error:"turn runtime has no initiative actors" };
  const currentActorId=session.state.clock.activeActorId ?? session.initiativeOrder[session.activeIndex];
  const currentIndex=session.initiativeOrder.indexOf(currentActorId);
  if (currentIndex<0) return { status:"rejected",error:`active actor is not in initiative order: ${currentActorId}` };
  const nextIndex=(currentIndex+1)%session.initiativeOrder.length;
  const nextActorId=session.initiativeOrder[nextIndex];
  const nextRound=session.state.clock.round+(nextIndex===0 ? 1 : 0);
  const expectedRevision=session.state.revision;
  const resolutionId=`turn-runtime:${expectedRevision}:${currentActorId}->${nextActorId}`;
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
      {
        id:`${resolutionId}:begin`,
        kind:"begin-turn",
        actorId:nextActorId,
        round:nextRound,
      },
    ],
  });
  if (resolved.status==="rejected") return { status:"rejected",error:resolved.error };
  session.state=resolved.state;
  session.activeIndex=nextIndex;
  return {
    status:"committed",
    activeActorId:nextActorId,
    round:nextRound,
    events:resolved.events.map((event)=>structuredClone(event)),
  };
}
