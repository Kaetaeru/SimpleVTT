import type { CharacterSheet } from "../app/contracts";
import type { TableCommand } from "./commands";
import { applyEvent, type TableEvent } from "./events";
import type { TableRefusal } from "./refusal";
import { TableRuntime } from "./runtime";
import type { TableState } from "./state";
import type { TableTransport } from "./transport";
import { TABLE_WIRE_VERSION, decodeWire, encodeWire, type TableWireMessage } from "./wire";

export interface TableClientOptions {
  participantId:string;
  name:string;
  sheet?:CharacterSheet;
  /** Durable changes to a character this peer controls (items, quantities): the app persists them and the client acks. */
  onDurableSheet?:(sheet:CharacterSheet)=>void|Promise<void>;
  onRefusal?:(refusal:TableRefusal&{commandId:string})=>void;
}

export type ClientReply={status:"committed";cursor:number}|{status:"refused";refusal:TableRefusal;cursor:number};

/**
 * A player's replica (TABLE_RUNTIME.md §5): sends commands, applies the Host's (already redacted) events in order,
 * asks for a catch-up on a gap, replaces its state on a snapshot, and writes durable sheet changes of its own
 * character back through the app's hook, acknowledging the event it wrote.
 */
export class TableClient {
  readonly runtime=new TableRuntime();
  peerId:string|null=null;
  sessionId:string|null=null;
  lastRefusal:(TableRefusal&{id:number})|null=null;
  private cursor=0;
  private counter=0;
  private refusals=0;
  private readonly pending=new Map<string,{command:TableCommand;resolve:(reply:ClientReply)=>void}>();
  private readonly off:Array<()=>void>=[];
  private readonly listeners=new Set<()=>void>();

  constructor(readonly transport:TableTransport,readonly options:TableClientOptions) {
    this.off.push(transport.onMessage((_peer,raw)=>this.receive(raw)));
  }

  get state():TableState { return this.runtime.state; }
  get revision():number { return this.cursor; }
  subscribe(listener:()=>void) { this.listeners.add(listener); return ()=>{ this.listeners.delete(listener); }; }
  private notify() { for(const listener of this.listeners) listener(); }

  close() { for(const off of this.off) off(); }

  /** Join, or rejoin with the cursor the replica already holds. */
  hello() {
    this.transport.send("host",encodeWire({type:"hello",version:TABLE_WIRE_VERSION,participantId:this.options.participantId,name:this.options.name,cursor:this.cursor,...(this.options.sheet?{sheet:this.options.sheet}:{})}));
  }

  /** Send a command; the promise settles with the Host's reply. Re-sending the same command id is safe. */
  send(command:TableCommand):Promise<ClientReply> {
    this.counter+=1;
    const commandId=`${this.options.participantId}:${this.counter}`;
    return this.sendWithId(commandId,command);
  }

  sendWithId(commandId:string,command:TableCommand):Promise<ClientReply> {
    return new Promise((resolve)=>{
      this.pending.set(commandId,{command,resolve});
      this.transport.send("host",encodeWire({type:"command",commandId,command}));
    });
  }

  /** Re-send every unanswered command (after a reconnect); the Host answers duplicates from memory. */
  resendPending() {
    for(const [commandId,entry] of this.pending) this.transport.send("host",encodeWire({type:"command",commandId,command:entry.command}));
  }

  private receive(raw:string) {
    const message=decodeWire(raw);
    if(!message) return;
    switch(message.type) {
      case "welcome":
        this.peerId=message.peerId;
        this.sessionId=message.sessionId;
        this.runtime.restore(message.snapshot);
        this.cursor=message.cursor;
        this.notify();
        return;
      case "snapshot":
        this.runtime.restore(message.snapshot);
        this.cursor=message.snapshot.revision;
        this.notify();
        return;
      case "events":
        for(const event of message.events) this.applyRemote(event);
        this.notify();
        return;
      case "reply": {
        const entry=this.pending.get(message.commandId);
        this.pending.delete(message.commandId);
        if(message.status==="refused"&&message.refusal) {
          this.refusals+=1;
          this.lastRefusal={...message.refusal,id:this.refusals};
          this.options.onRefusal?.({...message.refusal,commandId:message.commandId});
        } else this.lastRefusal=null;
        entry?.resolve(message.status==="committed"?{status:"committed",cursor:message.cursor}:{status:"refused",refusal:message.refusal!,cursor:message.cursor});
        this.notify();
        return;
      }
      case "error":
        this.refusals+=1;
        this.lastRefusal={code:message.code,message:message.message,id:this.refusals};
        this.notify();
        return;
      default: return;
    }
  }

  private applyRemote(event:TableEvent) {
    if(event.seq<=this.cursor) return; // already applied (a duplicate delivery)
    if(event.seq!==this.cursor+1) { this.transport.send("host",encodeWire({type:"catchup",cursor:this.cursor})); return; }
    const before=this.runtime.state;
    this.runtime.restore(applyEvent(before,event));
    this.cursor=event.seq;
    this.writeBack(event);
  }

  /** Durable changes for the character this peer controls go to the app's persistence hook, then the Host is told. */
  private writeBack(event:TableEvent) {
    const payload=event.payload;
    const sheets=payload.type==="rules-committed"||payload.type==="table-changed"?payload.sheets??[]:[];
    const mine=sheets.filter((patch)=>this.runtime.state.actors[patch.actorId]?.controllerPeer===this.peerId);
    if(!mine.length) return;
    for(const patch of mine) void this.options.onDurableSheet?.(patch.sheet);
    this.transport.send("host",encodeWire({type:"ack",cursor:event.seq}));
  }
}

export type { TableWireMessage };
