import type { CharacterLibraryStore, CharacterLibraryStoredGeneration } from "./persistenceContracts";
import type { PreparedGenerationWrite } from "./characterCampaignCompoundPersistence";

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

  preflightCompoundWrite(write:PreparedGenerationWrite) {
    if (this.failMessage) {
      const message = this.failMessage;
      this.failMessage = null;
      throw new Error(message);
    }
    const physical = Math.max(0,...this.generations.keys());
    if (physical !== write.expectedGeneration) throw new Error(`stale Character library generation: expected ${write.expectedGeneration}, current ${physical}`);
    if (write.nextGeneration !== write.expectedGeneration + 1) throw new Error(`invalid next Character library generation: ${write.nextGeneration}`);
    if (this.generations.has(write.nextGeneration)) throw new Error(`Character library generation already exists: ${write.nextGeneration}`);
  }

  applyPreflightedCompoundWrite(write:PreparedGenerationWrite) {
    this.generations.set(write.nextGeneration,{ generation:write.nextGeneration, payload:write.payload });
  }

  async writeGeneration(expectedGeneration:number,nextGeneration:number,payload:string):Promise<void> {
    const write={expectedGeneration,nextGeneration,payload};
    this.preflightCompoundWrite(write);
    this.applyPreflightedCompoundWrite(write);
  }
}
