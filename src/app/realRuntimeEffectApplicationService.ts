import "./phase09RealRuntimeAttackAdapter";
import type { ActivityEntry, AppSnapshot, ResolutionView } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { projectRuntimeEventsToActivity } from "./realActivityProjectionService";
import { commitAdapterTurnRuntimeState, snapshotAdapterTurnRuntimeState } from "./turnRuntimeSessionRegistry";
import { recordRuntimeResolutionEvents } from "./runtimeResolutionEventHistory";
import { SIMPLEVTT_APP_RULES_PROFILE } from "./realResolutionService";
import type { RulesRuntimeState } from "../domain/combatState";
import { resolvePendingResolution } from "../domain/resolution";
import type { ResolutionEvent, ResolutionOperation } from "../domain/resolutionTypes";

export type RuntimeEffectApplicationOperation = Extract<ResolutionOperation,
  { kind:"apply-effect" }
  | { kind:"update-effect" }
  | { kind:"remove-effect" }
  | { kind:"start-concentration" }
  | { kind:"end-concentration" }
>;

export interface RuntimeEffectApplicationRequest {
  resolutionId:string;
  actorId:string;
  sourceId:string;
  operations:RuntimeEffectApplicationOperation[];
  title?:string;
  summary?:string;
}

export type PreparedRuntimeEffectApplication =
  | { status:"committed"; inputRevision:number; state:RulesRuntimeState; events:ResolutionEvent[] }
  | { status:"rejected"; error:string };

export type RuntimeEffectApplicationResult =
  | { status:"committed"; events:ResolutionEvent[]; activity:ActivityEntry; revision:number }
  | { status:"rejected"; error:string };

interface RuntimeEffectApplicationAdapterState {
  scene:AppSnapshot["scene"];
  activity:ActivityEntry[];
  resolution:ResolutionView|null;
  lastBefore:unknown;
  lastResolutionId:string|null;
  getSnapshot():Promise<AppSnapshot>;
}

function actorName(internal:RuntimeEffectApplicationAdapterState,actorId:string) {
  return internal.scene.entities.find((entity)=>entity.id===actorId)?.name ?? actorId;
}

function defaultSummary(events:ResolutionEvent[]) {
  if (!events.length) return "runtime effect application committed";
  if (events.length===1) return events[0].summary;
  return `${events.length}개 runtime effect event 적용`;
}

export function resolveRuntimeEffectApplication(
  input:RulesRuntimeState,
  request:RuntimeEffectApplicationRequest,
):PreparedRuntimeEffectApplication {
  if (!request.operations.length) return { status:"rejected",error:"runtime effect application requires at least one operation" };
  const resolved=resolvePendingResolution(SIMPLEVTT_APP_RULES_PROFILE,input,{
    id:request.resolutionId,
    actorId:request.actorId,
    sourceId:request.sourceId,
    expectedRevision:input.revision,
    operations:request.operations.map((operation)=>structuredClone(operation)),
  });
  if (resolved.status==="rejected") return { status:"rejected",error:resolved.error };
  return {
    status:"committed",
    inputRevision:input.revision,
    state:resolved.state,
    events:resolved.events.map((event)=>structuredClone(event)),
  };
}

export async function applyAdapterRuntimeEffectApplication(
  adapter:MockAdapter,
  request:RuntimeEffectApplicationRequest,
):Promise<RuntimeEffectApplicationResult> {
  const internal=adapter as unknown as RuntimeEffectApplicationAdapterState;
  if (internal.resolution) return { status:"rejected",error:"runtime effect application cannot commit while another resolution is active" };

  const input=snapshotAdapterTurnRuntimeState(adapter,internal.scene);
  if (!input) return { status:"rejected",error:"runtime effect application requires an active turn runtime session" };
  const prepared=resolveRuntimeEffectApplication(input,request);
  if (prepared.status==="rejected") return prepared;

  if (!commitAdapterTurnRuntimeState(adapter,internal.scene,prepared.inputRevision,prepared.state)) {
    return { status:"rejected",error:"turn runtime revision changed before effect application commit" };
  }

  const events=prepared.events.map((event)=>structuredClone(event));
  const activity=projectRuntimeEventsToActivity({
    id:request.resolutionId,
    actorName:actorName(internal,request.actorId),
    title:request.title ?? request.sourceId,
    summary:request.summary ?? defaultSummary(events),
    events,
  });
  internal.activity.unshift(activity);
  recordRuntimeResolutionEvents(adapter,request.resolutionId,events);
  internal.lastBefore=null;
  internal.lastResolutionId=request.resolutionId;
  return { status:"committed",events,activity,revision:prepared.state.revision };
}
