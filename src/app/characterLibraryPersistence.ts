import type { CharacterSheet } from "./contracts";
import {
  CHARACTER_LIBRARY_SCHEMA_ID,
  CHARACTER_LIBRARY_SCHEMA_VERSION,
  DEFAULT_RULES_PROFILE,
  type CharacterLibraryDocumentV1,
  type CharacterLibraryRecordV1,
  type CharacterLibraryStore,
  type CharacterProgressionSelectionsV1,
  type CharacterRuntimeDurableSnapshotV1,
  type CharacterSourceSnapshotV1,
} from "./persistenceContracts";

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

function progressionSelections(sheet:CharacterSheet):CharacterProgressionSelectionsV1 {
  return cp({
    expertiseSkills:sheet.expertiseSkills,
    expertiseSources:sheet.expertiseSources,
    languageSources:sheet.languageSources,
    cantripSources:sheet.cantripSources,
    preparedSpellSources:sheet.preparedSpellSources,
    spellbookSpellSources:sheet.spellbookSpellSources,
    spellMasterySpellIds:sheet.spellMasterySpellIds,
    spellMasterySources:sheet.spellMasterySources,
    signatureSpellIds:sheet.signatureSpellIds,
    signatureSpellSources:sheet.signatureSpellSources,
    metamagicIds:sheet.metamagicIds,
    metamagicSources:sheet.metamagicSources,
    eldritchInvocationIds:sheet.eldritchInvocationIds,
    eldritchInvocationSources:sheet.eldritchInvocationSources,
    mysticArcanumSpellIds:sheet.mysticArcanumSpellIds,
    mysticArcanumSources:sheet.mysticArcanumSources,
    persistentFeatureOptionIds:sheet.persistentFeatureOptionIds,
    persistentFeatureOptionSources:sheet.persistentFeatureOptionSources,
    epicBoonFeatIds:sheet.epicBoonFeatIds,
    epicBoonFeatSources:sheet.epicBoonFeatSources,
    weaponMasteryIds:sheet.weaponMasteryIds,
    weaponMasterySources:sheet.weaponMasterySources,
    fightingStyleFeatIds:sheet.fightingStyleFeatIds,
    fightingStyleFeatSources:sheet.fightingStyleFeatSources,
    subclassIds:sheet.subclassIds,
    subclassSources:sheet.subclassSources,
    subclassFeatureIds:sheet.subclassFeatureIds,
    subclassFeatureSources:sheet.subclassFeatureSources,
    bardMagicalDiscoverySpellIds:sheet.bardMagicalDiscoverySpellIds,
    bardMagicalDiscoverySpellSources:sheet.bardMagicalDiscoverySpellSources,
    pactTomeCantripIds:sheet.pactTomeCantripIds,
    pactTomeRitualSpellIds:sheet.pactTomeRitualSpellIds,
    pactTomeSpellSources:sheet.pactTomeSpellSources,
  });
}

export function projectCharacterSourceV1(sheet:CharacterSheet):CharacterSourceSnapshotV1 {
  return {
    characterId:sheet.id,
    name:sheet.name,
    rulesProfile:{
      id:sheet.rulesProfileId ?? DEFAULT_RULES_PROFILE.id,
      version:sheet.rulesProfileVersion ?? DEFAULT_RULES_PROFILE.version,
    },
    build:{
      className:sheet.className,
      subclassName:sheet.subclassName,
      level:sheet.level,
      species:sheet.species,
      background:sheet.background,
      abilities:cp(sheet.abilities),
      skills:cp(sheet.skills),
      classLevels:sheet.classLevels ? cp(sheet.classLevels) : undefined,
      hitDiceByDie:sheet.hitDiceByDie ? cp(sheet.hitDiceByDie) : undefined,
      size:sheet.size,
      languages:sheet.languages ? cp(sheet.languages) : undefined,
      toolProficiencies:sheet.toolProficiencies ? cp(sheet.toolProficiencies) : undefined,
      creationSelections:cp(sheet.creationSelections ?? {}),
      notes:sheet.notes,
    },
    spellAndFeatureSelections:{
      cantrips:sheet.cantrips ? cp(sheet.cantrips) : undefined,
      preparedSpells:sheet.preparedSpells ? cp(sheet.preparedSpells) : undefined,
      spellbookSpells:sheet.spellbookSpells ? cp(sheet.spellbookSpells) : undefined,
      masteryWeapons:sheet.masteryWeapons ? cp(sheet.masteryWeapons) : undefined,
    },
    progression:progressionSelections(sheet),
    itemReferences:sheet.items.map((item) => ({ id:item.id, definitionId:item.definitionId, provenance:cp(item.provenance) })),
  };
}

export function projectCharacterRuntimeDurableV1(sheet:CharacterSheet):CharacterRuntimeDurableSnapshotV1 {
  return {
    hp:sheet.hp,
    tempHp:sheet.tempHp,
    lifeFlags:sheet.durableLifeFlags ? cp(sheet.durableLifeFlags) : undefined,
    resources:cp(sheet.resources),
    items:cp(sheet.items),
    goldGp:sheet.goldGp,
  };
}

export function buildCharacterLibraryRecordV1(sheet:CharacterSheet, previous?:CharacterLibraryRecordV1):CharacterLibraryRecordV1 {
  const source = projectCharacterSourceV1(sheet);
  const runtime = projectCharacterRuntimeDurableV1(sheet);
  const sourceRevision = previous
    ? previous.sourceRevision + (same(previous.source,source) ? 0 : 1)
    : Math.max(1,sheet.sourceRevision ?? 1);
  const runtimeRevision = previous
    ? previous.runtimeRevision + (same(previous.runtime,runtime) ? 0 : 1)
    : Math.max(1,sheet.runtimeRevision ?? 1);
  const cached = cp(sheet);
  cached.rulesProfileId = source.rulesProfile.id;
  cached.rulesProfileVersion = source.rulesProfile.version;
  cached.sourceRevision = sourceRevision;
  cached.runtimeRevision = runtimeRevision;
  return {
    characterId:sheet.id,
    sourceRevision,
    runtimeRevision,
    source,
    runtime,
    materializedCache:{ sourceRevision, runtimeRevision, sheet:cached },
  };
}

export function materializeCharacterRecordV1(record:CharacterLibraryRecordV1):CharacterSheet {
  const sheet = cp(record.materializedCache.sheet);
  sheet.id = record.characterId;
  sheet.name = record.source.name;
  sheet.hp = record.runtime.hp;
  sheet.tempHp = record.runtime.tempHp;
  sheet.resources = cp(record.runtime.resources);
  sheet.items = cp(record.runtime.items);
  sheet.goldGp = record.runtime.goldGp;
  sheet.durableLifeFlags = record.runtime.lifeFlags ? cp(record.runtime.lifeFlags) : sheet.durableLifeFlags;
  sheet.rulesProfileId = record.source.rulesProfile.id;
  sheet.rulesProfileVersion = record.source.rulesProfile.version;
  sheet.sourceRevision = record.sourceRevision;
  sheet.runtimeRevision = record.runtimeRevision;
  return sheet;
}

function isObject(value:unknown):value is Record<string,unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertRecord(value:unknown):asserts value is CharacterLibraryRecordV1 {
  if (!isObject(value)) throw new Error("character library record must be an object");
  if (typeof value.characterId !== "string" || !value.characterId) throw new Error("character library record is missing characterId");
  if (!Number.isInteger(value.sourceRevision) || Number(value.sourceRevision) < 1) throw new Error(`invalid sourceRevision for ${value.characterId}`);
  if (!Number.isInteger(value.runtimeRevision) || Number(value.runtimeRevision) < 1) throw new Error(`invalid runtimeRevision for ${value.characterId}`);
  if (!isObject(value.source) || !isObject(value.runtime) || !isObject(value.materializedCache)) throw new Error(`invalid durable record payload for ${value.characterId}`);
  const cache = value.materializedCache as Record<string,unknown>;
  if (!isObject(cache.sheet) || cache.sheet.id !== value.characterId) throw new Error(`materialized cache id mismatch for ${value.characterId}`);
}

export function decodeCharacterLibraryV1(payload:string):CharacterLibraryDocumentV1 {
  const parsed:unknown = JSON.parse(payload);
  if (!isObject(parsed)) throw new Error("character library must be an object");
  if (parsed.schemaId !== CHARACTER_LIBRARY_SCHEMA_ID) throw new Error(`unsupported character library schema: ${String(parsed.schemaId)}`);
  if (parsed.schemaVersion !== CHARACTER_LIBRARY_SCHEMA_VERSION) throw new Error(`unsupported character library version: ${String(parsed.schemaVersion)}`);
  if (!Number.isInteger(parsed.storageRevision) || Number(parsed.storageRevision) < 0) throw new Error("invalid character library storageRevision");
  if (parsed.activeCharacterId !== null && typeof parsed.activeCharacterId !== "string") throw new Error("invalid activeCharacterId");
  if (!Array.isArray(parsed.characters)) throw new Error("character library characters must be an array");
  parsed.characters.forEach(assertRecord);
  const ids = new Set<string>();
  for (const record of parsed.characters) {
    if (ids.has(record.characterId)) throw new Error(`duplicate character id: ${record.characterId}`);
    ids.add(record.characterId);
  }
  if (parsed.activeCharacterId && !ids.has(parsed.activeCharacterId)) throw new Error(`active character not found: ${parsed.activeCharacterId}`);
  return cp(parsed as unknown as CharacterLibraryDocumentV1);
}

export class CharacterLibrarySchemaError extends Error {}
export class CharacterLibraryMigrationRequiredError extends Error {
  constructor(readonly schemaVersion:unknown) {
    super(`Character library schema version ${String(schemaVersion)} requires an explicit migration`);
  }
}

export function decodeCharacterLibrary(payload:string):CharacterLibraryDocumentV1 {
  const parsed:unknown = JSON.parse(payload);
  if (!isObject(parsed)) throw new Error("character library must be an object");
  if (parsed.schemaId !== CHARACTER_LIBRARY_SCHEMA_ID) throw new CharacterLibrarySchemaError(`unsupported character library schema: ${String(parsed.schemaId)}`);
  switch (parsed.schemaVersion) {
    case CHARACTER_LIBRARY_SCHEMA_VERSION:
      return decodeCharacterLibraryV1(payload);
    default:
      throw new CharacterLibraryMigrationRequiredError(parsed.schemaVersion);
  }
}

export function encodeCharacterLibraryV1(document:CharacterLibraryDocumentV1) {
  return JSON.stringify(canonical(document),null,2);
}

function initialDocument(sheets:CharacterSheet[], activeCharacterId:string|null):CharacterLibraryDocumentV1 {
  const records = sheets.map((sheet) => buildCharacterLibraryRecordV1(sheet));
  const ids = new Set(records.map((record) => record.characterId));
  return {
    schemaId:CHARACTER_LIBRARY_SCHEMA_ID,
    schemaVersion:CHARACTER_LIBRARY_SCHEMA_VERSION,
    storageRevision:0,
    activeCharacterId:activeCharacterId && ids.has(activeCharacterId) ? activeCharacterId : records[0]?.characterId ?? null,
    characters:records,
  };
}

export interface CharacterLibraryHydration {
  document:CharacterLibraryDocumentV1;
  sheets:CharacterSheet[];
  activeCharacterId:string|null;
  physicalGeneration:number;
  loadedGeneration:number|null;
  recoveredFromOlderGeneration:boolean;
}

export class CharacterLibraryCorruptError extends Error {}

export class CharacterLibraryRepository {
  private document:CharacterLibraryDocumentV1|null = null;
  private physicalGeneration = 0;
  private loadedGeneration:number|null = null;

  constructor(private readonly store:CharacterLibraryStore) {}

  get durability() { return this.store.durability; }

  private result(recovered=false):CharacterLibraryHydration {
    if (!this.document) throw new Error("character library repository is not hydrated");
    return {
      document:cp(this.document),
      sheets:this.document.characters.map(materializeCharacterRecordV1),
      activeCharacterId:this.document.activeCharacterId,
      physicalGeneration:this.physicalGeneration,
      loadedGeneration:this.loadedGeneration,
      recoveredFromOlderGeneration:recovered,
    };
  }

  async hydrate(defaultSheets:CharacterSheet[], activeCharacterId:string|null):Promise<CharacterLibraryHydration> {
    const generations = (await this.store.readGenerations()).sort((a,b) => b.generation-a.generation);
    this.physicalGeneration = generations[0]?.generation ?? 0;
    for (const generation of generations) {
      if (generation.payload === null) continue;
      try {
        const document = decodeCharacterLibrary(generation.payload);
        if (document.storageRevision !== generation.generation) continue;
        this.document = document;
        this.loadedGeneration = generation.generation;
        return this.result(generation.generation < this.physicalGeneration);
      } catch (error) {
        if (error instanceof CharacterLibraryMigrationRequiredError || error instanceof CharacterLibrarySchemaError) throw error;
      }
    }
    if (generations.length) throw new CharacterLibraryCorruptError("no valid committed Character library generation remains");
    this.document = initialDocument(defaultSheets,activeCharacterId);
    this.loadedGeneration = null;
    return this.result(false);
  }

  async commit(sheets:CharacterSheet[], activeCharacterId:string|null):Promise<CharacterLibraryHydration> {
    if (!this.document) throw new Error("character library repository must hydrate before commit");
    const previousById = new Map(this.document.characters.map((record) => [record.characterId,record]));
    const nextById = new Map(previousById);
    for (const sheet of sheets) nextById.set(sheet.id,buildCharacterLibraryRecordV1(sheet,previousById.get(sheet.id)));
    const ids = new Set(nextById.keys());
    const nextGeneration = this.physicalGeneration + 1;
    const next:CharacterLibraryDocumentV1 = {
      schemaId:CHARACTER_LIBRARY_SCHEMA_ID,
      schemaVersion:CHARACTER_LIBRARY_SCHEMA_VERSION,
      storageRevision:nextGeneration,
      activeCharacterId:activeCharacterId && ids.has(activeCharacterId) ? activeCharacterId : this.document.activeCharacterId,
      characters:[...nextById.values()].sort((a,b) => a.characterId.localeCompare(b.characterId)),
    };
    await this.store.writeGeneration(this.physicalGeneration,nextGeneration,encodeCharacterLibraryV1(next));
    this.document = next;
    this.physicalGeneration = nextGeneration;
    this.loadedGeneration = nextGeneration;
    return this.result(false);
  }

  snapshot() {
    if (!this.document) return null;
    return cp(this.document);
  }
}
