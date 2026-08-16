import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface SessionTransportStatus {
  role:"host"|"client"|null;
  state:"connected"|"reconnecting"|"disconnected";
  address:string;
  peerCount:number;
}

export interface SessionTransportMessage {
  peer:string;
  message:string;
}

function hasTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export class TauriSessionTransport {
  available() { return hasTauriRuntime(); }

  async startHost(bindAddress="0.0.0.0:3210"):Promise<SessionTransportStatus> {
    if (!this.available()) throw new Error("Tauri session transport is unavailable outside the desktop runtime");
    return invoke<SessionTransportStatus>("start_session_host",{ bindAddress });
  }

  async connectClient(address:string):Promise<SessionTransportStatus> {
    if (!this.available()) throw new Error("Tauri session transport is unavailable outside the desktop runtime");
    return invoke<SessionTransportStatus>("connect_session_client",{ address });
  }

  async send(message:string):Promise<number> {
    if (!this.available()) throw new Error("Tauri session transport is unavailable outside the desktop runtime");
    return invoke<number>("send_session_message",{ message });
  }

  async sendTo(peer:string,message:string):Promise<number> {
    if (!this.available()) throw new Error("Tauri session transport is unavailable outside the desktop runtime");
    return invoke<number>("send_session_message_to",{ peer,message });
  }

  async stop():Promise<SessionTransportStatus> {
    if (!this.available()) return { role:null,state:"disconnected",address:"",peerCount:0 };
    return invoke<SessionTransportStatus>("stop_session_transport");
  }

  async status():Promise<SessionTransportStatus> {
    if (!this.available()) return { role:null,state:"disconnected",address:"",peerCount:0 };
    return invoke<SessionTransportStatus>("get_session_transport_status");
  }

  async onMessage(handler:(message:SessionTransportMessage)=>void):Promise<UnlistenFn> {
    if (!this.available()) return () => {};
    return listen<SessionTransportMessage>("session-transport-message",(event)=>handler(event.payload));
  }

  async onState(handler:(status:SessionTransportStatus)=>void):Promise<UnlistenFn> {
    if (!this.available()) return () => {};
    return listen<SessionTransportStatus>("session-transport-state",(event)=>handler(event.payload));
  }
}

export const tauriSessionTransport=new TauriSessionTransport();
