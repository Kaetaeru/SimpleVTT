import type { ResolutionEvent } from "../domain/resolutionTypes";

export const CONNECTED_SESSION_PROTOCOL_VERSION = 1 as const;

export interface CharacterProjectionRevision {
  characterId:string;
  sourceRevision:number;
  runtimeRevision:number;
}

export interface SessionCompatibilityManifest {
  protocolVersion:number;
  rulesProfileId:string;
  capabilities:string[];
  character?:CharacterProjectionRevision;
}

export type SessionCompatibilityResult =
  | { status:"compatible"; message:string }
  | { status:"warning"; message:string }
  | { status:"incompatible"; message:string };

export interface ConnectedActionRequest {
  sessionId:string;
  requestId:string;
  actorId:string;
  actionId:string;
  targetIds:string[];
  knownEventCursor:number;
  character?:CharacterProjectionRevision;
  capabilities:string[];
}

export type ConnectedEventPayload =
  | {
      kind:"resolution";
      resolutionId:string;
      resolutionEvents:ResolutionEvent[];
      stateChanges:string[];
      provenance:string[];
    }
  | {
      kind:"mode-transition"|"correction"|"participant";
      resolutionId?:string;
      stateChanges:string[];
      provenance:string[];
    };

export interface ConnectedSessionEvent {
  sessionId:string;
  eventId:string;
  sequence:number;
  requestId?:string;
  actorId?:string;
  payload:ConnectedEventPayload;
}

export interface HostEventCandidate {
  actorId?:string;
  payload:ConnectedEventPayload;
}

export type HostCommitResult =
  | { status:"committed"; event:ConnectedSessionEvent }
  | { status:"duplicate"; event:ConnectedSessionEvent }
  | { status:"rejected"; error:string; hostCursor:number };

export type HostReserveResult =
  | { status:"reserved"; hostCursor:number }
  | { status:"duplicate"; event:ConnectedSessionEvent }
  | { status:"rejected"; error:string; hostCursor:number };

export type ClientApplyResult =
  | { status:"applied"; cursor:number }
  | { status:"duplicate"; cursor:number }
  | { status:"rejected"; error:string; cursor:number };

export type ConnectedPayloadApplyResult = void | { status:"committed" } | { status:"rejected"; error:string };

function normalizedCapabilities(values:string[]) {
  return [...new Set(values)].sort();
}

export function compareSessionCompatibility(
  host:SessionCompatibilityManifest,
  client:SessionCompatibilityManifest,
):SessionCompatibilityResult {
  if (host.protocolVersion !== client.protocolVersion) {
    return { status:"incompatible", message:`protocol version mismatch: host ${host.protocolVersion}, client ${client.protocolVersion}` };
  }
  if (host.rulesProfileId !== client.rulesProfileId) {
    return { status:"incompatible", message:`rules profile mismatch: host ${host.rulesProfileId}, client ${client.rulesProfileId}` };
  }
  const clientCapabilities = new Set(client.capabilities);
  const missing = normalizedCapabilities(host.capabilities).filter((capability) => !clientCapabilities.has(capability));
  if (missing.length > 0) {
    return { status:"incompatible", message:`client is missing required capabilities: ${missing.join(", ")}` };
  }
  const hostCapabilities = new Set(host.capabilities);
  const extra = normalizedCapabilities(client.capabilities).filter((capability) => !hostCapabilities.has(capability));
  if (extra.length > 0) {
    return { status:"warning", message:`client has extra capabilities not mounted by host: ${extra.join(", ")}` };
  }
  return { status:"compatible", message:"protocol, rules profile, and required capabilities are compatible" };
}

export class HostSessionLedger {
  readonly sessionId:string;
  readonly manifest:SessionCompatibilityManifest;
  private readonly events:ConnectedSessionEvent[] = [];
  private readonly requestEvents = new Map<string,ConnectedSessionEvent>();
  private readonly reservedRequestCursors = new Map<string,number>();

  constructor(sessionId:string, manifest:SessionCompatibilityManifest) {
    this.sessionId=sessionId;
    this.manifest={ ...manifest, capabilities:normalizedCapabilities(manifest.capabilities) };
  }

  get cursor() { return this.events.length; }

  handshake(client:SessionCompatibilityManifest) {
    return compareSessionCompatibility(this.manifest,client);
  }

  reserveActionRequest(request:ConnectedActionRequest):HostReserveResult {
    if (request.sessionId !== this.sessionId) {
      return { status:"rejected", error:`session mismatch: expected ${this.sessionId}, received ${request.sessionId}`, hostCursor:this.cursor };
    }
    const duplicate=this.requestEvents.get(request.requestId);
    if (duplicate) return { status:"duplicate", event:structuredClone(duplicate) };
    if (this.reservedRequestCursors.has(request.requestId)) {
      return { status:"reserved", hostCursor:this.reservedRequestCursors.get(request.requestId)! };
    }
    if (request.knownEventCursor !== this.cursor) {
      return { status:"rejected", error:`stale event cursor: client ${request.knownEventCursor}, host ${this.cursor}`, hostCursor:this.cursor };
    }
    this.reservedRequestCursors.set(request.requestId,this.cursor);
    return { status:"reserved", hostCursor:this.cursor };
  }

  commitReservedActionRequest(requestId:string,candidate:HostEventCandidate):HostCommitResult {
    const duplicate=this.requestEvents.get(requestId);
    if (duplicate) return { status:"duplicate", event:structuredClone(duplicate) };
    const reservedCursor=this.reservedRequestCursors.get(requestId);
    if (reservedCursor===undefined) {
      return { status:"rejected", error:`request was not reserved: ${requestId}`, hostCursor:this.cursor };
    }
    if (reservedCursor!==this.cursor) {
      this.reservedRequestCursors.delete(requestId);
      return { status:"rejected", error:`host history advanced while request was pending: reserved ${reservedCursor}, host ${this.cursor}`, hostCursor:this.cursor };
    }
    const event=this.commitCandidate(candidate,requestId);
    this.reservedRequestCursors.delete(requestId);
    this.requestEvents.set(requestId,event);
    return { status:"committed", event:structuredClone(event) };
  }

  cancelReservedActionRequest(requestId:string) {
    this.reservedRequestCursors.delete(requestId);
  }

  commitActionRequest(request:ConnectedActionRequest,candidate:HostEventCandidate):HostCommitResult {
    const reserved=this.reserveActionRequest(request);
    if (reserved.status==="duplicate") return reserved;
    if (reserved.status==="rejected") return reserved;
    return this.commitReservedActionRequest(request.requestId,candidate);
  }

  commitHostEvent(candidate:HostEventCandidate):ConnectedSessionEvent {
    return structuredClone(this.commitCandidate(candidate));
  }

  eventsAfter(cursor:number):ConnectedSessionEvent[] {
    if (!Number.isInteger(cursor) || cursor < 0 || cursor > this.cursor) {
      throw new Error(`invalid event cursor ${cursor}; host cursor is ${this.cursor}`);
    }
    return this.events.slice(cursor).map((event) => structuredClone(event));
  }

  private commitCandidate(candidate:HostEventCandidate,requestId?:string) {
    const sequence=this.cursor+1;
    const event:ConnectedSessionEvent={
      sessionId:this.sessionId,
      eventId:`${this.sessionId}:event:${sequence}`,
      sequence,
      requestId,
      actorId:candidate.actorId,
      payload:structuredClone(candidate.payload),
    };
    this.events.push(event);
    return event;
  }
}

export class ClientSessionReplica {
  readonly sessionId:string;
  private appliedEventIds = new Set<string>();
  private _cursor=0;

  constructor(sessionId:string) { this.sessionId=sessionId; }
  get cursor() { return this._cursor; }

  private preflight(event:ConnectedSessionEvent):ClientApplyResult|undefined {
    if (event.sessionId !== this.sessionId) {
      return { status:"rejected", error:`session mismatch: expected ${this.sessionId}, received ${event.sessionId}`, cursor:this.cursor };
    }
    if (this.appliedEventIds.has(event.eventId)) {
      return { status:"duplicate", cursor:this.cursor };
    }
    if (event.sequence <= this.cursor) {
      return { status:"rejected", error:`conflicting history at sequence ${event.sequence}; cursor is ${this.cursor}`, cursor:this.cursor };
    }
    if (event.sequence !== this.cursor+1) {
      return { status:"rejected", error:`event gap: expected ${this.cursor+1}, received ${event.sequence}`, cursor:this.cursor };
    }
    return undefined;
  }

  private accept(event:ConnectedSessionEvent):ClientApplyResult {
    this.appliedEventIds.add(event.eventId);
    this._cursor=event.sequence;
    return { status:"applied", cursor:this.cursor };
  }

  apply(
    event:ConnectedSessionEvent,
    applyPayload:(payload:ConnectedEventPayload,event:ConnectedSessionEvent)=>ConnectedPayloadApplyResult,
  ):ClientApplyResult {
    const preflight=this.preflight(event);
    if (preflight) return preflight;
    const applied=applyPayload(structuredClone(event.payload),structuredClone(event));
    if (applied && applied.status === "rejected") {
      return { status:"rejected", error:`authoritative event apply rejected: ${applied.error}`, cursor:this.cursor };
    }
    return this.accept(event);
  }

  async applyAsync(
    event:ConnectedSessionEvent,
    applyPayload:(payload:ConnectedEventPayload,event:ConnectedSessionEvent)=>Promise<ConnectedPayloadApplyResult>,
  ):Promise<ClientApplyResult> {
    const preflight=this.preflight(event);
    if (preflight) return preflight;
    const applied=await applyPayload(structuredClone(event.payload),structuredClone(event));
    if (applied && applied.status === "rejected") {
      return { status:"rejected", error:`authoritative event apply rejected: ${applied.error}`, cursor:this.cursor };
    }
    return this.accept(event);
  }

  applyBatch(
    events:ConnectedSessionEvent[],
    applyPayload:(payload:ConnectedEventPayload,event:ConnectedSessionEvent)=>ConnectedPayloadApplyResult,
  ):ClientApplyResult {
    let result:ClientApplyResult={ status:"duplicate", cursor:this.cursor };
    for (const event of events) {
      result=this.apply(event,applyPayload);
      if (result.status === "rejected") return result;
    }
    return result;
  }

  async applyBatchAsync(
    events:ConnectedSessionEvent[],
    applyPayload:(payload:ConnectedEventPayload,event:ConnectedSessionEvent)=>Promise<ConnectedPayloadApplyResult>,
  ):Promise<ClientApplyResult> {
    let result:ClientApplyResult={ status:"duplicate", cursor:this.cursor };
    for (const event of events) {
      result=await this.applyAsync(event,applyPayload);
      if (result.status === "rejected") return result;
    }
    return result;
  }
}
