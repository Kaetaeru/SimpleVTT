import type { CampaignLibraryStore, CampaignStoredGeneration } from "./campaignPersistenceContracts";
import type { PreparedGenerationWrite } from "./characterCampaignCompoundPersistence";

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

  preflightCompoundWrite(write:PreparedGenerationWrite){
    if(this.nextWriteError){const message=this.nextWriteError;this.nextWriteError=null;throw new Error(message);}
    const physical=Math.max(0,...this.generations.map((entry)=>entry.generation));
    if(physical!==write.expectedGeneration) throw new Error(`stale Campaign library generation: expected ${write.expectedGeneration}, current ${physical}`);
    if(write.nextGeneration!==write.expectedGeneration+1) throw new Error(`invalid next Campaign library generation: expected ${write.expectedGeneration+1}, received ${write.nextGeneration}`);
    if(this.generations.some((entry)=>entry.generation===write.nextGeneration)) throw new Error(`Campaign library generation already exists: ${write.nextGeneration}`);
  }

  applyPreflightedCompoundWrite(write:PreparedGenerationWrite){
    this.generations.push({generation:write.nextGeneration,payload:write.payload});
    this.generations.sort((a,b)=>b.generation-a.generation);
    this.generations=this.generations.slice(0,3);
  }

  async writeGeneration(expectedGeneration:number,nextGeneration:number,payload:string){
    const write={expectedGeneration,nextGeneration,payload};
    this.preflightCompoundWrite(write);
    this.applyPreflightedCompoundWrite(write);
  }

  failNextWrite(message:string){this.nextWriteError=message;}
  seed(generation:number,payload:string|null,readError?:string){
    this.generations=this.generations.filter((entry)=>entry.generation!==generation);
    this.generations.push({generation,payload,readError});
  }
}
