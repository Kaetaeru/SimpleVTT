import type { CharacterSheet } from "./contracts";
import {
  buildCharacterLibraryRecordV1,
  encodeCharacterLibraryV1,
} from "./characterLibraryPersistence";
import {
  CHARACTER_LIBRARY_SCHEMA_ID,
  CHARACTER_LIBRARY_SCHEMA_VERSION,
  type CharacterLibraryDocumentV1,
  type CharacterLibraryStore,
} from "./persistenceContracts";
import {
  decodeCampaignDocumentV1,
  encodeCampaignDocumentV1,
} from "./campaignPersistence";
import type {
  CampaignDocumentV1,
  CampaignLibraryStore,
} from "./campaignPersistenceContracts";
import type { MemoryCharacterLibraryStore } from "./memoryCharacterLibraryStore";
import type { MemoryCampaignLibraryStore } from "./memoryCampaignLibraryStore";

export interface PreparedGenerationWrite {
  expectedGeneration:number;
  nextGeneration:number;
  payload:string;
}

export interface CharacterCampaignCompoundWrite {
  transactionId:string;
  character:PreparedGenerationWrite;
  campaign:PreparedGenerationWrite;
}

export interface CharacterCampaignCompoundWriter {
  write(request:CharacterCampaignCompoundWrite):Promise<void>;
}

async function physicalGeneration(store:{readGenerations():Promise<Array<{generation:number}>>}){
  const generations=await store.readGenerations();
  return Math.max(0,...generations.map((entry)=>entry.generation));
}

export async function prepareCharacterLibraryGeneration(
  current:CharacterLibraryDocumentV1,
  store:CharacterLibraryStore,
  sheets:CharacterSheet[],
  activeCharacterId:string|null,
):Promise<PreparedGenerationWrite>{
  const expectedGeneration=await physicalGeneration(store);
  const nextGeneration=expectedGeneration+1;
  const previousById=new Map(current.characters.map((record)=>[record.characterId,record]));
  const nextById=new Map(previousById);
  for(const sheet of sheets) nextById.set(sheet.id,buildCharacterLibraryRecordV1(sheet,previousById.get(sheet.id)));
  const ids=new Set(nextById.keys());
  const next:CharacterLibraryDocumentV1={
    schemaId:CHARACTER_LIBRARY_SCHEMA_ID,
    schemaVersion:CHARACTER_LIBRARY_SCHEMA_VERSION,
    storageRevision:nextGeneration,
    activeCharacterId:activeCharacterId&&ids.has(activeCharacterId)?activeCharacterId:current.activeCharacterId,
    characters:[...nextById.values()].sort((left,right)=>left.characterId.localeCompare(right.characterId)),
  };
  return {expectedGeneration,nextGeneration,payload:encodeCharacterLibraryV1(next)};
}

export async function prepareCampaignLibraryGeneration(
  store:CampaignLibraryStore,
  candidate:CampaignDocumentV1,
):Promise<PreparedGenerationWrite>{
  const expectedGeneration=await physicalGeneration(store);
  const nextGeneration=expectedGeneration+1;
  const next=decodeCampaignDocumentV1(encodeCampaignDocumentV1({...candidate,storageRevision:nextGeneration}));
  return {expectedGeneration,nextGeneration,payload:encodeCampaignDocumentV1(next)};
}

/**
 * Test/development atomic writer. Both stores perform every failure/stale check
 * during preflight. Applying a preflighted write is synchronous and cannot fail,
 * so neither generation becomes visible unless both participants are valid.
 */
export class MemoryCharacterCampaignCompoundWriter implements CharacterCampaignCompoundWriter {
  constructor(
    private readonly characterStore:MemoryCharacterLibraryStore,
    private readonly campaignStore:MemoryCampaignLibraryStore,
  ){}

  async write(request:CharacterCampaignCompoundWrite){
    if(!request.transactionId.trim()) throw new Error("compound transaction id is required");
    this.characterStore.preflightCompoundWrite(request.character);
    this.campaignStore.preflightCompoundWrite(request.campaign);
    this.characterStore.applyPreflightedCompoundWrite(request.character);
    this.campaignStore.applyPreflightedCompoundWrite(request.campaign);
  }
}
