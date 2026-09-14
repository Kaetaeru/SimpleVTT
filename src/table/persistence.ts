import type { TableEvent } from "./events";
import { replayEvents } from "./events";
import { cloneState, type TableState } from "./state";

/**
 * Session persistence (RULES_RUNTIME_SPECS.md §4, persistence.md §3): a snapshot of the whole table plus the ledger
 * since it. The snapshot is the source, not a cache; restoring replays the tail through the same `applyEvent`.
 */
export const TABLE_SNAPSHOT_VERSION=1;

export interface TableSnapshot {
  version:number;
  savedAt:string;
  state:TableState;
  /** Events after `state.revision`, oldest first (normally empty when the snapshot is fresh). */
  tail:TableEvent[];
}

export interface TableStore {
  save(sessionId:string,snapshot:TableSnapshot):void|Promise<void>;
  load(sessionId:string):TableSnapshot|null|Promise<TableSnapshot|null>;
}

export function snapshotOf(state:TableState,tail:TableEvent[]=[],savedAt="지금"):TableSnapshot {
  return {version:TABLE_SNAPSHOT_VERSION,savedAt,state:cloneState(state),tail:tail.filter((event)=>event.seq>state.revision).map((event)=>cloneState(event))};
}

export function stateFromSnapshot(snapshot:TableSnapshot):TableState {
  if(snapshot.version!==TABLE_SNAPSHOT_VERSION) throw new Error(`저장본 버전이 다릅니다 (${snapshot.version}); 이 앱은 ${TABLE_SNAPSHOT_VERSION}을 읽습니다.`);
  return replayEvents(snapshot.state,[...snapshot.tail].sort((a,b)=>a.seq-b.seq));
}

export function encodeSnapshot(snapshot:TableSnapshot):string { return JSON.stringify(snapshot); }
export function decodeSnapshot(text:string):TableSnapshot|null {
  try { const parsed=JSON.parse(text) as TableSnapshot; return parsed&&typeof parsed==="object"&&typeof parsed.version==="number"&&parsed.state?parsed:null; }
  catch { return null; }
}

/** In-memory store for tests and solo play without a disk. */
export class MemoryTableStore implements TableStore {
  readonly saved=new Map<string,TableSnapshot>();
  save(sessionId:string,snapshot:TableSnapshot) { this.saved.set(sessionId,cloneState(snapshot)); }
  load(sessionId:string) { const found=this.saved.get(sessionId); return found?cloneState(found):null; }
}

/** A store over a Web Storage object (localStorage in the desktop webview). */
export class WebStorageTableStore implements TableStore {
  constructor(private readonly storage:{getItem(key:string):string|null;setItem(key:string,value:string):void},private readonly prefix="simplevtt.table.session.") {}
  save(sessionId:string,snapshot:TableSnapshot) { this.storage.setItem(this.prefix+sessionId,encodeSnapshot(snapshot)); }
  load(sessionId:string) { const raw=this.storage.getItem(this.prefix+sessionId); return raw?decodeSnapshot(raw):null; }
}
