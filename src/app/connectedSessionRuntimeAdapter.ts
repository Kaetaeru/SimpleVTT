import "./persistenceContracts";
import type { ActivityEntry, AppSnapshot, CatalogEntry, CharacterSheet, CharacterSummary, ConnectionState, SceneVm } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import {
  CONNECTED_SESSION_PROTOCOL_VERSION,
  ClientSessionReplica,
  HostSessionLedger,
  type ConnectedEventPayload,
  type ConnectedSceneTopology,
  type ConnectedSessionEvent,
  type SessionCompatibilityManifest,
} from "./connectedSessionProtocol";
import { decodeConnectedWireMessage, encodeConnectedWireMessage, type ConnectedWireMessage } from "./connectedSessionWire";
import { applyConnectedCorrections } from "./connectedCorrectionApply";
import { applyResolutionEvents } from "./realEventApplyService";
import { persistCharacterResolutionEvents } from "./resolutionCharacterWriteBackPort";
import { SIMPLEVTT_APP_RULES_PROFILE } from "./realResolutionService";
import { publishExternalAdapterSnapshot } from "./adapterSnapshotEvents";
import { connectedStateFor, resetConnectedState } from "./connectedSessionState";
import { routeConnectedActionRequest } from "./connectedActionRequestPort";
import { routeConnectedInterruptResponse } from "./connectedInterruptResponsePort";
import { routeConnectedConcentrationResponse } from "./connectedConcentrationResponsePort";
import { tauriSessionTransport, type SessionTransportMessage, type SessionTransportStatus } from "./tauriSessionTransport";
import { buildCharacterSessionProjectionV1 } from "./characterSessionProjection";
import { acceptHostCharacterSessionProjection } from "./connectedCharacterProjectionHandshake";
import { syncConnectedCampaignRoster } from "./connectedCampaignRosterPort";
import { projectedCharacterById, rebindCharacterSessionProjectionPeer } from "./characterSessionProjectionRegistry";
import { unmountReconstructedCharacterSessionProjection } from "./characterSessionProjectionMount";
import { clearReadyActionConfiguration, setReadyActionConfiguration } from "./standardActionReadyState";
import { commitAdapterTurnRuntimeState, ensureAdapterTurnRuntimeState } from "./turnRuntimeSessionRegistry";
import type { ResolutionEvent } from "../domain/resolutionTypes";
import {
  actionFromConnectedPresentation,
  isConnectedResolutionPresentation,
  type ConnectedResolutionPresentationV1,
} from "./connectedResolutionPresentation";

declare module "./contracts" {
  interface SessionParticipantVm { ready?:boolean; }
}

export const CONNECTED_CAPABILITIES=["resolution-event-v1","resolution-presentation-v1","interrupt-response-v1","concentration-response-v1","resolution-undo-v1","character-projection-v1","event-cursor-v1","ready-action-v1","manual-movement-reaction-v1","ready-intent-v1","session-end-v1","scene-topology-v1"];

export interface ConnectedAdapterState {
  role:"player"|"dm";
  connectionState:ConnectionState;
  sessionMode:AppSnapshot["sessionMode"];
  session:AppSnapshot["session"];
  scene:SceneVm;
  resolution:AppSnapshot["resolution"];
  resolutionPresentation:AppSnapshot["resolutionPresentation"];
  activeCharacter:CharacterSheet;
  characters:CharacterSummary[];
  catalog:CatalogEntry[];
  activity:ActivityEntry[];
  syncChar():void;
  getSnapshot():Promise<AppSnapshot>;
}

export function connectedInternal(adapter:MockAdapter) {
  return adapter as unknown as ConnectedAdapterState;
}

function applyConnectedResolutionEvents(adapter:MockAdapter,events:ResolutionEvent[]) {
  const app=connectedInternal(adapter);
  const runtime=ensureAdapterTurnRuntimeState(adapter,app.scene);
  const projected=applyResolutionEvents(app.scene,events,app.activeCharacter.resources,app.activeCharacter.items,runtime);
  if(projected.status==="rejected"||!projected.runtimeState)return projected;
  if(projected.runtimeState.revision!==runtime.revision&&!commitAdapterTurnRuntimeState(adapter,projected.scene,runtime.revision,projected.runtimeState))return {status:"rejected" as const,error:"connected runtime revision changed before event apply"};
  return projected;
}

export function connectedManifest(adapter:MockAdapter):SessionCompatibilityManifest {
  const character=connectedInternal(adapter).activeCharacter;
  return {
    protocolVersion:CONNECTED_SESSION_PROTOCOL_VERSION,
    rulesProfileId:character.rulesProfileId ?? SIMPLEVTT_APP_RULES_PROFILE.profileId,
    capabilities:[...CONNECTED_CAPABILITIES],
    character:{
      characterId:character.id,
      sourceRevision:character.sourceRevision ?? 0,
      runtimeRevision:character.runtimeRevision ?? 0,
    },
  };
}

export async function publishConnectedSnapshot(adapter:MockAdapter) {
  publishExternalAdapterSnapshot(await connectedInternal(adapter).getSnapshot());
}

function installConnectedResolutionPresentation(adapter:MockAdapter,presentation:ConnectedResolutionPresentationV1) {
  const app=connectedInternal(adapter);
  const privateInterrupt=connectedStateFor(adapter).privateInterruptsByResolution.get(presentation.resolutionId);
  const privateConcentration=connectedStateFor(adapter).privateConcentrationByResolution.get(presentation.resolutionId);
  app.resolution=structuredClone(presentation.resolution);
  if(app.resolution?.stage==="interrupt"&&privateInterrupt) app.resolution.interrupt=structuredClone(privateInterrupt);
  if(app.resolution?.stage==="save-animation"&&privateConcentration) app.resolution.concentrationSave=structuredClone(privateConcentration);
  app.resolutionPresentation={
    resolutionId:presentation.resolutionId,
    presentationSequence:presentation.presentationSequence,
    delivery:presentation.delivery,
    action:actionFromConnectedPresentation(presentation.action),
  };
}

const REMOTE_DICE_PRESENTATION_STAGES=new Set(["roll-animation","save-animation","damage-animation"]);

function isRemoteDicePresentation(presentation:ConnectedResolutionPresentationV1) {
  return REMOTE_DICE_PRESENTATION_STAGES.has(presentation.resolution.stage)
    && presentation.resolution.authoritativeDice.length>0;
}

function enqueueOrInstallConnectedPresentation(adapter:MockAdapter,presentation:ConnectedResolutionPresentationV1) {
  const state=connectedStateFor(adapter);
  const app=connectedInternal(adapter);
  if(!app.resolutionPresentation){
    installConnectedResolutionPresentation(adapter,presentation);
    return "applied" as const;
  }
  if(isRemoteDicePresentation(presentation)){
    state.pendingPresentations=[];
    installConnectedResolutionPresentation(adapter,presentation);
    return "replaced" as const;
  }
  state.pendingPresentations.push(structuredClone(presentation));
  return "queued" as const;
}

export function advanceConnectedResolutionPresentation(adapter:MockAdapter) {
  const state=connectedStateFor(adapter);
  if(state.mode!=="client") return {status:"rejected" as const,error:"only a connected Client can advance the remote presentation queue"};
  const next=state.pendingPresentations.shift();
  if(!next) return {status:"empty" as const};
  installConnectedResolutionPresentation(adapter,next);
  return {status:"applied" as const,presentationSequence:next.presentationSequence,remaining:state.pendingPresentations.length};
}

export function resetConnectedSessionTransientState(adapter:MockAdapter,message:string) {
  const app=connectedInternal(adapter);
  clearReadyActionConfiguration(adapter);
  resetConnectedState(adapter,null);
  app.sessionMode="freeform";
  app.scene.round=0;
  const localActorId=app.scene.entities.some((entity)=>entity.id===app.activeCharacter.id) ? app.activeCharacter.id : "";
  app.scene.currentActorId=localActorId;
  app.scene.selectedActorId=localActorId;
  app.scene.economyByActor={};
  app.resolution=null;
  app.resolutionPresentation=null;
  app.connectionState="disconnected";
  app.session.role="offline";
  app.session.address="";
  app.session.participants=[];
  app.session.compatibility="warning";
  app.session.compatibilityMessage=message;
}

function setTransportStatus(adapter:MockAdapter,status:SessionTransportStatus) {
  const app=connectedInternal(adapter);
  app.connectionState=status.state;
  if (status.address) app.session.address=status.address;
  if (status.role) app.session.role=status.role;
  if (status.state==="disconnected") {
    app.session.participants=app.session.participants.map((participant)=>({ ...participant,state:"disconnected" as const,ready:false }));
  }
}

export async function sendConnectedWireTo(peer:string,message:ConnectedWireMessage) {
  await tauriSessionTransport.sendTo(peer,encodeConnectedWireMessage(message));
}

export async function broadcastConnectedWire(message:ConnectedWireMessage) {
  await tauriSessionTransport.send(encodeConnectedWireMessage(message));
}

function sceneTopology(scene:SceneVm):ConnectedSceneTopology {
  return {
    sceneId:scene.id,
    sceneName:scene.name,
    round:scene.round,
    currentActorId:scene.currentActorId,
    entities:structuredClone(scene.entities),
    economyByActor:structuredClone(scene.economyByActor),
  };
}

export async function commitConnectedSceneTopology(
  adapter:MockAdapter,
  stateChanges:string[],
  provenance:string[],
) {
  const state=connectedStateFor(adapter);
  const app=connectedInternal(adapter);
  if (state.mode!=="host"||!state.ledger) return {status:"ignored" as const};
  const event=state.ledger.commitHostEvent({
    actorId:"host",
    payload:{kind:"scene-topology",topology:sceneTopology(app.scene),stateChanges:[...stateChanges],provenance:[...provenance]},
  });
  await broadcastConnectedWire({type:"event-batch",sessionId:state.ledger.sessionId,afterCursor:event.sequence-1,events:[event]});
  return {status:"committed" as const,event};
}

async function sendClientHello(adapter:MockAdapter,knownEventCursor:number) {
  const app=connectedInternal(adapter);
  let projection;
  try {
    projection=buildCharacterSessionProjectionV1(app.activeCharacter,app.catalog);
  } catch(error) {
    app.session.compatibility="warning";
    app.session.compatibilityMessage=`Character SessionProjection unavailable: ${error instanceof Error?error.message:String(error)}`;
  }
  await tauriSessionTransport.send(encodeConnectedWireMessage({
    type:"hello",
    manifest:connectedManifest(adapter),
    participantId:`client:${app.activeCharacter.id}`,
    participantName:app.activeCharacter.name,
    knownEventCursor,
    projection,
  }));
}

function clearClientHandshakeRetry(adapter:MockAdapter) {
  const state=connectedStateFor(adapter);
  if (state.handshakeTimer) clearTimeout(state.handshakeTimer);
  state.handshakeTimer=null;
  state.handshakeAttempts=0;
}

function scheduleClientHandshakeRetry(adapter:MockAdapter) {
  const state=connectedStateFor(adapter);
  if (state.mode!=="client"||state.sessionId||state.handshakeTimer) return;
  if (state.handshakeAttempts>=4) {
    const app=connectedInternal(adapter);
    app.session.compatibility="warning";
    app.session.compatibilityMessage="Host compatibility handshake timed out after 4 retries. Verify both apps use the same build, then retry Join.";
    void publishConnectedSnapshot(adapter);
    return;
  }
  const delay=500*(2**state.handshakeAttempts);
  state.handshakeTimer=setTimeout(async()=>{
    state.handshakeTimer=null;
    if (state.mode!=="client"||state.sessionId) return;
    state.handshakeAttempts+=1;
    try {
      await sendClientHello(adapter,state.replica?.cursor??0);
      const app=connectedInternal(adapter);
      app.session.compatibility="warning";
      app.session.compatibilityMessage=`Host compatibility handshake retry ${state.handshakeAttempts}/4.`;
      await publishConnectedSnapshot(adapter);
    } catch(error) {
      const app=connectedInternal(adapter);
      app.session.compatibility="warning";
      app.session.compatibilityMessage=`Host handshake retry failed: ${error instanceof Error?error.message:String(error)}`;
      await publishConnectedSnapshot(adapter);
    }
    scheduleClientHandshakeRetry(adapter);
  },delay);
  (state.handshakeTimer as unknown as {unref?:()=>void}).unref?.();
}

function applyParticipantPayload(adapter:MockAdapter,payload:Extract<ConnectedEventPayload,{kind:"participant"}>) {
  const app=connectedInternal(adapter);
  const participant={
    id:payload.participantId,
    name:payload.participantName,
    characterName:payload.characterName,
    state:payload.state,
    ready:payload.ready,
  };
  const existing=app.session.participants.some((entry)=>entry.id===participant.id);
  app.session.participants=existing
    ? app.session.participants.map((entry)=>entry.id===participant.id ? participant : entry)
    : [...app.session.participants,participant];
}

async function applyConfirmedPayload(adapter:MockAdapter,payload:ConnectedEventPayload,event:ConnectedSessionEvent) {
  const app=connectedInternal(adapter);
  const state=connectedStateFor(adapter);
  if (payload.kind==="mode-transition") {
    state.sessionStarted=true;
    app.sessionMode=payload.sessionMode;
    app.scene.round=payload.round;
    app.scene.currentActorId=payload.currentActorId;
    app.scene.economyByActor=structuredClone(payload.economyByActor);
    app.activity.unshift({
      id:`connected:${event.eventId}`,
      time:"지금",
      actor:"Host",
      title:"원격 턴 상태 동기화",
      summary:`${payload.sessionMode} · round ${payload.round} · ${payload.currentActorId}`,
      detail:[`eventId=${event.eventId}`,...payload.provenance],
      stateChanges:[...payload.stateChanges],
    });
    return { status:"committed" as const };
  }
  if (payload.kind==="participant") {
    applyParticipantPayload(adapter,payload);
    return { status:"committed" as const };
  }
  if (payload.kind==="scene-topology") {
    const localActorId=app.activeCharacter.id;
    const localActions=app.scene.actionsByActor[localActorId]?.map((action)=>structuredClone(action))??[];
    const topology=payload.topology;
    const hasLocalActor=topology.entities.some((entity)=>entity.id===localActorId);
    app.scene={
      ...app.scene,
      id:topology.sceneId,
      name:topology.sceneName,
      round:topology.round,
      currentActorId:topology.currentActorId,
      selectedActorId:hasLocalActor?localActorId:topology.currentActorId,
      entities:structuredClone(topology.entities),
      actionsByActor:localActions.length?{[localActorId]:localActions}:{},
      economyByActor:structuredClone(topology.economyByActor),
    };
    app.activity.unshift({
      id:`connected:${event.eventId}`,
      time:"지금",
      actor:"Host",
      title:"장면 액터 동기화",
      summary:`${topology.entities.length} actors`,
      detail:[`eventId=${event.eventId}`,...payload.provenance],
      stateChanges:[...payload.stateChanges],
    });
    return {status:"committed" as const};
  }
  if(payload.kind==="resolution-undo"){
    const projected=applyConnectedResolutionEvents(adapter,payload.inverseResolutionEvents);
    if(projected.status==="rejected")return projected;
    const writeBack=await persistCharacterResolutionEvents(adapter,payload.inverseResolutionEvents,"forward");
    if(writeBack.status==="rejected")return {status:"rejected" as const,error:`Character undo write-back failed: ${writeBack.error}`};
    app.scene=projected.scene;
    app.activeCharacter.resources=projected.resources.map((entry)=>structuredClone(entry));
    app.activeCharacter.items=projected.items.map((entry)=>structuredClone(entry));
    app.syncChar();
    app.activity=app.activity.map((entry)=>entry.id===payload.undoOf?{...entry,reversed:true}:entry);
    app.activity.unshift({id:payload.undoId,time:"지금",actor:"DM",title:"원격 Resolution 되돌림",summary:payload.undoOf,detail:[`eventId=${event.eventId}`,...payload.provenance],stateChanges:[...projected.stateChanges],correction:true,undoOf:payload.undoOf});
    app.resolution=null;
    app.resolutionPresentation=null;
    state.pendingPresentations=[];
    return {status:"committed" as const};
  }
  if (payload.kind==="ready-action") {
    const actor=app.scene.entities.find((entity)=>entity.id===payload.actorId);
    if (!actor) return {status:"rejected" as const,error:`ready-action actor is missing: ${payload.actorId}`};
    app.scene.economyByActor[payload.actorId]={...payload.economy};
    if (payload.transition==="armed"&&payload.configuration) {
      setReadyActionConfiguration(adapter,payload.configuration);
      if (!actor.status.includes("준비 행동")) actor.status.push("준비 행동");
    } else {
      clearReadyActionConfiguration(adapter,payload.actorId);
      actor.status=actor.status.filter((status)=>status!=="준비 행동");
    }
    app.activity.unshift({id:`connected:${event.eventId}`,time:"지금",actor:actor.name,title:payload.transition==="armed"?"원격 준비 행동 설정":"원격 준비 행동 해제",summary:payload.configuration?.trigger??`Host event #${event.sequence}`,detail:[`eventId=${event.eventId}`,...payload.provenance],stateChanges:[...payload.stateChanges]});
    return {status:"committed" as const};
  }
  if (payload.kind==="correction") {
    const corrected=applyConnectedCorrections(app.scene,app.activeCharacter.resources,payload.changes);
    if (corrected.status==="rejected") return corrected;
    app.scene=corrected.scene;
    app.activeCharacter.resources=corrected.resources.map((entry)=>structuredClone(entry));
    app.syncChar();
    app.activity.unshift({
      id:`connected:${event.eventId}`,
      time:"지금",
      actor:"DM",
      title:"원격 DM 판정 수정",
      summary:payload.ruling,
      detail:[`eventId=${event.eventId}`,...payload.provenance],
      stateChanges:corrected.stateChanges.length ? corrected.stateChanges : [...payload.stateChanges],
      correction:true,
      ruling:payload.ruling,
    });
    return { status:"committed" as const };
  }
  if (payload.kind!=="resolution") return { status:"committed" as const };
  if (!isConnectedResolutionPresentation(payload.presentation)) return {status:"rejected" as const,error:"Host resolution event is missing a valid presentation envelope"};
  const projected=applyConnectedResolutionEvents(adapter,payload.resolutionEvents);
  if (projected.status==="rejected") return projected;

  const writeBack=await persistCharacterResolutionEvents(adapter,payload.resolutionEvents,"forward");
  if (writeBack.status==="rejected") {
    return { status:"rejected" as const,error:`Character write-back failed after host confirmation: ${writeBack.error}` };
  }

  app.scene=projected.scene;
  app.activeCharacter.resources=projected.resources.map((entry)=>structuredClone(entry));
  app.activeCharacter.items=projected.items.map((entry)=>structuredClone(entry));
  app.syncChar();
  const presentationStatus=enqueueOrInstallConnectedPresentation(adapter,payload.presentation);
  state.lastAppliedPresentationSequence=Math.max(state.lastAppliedPresentationSequence,payload.presentation.presentationSequence);
  app.activity.unshift({
    id:payload.resolutionId,
    time:"지금",
    actor:event.actorId ?? "Host",
    title:`원격 Resolution 적용 · ${payload.resolutionId}`,
    summary:`Host event #${event.sequence}`,
    detail:[`eventId=${event.eventId}`,`ResolutionEvent ${payload.resolutionEvents.length}개`,`host-authoritative forward apply`,`presentation=${presentationStatus}`],
    stateChanges:[...projected.stateChanges],
  });
  return { status:"committed" as const };
}

export function applyConnectedResolutionPresentation(adapter:MockAdapter,presentation:ConnectedResolutionPresentationV1) {
  const state=connectedStateFor(adapter);
  const app=connectedInternal(adapter);
  if (state.mode!=="client") return {status:"rejected" as const,error:"only a connected Client can apply remote presentation"};
  if (!isConnectedResolutionPresentation(presentation)) return {status:"rejected" as const,error:"invalid connected Resolution presentation"};
  if (presentation.delivery!=="live") return {status:"rejected" as const,error:"catch-up presentation must arrive with its committed event"};
  if (presentation.presentationSequence<=state.lastAppliedPresentationSequence) {
    return {status:"duplicate" as const,presentationSequence:state.lastAppliedPresentationSequence};
  }
  state.lastAppliedPresentationSequence=presentation.presentationSequence;
  const status=enqueueOrInstallConnectedPresentation(adapter,presentation);
  return {status,presentationSequence:presentation.presentationSequence,queued:state.pendingPresentations.length};
}

export function applyConnectedInterruptPrompt(
  adapter:MockAdapter,
  prompt:{sessionId:string;resolutionId:string;presentationSequence:number;interrupt:import("./contracts").InterruptView},
) {
  const state=connectedStateFor(adapter);
  const app=connectedInternal(adapter);
  if(state.mode!=="client"||!state.sessionId||prompt.sessionId!==state.sessionId) return {status:"rejected" as const,error:"interrupt prompt session does not match this Client"};
  if(prompt.interrupt.responderId!==app.activeCharacter.id) return {status:"rejected" as const,error:"interrupt prompt does not belong to this Client Character"};
  state.privateInterruptsByResolution.set(prompt.resolutionId,structuredClone(prompt.interrupt));
  if(app.resolution?.id===prompt.resolutionId&&app.resolution.stage==="interrupt") app.resolution.interrupt=structuredClone(prompt.interrupt);
  return {status:"applied" as const};
}

export function applyConnectedConcentrationPrompt(adapter:MockAdapter,prompt:Extract<ConnectedWireMessage,{type:"resolution-concentration-prompt"}>) {
  const state=connectedStateFor(adapter);const app=connectedInternal(adapter);
  if(state.mode!=="client"||state.sessionId!==prompt.sessionId)return {status:"rejected" as const,error:"concentration prompt session does not match this Client"};
  if(prompt.save.targetId!==app.activeCharacter.id)return {status:"rejected" as const,error:"concentration prompt does not belong to this Client Character"};
  state.privateConcentrationByResolution.set(prompt.resolutionId,structuredClone(prompt.save));
  if(app.resolution?.id===prompt.resolutionId&&app.resolution.stage==="save-animation")app.resolution.concentrationSave=structuredClone(prompt.save);
  return {status:"applied" as const};
}

export async function applyConnectedClientEvents(adapter:MockAdapter,events:ConnectedSessionEvent[]) {
  const state=connectedStateFor(adapter);
  if (!state.replica) return { status:"rejected" as const,error:"client replica is not initialized",cursor:0 };
  return state.replica.applyBatchAsync(events,(payload,event)=>applyConfirmedPayload(adapter,payload,event));
}

function scheduleClientReconnect(adapter:MockAdapter) {
  const state=connectedStateFor(adapter);
  const app=connectedInternal(adapter);
  if (state.mode!=="client"||!state.sessionId||!app.session.address||state.reconnectTimer||state.reconnectInFlight) return;
  app.connectionState="reconnecting";
  app.session.participants=app.session.participants.map((participant)=>({ ...participant,state:"reconnecting" as const,ready:false }));
  const delay=Math.min(1000*(2**Math.min(state.reconnectAttempts,3)),8000);
  app.session.compatibility="warning";
  app.session.compatibilityMessage=`Connection lost · retrying from event cursor ${state.replica?.cursor ?? 0}.`;
  state.reconnectTimer=setTimeout(async()=>{
    state.reconnectTimer=null;
    if (state.mode!=="client") return;
    state.reconnectInFlight=true;
    try {
      const status=await tauriSessionTransport.connectClient(app.session.address);
      setTransportStatus(adapter,status);
      state.reconnectAttempts=0;
      await sendClientHello(adapter,state.replica?.cursor ?? 0);
    } catch(error) {
      state.reconnectAttempts+=1;
      app.connectionState="reconnecting";
      app.session.compatibility="warning";
      app.session.compatibilityMessage=`Reconnect attempt ${state.reconnectAttempts} failed: ${error instanceof Error?error.message:String(error)}`;
    } finally {
      state.reconnectInFlight=false;
      await publishConnectedSnapshot(adapter);
    }
    if (app.connectionState!=="connected") scheduleClientReconnect(adapter);
  },delay);
  void publishConnectedSnapshot(adapter);
}

function acceptedManifestForParticipant(adapter:MockAdapter,participantId:string) {
  const state=connectedStateFor(adapter);
  for (const [peer,mappedParticipantId] of state.peerParticipants.entries()) {
    if (mappedParticipantId!==participantId) continue;
    const manifest=state.peerManifests.get(peer);
    if (manifest) return manifest;
  }
  return undefined;
}

async function rejectLiveHello(adapter:MockAdapter,peer:string,message:string) {
  const state=connectedStateFor(adapter);
  const app=connectedInternal(adapter);
  const ledger=state.ledger;
  if (!ledger) return;
  await sendConnectedWireTo(peer,{
    type:"hello-ack",
    sessionId:ledger.sessionId,
    sessionName:app.session.name,
    compatibility:{status:"incompatible",message},
    hostCursor:ledger.cursor,
    events:[],
  });
}

async function handleHostMessage(adapter:MockAdapter,message:SessionTransportMessage,wire:ConnectedWireMessage) {
  const state=connectedStateFor(adapter);
  const app=connectedInternal(adapter);
  const ledger=state.ledger;
  if (!ledger) return;

  if (wire.type==="hello") {
    const existingParticipant=app.session.participants.find((participant)=>participant.id===wire.participantId);
    const previousManifest=existingParticipant ? acceptedManifestForParticipant(adapter,wire.participantId) : undefined;
    if (state.sessionStarted&&existingParticipant) {
      const expectedCharacterId=previousManifest?.character?.characterId;
      const reconnectCharacterId=wire.manifest.character?.characterId;
      if (!previousManifest||expectedCharacterId!==reconnectCharacterId) {
        await rejectLiveHello(adapter,message.peer,"Live reconnect must use the previously accepted participant and Character identity.");
        return;
      }
    }

    let compatibility=ledger.handshake(wire.manifest);
    let events:ConnectedSessionEvent[]=[];
    if (compatibility.status!=="incompatible") {
      try { ledger.eventsAfter(wire.knownEventCursor); }
      catch(error) {
        await sendConnectedWireTo(message.peer,{type:"error",code:"invalid-event-cursor",message:error instanceof Error?error.message:String(error),hostCursor:ledger.cursor});
        return;
      }

      const characterId=wire.manifest.character?.characterId;
      const previousProjectionPeer=characterId?projectedCharacterById(adapter,characterId)?.peerId:undefined;
      const projectionAcceptance=acceptHostCharacterSessionProjection(adapter,message.peer,wire.manifest,wire.projection);
      if (projectionAcceptance.status==="rejected") {
        compatibility={status:"incompatible",message:`Character SessionProjection rejected: ${projectionAcceptance.error}`};
      } else {
        const rosterResult=characterId?await syncConnectedCampaignRoster(adapter,{
          participantId:wire.participantId,
          participantName:wire.participantName,
          characterId,
          level:wire.projection?.source.build.level,
        }):{status:"ignored" as const,reason:"hello has no Character identity"};
        if(rosterResult.status==="rejected"){
          if(projectionAcceptance.mode==="mounted") unmountReconstructedCharacterSessionProjection(adapter,message.peer);
          if(projectionAcceptance.mode==="rebound"&&previousProjectionPeer) rebindCharacterSessionProjectionPeer(adapter,characterId!,previousProjectionPeer);
          compatibility={status:"incompatible",message:`Campaign roster reference rejected: ${rosterResult.error}`};
        }
      }
      if(compatibility.status!=="incompatible"&&projectionAcceptance.status==="accepted"){
        if (characterId) {
          for (const [peer,manifest] of state.peerManifests.entries()) {
            if (peer!==message.peer&&manifest.character?.characterId===characterId) {
              state.peerManifests.delete(peer);
              state.peerParticipants.delete(peer);
            }
          }
        }
        state.peerManifests.set(message.peer,structuredClone(wire.manifest));
        state.peerParticipants.set(message.peer,wire.participantId);
        const cursorBeforeParticipant=ledger.cursor;
        const participantEvent=ledger.commitHostEvent({
          actorId:wire.participantId,
          payload:{
            kind:"participant",
            participantId:wire.participantId,
            participantName:wire.participantName,
            characterName:wire.participantName,
            state:"connected",
            ready:false,
            stateChanges:[`${wire.participantName} connected`],
            provenance:[existingParticipant?"host-authoritative participant reconnect":"host-authoritative participant handshake"],
          },
        });
        applyParticipantPayload(adapter,participantEvent.payload as Extract<ConnectedEventPayload,{kind:"participant"}>);
        const participantCommitted=ledger.cursor>cursorBeforeParticipant;
        const topologyEvent=participantCommitted?ledger.commitHostEvent({
          actorId:"host",
          payload:{
            kind:"scene-topology",
            topology:sceneTopology(app.scene),
            stateChanges:[`${app.scene.entities.length} Scene actors synchronized`],
            provenance:["host-authoritative Character join topology"],
          },
        }):undefined;
        for (const peer of state.peerParticipants.keys()) {
          if (peer!==message.peer) {
            const outbound=topologyEvent?[participantEvent,topologyEvent]:[participantEvent];
            await sendConnectedWireTo(peer,{type:"event-batch",sessionId:ledger.sessionId,afterCursor:participantEvent.sequence-1,events:outbound}).catch(()=>undefined);
          }
        }
        events=ledger.eventsAfter(wire.knownEventCursor);
      }
    }
    await sendConnectedWireTo(message.peer,{type:"hello-ack",sessionId:ledger.sessionId,sessionName:app.session.name,compatibility,hostCursor:ledger.cursor,events});
    await publishConnectedSnapshot(adapter);
    return;
  }

  if (wire.type==="ready-intent") {
    if (wire.sessionId!==ledger.sessionId) {
      await sendConnectedWireTo(message.peer,{type:"error",code:"session-mismatch",message:`expected ${ledger.sessionId}, received ${wire.sessionId}`,hostCursor:ledger.cursor});
      return;
    }
    if (state.sessionStarted) {
      await sendConnectedWireTo(message.peer,{type:"error",code:"session-live",message:"Ready can only change before the Host starts play.",hostCursor:ledger.cursor});
      return;
    }
    const participantId=state.peerParticipants.get(message.peer);
    const manifest=state.peerManifests.get(message.peer);
    const participant=participantId ? app.session.participants.find((entry)=>entry.id===participantId) : undefined;
    if (!participantId||!manifest||!participant||participant.state!=="connected") {
      await sendConnectedWireTo(message.peer,{type:"error",code:"ready-not-authorized",message:"Ready intent requires an accepted connected participant handshake.",hostCursor:ledger.cursor});
      return;
    }
    if (ledger.handshake(manifest).status==="incompatible") {
      await sendConnectedWireTo(message.peer,{type:"error",code:"ready-incompatible",message:"Incompatible participants cannot become Ready.",hostCursor:ledger.cursor});
      return;
    }
    const event=ledger.commitHostEvent({
      actorId:participantId,
      payload:{
        kind:"participant",
        participantId,
        participantName:participant.name,
        characterName:participant.characterName,
        state:"connected",
        ready:wire.ready,
        stateChanges:[`${participant.name} Ready = ${wire.ready}`],
        provenance:["host-authoritative ready intent"],
      },
    });
    applyParticipantPayload(adapter,event.payload as Extract<ConnectedEventPayload,{kind:"participant"}>);
    await broadcastConnectedWire({type:"event-batch",sessionId:ledger.sessionId,afterCursor:event.sequence-1,events:[event]});
    await publishConnectedSnapshot(adapter);
    return;
  }

  if (wire.type==="catchup-request") {
    if (wire.sessionId!==ledger.sessionId) {
      await sendConnectedWireTo(message.peer,{type:"error",code:"session-mismatch",message:`expected ${ledger.sessionId}, received ${wire.sessionId}`,hostCursor:ledger.cursor});
      return;
    }
    try {
      await sendConnectedWireTo(message.peer,{type:"event-batch",sessionId:ledger.sessionId,afterCursor:wire.afterCursor,events:ledger.eventsAfter(wire.afterCursor)});
    } catch(error) {
      await sendConnectedWireTo(message.peer,{type:"error",code:"invalid-event-cursor",message:error instanceof Error?error.message:String(error),hostCursor:ledger.cursor});
    }
    return;
  }

  if (wire.type==="action-request") {
    const routed=await routeConnectedActionRequest(adapter,message,wire.request);
    if (!routed) {
      await sendConnectedWireTo(message.peer,{type:"error",code:"action-route-unavailable",message:"connected ActionRequest router is unavailable",hostCursor:ledger.cursor});
    }
    return;
  }

  if(wire.type==="resolution-interrupt-response"){
    const routed=await routeConnectedInterruptResponse(adapter,message,wire.response);
    if(!routed) await sendConnectedWireTo(message.peer,{type:"error",code:"interrupt-route-unavailable",message:"connected interrupt response router is unavailable",hostCursor:ledger.cursor});
    return;
  }
  if(wire.type==="resolution-concentration-response"){
    const routed=await routeConnectedConcentrationResponse(adapter,message,wire.response);
    if(!routed)await sendConnectedWireTo(message.peer,{type:"error",code:"concentration-route-unavailable",message:"connected concentration response router is unavailable",hostCursor:ledger.cursor});
  }
}

async function handleClientMessage(adapter:MockAdapter,wire:ConnectedWireMessage) {
  const state=connectedStateFor(adapter);
  const app=connectedInternal(adapter);
  if (wire.type==="session-ended") {
    if (!state.sessionId||wire.sessionId!==state.sessionId) {
      app.session.compatibility="warning";
      app.session.compatibilityMessage=`Ignored session end for another session: ${wire.sessionId}.`;
      await publishConnectedSnapshot(adapter);
      return;
    }
    resetConnectedSessionTransientState(adapter,`Session ended by Host · ${wire.reason}`);
    await tauriSessionTransport.stop().catch(()=>undefined);
    await publishConnectedSnapshot(adapter);
    return;
  }
  if (wire.type==="hello-ack") {
    clearClientHandshakeRetry(adapter);
    state.sessionId=wire.sessionId;
    if (wire.sessionName) app.session.name=wire.sessionName;
    if (!state.replica || state.replica.sessionId!==wire.sessionId) state.replica=new ClientSessionReplica(wire.sessionId);
    app.session.compatibility=wire.compatibility.status;
    app.session.compatibilityMessage=wire.compatibility.message;
    if (wire.compatibility.status==="incompatible") {
      state.mode=null;
      app.connectionState="disconnected";
      await tauriSessionTransport.stop();
      await publishConnectedSnapshot(adapter);
      return;
    }
    const localId=`client:${app.activeCharacter.id}`;
    const preserved=app.session.participants.filter((entry)=>entry.id!=="host"&&entry.id!==localId);
    app.session.participants=[
      {id:"host",name:"DM Host",state:"connected",ready:false},
      ...preserved,
      {id:localId,name:"Local Player",characterName:app.activeCharacter.name,state:"connected",ready:false},
    ];
    const applied=await applyConnectedClientEvents(adapter,wire.events);
    if (applied.status==="rejected") {
      app.session.compatibility="warning";
      app.session.compatibilityMessage=applied.error;
    } else {
      app.connectionState="connected";
      state.reconnectAttempts=0;
    }
    await publishConnectedSnapshot(adapter);
    return;
  }

  if (wire.type==="event-batch") {
    if (!state.replica || wire.sessionId!==state.replica.sessionId) {
      app.session.compatibility="warning";
      app.session.compatibilityMessage="received an event batch for a different or uninitialized session";
      await publishConnectedSnapshot(adapter);
      return;
    }
    const applied=await applyConnectedClientEvents(adapter,wire.events);
    if (applied.status==="rejected") {
      app.session.compatibility="warning";
      app.session.compatibilityMessage=applied.error;
    }
    await publishConnectedSnapshot(adapter);
    return;
  }

  if (wire.type==="resolution-presentation") {
    if (!state.sessionId||wire.sessionId!==state.sessionId) {
      app.session.compatibility="warning";
      app.session.compatibilityMessage="received a Resolution presentation for a different or uninitialized session";
    } else {
      const applied=applyConnectedResolutionPresentation(adapter,wire.presentation);
      if (applied.status==="rejected") {
        app.session.compatibility="warning";
        app.session.compatibilityMessage=applied.error;
      }
    }
    await publishConnectedSnapshot(adapter);
    return;
  }

  if(wire.type==="resolution-interrupt-prompt"){
    const applied=applyConnectedInterruptPrompt(adapter,wire);
    if(applied.status==="rejected"){app.session.compatibility="warning";app.session.compatibilityMessage=applied.error;}
    await publishConnectedSnapshot(adapter);
    return;
  }
  if(wire.type==="resolution-concentration-prompt"){
    const applied=applyConnectedConcentrationPrompt(adapter,wire);
    if(applied.status==="rejected"){app.session.compatibility="warning";app.session.compatibilityMessage=applied.error;}
    await publishConnectedSnapshot(adapter);return;
  }

  if (wire.type==="error") {
    app.session.compatibility="warning";
    app.session.compatibilityMessage=`${wire.code}: ${wire.message}`;
    await publishConnectedSnapshot(adapter);
  }
}

async function handleMessage(adapter:MockAdapter,message:SessionTransportMessage) {
  const decoded=decodeConnectedWireMessage(message.message);
  const state=connectedStateFor(adapter);
  if (decoded.status==="rejected") {
    if (state.mode==="host") {
      await sendConnectedWireTo(message.peer,{type:"error",code:"malformed-wire",message:decoded.error}).catch(()=>undefined);
    } else {
      const app=connectedInternal(adapter);
      app.session.compatibility="warning";
      app.session.compatibilityMessage=decoded.error;
      await publishConnectedSnapshot(adapter);
    }
    return;
  }
  if (state.mode==="host") await handleHostMessage(adapter,message,decoded.message);
  else if (state.mode==="client") await handleClientMessage(adapter,decoded.message);
}

async function ensureListeners(adapter:MockAdapter) {
  const state=connectedStateFor(adapter);
  if (state.listenersInstalled || !tauriSessionTransport.available()) return;
  state.listenersInstalled=true;
  await tauriSessionTransport.onMessage((message)=>{ void handleMessage(adapter,message); });
  await tauriSessionTransport.onState((status)=>{
    const current=connectedStateFor(adapter);
    if (current.mode==="client"&&status.state==="disconnected"&&current.sessionId) {
      if (current.reconnectInFlight) {
        connectedInternal(adapter).connectionState="reconnecting";
        void publishConnectedSnapshot(adapter);
        return;
      }
      setTransportStatus(adapter,status);
      scheduleClientReconnect(adapter);
      return;
    }
    setTransportStatus(adapter,status);
    void publishConnectedSnapshot(adapter);
  });
}

MockAdapter.prototype.hostSession=async function hostConnectedSession() {
  const app=connectedInternal(this);
  const state=connectedStateFor(this);
  if (!tauriSessionTransport.available()) {
    state.mode=null;
    app.session.role="offline";
    app.connectionState="disconnected";
    app.session.compatibility="incompatible";
    app.session.compatibilityMessage="Remote hosting requires the Tauri desktop runtime.";
    return app.getSnapshot();
  }
  await ensureListeners(this);
  const status=await tauriSessionTransport.startHost("0.0.0.0:3210");
  clearReadyActionConfiguration(this);
  resetConnectedState(this,"host");
  const nextState=connectedStateFor(this);
  nextState.listenersInstalled=true;
  const sessionId=`session.${Date.now().toString(36)}`;
  nextState.sessionId=sessionId;
  nextState.ledger=new HostSessionLedger(sessionId,connectedManifest(this));
  setTransportStatus(this,status);
  app.session.role="host";
  app.session.compatibility="compatible";
  app.session.compatibilityMessage="Host authority active · waiting for compatible clients.";
  app.session.participants=[{id:"host",name:"DM Host",state:"connected",ready:false}];
  return app.getSnapshot();
};

MockAdapter.prototype.joinSession=async function joinConnectedSession(address:string) {
  const app=connectedInternal(this);
  const state=connectedStateFor(this);
  const target=address.trim();
  if (!target) {
    app.connectionState="disconnected";
    app.session.compatibility="incompatible";
    app.session.compatibilityMessage="Host address is required.";
    return app.getSnapshot();
  }
  if (!tauriSessionTransport.available()) {
    state.mode=null;
    app.session.role="offline";
    app.connectionState="disconnected";
    app.session.compatibility="incompatible";
    app.session.compatibilityMessage="Remote join requires the Tauri desktop runtime.";
    return app.getSnapshot();
  }
  await ensureListeners(this);
  const status=await tauriSessionTransport.connectClient(target);
  clearReadyActionConfiguration(this);
  resetConnectedState(this,"client");
  const nextState=connectedStateFor(this);
  nextState.listenersInstalled=true;
  setTransportStatus(this,status);
  app.session.role="client";
  app.session.address=target;
  app.session.compatibility="warning";
  app.session.compatibilityMessage="Transport connected · waiting for host compatibility handshake.";
  await sendClientHello(this,0);
  scheduleClientHandshakeRetry(this);
  return app.getSnapshot();
};
