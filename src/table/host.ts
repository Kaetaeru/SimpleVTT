import type { CharacterSheet } from "../app/contracts";
import { HOST_ORIGIN, type CommandOrigin, type TableCommand } from "./commands";
import { applyEvent, type TableEvent } from "./events";
import type { TableViewer } from "./project";
import { redactEventFor, redactStateFor } from "./redact";
import type { TableRefusal } from "./refusal";
import type { Outcome, TableRuntime } from "./runtime";
import { cloneState, type TableState } from "./state";
import type { TableTransport } from "./transport";
import { TABLE_WIRE_VERSION, decodeWire, encodeWire, type TableWireMessage } from "./wire";

export interface HostPeer {
  peerId:string;
  participantId:string;
  name:string;
  characterId?:string;
  /** The last event sequence this peer confirmed receiving (its cursor). */
  cursor:number;
  /** The last durable event the owner's client confirmed it wrote back. */
  ackedCursor:number;
  connected:boolean;
}

export interface TableHostOptions {
  sessionId?:string;
  /** How many ledger events stay servable for catch-up; an older cursor gets a snapshot. */
  retention?:number;
  now?:()=>string;
}

/**
 * The Host (TABLE_RUNTIME.md §5): the only place `dispatch` runs. Players send commands; the Host answers each
 * command once (duplicates by command id are answered from memory, never re-run) and broadcasts every event to
 * every peer, redacted for that peer. Reconnect: a hello with a cursor gets the events after it, or a snapshot.
 */
export class TableHost {
  readonly peers=new Map<string,HostPeer>();
  private readonly replies=new Map<string,{status:"committed"|"refused";refusal?:TableRefusal;cursor:number}>();
  private readonly stateBefore=new Map<number,TableState>();
  private readonly retention:number;
  readonly sessionId:string;
  private readonly off:Array<()=>void>=[];

  constructor(readonly runtime:TableRuntime,readonly transport:TableTransport,options:TableHostOptions={}) {
    this.sessionId=options.sessionId??runtime.state.sessionId;
    this.retention=options.retention??500;
    this.off.push(transport.onMessage((peer,raw)=>this.receive(peer,raw)));
    this.off.push(transport.onPeerLeft((peer)=>{ const entry=this.peers.get(peer); if(entry) entry.connected=false; }));
  }

  close() { for(const off of this.off) off(); this.transport.broadcast(encodeWire({type:"ended",reason:"host-closed"})); }

  /** The DM's own commands go through here so their events reach the players too. */
  dispatch(command:TableCommand,origin:CommandOrigin=HOST_ORIGIN):Outcome {
    const before=cloneState(this.runtime.state);
    const outcome=this.runtime.dispatch(command,origin);
    if(outcome.status==="committed") this.broadcastEvents(outcome.events,before);
    return outcome;
  }

  private viewerFor(peer:HostPeer):TableViewer { return {role:"player",peerId:peer.peerId}; }

  private broadcastEvents(events:TableEvent[],before:TableState) {
    let current=before;
    for(const event of events) {
      const after=applyEvent(current,event);
      this.stateBefore.set(event.seq,current);
      for(const peer of this.peers.values()) {
        if(!peer.connected) continue;
        const redacted=redactEventFor(event,current,after,this.viewerFor(peer));
        if(redacted) this.transport.send(peer.peerId,encodeWire({type:"events",events:[redacted]}));
      }
      current=after;
    }
    // Keep only what catch-up may still need.
    for(const seq of [...this.stateBefore.keys()]) if(seq<this.runtime.state.revision-this.retention) this.stateBefore.delete(seq);
  }

  private receive(peer:string,raw:string) {
    const message=decodeWire(raw);
    if(!message) { this.transport.send(peer,encodeWire({type:"error",code:"wire-invalid",message:"메시지를 읽을 수 없습니다."})); return; }
    switch(message.type) {
      case "hello": return this.hello(peer,message);
      case "command": return this.command(peer,message);
      case "catchup": return this.catchUp(peer,message.cursor);
      case "ack": { const entry=this.peers.get(peer); if(entry) entry.ackedCursor=Math.max(entry.ackedCursor,message.cursor); return; }
      default: return;
    }
  }

  private hello(peer:string,message:Extract<TableWireMessage,{type:"hello"}>) {
    if(message.version!==TABLE_WIRE_VERSION) { this.transport.send(peer,encodeWire({type:"error",code:"version-mismatch",message:`테이블 프로토콜 버전이 다릅니다 (호스트 ${TABLE_WIRE_VERSION}, 참가자 ${message.version}).`})); return; }
    const existing=[...this.peers.values()].find((entry)=>entry.participantId===message.participantId);
    const entry:HostPeer=existing??{peerId:peer,participantId:message.participantId,name:message.name,cursor:0,ackedCursor:0,connected:true};
    if(existing&&existing.peerId!==peer) { this.peers.delete(existing.peerId); entry.peerId=peer; }
    entry.connected=true;
    entry.name=message.name;
    this.peers.set(peer,entry);
    // A character joins the table on its owner's first hello; on a reconnect it is already there.
    if(message.sheet&&!this.runtime.state.actors[message.sheet.id]) {
      const before=cloneState(this.runtime.state);
      const outcome=this.runtime.dispatch({type:"add-actors",specs:[{kind:"character",sheet:message.sheet,controllerPeer:peer,side:"ally"}]},HOST_ORIGIN);
      if(outcome.status==="committed") { entry.characterId=message.sheet.id; this.broadcastEvents(outcome.events,before); }
    } else if(message.sheet) {
      entry.characterId=message.sheet.id;
      const actor=this.runtime.state.actors[message.sheet.id];
      if(actor&&actor.controllerPeer!==peer) {
        const before=cloneState(this.runtime.state);
        const outcome=this.runtime.dispatch({type:"set-actor",actorId:message.sheet.id,patch:{controllerPeer:peer}},HOST_ORIGIN);
        if(outcome.status==="committed") this.broadcastEvents(outcome.events,before);
      }
    }
    const canCatchUp=message.cursor>0&&message.cursor<=this.runtime.state.revision&&this.runtime.ledger.some((event)=>event.seq===message.cursor+1||message.cursor===this.runtime.state.revision);
    if(canCatchUp) {
      this.transport.send(peer,encodeWire({type:"welcome",sessionId:this.sessionId,peerId:peer,participantId:entry.participantId,snapshot:redactStateFor(this.runtime.state,this.viewerFor(entry)),cursor:this.runtime.state.revision}));
      entry.cursor=this.runtime.state.revision;
      return;
    }
    this.transport.send(peer,encodeWire({type:"welcome",sessionId:this.sessionId,peerId:peer,participantId:entry.participantId,snapshot:redactStateFor(this.runtime.state,this.viewerFor(entry)),cursor:this.runtime.state.revision}));
    entry.cursor=this.runtime.state.revision;
  }

  private catchUp(peer:string,cursor:number) {
    const entry=this.peers.get(peer);
    if(!entry) return;
    const missing=this.runtime.ledger.filter((event)=>event.seq>cursor);
    const servable=missing.every((event)=>this.stateBefore.has(event.seq));
    if(!servable||missing.length>this.retention) {
      this.transport.send(peer,encodeWire({type:"snapshot",snapshot:redactStateFor(this.runtime.state,this.viewerFor(entry))}));
      entry.cursor=this.runtime.state.revision;
      return;
    }
    const events=missing.flatMap((event)=>{ const before=this.stateBefore.get(event.seq)!; const redacted=redactEventFor(event,before,applyEvent(before,event),this.viewerFor(entry)); return redacted?[redacted]:[]; });
    this.transport.send(peer,encodeWire({type:"events",events}));
    entry.cursor=this.runtime.state.revision;
  }

  private command(peer:string,message:Extract<TableWireMessage,{type:"command"}>) {
    const entry=this.peers.get(peer);
    if(!entry) { this.transport.send(peer,encodeWire({type:"error",code:"not-joined",message:"먼저 세션에 참가하세요."})); return; }
    const seen=this.replies.get(message.commandId);
    if(seen) { this.transport.send(peer,encodeWire({type:"reply",commandId:message.commandId,...seen})); return; }
    const outcome=this.dispatch(message.command,{peerId:peer,role:"player"});
    const reply=outcome.status==="committed"?{status:"committed" as const,cursor:this.runtime.state.revision}:{status:"refused" as const,refusal:{code:outcome.refusal.code,message:outcome.refusal.message,...(outcome.refusal.actorId?{actorId:outcome.refusal.actorId}:{}),...(outcome.refusal.actionId?{actionId:outcome.refusal.actionId}:{})},cursor:this.runtime.state.revision};
    this.replies.set(message.commandId,reply);
    this.transport.send(peer,encodeWire({type:"reply",commandId:message.commandId,...reply}));
  }
}

export type { CharacterSheet };
