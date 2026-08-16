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
import { tauriSessionTransport, type SessionTransportMessage, type SessionTransportStatus } from "./tauriSessionTransport";

const CONNECTED_CAPABILITIES=["resolution-event-v1","character-projection-v1","event-cursor-v1"];

interface ConnectedAdapterState {
  role:"player"|"dm";
  connectionState:ConnectionState;
  session:AppSnapshot["session"];
  scene:SceneVm;
  activeCharacter:CharacterSheet;
  characters:CharacterSummary[];
  activity:ActivityEntry[];
  syncChar():void;
  getSnapshot():Promise<AppSnapshot>;
}

interface ConnectedRuntimeState {
  mode:"host"|"client"|null;
  sessionId:string|null;
  ledger:HostSessionLedger|null;
  replica:ClientSessionReplica|null;
  listenersInstalled:boolean;
}

const states=new WeakMap<MockAdapter,ConnectedRuntimeState>();

function runtimeFor(adapter:MockAdapter) {
  let state=states.get(adapter);
  if (!state) {
    state={ mode:null,sessionId:null,ledger:null,replica:null,listenersInstalled:false };
    states.set(adapter,state);
  }
  return state;
}

function internal(adapter:MockAdapter) {
  return adapter as unknown as ConnectedAdapterState;
}

function manifest(adapter:MockAdapter):SessionCompatibilityManifest {
  const character=internal(adapter).activeCharacter;
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

async function publish(adapter:MockAdapter) {
  publishExternalAdapterSnapshot(await internal(adapter).getSnapshot());
}

function setTransportStatus(adapter:MockAdapter,status:SessionTransportStatus) {
  const app=internal(adapter);
  app.connectionState=status.state;
  if (status.address) app.session.address=status.address;
  if (status.role) app.session.role=status.role;
  if (status.state==="disconnected") {
    app.session.participants=app.session.participants.map((participant)=>({ ...participant,state:"disconnected" as const }));
  }
}

async function sendTo(peer:string,message:ConnectedWireMessage) {
  await tauriSessionTransport.sendTo(peer,encodeConnectedWireMessage(message));
}

async function applyConfirmedPayload(adapter:MockAdapter,payload:ConnectedEventPayload,event:ConnectedSessionEvent) {
  if (payload.kind!=="resolution") return { status:"committed" as const };
  const app=internal(adapter);
  const projected=applyResolutionEvents(app.scene,payload.resolutionEvents,app.activeCharacter.resources,app.activeCharacter.items);
  if (projected.status==="rejected") return projected;

  const writeBack=await persistCharacterResolutionEvents(adapter,payload.resolutionEvents,"forward");
  if (writeBack.status==="rejected") return { status:"rejected" as const,error:`Character write-back failed after host confirmation: ${writeBack.error}` };

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

async function applyClientEvents(adapter:MockAdapter,events:ConnectedSessionEvent[]) {
  const state=runtimeFor(adapter);
  if (!state.replica) return { status:"rejected" as const,error:"client replica is not initialized",cursor:0 };
  return state.replica.applyBatchAsync(events,(payload,event)=>applyConfirmedPayload(adapter,payload,event));
}

async function handleHostMessage(adapter:MockAdapter,message:SessionTransportMessage,wire:ConnectedWireMessage) {
  const state=runtimeFor(adapter);
  const app=internal(adapter);
  const ledger=state.ledger;
  if (!ledger) return;

  if (wire.type==="hello") {
    const compatibility=ledger.handshake(wire.manifest);
    let events:ConnectedSessionEvent[]=[];
    if (compatibility.status!=="incompatible") {
      try { events=ledger.eventsAfter(wire.knownEventCursor); }
      catch(error) {
        await sendTo(message.peer,{type:"error",code:"invalid-event-cursor",message:error instanceof Error?error.message:String(error),hostCursor:ledger.cursor});
        return;
      }
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
    await sendTo(message.peer,{type:"hello-ack",sessionId:ledger.sessionId,compatibility,hostCursor:ledger.cursor,events});
    await publish(adapter);
    return;
  }

  if (wire.type==="catchup-request") {
    if (wire.sessionId!==ledger.sessionId) {
      await sendTo(message.peer,{type:"error",code:"session-mismatch",message:`expected ${ledger.sessionId}, received ${wire.sessionId}`,hostCursor:ledger.cursor});
      return;
    }
    try {
      await sendTo(message.peer,{type:"event-batch",sessionId:ledger.sessionId,afterCursor:wire.afterCursor,events:ledger.eventsAfter(wire.afterCursor)});
    } catch(error) {
      await sendTo(message.peer,{type:"error",code:"invalid-event-cursor",message:error instanceof Error?error.message:String(error),hostCursor:ledger.cursor});
    }
    return;
  }

  if (wire.type==="action-request") {
    await sendTo(message.peer,{type:"error",code:"action-route-pending",message:"connected ActionRequest reached the authoritative host; product resolution routing is the next Phase 12 slice",hostCursor:ledger.cursor});
  }
}

async function handleClientMessage(adapter:MockAdapter,wire:ConnectedWireMessage) {
  const state=runtimeFor(adapter);
  const app=internal(adapter);
  if (wire.type==="hello-ack") {
    state.sessionId=wire.sessionId;
    if (!state.replica || state.replica.sessionId!==wire.sessionId) state.replica=new ClientSessionReplica(wire.sessionId);
    app.session.compatibility=wire.compatibility.status;
    app.session.compatibilityMessage=wire.compatibility.message;
    if (wire.compatibility.status==="incompatible") {
      app.connectionState="disconnected";
      await tauriSessionTransport.stop();
      await publish(adapter);
      return;
    }
    const applied=await applyClientEvents(adapter,wire.events);
    if (applied.status==="rejected") {
      app.session.compatibility="warning";
      app.session.compatibilityMessage=applied.error;
    }
    app.session.participants=[
      {id:"host",name:"DM Host",state:"connected"},
      {id:`client:${app.activeCharacter.id}`,name:"Local Player",characterName:app.activeCharacter.name,state:"connected"},
    ];
    await publish(adapter);
    return;
  }

  if (wire.type==="event-batch") {
    if (!state.replica || wire.sessionId!==state.replica.sessionId) {
      app.session.compatibility="warning";
      app.session.compatibilityMessage="received an event batch for a different or uninitialized session";
      await publish(adapter);
      return;
    }
    const applied=await applyClientEvents(adapter,wire.events);
    if (applied.status==="rejected") {
      app.session.compatibility="warning";
      app.session.compatibilityMessage=applied.error;
    }
    await publish(adapter);
    return;
  }

  if (wire.type==="error") {
    app.session.compatibility="warning";
    app.session.compatibilityMessage=`${wire.code}: ${wire.message}`;
    await publish(adapter);
  }
}

async function handleMessage(adapter:MockAdapter,message:SessionTransportMessage) {
  const decoded=decodeConnectedWireMessage(message.message);
  const state=runtimeFor(adapter);
  if (decoded.status==="rejected") {
    if (state.mode==="host") {
      await sendTo(message.peer,{type:"error",code:"malformed-wire",message:decoded.error,state:undefined} as never).catch(()=>undefined);
    } else {
      const app=internal(adapter);
      app.session.compatibility="warning";
      app.session.compatibilityMessage=decoded.error;
      await publish(adapter);
    }
    return;
  }
  if (state.mode==="host") await handleHostMessage(adapter,message,decoded.message);
  else if (state.mode==="client") await handleClientMessage(adapter,decoded.message);
}

async function ensureListeners(adapter:MockAdapter) {
  const state=runtimeFor(adapter);
  if (state.listenersInstalled || !tauriSessionTransport.available()) return;
  state.listenersInstalled=true;
  await tauriSessionTransport.onMessage((message)=>{ void handleMessage(adapter,message); });
  await tauriSessionTransport.onState((status)=>{
    setTransportStatus(adapter,status);
    void publish(adapter);
  });
}

MockAdapter.prototype.hostSession=async function hostConnectedSession() {
  const app=internal(this);
  const state=runtimeFor(this);
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
  const sessionId=`session.${Date.now().toString(36)}`;
  state.mode="host";
  state.sessionId=sessionId;
  state.replica=null;
  state.ledger=new HostSessionLedger(sessionId,manifest(this));
  setTransportStatus(this,status);
  app.session.role="host";
  app.session.compatibility="compatible";
  app.session.compatibilityMessage="Host authority active · waiting for compatible clients.";
  app.session.participants=[{id:"host",name:"DM Host",state:"connected"}];
  return app.getSnapshot();
};

MockAdapter.prototype.joinSession=async function joinConnectedSession(address:string) {
  const app=internal(this);
  const state=runtimeFor(this);
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
  state.mode="client";
  state.sessionId=null;
  state.ledger=null;
  state.replica=null;
  setTransportStatus(this,status);
  app.session.role="client";
  app.session.address=target;
  app.session.compatibility="warning";
  app.session.compatibilityMessage="Transport connected · waiting for host compatibility handshake.";
  await tauriSessionTransport.send(encodeConnectedWireMessage({
    type:"hello",
    manifest:manifest(this),
    participantId:`client:${app.activeCharacter.id}`,
    participantName:app.activeCharacter.name,
    knownEventCursor:0,
  }));
  return app.getSnapshot();
};
