import type { CharacterLibraryStore, CharacterLibraryStoredGeneration } from "./persistenceContracts";

export class MemoryCharacterLibraryStore implements CharacterLibraryStore {
  readonly durability = "volatile" as const;
  private readonly generations = new Map<number,CharacterLibraryStoredGeneration>();
  private failMessage:string|null = null;

  seed(generation:number,payload:string|null,readError?:string) {
    this.generations.set(generation,{ generation, payload, readError });
  }

  failNextWrite(message="simulated Character library write failure") {
    this.failMessage = message;
  }

  async readGenerations():Promise<CharacterLibraryStoredGeneration[]> {
    return [...this.generations.values()]
      .sort((a,b) => b.generation-a.generation)
      .map((entry) => structuredClone(entry));
  }

  async writeGeneration(expectedGeneration:number,nextGeneration:number,payload:string):Promise<void> {
    if (this.failMessage) {
      const message = this.failMessage;
      this.failMessage = null;
      throw new Error(message);
    }
    const physical = Math.max(0,...this.generations.keys());
    if (physical !== expectedGeneration) throw new Error(`stale Character library generation: expected ${expectedGeneration}, current ${physical}`);
    if (nextGeneration !== expectedGeneration + 1) throw new Error(`invalid next Character library generation: ${nextGeneration}`);
    if (this.generations.has(nextGeneration)) throw new Error(`Character library generation already exists: ${nextGeneration}`);
    this.generations.set(nextGeneration,{ generation:nextGeneration, payload });
  }
}
