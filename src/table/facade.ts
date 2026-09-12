import type { AppSnapshot, CharacterSheet, ResolutionVisibilityVm, SessionMode, SessionParticipantVm } from "../app/contracts";
import "../app/productionSessionLifecycleAdapter";
import type { MockAdapter } from "../app/mockAdapter";
import { publishExternalAdapterSnapshot } from "../app/adapterSnapshotEvents";
import { isSrdMonsterId } from "../app/srdMonsterCatalog";
import { sessionDebugPreviewRoleFor } from "../app/sessionDebugPreviewRole";
import type { ReadyActionConfiguration } from "../app/standardActionReadyState";
import { tauriSessionTransport } from "../app/tauriSessionTransport";
import { CONDITION_IDS } from "./actors";
import { conditionLabelKo } from "../app/srdMonsterCatalog";
import { TableClient } from "./client";
import { HOST_ORIGIN, type CommandOrigin, type TableCommand } from "./commands";
import { queuedDice, randomDice } from "./dice";
import { TableHost } from "./host";
import { projectTable, type TableViewer } from "./project";
import type { TableRefusal } from "./refusal";
import { TableRuntime, type Outcome } from "./runtime";
import { MemoryTransportHub, tauriTableTransport, type TableTransport } from "./transport";

export const LOCAL_PLAYER_PEER="peer.local";

/** How the facade reaches other peers: an injected hub (tests, previews), the desktop transport, or nothing (solo). */
export interface TableFacadeTransportOptions {
  hub?:MemoryTransportHub;
  /** This peer's id on the hub when joining as a client. */
  peerId?:string;
}

/**
 * The session facade (TABLE_RUNTIME.md §6): the old screens keep calling the adapter surface they know; the session
 * subset is answered by the table runtime and merged into the base snapshot. Everything outside the session (character
 * library, creation, campaign) still goes to the base adapter. At switch-over (T2-07) this becomes the app's adapter.
 */
export interface TableSessionFacade {
  readonly runtime:TableRuntime;
  readonly adapter:MockAdapter;
  readonly host:TableHost|null;
  readonly client:TableClient|null;
  readonly mode:"offline"|"host"|"client";
  /** Dispatch from outside the screens (scripts, tests) and push the merged snapshot to the provider. */
  dispatch(command:TableCommand,origin?:CommandOrigin):Promise<Outcome>;
  /** Seed the local character as a controlled ally when the table has no actors yet. */
  ensureLocalCharacter():Promise<void>;
}

const CONDITION_BY_LABEL=new Map(CONDITION_IDS.map((id)=>[conditionLabelKo(id),id]));
const NARRATIVE_ALIASES:Record<string,string>={"매혹됨":"charmed","실명":"blinded","기절":"stunned","무의식":"unconscious","포박":"restrained","마비":"paralyzed","중독됨":"poisoned","공포":"frightened","붙잡힘":"grappled","넘어짐":"prone"};

export function createTableSessionFacade(base:MockAdapter,options:{runtime?:TableRuntime;origin?:CommandOrigin;transport?:TableFacadeTransportOptions}={}):TableSessionFacade {
  const dice=queuedDice([],randomDice());
  const runtime=options.runtime??new TableRuntime({sessionId:"table.preview",dice});
  const origin=options.origin??HOST_ORIGIN;
  let selectedActorId:string|null=null;
  let dismissedResolutionId:string|null=null;

  // Connected play (§3): the Host runs the runtime and broadcasts; a client holds a replica and sends commands.
  let mode:"offline"|"host"|"client"="offline";
  let host:TableHost|null=null;
  let client:TableClient|null=null;
  let address="";
  let usingDesktopTransport=false;
  let unsubscribeClient:(()=>void)|null=null;

  const activeRuntime=()=>client?client.runtime:runtime;
  const activeRefusal=():(TableRefusal&{id:number})|null=>client?client.lastRefusal:runtime.lastRefusal;

  // The DM is whoever hosts (or previews as the DM); the base adapter's own role field lags behind the preview toggle.
  const isDm=(snapshot:AppSnapshot)=>mode==="client"?false:mode==="host"||sessionDebugPreviewRoleFor(base)==="dm"||snapshot.role==="dm"||snapshot.session.role==="host";
  const viewerFor=(snapshot:AppSnapshot):TableViewer=>mode==="client"?{role:"player",peerId:client?.peerId??LOCAL_PLAYER_PEER}:isDm(snapshot)?{role:"dm",peerId:HOST_ORIGIN.peerId}:{role:"player",peerId:LOCAL_PLAYER_PEER};
  const originFor=(snapshot:AppSnapshot):CommandOrigin=>isDm(snapshot)?origin:{peerId:LOCAL_PLAYER_PEER,role:"player"};

  const participants=(state:TableRuntime["state"]):SessionParticipantVm[]=>{
    const list:SessionParticipantVm[]=[{id:"host",name:"DM Host",state:"connected"}];
    for(const actor of Object.values(state.actors)) {
      if(actor.source.kind!=="character"||!actor.controllerPeer||actor.controllerPeer===HOST_ORIGIN.peerId||actor.controllerPeer===LOCAL_PLAYER_PEER) continue;
      const peer=host?.peers.get(actor.controllerPeer);
      list.push({id:`client:${actor.id}`,name:peer?.name??actor.name,characterName:actor.name,state:peer?(peer.connected?"connected":"disconnected"):"connected"});
    }
    return list;
  };

  const merged=async():Promise<AppSnapshot>=>{
    const snapshot=await base.getSnapshot();
    const state=activeRuntime().state;
    const view=projectTable(state,viewerFor(snapshot),activeRefusal());
    const ids=view.scene.entities.map((entity)=>entity.id);
    if(!selectedActorId||!ids.includes(selectedActorId)) selectedActorId=state.currentActorId&&ids.includes(state.currentActorId)?state.currentActorId:ids[0]??null;
    const resolution=view.resolution&&view.resolution.id!==dismissedResolutionId?view.resolution:null;
    const session=mode==="offline"?snapshot.session:{
      ...snapshot.session,
      name:snapshot.session.name||"테이블",
      address,
      role:mode,
      lifecycle:"live" as const,
      compatibility:"compatible" as const,
      compatibilityMessage:mode==="host"?(usingDesktopTransport?"Host 권위 활성 · 참가자를 기다립니다.":"로컬 테이블 (솔로 플레이) · 네트워크 없음"):"Host 권위에 연결됨.",
      participants:participants(state),
    };
    return {
      ...snapshot,
      session,
      connectionState:mode==="offline"?snapshot.connectionState:"connected",
      sessionMode:view.sessionMode,
      scene:{...view.scene,name:snapshot.scene.name||"테이블",selectedActorId:selectedActorId??""},
      activity:view.activity,
      resolution,
      resolutionPresentation:null,
      refusal:view.refusal?{...view.refusal,origin:mode==="client"?"host":"local"}:null,
    };
  };

  const run=async(command:TableCommand,commandOrigin?:CommandOrigin):Promise<Outcome>=>{
    const snapshot=await base.getSnapshot();
    if(client) {
      const reply=await client.send(command);
      if(reply.status==="committed") { dismissedResolutionId=null; return {status:"committed",events:[],resolution:client.runtime.state.activeResolution}; }
      return {status:"refused",refusal:{...reply.refusal,id:client.lastRefusal?.id??0}};
    }
    const outcome=host?host.dispatch(command,commandOrigin??originFor(snapshot)):runtime.dispatch(command,commandOrigin??originFor(snapshot));
    if(outcome.status==="committed"&&outcome.events.some((event)=>event.payload.type==="rules-committed"&&event.payload.resolution)) dismissedResolutionId=null;
    return outcome;
  };

  const localPeerId=()=>options.transport?.peerId??LOCAL_PLAYER_PEER;

  const hostSession=async():Promise<AppSnapshot>=>{
    if(mode==="host") return merged();
    if(client) { client.close(); unsubscribeClient?.(); client=null; }
    let transport:TableTransport;
    if(options.transport?.hub) transport=options.transport.hub.host;
    else if(tauriSessionTransport.available()) {
      const status=await tauriSessionTransport.startHost("0.0.0.0:3210");
      address=status.address;
      usingDesktopTransport=true;
      transport=tauriTableTransport(tauriSessionTransport);
    } else transport=new MemoryTransportHub().host; // solo: the table runs locally, no network
    await ensureLocalCharacter();
    host=new TableHost(runtime,transport,{sessionId:runtime.state.sessionId});
    mode="host";
    return merged();
  };

  const joinSession=async(target:string):Promise<AppSnapshot>=>{
    if(host) { host.close(); host=null; }
    if(client) { client.close(); unsubscribeClient?.(); client=null; }
    const snapshot=await base.getSnapshot();
    const sheet=snapshot.activeCharacter as CharacterSheet;
    let transport:TableTransport;
    if(options.transport?.hub) transport=options.transport.hub.client(localPeerId());
    else if(tauriSessionTransport.available()) {
      await tauriSessionTransport.connectClient(target.trim());
      usingDesktopTransport=true;
      transport=tauriTableTransport(tauriSessionTransport);
    } else throw new Error("원격 참가에는 데스크톱 런타임이 필요합니다.");
    address=target.trim();
    client=new TableClient(transport,{participantId:`client:${sheet.id}`,name:sheet.name,sheet,onDurableSheet:async(next)=>{ await persistDurableSheet(next); }});
    unsubscribeClient=client.subscribe(()=>{ void merged().then(publishExternalAdapterSnapshot); });
    mode="client";
    client.hello();
    return merged();
  };

  const stopSession=async():Promise<AppSnapshot>=>{
    if(host) { host.close(); host=null; }
    if(client) { client.close(); unsubscribeClient?.(); client=null; }
    if(usingDesktopTransport) { await tauriSessionTransport.stop(); usingDesktopTransport=false; }
    mode="offline"; address="";
    return merged();
  };

  /** The owner's durable sheet: the base adapter still owns the library, so the write-back goes through it when it can. */
  const persistDurableSheet=async(sheet:CharacterSheet)=>{
    const persist=(base as unknown as {persistTableSheet?:(sheet:CharacterSheet)=>Promise<unknown>}).persistTableSheet;
    if(persist) await persist.call(base,sheet);
  };

  const actorForAction=(snapshot:AppSnapshot,actionId:string)=>{
    const preferred=isDm(snapshot)?selectedActorId:snapshot.activeCharacter.id;
    if(preferred&&runtime.state.actors[preferred]&&projectTable(runtime.state,viewerFor(snapshot)).scene.actionsByActor[preferred]?.some((action)=>action.id===actionId)) return preferred;
    const view=projectTable(runtime.state,viewerFor(snapshot));
    return Object.keys(view.scene.actionsByActor).find((id)=>view.scene.actionsByActor[id].some((action)=>action.id===actionId))??preferred??null;
  };

  const ensureLocalCharacter=async()=>{
    if(client) return;
    const snapshot=await base.getSnapshot();
    const sheet=snapshot.activeCharacter as CharacterSheet;
    if(!sheet?.id||runtime.state.actors[sheet.id]) return;
    runtime.dispatch({type:"add-actors",specs:[{kind:"character",sheet,controllerPeer:LOCAL_PLAYER_PEER,side:"ally"}]},HOST_ORIGIN);
  };

  const overrides:Partial<Record<keyof MockAdapter,unknown>>={
    getSnapshot:async()=>{await ensureLocalCharacter();return merged();},
    resolveAction:async(actionId:string,targetIds:string[])=>{
      const snapshot=await base.getSnapshot();
      const actorId=actorForAction(snapshot,actionId);
      if(actorId) await run({type:"act",actorId,actionId,targetIds});
      return merged();
    },
    advanceResolution:async()=>merged(),
    dismissResolution:async()=>{dismissedResolutionId=runtime.state.activeResolution?.id??null;return merged();},
    undoLastResolution:async()=>{await run({type:"undo"});return merged();},
    respondToInterrupt:async(accept:boolean)=>{
      const state=activeRuntime().state;
      const peer=mode==="client"?client?.peerId:mode==="host"?HOST_ORIGIN.peerId:LOCAL_PLAYER_PEER;
      const question=state.questions.find((entry)=>entry.toPeer===peer)??(mode!=="client"?state.questions[0]:undefined);
      if(!question) return merged();
      const option=accept?question.options.find((entry)=>entry.id!=="decline"&&entry.id!=="hold"&&entry.id!=="deny"):question.options.find((entry)=>entry.id==="decline"||entry.id==="hold"||entry.id==="deny");
      if(option) await run({type:"answer-question",questionId:question.id,optionId:option.id}); else if(mode!=="client") await run({type:"skip-question",questionId:question.id});
      return merged();
    },
    applyDmAdjudication:async()=>merged(),
    configureReadyAction:async(command:ReadyActionConfiguration)=>{ await run({type:"ready",actorId:command.actorId,actionId:command.actionId,trigger:command.trigger}); return merged(); },
    hostSession,
    joinSession,
    stopSession,
    setSessionReady:async()=>merged(),
    startPreparedSession:async(mode:SessionMode)=>{ if(mode==="initiative"&&activeRuntime().state.mode!=="initiative") await run({type:"start-initiative"}); return merged(); },
    setNextResolutionVisibility:async(visibility:ResolutionVisibilityVm|null)=>{
      const wanted=visibility&&(visibility as unknown as {mode?:string;visibility?:string}).mode==="dm-only"?"dm":visibility&&(visibility as unknown as {visibility?:string}).visibility==="dm-only"?"dm":"public";
      if(runtime.state.rollVisibility!==wanted) await run({type:"set-roll-visibility",visibility:wanted});
      return merged();
    },
    selectDmActor:async(id:string)=>{if(runtime.state.actors[id]) selectedActorId=id;return merged();},
    startInitiative:async()=>{await run({type:"start-initiative"});return merged();},
    endInitiative:async()=>{await run({type:"end-initiative"});return merged();},
    endTurn:async()=>{await run({type:"end-turn"});return merged();},
    setSessionMode:async(mode:SessionMode)=>{
      if(mode==="initiative"&&runtime.state.mode!=="initiative") await run({type:"start-initiative"});
      if(mode==="freeform"&&runtime.state.mode!=="freeform") await run({type:"end-initiative"});
      return merged();
    },
    setCurrentActor:async(id:string)=>{if(runtime.state.mode==="initiative") await run({type:"set-current-actor",actorId:id}); selectedActorId=id; return merged();},
    setQueuedD20:async(value:number|null)=>{if(value!==null) dice.push(value,value);await base.setQueuedD20(value);return merged();},
    instantiateCombatant:async(definitionId:string)=>{
      if(isSrdMonsterId(definitionId)) await run({type:"add-actors",specs:[{kind:"monster",monsterId:definitionId}]});
      return merged();
    },
    instantiateCombatantGroup:async(definitionId:string,count:number,label?:string)=>{
      if(isSrdMonsterId(definitionId)) await run({type:"add-actors",specs:[{kind:"monster",monsterId:definitionId,count,...(label?{name:label}:{})}]});
      return merged();
    },
    removeCombatant:async(id:string)=>{await run({type:"remove-actor",actorId:id});return merged();},
    applyNarrativeDamage:async(entityId:string,amount:number|"half")=>{
      const combatant=runtime.state.rules.combatants[entityId];
      if(combatant) {
        const value=amount==="half"?Math.floor(combatant.life.hp.current/2):amount;
        if(value>0) await run({type:"ruling",targetIds:[entityId],ruling:{kind:"damage",amount:value}});
        else if(value<0) await run({type:"ruling",targetIds:[entityId],ruling:{kind:"heal",amount:-value}});
      }
      return merged();
    },
    setCreatureStatus:async(entityId:string,status:string,on:boolean)=>{
      const conditionId=CONDITION_BY_LABEL.get(status)??(NARRATIVE_ALIASES[status] as import("../domain/conditions").ConditionId|undefined);
      if(conditionId) await run({type:"ruling",targetIds:[entityId],ruling:{kind:"condition",conditionId,on}});
      return merged();
    },
    setEngagement:async(leftId:string,rightId:string,engaged:boolean)=>{await run({type:"ruling",targetIds:[leftId],ruling:{kind:"engage",otherId:rightId,on:engaged}});return merged();},
  };

  const adapter=new Proxy(base,{
    get(target,property,receiver) {
      if(typeof property==="string"&&property in overrides) return overrides[property as keyof MockAdapter];
      const value=Reflect.get(target,property,receiver);
      return typeof value==="function"?value.bind(target):value;
    },
  }) as MockAdapter;

  return {
    runtime,
    adapter,
    async dispatch(command,commandOrigin=HOST_ORIGIN) {
      const outcome=await run(command,commandOrigin);
      publishExternalAdapterSnapshot(await merged());
      return outcome;
    },
    ensureLocalCharacter,
    get host() { return host; },
    get client() { return client; },
    get mode() { return mode; },
  };
}
