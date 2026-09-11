import type { CharacterSheet } from "../app/contracts";
import type { TableCommand } from "./commands";
import type { TableEvent } from "./events";
import type { TableRefusal } from "./refusal";
import type { TableState } from "./state";

export const TABLE_WIRE_VERSION=1;

/**
 * V2 wire (TABLE_RUNTIME.md §5): hello/welcome, command/reply, events, catch-up, snapshot. Every event a player
 * receives is already redacted for that player; the Host never sends its own state whole to a player.
 */
export type TableWireMessage=
  |{type:"hello";version:number;participantId:string;name:string;cursor:number;sheet?:CharacterSheet}
  |{type:"welcome";sessionId:string;peerId:string;participantId:string;snapshot:TableState;cursor:number}
  |{type:"command";commandId:string;command:TableCommand}
  |{type:"reply";commandId:string;status:"committed"|"refused";refusal?:TableRefusal;cursor:number}
  |{type:"events";events:TableEvent[]}
  |{type:"catchup";cursor:number}
  |{type:"snapshot";snapshot:TableState}
  |{type:"ack";cursor:number}
  |{type:"ended";reason:string}
  |{type:"error";code:string;message:string};

export function encodeWire(message:TableWireMessage):string { return JSON.stringify(message); }

export function decodeWire(raw:string):TableWireMessage|null {
  try {
    const parsed=JSON.parse(raw) as {type?:unknown};
    if(!parsed||typeof parsed!=="object"||typeof parsed.type!=="string") return null;
    return parsed as TableWireMessage;
  } catch { return null; }
}
