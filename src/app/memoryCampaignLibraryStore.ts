import type { CampaignLibraryStore, CampaignStoredGeneration } from "./campaignPersistenceContracts";

export class MemoryCampaignLibraryStore implements CampaignLibraryStore {
  readonly durability="memory" as const;
  private generations:CampaignStoredGeneration[];
  private nextWriteError:string|null=null;

  constructor(seed:CampaignStoredGeneration[]=[]){
    this.generations=structuredClone(seed);
  }

  async readGenerations(){
    return structuredClone(this.generations).sort((a,b)=>b.generation-a.generation);
  }

  async writeGeneration(expectedGeneration:number,nextGeneration:number,payload:string){
    if(this.nextWriteError){const message=this.nextWriteError;this.nextWriteError=null;throw new Error(message);}
    const physical=Math.max(0,...this.generations.map((entry)=>entry.generation));
    if(physical!==expectedGeneration) throw new Error(`stale Campaign library generation: expected ${expectedGeneration}, current ${physical}`);
    if(nextGeneration!==expectedGeneration+1) throw new Error(`invalid next Campaign library generation: expected ${expectedGeneration+1}, received ${nextGeneration}`);
    this.generations.push({generation:nextGeneration,payload});
    this.generations.sort((a,b)=>b.generation-a.generation);
    this.generations=this.generations.slice(0,3);
  }

  failNextWrite(message:string){this.nextWriteError=message;}
  seed(generation:number,payload:string|null,readError?:string){
    this.generations=this.generations.filter((entry)=>entry.generation!==generation);
    this.generations.push({generation,payload,readError});
  }
}
