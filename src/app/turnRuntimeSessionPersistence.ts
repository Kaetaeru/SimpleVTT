import { cloneRuntimeState, type RulesRuntimeState } from "../domain/combatState";

export const TURN_RUNTIME_SESSION_SCHEMA_ID="simplevtt.turn-runtime-sessions" as const;
export const TURN_RUNTIME_SESSION_SCHEMA_VERSION=1 as const;

export interface TurnRuntimeSessionStoredGeneration {
  generation:number;
  payload:string|null;
  readError?:string;
}

export interface TurnRuntimeSessionStore {
  readonly durability:"durable"|"volatile";
  readGenerations():Promise<TurnRuntimeSessionStoredGeneration[]>;
  writeGeneration(expectedGeneration:number,nextGeneration:number,payload:string):Promise<void>;
}

interface TurnRuntimeSessionDocumentV1 {
  schemaId:typeof TURN_RUNTIME_SESSION_SCHEMA_ID;
  schemaVersion:typeof TURN_RUNTIME_SESSION_SCHEMA_VERSION;
  storageRevision:number;
  checkpoints:Record<string,RulesRuntimeState>;
}

function initialDocument():TurnRuntimeSessionDocumentV1 {
  return {
    schemaId:TURN_RUNTIME_SESSION_SCHEMA_ID,
    schemaVersion:TURN_RUNTIME_SESSION_SCHEMA_VERSION,
    storageRevision:0,
    checkpoints:{},
  };
}

function decode(payload:string):TurnRuntimeSessionDocumentV1 {
  const parsed=JSON.parse(payload) as Partial<TurnRuntimeSessionDocumentV1>;
  if (parsed.schemaId!==TURN_RUNTIME_SESSION_SCHEMA_ID) throw new Error(`unsupported turn runtime schema: ${String(parsed.schemaId)}`);
  if (parsed.schemaVersion!==TURN_RUNTIME_SESSION_SCHEMA_VERSION) throw new Error(`unsupported turn runtime version: ${String(parsed.schemaVersion)}`);
  if (!Number.isInteger(parsed.storageRevision) || Number(parsed.storageRevision)<0) throw new Error("turn runtime storageRevision is invalid");
  if (!parsed.checkpoints || typeof parsed.checkpoints!=="object" || Array.isArray(parsed.checkpoints)) throw new Error("turn runtime checkpoints are invalid");
  return {
    schemaId:TURN_RUNTIME_SESSION_SCHEMA_ID,
    schemaVersion:TURN_RUNTIME_SESSION_SCHEMA_VERSION,
    storageRevision:Number(parsed.storageRevision),
    checkpoints:Object.fromEntries(Object.entries(parsed.checkpoints).map(([sceneId,state])=>[sceneId,cloneRuntimeState(state)])),
  };
}

function sameState(a:RulesRuntimeState|undefined,b:RulesRuntimeState) {
  return a!==undefined && JSON.stringify(a)===JSON.stringify(b);
}

export class TurnRuntimeSessionRepository {
  private document:TurnRuntimeSessionDocumentV1|null=null;
  private physicalGeneration=0;

  constructor(private readonly store:TurnRuntimeSessionStore) {}

  get durability() { return this.store.durability; }

  private async ensureHydrated() {
    if (this.document) return;
    const generations=(await this.store.readGenerations()).sort((a,b)=>b.generation-a.generation);
    this.physicalGeneration=generations[0]?.generation ?? 0;
    for (const generation of generations) {
      if (generation.payload===null) continue;
      try {
        const document=decode(generation.payload);
        if (document.storageRevision!==generation.generation) continue;
        this.document=document;
        return;
      } catch {
        continue;
      }
    }
    if (generations.length) throw new Error("no valid committed turn-runtime generation remains");
    this.document=initialDocument();
  }

  async read(sceneId:string):Promise<RulesRuntimeState|undefined> {
    await this.ensureHydrated();
    const state=this.document!.checkpoints[sceneId];
    return state ? cloneRuntimeState(state) : undefined;
  }

  async write(sceneId:string,state:RulesRuntimeState):Promise<void> {
    await this.ensureHydrated();
    if (sameState(this.document!.checkpoints[sceneId],state)) return;
    const nextGeneration=this.physicalGeneration+1;
    const next:TurnRuntimeSessionDocumentV1={
      ...this.document!,
      storageRevision:nextGeneration,
      checkpoints:{...this.document!.checkpoints,[sceneId]:cloneRuntimeState(state)},
    };
    await this.store.writeGeneration(this.physicalGeneration,nextGeneration,JSON.stringify(next,null,2));
    this.physicalGeneration=nextGeneration;
    this.document=next;
  }

  async delete(sceneId:string):Promise<void> {
    await this.ensureHydrated();
    if (!(sceneId in this.document!.checkpoints)) return;
    const checkpoints={...this.document!.checkpoints};
    delete checkpoints[sceneId];
    const nextGeneration=this.physicalGeneration+1;
    const next:TurnRuntimeSessionDocumentV1={...this.document!,storageRevision:nextGeneration,checkpoints};
    await this.store.writeGeneration(this.physicalGeneration,nextGeneration,JSON.stringify(next,null,2));
    this.physicalGeneration=nextGeneration;
    this.document=next;
  }
}
