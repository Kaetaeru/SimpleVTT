import type { TurnRuntimeSessionStore, TurnRuntimeSessionStoredGeneration } from "./turnRuntimeSessionPersistence";
import { MemoryTurnRuntimeSessionStore } from "./memoryTurnRuntimeSessionStore";
import { isTauriCharacterLibraryRuntime } from "./tauriCharacterLibraryStore";

const STORAGE_KEY="simplevtt.turn-runtime-sessions.v1";

type StoredPayload=Array<{generation:number;payload:string}>;

export class TauriTurnRuntimeSessionStore implements TurnRuntimeSessionStore {
  readonly durability="durable" as const;

  private readStored():StoredPayload {
    const raw=window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed=JSON.parse(raw) as StoredPayload;
    if (!Array.isArray(parsed)) throw new Error("turn runtime local storage payload is invalid");
    return parsed;
  }

  async readGenerations():Promise<TurnRuntimeSessionStoredGeneration[]> {
    return this.readStored()
      .sort((a,b)=>b.generation-a.generation)
      .map(({generation,payload})=>({generation,payload}));
  }

  async writeGeneration(expectedGeneration:number,nextGeneration:number,payload:string):Promise<void> {
    const stored=this.readStored();
    const current=Math.max(0,...stored.map((entry)=>entry.generation));
    if (current!==expectedGeneration) throw new Error(`stale turn runtime generation: expected ${expectedGeneration}, current ${current}`);
    if (nextGeneration!==expectedGeneration+1) throw new Error(`invalid turn runtime next generation: ${nextGeneration}`);
    const next=[{generation:nextGeneration,payload},...stored].slice(0,2);
    window.localStorage.setItem(STORAGE_KEY,JSON.stringify(next));
  }
}

export function createPlatformTurnRuntimeSessionStore():TurnRuntimeSessionStore {
  return isTauriCharacterLibraryRuntime()
    ? new TauriTurnRuntimeSessionStore()
    : new MemoryTurnRuntimeSessionStore();
}
