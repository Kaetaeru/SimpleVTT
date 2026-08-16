import type { CharacterCreateDraft, LevelUpDraft } from "./contracts";
import {
  AUTHORING_DRAFT_SCHEMA_ID,
  AUTHORING_DRAFT_SCHEMA_VERSION,
  type AuthoringDraftDocumentV1,
  type AuthoringDraftStore,
  type CreationDraftIntentV1,
  type ProgressionDraftIntentV1,
} from "./authoringDraftContracts";

const cp = <T,>(value:T):T => structuredClone(value);

function canonical(value:unknown):unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string,unknown>)
      .sort(([a],[b]) => a.localeCompare(b))
      .map(([key,item]) => [key,canonical(item)]));
  }
  return value;
}

function same(a:unknown,b:unknown) {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

export function projectCreationDraftIntentV1(
  draft:CharacterCreateDraft,
  context:{editingBaseSourceRevision?:number},
):CreationDraftIntentV1 {
  return cp({
    draftId:draft.id,
    editingCharacterId:draft.editingCharacterId,
    editingBaseSourceRevision:context.editingBaseSourceRevision,
    step:draft.step,
    activeSectionId:draft.activeSectionId,
    mode:draft.mode,
    rulesProfileId:draft.rulesProfileId,
    name:draft.name,
    className:draft.className,
    subclassName:draft.subclassName,
    species:draft.species,
    background:draft.background,
    level:draft.level,
    abilityMethod:draft.abilityMethod,
    abilities:draft.abilities,
    rolledPool:draft.rolledPool,
    rolledAssignments:draft.rolledAssignments,
    selectedSkills:draft.selectedSkills,
    selectedSpells:draft.selectedSpells,
    selectedClassChoices:draft.selectedClassChoices,
    equipmentPreset:draft.equipmentPreset,
    backgroundEquipmentPreset:draft.backgroundEquipmentPreset,
    notes:draft.notes,
    overrides:draft.overrides,
    choiceSelections:draft.choiceSelections ?? {},
  });
}

export function projectProgressionDraftIntentV1(
  draft:LevelUpDraft,
  baseSourceRevision:number,
):ProgressionDraftIntentV1 {
  return cp({
    characterId:draft.characterId,
    baseSourceRevision,
    step:draft.step,
    targetClassId:draft.targetClassId,
    hpMethod:draft.hpMethod,
    hpRoll:draft.hpRoll,
    progressionSelections:draft.progressionSelections ?? {},
  });
}

function isObject(value:unknown):value is Record<string,unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertFiniteInteger(value:unknown,label:string,min:number) {
  if (!Number.isInteger(value) || Number(value) < min) throw new Error(`${label} is invalid`);
}

function assertCreation(value:unknown):asserts value is CreationDraftIntentV1 {
  if (!isObject(value)) throw new Error("creation draft intent must be an object");
  if (typeof value.draftId !== "string" || !value.draftId) throw new Error("creation draft intent is missing draftId");
  if (value.editingCharacterId !== undefined && typeof value.editingCharacterId !== "string") throw new Error("creation draft editingCharacterId is invalid");
  if (value.editingBaseSourceRevision !== undefined) assertFiniteInteger(value.editingBaseSourceRevision,"creation draft editingBaseSourceRevision",1);
  assertFiniteInteger(value.step,"creation draft step",0);
  if (typeof value.rulesProfileId !== "string" || !value.rulesProfileId) throw new Error("creation draft intent is missing rulesProfileId");
  if (!isObject(value.abilities) || !isObject(value.rolledAssignments) || !Array.isArray(value.rolledPool)) throw new Error("creation draft ability intent is invalid");
  if (!Array.isArray(value.selectedSkills) || !Array.isArray(value.selectedSpells) || !isObject(value.choiceSelections)) throw new Error("creation draft selections are invalid");
  if (!isObject(value.overrides)) throw new Error("creation draft overrides are invalid");
}

function assertProgression(value:unknown):asserts value is ProgressionDraftIntentV1 {
  if (!isObject(value)) throw new Error("progression draft intent must be an object");
  if (typeof value.characterId !== "string" || !value.characterId) throw new Error("progression draft intent is missing characterId");
  assertFiniteInteger(value.baseSourceRevision,"progression draft baseSourceRevision",1);
  assertFiniteInteger(value.step,"progression draft step",0);
  if (value.targetClassId !== undefined && typeof value.targetClassId !== "string") throw new Error("progression draft targetClassId is invalid");
  if (value.hpMethod !== "fixed" && value.hpMethod !== "roll") throw new Error("progression draft hpMethod is invalid");
  if (value.hpRoll !== undefined && (!Number.isInteger(value.hpRoll) || Number(value.hpRoll) < 1)) throw new Error("progression draft hpRoll is invalid");
  if (!isObject(value.progressionSelections)) throw new Error("progression draft selections are invalid");
}

export function decodeAuthoringDraftsV1(payload:string):AuthoringDraftDocumentV1 {
  const parsed:unknown = JSON.parse(payload);
  if (!isObject(parsed)) throw new Error("authoring draft document must be an object");
  if (parsed.schemaId !== AUTHORING_DRAFT_SCHEMA_ID) throw new Error(`unsupported authoring draft schema: ${String(parsed.schemaId)}`);
  if (parsed.schemaVersion !== AUTHORING_DRAFT_SCHEMA_VERSION) throw new Error(`unsupported authoring draft version: ${String(parsed.schemaVersion)}`);
  assertFiniteInteger(parsed.storageRevision,"authoring draft storageRevision",0);
  if (parsed.creation !== null) assertCreation(parsed.creation);
  if (parsed.progression !== null) assertProgression(parsed.progression);
  return cp(parsed as unknown as AuthoringDraftDocumentV1);
}

export class AuthoringDraftSchemaError extends Error {}
export class AuthoringDraftMigrationRequiredError extends Error {
  constructor(readonly schemaVersion:unknown) {
    super(`Authoring draft schema version ${String(schemaVersion)} requires an explicit migration`);
  }
}

export function decodeAuthoringDrafts(payload:string):AuthoringDraftDocumentV1 {
  const parsed:unknown = JSON.parse(payload);
  if (!isObject(parsed)) throw new Error("authoring draft document must be an object");
  if (parsed.schemaId !== AUTHORING_DRAFT_SCHEMA_ID) throw new AuthoringDraftSchemaError(`unsupported authoring draft schema: ${String(parsed.schemaId)}`);
  switch (parsed.schemaVersion) {
    case AUTHORING_DRAFT_SCHEMA_VERSION:
      return decodeAuthoringDraftsV1(payload);
    default:
      throw new AuthoringDraftMigrationRequiredError(parsed.schemaVersion);
  }
}

export function encodeAuthoringDraftsV1(document:AuthoringDraftDocumentV1) {
  return JSON.stringify(canonical(document),null,2);
}

function initialDocument():AuthoringDraftDocumentV1 {
  return {
    schemaId:AUTHORING_DRAFT_SCHEMA_ID,
    schemaVersion:AUTHORING_DRAFT_SCHEMA_VERSION,
    storageRevision:0,
    creation:null,
    progression:null,
  };
}

export interface AuthoringDraftHydration {
  document:AuthoringDraftDocumentV1;
  physicalGeneration:number;
  loadedGeneration:number|null;
  recoveredFromOlderGeneration:boolean;
}

export class AuthoringDraftCorruptError extends Error {}

export class AuthoringDraftRepository {
  private document:AuthoringDraftDocumentV1|null = null;
  private physicalGeneration = 0;
  private loadedGeneration:number|null = null;

  constructor(private readonly store:AuthoringDraftStore) {}

  get durability() { return this.store.durability; }

  private result(recovered=false):AuthoringDraftHydration {
    if (!this.document) throw new Error("authoring draft repository is not hydrated");
    return {
      document:cp(this.document),
      physicalGeneration:this.physicalGeneration,
      loadedGeneration:this.loadedGeneration,
      recoveredFromOlderGeneration:recovered,
    };
  }

  async hydrate():Promise<AuthoringDraftHydration> {
    const generations = (await this.store.readGenerations()).sort((a,b) => b.generation-a.generation);
    this.physicalGeneration = generations[0]?.generation ?? 0;
    for (const generation of generations) {
      if (generation.payload === null) continue;
      try {
        const document = decodeAuthoringDrafts(generation.payload);
        if (document.storageRevision !== generation.generation) continue;
        this.document = document;
        this.loadedGeneration = generation.generation;
        return this.result(generation.generation < this.physicalGeneration);
      } catch (error) {
        if (error instanceof AuthoringDraftMigrationRequiredError || error instanceof AuthoringDraftSchemaError) throw error;
      }
    }
    if (generations.length) throw new AuthoringDraftCorruptError("no valid committed authoring draft generation remains");
    this.document = initialDocument();
    this.loadedGeneration = null;
    return this.result(false);
  }

  async commit(update:{creation?:CreationDraftIntentV1|null;progression?:ProgressionDraftIntentV1|null}):Promise<AuthoringDraftHydration> {
    if (!this.document) throw new Error("authoring draft repository must hydrate before commit");
    const nextContent = {
      creation:update.creation === undefined ? this.document.creation : cp(update.creation),
      progression:update.progression === undefined ? this.document.progression : cp(update.progression),
    };
    if (same(nextContent,{creation:this.document.creation,progression:this.document.progression})) return this.result(false);
    const nextGeneration = this.physicalGeneration + 1;
    const next:AuthoringDraftDocumentV1 = {
      schemaId:AUTHORING_DRAFT_SCHEMA_ID,
      schemaVersion:AUTHORING_DRAFT_SCHEMA_VERSION,
      storageRevision:nextGeneration,
      ...nextContent,
    };
    await this.store.writeGeneration(this.physicalGeneration,nextGeneration,encodeAuthoringDraftsV1(next));
    this.document = next;
    this.physicalGeneration = nextGeneration;
    this.loadedGeneration = nextGeneration;
    return this.result(false);
  }

  snapshot() { return this.document ? cp(this.document) : null; }
}
