import type { TurnRuntimeSessionStore, TurnRuntimeSessionStoredGeneration } from "./turnRuntimeSessionPersistence";

export class MemoryTurnRuntimeSessionStore implements TurnRuntimeSessionStore {
  readonly durability="volatile" as const;
  private generations=new Map<number,string>();

  async readGenerations():Promise<TurnRuntimeSessionStoredGeneration[]> {
    return [...this.generations.entries()]
      .sort(([a],[b])=>b-a)
      .map(([generation,payload])=>({generation,payload}));
  }

  async writeGeneration(expectedGeneration:number,nextGeneration:number,payload:string):Promise<void> {
    const current=Math.max(0,...this.generations.keys());
    if (current!==expectedGeneration) throw new Error(`stale turn runtime generation: expected ${expectedGeneration}, current ${current}`);
    if (nextGeneration!==expectedGeneration+1) throw new Error(`invalid turn runtime next generation: ${nextGeneration}`);
    this.generations.set(nextGeneration,payload);
  }
}
