import "./persistenceContracts";
import type { ActivityEntry, AppSnapshot, CharacterSheet, CharacterSummary, ConnectionState, SceneVm } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import {
  CONNECTED_SESSION_PROTOCOL_VERSION,
  ClientSessionReplica,
  HostSessionLedger,
  type ConnectedEventPayload,
  type ConnectedSessionEvent,
  type SessionCompatibilityManifest,
} from "./connectedSessionProtocol";
import { decodeConnectedWireMessage, encodeConnectedWireMessage, type ConnectedWireMessage } from "./connectedSessionWire";
import { applyResolutionEvents } from "./realEventApplyService";
import { persistCharacterResolutionEvents } from "./resolutionCharacterWriteBackPort";
import { SIMPLEVTT_APP_RULES_PROFILE } from "./realResolutionService";
import { publishExternalAdapterSnapshot } from "./adapterSnapshotEvents";
import { connectedStateFor, resetConnectedState } from "./connectedSessionState";
import { routeConnectedActionRequest } from "./connectedActionRequestPort";
import { tauriSessionTransport, type SessionTransportMessage, type SessionTransportStatus } from "./tauriSessionTransport";

export const CONNECTED_CAPABILITIES=["resolution-event-v1","character-projection-v1","event-cursor-v1"];

export interface ConnectedAdapterState {
  role:"player"|"dm";
  connectionState:ConnectionState;
  sessionMode:AppSnapshot["sessionMode"];
  session:AppSnapshot["session"];
  scene:SceneVm;
  activeCharacter:CharacterSheet;
  characters:CharacterSummary[];
  activity:ActivityEntry[];
  syncChar():void;
  getSnapshot():Promise<AppSnapshot>;
}

export function connectedInternal(adapter:MockAdapter) {
  return adapter as unknown as ConnectedAdapterState;
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

function setTransportStatus(adapter:MockAdapter,status:SessionTransportStatus) {
  const app=connectedInternal(adapter);
  app.connectionState=status.state;
  if (status.address) app.session.address=status.address;
  if (status.role) app.session.role=status.role;
  if (status.state==="disconnected") {
    app.session.participants=app.session.participants.map((participant)=>({ ...participant,state:"disconnected" as const }));
  }
}

export async function sendConnectedWireTo(peer:string,message:ConnectedWireMessage) {
  await tauriSessionTransport.sendTo(peer,encodeConnectedWireMessage(message));
}

export async function broadcastConnectedWire(message:ConnectedWireMessage) {
  await tauriSessionTransport.send(encodeConnectedWireMessage(message));
}

async function sendClientHello(adapter:MockAdapter,knownEventCursor:number) {
  const app=connectedInternal(adapter);
  await tauriSessionTransport.send(encodeConnectedWireMessage({
    type:"hello",
    manifest:connectedManifest(adapter),
    participantId:`client:${app.activeCharacter.id}`,
    participantName:app.activeCharacter.name,
    knownEventCursor,
  }));
}

async function applyConfirmedPayload(adapter:MockAdapter,payload:ConnectedEventPayload,event:ConnectedSessionEvent) {
  const app=connectedInternal(adapter);
  if (payload.kind==="mode-transition") {
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
  if (payload.kind!=="resolution") return { status:"committed" as const };
  const projected=applyResolutionEvents(app.scene,payload.resolutionEvents,app.activeCharacter.resources,app.activeCharacter.items);
  if (projected.status==="rejected") return projected;

  const writeBack=await persistCharacterResolutionEvents(adapter,payload.resolutionEvents,"forward");
  if (writeBack.status==="rejected") {
    return { status:"rejected" as const,error:`Character write-back failed after host confirmation: ${writeBack.error}` };
  }

  app.scene=projected.scene;
  app.activeCharacter.resources=projected.resources.map((entry)=>structuredClone(entry));
  app.activeCharacter.items=projected.items.map((entry)=>structuredClone(entry));
  app.syncChar();
  app.activity.unshift({
    id:`connected:${event.eventId}`,
    time:"지금",
    actor:event.actorId ?? "Host",
    title:`원격 Resolution 적용 · ${payload.resolutionId}`,
    summary:`Host event #${event.sequence}`,
    detail:[`eventId=${event.eventId}`,`ResolutionEvent ${payload.resolutionEvents.length}개`,`host-authoritative forward apply`],
    stateChanges:[...projected.stateChanges],
  });
  return { status:"committed" as const };
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
  app.session.participants=app.session.participants.map((participant)=>({ ...participant,state:"reconnecting" as const }));
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

async function handleHostMessage(adapter:MockAdapter,message:SessionTransportMessage,wire:ConnectedWireMessage) {
  const state=connectedStateFor(adapter);
  const app=connectedInternal(adapter);
  const ledger=state.ledger;
  if (!ledger) return;

  if (wire.type==="hello") {
    const compatibility=ledger.handshake(wire.manifest);
    let events:ConnectedSessionEvent[]=[];
    if (compatibility.status!=="incompatible") {
      try { events=ledger.eventsAfter(wire.knownEventCursor); }
      catch(error) {
        await sendConnectedWireTo(message.peer,{type:"error",code:"invalid-event-cursor",message:error instanceof Error?error.message:String(error),hostCursor:ledger.cursor});
        return;
      }
      state.peerManifests.set(message.peer,structuredClone(wire.manifest));
      const existing=app.session.participants.find((entry)=>entry.id===wire.participantId);
      const participant={
        id:wire.participantId,
        name:wire.participantName,
        characterName:wire.manifest.character?.characterId,
        state:"connected" as const,
      };
      app.session.participants=existing
        ? app.session.participants.map((entry)=>entry.id===participant.id ? participant : entry)
        : [...app.session.participants,participant];
    }
    await sendConnectedWireTo(message.peer,{type:"hello-ack",sessionId:ledger.sessionId,compatibility,hostCursor:ledger.cursor,events});
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
  }
}

async function handleClientMessage(adapter:MockAdapter,wire:ConnectedWireMessage) {
  const state=connectedStateFor(adapter);
  const app=connectedInternal(adapter);
  if (wire.type==="hello-ack") {
    state.sessionId=wire.sessionId;
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
    const applied=await applyConnectedClientEvents(adapter,wire.events);
    if (applied.status==="rejected") {
      app.session.compatibility="warning";
      app.session.compatibilityMessage=applied.error;
    } else {
      app.connectionState="connected";
      state.reconnectAttempts=0;
      app.session.participants=[
        {id:"host",name:"DM Host",state:"connected"},
        {id:`client:${app.activeCharacter.id}`,name:"Local Player",characterName:app.activeCharacter.name,state:"connected"},
      ];
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
  app.session.participants=[{id:"host",name:"DM Host",state:"connected"}];
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
  resetConnectedState(this,"client");
  const nextState=connectedStateFor(this);
  nextState.listenersInstalled=true;
  setTransportStatus(this,status);
  app.session.role="client";
  app.session.address=target;
  app.session.compatibility="warning";
  app.session.compatibilityMessage="Transport connected · waiting for host compatibility handshake.";
  await sendClientHello(this,0);
  return app.getSnapshot();
};
