import type { InstalledContentStore, InstalledContentStoredGeneration } from "./installedContentContracts";

export class MemoryInstalledContentStore implements InstalledContentStore {
  readonly durability="volatile" as const;
  private generations:InstalledContentStoredGeneration[]=[];
  private nextWriteError:string|null=null;

  constructor(seed:InstalledContentStoredGeneration[]=[]){
    this.generations=structuredClone(seed);
  }

  failNextWrite(message:string) { this.nextWriteError=message; }

  async readGenerations():Promise<InstalledContentStoredGeneration[]> {
    return structuredClone(this.generations);
  }

  async writeGeneration(expectedGeneration:number,nextGeneration:number,payload:string):Promise<void> {
    if (this.nextWriteError) {
      const message=this.nextWriteError;
      this.nextWriteError=null;
      throw new Error(message);
    }
    const physical=Math.max(0,...this.generations.map((generation)=>generation.generation));
    if (physical!==expectedGeneration) throw new Error(`stale Installed content generation: expected ${expectedGeneration}, physical ${physical}`);
    if (nextGeneration!==physical+1) throw new Error(`Installed content next generation must be ${physical+1}, got ${nextGeneration}`);
    this.generations=[
      {generation:nextGeneration,payload},
      ...this.generations.filter((generation)=>generation.generation!==nextGeneration),
    ];
  }
}
