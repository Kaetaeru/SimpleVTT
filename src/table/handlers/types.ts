import type { RulesProfileLike } from "../../domain/profileEngine";
import type { PendingResolution, ResolutionCommit, ResolutionOperation } from "../../domain/resolutionTypes";
import type { RulesRuntimeState } from "../../domain/combatState";
import { resolvePendingResolution } from "../../domain/resolution";
import type { CommandOrigin } from "../commands";
import type { Dice } from "../dice";
import type { TableEventPayload } from "../events";
import { kernelErrorKo, refused, type Refused } from "../refusal";
import type { LogEntry, ResolutionRecord, TableState, Visibility } from "../state";

export interface HandlerContext {
  state:TableState;
  dice:Dice;
  profile:RulesProfileLike;
  /** The sequence the first event of this command will receive. */
  nextSeq:number;
  now:()=>string;
  origin:CommandOrigin;
}

export interface EventDraft {
  payload:TableEventPayload;
  log:LogEntry[];
}

export type HandlerResult=
  |{status:"committed";events:EventDraft[];resolution?:ResolutionRecord|null}
  |Refused;

export function logEntry(ctx:HandlerContext,input:Omit<LogEntry,"id"|"seq"|"time"|"visibility">&{visibility?:Visibility;index?:number}):LogEntry {
  const {index=0,visibility="public",...rest}=input;
  return {id:`log.${ctx.nextSeq}.${index}`,seq:ctx.nextSeq,time:ctx.now(),visibility,...rest};
}

export function actorName(state:TableState,actorId:string) { return state.actors[actorId]?.name??actorId; }

/** One kernel commit over the table's rules state; a rejection becomes a refusal in the rules' words. */
export function commitOperations(
  ctx:HandlerContext,
  input:{id:string;actorId:string;sourceId:string;operations:ResolutionOperation[];rules?:RulesRuntimeState;refusalCode?:string;actionId?:string},
):{status:"committed";commit:Extract<ResolutionCommit,{status:"committed"}>}|Refused {
  const rules=input.rules??ctx.state.rules;
  const pending:PendingResolution={id:input.id,actorId:input.actorId,sourceId:input.sourceId,expectedRevision:rules.revision,operations:input.operations};
  let commit:ResolutionCommit;
  try { commit=resolvePendingResolution(ctx.profile,rules,pending); }
  catch(error) { return refused(input.refusalCode??"action-rejected",kernelErrorKo(error instanceof Error?error.message:String(error)),{actorId:input.actorId,actionId:input.actionId}); }
  if(commit.status==="rejected") return refused(input.refusalCode??"action-rejected",kernelErrorKo(commit.error),{actorId:input.actorId,actionId:input.actionId});
  return {status:"committed",commit};
}
