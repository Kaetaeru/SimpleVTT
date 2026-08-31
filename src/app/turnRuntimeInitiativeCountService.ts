import { resolvePendingResolution } from "../domain/resolution";
import type { ResolutionEvent } from "../domain/resolutionTypes";
import { SIMPLEVTT_APP_RULES_PROFILE } from "./realResolutionService";
import type { TurnRuntimeSession } from "./realTurnRuntimeService";

export type TurnRuntimeInitiativeCountResult =
  | {
      status:"committed";
      initiativeCount:number;
      resolutionId:string;
      events:ResolutionEvent[];
    }
  | {status:"rejected";error:string};

export function setTurnRuntimeInitiativeCount(
  session:TurnRuntimeSession,
  count:number,
):TurnRuntimeInitiativeCountResult {
  if(!Number.isInteger(count)||count<0) return {status:"rejected",error:"initiative count must be a non-negative integer"};
  const actorId=session.state.clock.activeActorId??session.initiativeOrder[session.activeIndex]??"session";
  const expectedRevision=session.state.revision;
  const resolutionId=`turn-runtime:${expectedRevision}:initiative-count:${count}`;
  const committed=resolvePendingResolution(SIMPLEVTT_APP_RULES_PROFILE,session.state,{
    id:resolutionId,
    actorId,
    sourceId:"app:turn-runtime:initiative-count",
    expectedRevision,
    operations:[{
      id:`${resolutionId}:set`,
      kind:"set-initiative-count",
      count,
    }],
  });
  if(committed.status==="rejected") return {status:"rejected",error:committed.error};
  session.state=committed.state;
  return {
    status:"committed",
    initiativeCount:count,
    resolutionId,
    events:committed.events.map((event)=>structuredClone(event)),
  };
}
