/**
 * The table's view of a transport: opaque strings to one peer or every peer, and incoming strings tagged with the
 * sending peer. The desktop app binds this to the existing Tauri session transport; tests use the in-memory hub.
 */
export interface TableTransport {
  send(peer:string,message:string):void|Promise<unknown>;
  broadcast(message:string):void|Promise<unknown>;
  onMessage(handler:(peer:string,message:string)=>void):()=>void;
  onPeerLeft(handler:(peer:string)=>void):()=>void;
}

type Handler=(peer:string,message:string)=>void;

/** In-memory hub for tests and offline previews: one host endpoint, any number of client endpoints, disconnect/reconnect. */
export class MemoryTransportHub {
  private hostHandlers=new Set<Handler>();
  private hostLeft=new Set<(peer:string)=>void>();
  private clients=new Map<string,{handlers:Set<Handler>;connected:boolean}>();
  /** Messages delivered while a peer is disconnected are dropped, like a closed socket. */
  dropped:Array<{peer:string;direction:"to-host"|"to-client";message:string}>=[];

  readonly host:TableTransport={
    send:(peer,message)=>{ const client=this.clients.get(peer); if(!client||!client.connected) { this.dropped.push({peer,direction:"to-client",message}); return; } for(const handler of client.handlers) handler("host",message); },
    broadcast:(message)=>{ for(const [peer] of this.clients) this.host.send(peer,message); },
    onMessage:(handler)=>{ this.hostHandlers.add(handler); return ()=>{ this.hostHandlers.delete(handler); }; },
    onPeerLeft:(handler)=>{ this.hostLeft.add(handler); return ()=>{ this.hostLeft.delete(handler); }; },
  };

  client(peer:string):TableTransport {
    const entry=this.clients.get(peer)??{handlers:new Set<Handler>(),connected:true};
    this.clients.set(peer,entry);
    return {
      send:(_to,message)=>{ if(!entry.connected) { this.dropped.push({peer,direction:"to-host",message}); return; } for(const handler of this.hostHandlers) handler(peer,message); },
      broadcast:(message)=>{ if(!entry.connected) { this.dropped.push({peer,direction:"to-host",message}); return; } for(const handler of this.hostHandlers) handler(peer,message); },
      onMessage:(handler)=>{ entry.handlers.add(handler); return ()=>{ entry.handlers.delete(handler); }; },
      onPeerLeft:()=>()=>{},
    };
  }

  disconnect(peer:string) { const entry=this.clients.get(peer); if(entry) entry.connected=false; for(const handler of this.hostLeft) handler(peer); }
  reconnect(peer:string) { const entry=this.clients.get(peer); if(entry) entry.connected=true; }
}

/** The desktop transport (src/app/tauriSessionTransport.ts) seen through the table's interface. */
export function tauriTableTransport(transport:{send(message:string):Promise<number>;sendTo(peer:string,message:string):Promise<number>;onMessage(handler:(message:{peer:string;message:string})=>void):Promise<()=>void>;onPeerLifecycle(handler:(event:{peer:string;state:"disconnected"})=>void):Promise<()=>void>}):TableTransport {
  return {
    send:(peer,message)=>transport.sendTo(peer,message),
    broadcast:(message)=>transport.send(message),
    onMessage:(handler)=>{ let off:(()=>void)|null=null; void transport.onMessage((message)=>handler(message.peer,message.message)).then((unlisten)=>{ off=unlisten; }); return ()=>{ off?.(); }; },
    onPeerLeft:(handler)=>{ let off:(()=>void)|null=null; void transport.onPeerLifecycle((event)=>{ if(event.state==="disconnected") handler(event.peer); }).then((unlisten)=>{ off=unlisten; }); return ()=>{ off?.(); }; },
  };
}
