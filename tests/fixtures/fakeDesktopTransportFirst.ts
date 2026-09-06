import { tauriSessionTransport, type SessionTransportMessage } from "../../src/app/tauriSessionTransport";
import { encodeConnectedWireMessage, type ConnectedWireMessage } from "../../src/app/connectedSessionWire";

/**
 * Installs a fake desktop transport at import time. Import this module BEFORE any runtime adapter that binds
 * `tauriSessionTransport.onMessage`/`sendTo` at its own import (the campaign-systems adapter does), so the
 * adapters' bound base functions point at the fake instead of the unavailable Tauri bridge.
 */
const listeners:Array<(message:SessionTransportMessage)=>void>=[];
const sent:string[]=[];
const sentTo:Array<{peer:string;message:string}>=[];

tauriSessionTransport.available=()=>true;
tauriSessionTransport.startHost=async()=>({role:"host",state:"connected",address:"127.0.0.1:3210",peerCount:0});
tauriSessionTransport.connectClient=async(address)=>({role:"client",state:"connected",address,peerCount:1});
tauriSessionTransport.send=async(message)=>{sent.push(message);return 1;};
tauriSessionTransport.sendTo=async(peer,message)=>{sentTo.push({peer,message});return 1;};
tauriSessionTransport.stop=async()=>({role:null,state:"disconnected",address:"",peerCount:0});
tauriSessionTransport.onMessage=async(handler)=>{listeners.push(handler);return()=>{const index=listeners.indexOf(handler);if(index>=0)listeners.splice(index,1);};};
tauriSessionTransport.onState=async()=>()=>{};
tauriSessionTransport.onPeerLifecycle=async()=>()=>{};

export const fakeDesktopTransport={
  sent:()=>[...sent],
  sentTo:()=>[...sentTo],
  reset(){sent.length=0;sentTo.length=0;},
  /** Delivers a wire message from `peer` to every registered listener (each adapter filters by its own state). */
  emitFrom(peer:string,message:ConnectedWireMessage){for(const listener of [...listeners])listener({peer,message:encodeConnectedWireMessage(message)});},
  emitRaw(peer:string,message:string){for(const listener of [...listeners])listener({peer,message});},
};
