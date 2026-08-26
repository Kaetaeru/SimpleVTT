import type { CharacterResourceVm, CharacterSheet, ItemInstanceVm } from "./contracts";
import {
  CHARACTER_LIBRARY_SCHEMA_ID,
  CHARACTER_LIBRARY_SCHEMA_VERSION,
  DEFAULT_RULES_PROFILE,
  type CharacterItemRuntimeStateV1,
  type CharacterItemSourceReferenceV1,
  type CharacterLibraryDocumentV1,
  type CharacterLibraryRecordV1,
  type CharacterLibraryStore,
  type CharacterProgressionSelectionsV1,
  type CharacterResourceRuntimeStateV1,
  type CharacterRuntimeDurableSnapshotV1,
  type CharacterSourceSnapshotV1,
} from "./persistenceContracts";
import { reconstructLegacyCreationAuthoringSourceV1 } from "./characterCreationAuthoringSource";

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

function itemSourceReference(item:ItemInstanceVm):CharacterItemSourceReferenceV1 {
  return {
    id:item.id,
    definitionId:item.definitionId,
    name:item.name,
    nameEn:item.nameEn,
    kind:item.kind,
    attunementRequired:item.attunementRequired,
    chargeMaximum:item.charges?.max,
    passiveEffects:cp(item.passiveEffects),
    grantedActionIds:cp(item.grantedActionIds),
    provenance:cp(item.provenance),
  };
}

function resourceSourceDefinition(resource:CharacterResourceVm) {
  return {
    id:resource.id,
    label:resource.label,
    max:resource.max,
    source:resource.source,
    recovery:resource.recovery ? cp(resource.recovery) : undefined,
  };
}

function itemRuntimeState(item:ItemInstanceVm):CharacterItemRuntimeStateV1 {
  return {
    id:item.id,
    quantity:item.quantity,
    equipped:item.equipped,
    wielded:item.wielded,
    wieldSlot:item.wieldSlot,
    attuned:item.attuned,
    charges:item.charges ? { current:item.charges.current } : undefined,
  };
}

function resourceRuntimeState(resource:CharacterResourceVm):CharacterResourceRuntimeStateV1 {
  return {
    id:resource.id,
    current:resource.current,
    recoveryLockouts:resource.recoveryLockouts ? cp(resource.recoveryLockouts) : undefined,
  };
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
    creationAuthoring:sheet.creationAuthoringSource?.completeness === "explicit"
      ? cp(sheet.creationAuthoringSource)
      : undefined,
    spellAndFeatureSelections:{
      cantrips:sheet.cantrips ? cp(sheet.cantrips) : undefined,
      preparedSpells:sheet.preparedSpells ? cp(sheet.preparedSpells) : undefined,
      spellbookSpells:sheet.spellbookSpells ? cp(sheet.spellbookSpells) : undefined,
      masteryWeapons:sheet.masteryWeapons ? cp(sheet.masteryWeapons) : undefined,
    },
    progression:progressionSelections(sheet),
    featureGrants:cp(sheet.features),
    wildShapeKnownForms:sheet.wildShapeKnownForms ? cp(sheet.wildShapeKnownForms) : undefined,
    resourceDefinitions:sheet.resources.map(resourceSourceDefinition),
    itemReferences:sheet.items.map(itemSourceReference),
  };
}

export function projectCharacterRuntimeDurableV1(sheet:CharacterSheet):CharacterRuntimeDurableSnapshotV1 {
  return {
    hp:sheet.hp,
    tempHp:sheet.tempHp,
    lifeFlags:sheet.durableLifeFlags ? cp(sheet.durableLifeFlags) : undefined,
    resources:sheet.resources.map(resourceRuntimeState),
    items:sheet.items.map(itemRuntimeState),
    goldGp:sheet.goldGp,
  };
}

function comparableRuntime(runtime:CharacterRuntimeDurableSnapshotV1):CharacterRuntimeDurableSnapshotV1 {
  return {
    hp:runtime.hp,
    tempHp:runtime.tempHp,
    lifeFlags:runtime.lifeFlags ? cp(runtime.lifeFlags) : undefined,
    resources:runtime.resources.map((resource) => ({
      id:resource.id,
      current:resource.current,
      recoveryLockouts:resource.recoveryLockouts ? cp(resource.recoveryLockouts) : undefined,
    })),
    items:runtime.items.map((item) => ({
      id:item.id,
      quantity:item.quantity,
      equipped:item.equipped,
      wielded:item.wielded,
      wieldSlot:item.wieldSlot,
      attuned:item.attuned,
      charges:item.charges ? { current:item.charges.current } : undefined,
    })),
    goldGp:runtime.goldGp,
  };
}

export function buildCharacterLibraryRecordV1(sheet:CharacterSheet, previous?:CharacterLibraryRecordV1):CharacterLibraryRecordV1 {
  const source = projectCharacterSourceV1(sheet);
  const runtime = projectCharacterRuntimeDurableV1(sheet);
  const sourceRevision = previous
    ? previous.sourceRevision + (same(previous.source,source) ? 0 : 1)
    : Math.max(1,sheet.sourceRevision ?? 1);
  const runtimeRevision = previous
    ? previous.runtimeRevision + (same(comparableRuntime(previous.runtime),runtime) ? 0 : 1)
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

function applyProgressionSource(sheet:CharacterSheet,progression:CharacterProgressionSelectionsV1) {
  sheet.expertiseSkills=progression.expertiseSkills ? cp(progression.expertiseSkills) : undefined;
  sheet.expertiseSources=progression.expertiseSources ? cp(progression.expertiseSources) : undefined;
  sheet.languageSources=progression.languageSources ? cp(progression.languageSources) : undefined;
  sheet.cantripSources=progression.cantripSources ? cp(progression.cantripSources) : undefined;
  sheet.preparedSpellSources=progression.preparedSpellSources ? cp(progression.preparedSpellSources) : undefined;
  sheet.spellbookSpellSources=progression.spellbookSpellSources ? cp(progression.spellbookSpellSources) : undefined;
  sheet.spellMasterySpellIds=progression.spellMasterySpellIds ? cp(progression.spellMasterySpellIds) : undefined;
  sheet.spellMasterySources=progression.spellMasterySources ? cp(progression.spellMasterySources) : undefined;
  sheet.signatureSpellIds=progression.signatureSpellIds ? cp(progression.signatureSpellIds) : undefined;
  sheet.signatureSpellSources=progression.signatureSpellSources ? cp(progression.signatureSpellSources) : undefined;
  sheet.metamagicIds=progression.metamagicIds ? cp(progression.metamagicIds) : undefined;
  sheet.metamagicSources=progression.metamagicSources ? cp(progression.metamagicSources) : undefined;
  sheet.eldritchInvocationIds=progression.eldritchInvocationIds ? cp(progression.eldritchInvocationIds) : undefined;
  sheet.eldritchInvocationSources=progression.eldritchInvocationSources ? cp(progression.eldritchInvocationSources) : undefined;
  sheet.mysticArcanumSpellIds=progression.mysticArcanumSpellIds ? cp(progression.mysticArcanumSpellIds) : undefined;
  sheet.mysticArcanumSources=progression.mysticArcanumSources ? cp(progression.mysticArcanumSources) : undefined;
  sheet.persistentFeatureOptionIds=progression.persistentFeatureOptionIds ? cp(progression.persistentFeatureOptionIds) : undefined;
  sheet.persistentFeatureOptionSources=progression.persistentFeatureOptionSources ? cp(progression.persistentFeatureOptionSources) : undefined;
  sheet.epicBoonFeatIds=progression.epicBoonFeatIds ? cp(progression.epicBoonFeatIds) : undefined;
  sheet.epicBoonFeatSources=progression.epicBoonFeatSources ? cp(progression.epicBoonFeatSources) : undefined;
  sheet.weaponMasteryIds=progression.weaponMasteryIds ? cp(progression.weaponMasteryIds) : undefined;
  sheet.weaponMasterySources=progression.weaponMasterySources ? cp(progression.weaponMasterySources) : undefined;
  sheet.fightingStyleFeatIds=progression.fightingStyleFeatIds ? cp(progression.fightingStyleFeatIds) : undefined;
  sheet.fightingStyleFeatSources=progression.fightingStyleFeatSources ? cp(progression.fightingStyleFeatSources) : undefined;
  sheet.subclassIds=progression.subclassIds ? cp(progression.subclassIds) : undefined;
  sheet.subclassSources=progression.subclassSources ? cp(progression.subclassSources) : undefined;
  sheet.subclassFeatureIds=progression.subclassFeatureIds ? cp(progression.subclassFeatureIds) : undefined;
  sheet.subclassFeatureSources=progression.subclassFeatureSources ? cp(progression.subclassFeatureSources) : undefined;
  sheet.bardMagicalDiscoverySpellIds=progression.bardMagicalDiscoverySpellIds ? cp(progression.bardMagicalDiscoverySpellIds) : undefined;
  sheet.bardMagicalDiscoverySpellSources=progression.bardMagicalDiscoverySpellSources ? cp(progression.bardMagicalDiscoverySpellSources) : undefined;
  sheet.pactTomeCantripIds=progression.pactTomeCantripIds ? cp(progression.pactTomeCantripIds) : undefined;
  sheet.pactTomeRitualSpellIds=progression.pactTomeRitualSpellIds ? cp(progression.pactTomeRitualSpellIds) : undefined;
  sheet.pactTomeSpellSources=progression.pactTomeSpellSources ? cp(progression.pactTomeSpellSources) : undefined;
}

function applySourceSnapshot(sheet:CharacterSheet,source:CharacterSourceSnapshotV1) {
  sheet.id=source.characterId;
  sheet.name=source.name;
  sheet.className=source.build.className;
  sheet.subclassName=source.build.subclassName;
  sheet.level=source.build.level;
  sheet.species=source.build.species;
  sheet.background=source.build.background;
  sheet.abilities=cp(source.build.abilities);
  sheet.skills=cp(source.build.skills);
  sheet.classLevels=source.build.classLevels ? cp(source.build.classLevels) : undefined;
  sheet.hitDiceByDie=source.build.hitDiceByDie ? cp(source.build.hitDiceByDie) : undefined;
  sheet.size=source.build.size;
  sheet.languages=source.build.languages ? cp(source.build.languages) : undefined;
  sheet.toolProficiencies=source.build.toolProficiencies ? cp(source.build.toolProficiencies) : undefined;
  sheet.creationSelections=cp(source.build.creationSelections);
  sheet.notes=source.build.notes;
  sheet.cantrips=source.spellAndFeatureSelections.cantrips ? cp(source.spellAndFeatureSelections.cantrips) : undefined;
  sheet.preparedSpells=source.spellAndFeatureSelections.preparedSpells ? cp(source.spellAndFeatureSelections.preparedSpells) : undefined;
  sheet.spellbookSpells=source.spellAndFeatureSelections.spellbookSpells ? cp(source.spellAndFeatureSelections.spellbookSpells) : undefined;
  sheet.masteryWeapons=source.spellAndFeatureSelections.masteryWeapons ? cp(source.spellAndFeatureSelections.masteryWeapons) : undefined;
  applyProgressionSource(sheet,source.progression);
  if (source.featureGrants) sheet.features=cp(source.featureGrants);
  sheet.wildShapeKnownForms=source.wildShapeKnownForms ? cp(source.wildShapeKnownForms) : undefined;
  sheet.rulesProfileId=source.rulesProfile.id;
  sheet.rulesProfileVersion=source.rulesProfile.version;
}

function materializeResources(record:CharacterLibraryRecordV1):CharacterResourceVm[] {
  const definitions=record.source.resourceDefinitions;
  if (!definitions) return cp(record.runtime.resources as unknown as CharacterResourceVm[]);
  const runtimeById=new Map(record.runtime.resources.map((resource)=>[resource.id,resource]));
  return definitions.map((definition)=>{
    const runtime=runtimeById.get(definition.id);
    return {
      id:definition.id,
      label:definition.label,
      current:Math.min(runtime?.current ?? definition.max,definition.max),
      max:definition.max,
      source:definition.source,
      recovery:definition.recovery ? cp(definition.recovery) : undefined,
      recoveryLockouts:runtime?.recoveryLockouts ? cp(runtime.recoveryLockouts) : undefined,
    };
  });
}

function materializeItems(record:CharacterLibraryRecordV1):ItemInstanceVm[] {
  const runtimeById=new Map(record.runtime.items.map((item)=>[item.id,item]));
  return record.source.itemReferences.map((reference)=>{
    const runtime=runtimeById.get(reference.id);
    const legacy=runtime as unknown as Partial<ItemInstanceVm>|undefined;
    const maximum=reference.chargeMaximum ?? legacy?.charges?.max;
    const current=runtime?.charges?.current ?? legacy?.charges?.current;
    return {
      id:reference.id,
      definitionId:reference.definitionId,
      name:reference.name ?? legacy?.name ?? reference.definitionId,
      nameEn:reference.nameEn ?? legacy?.nameEn,
      kind:reference.kind ?? legacy?.kind ?? "equipment",
      quantity:runtime?.quantity ?? legacy?.quantity ?? 1,
      equipped:runtime?.equipped ?? legacy?.equipped ?? false,
      wielded:runtime?.wielded ?? legacy?.wielded,
      wieldSlot:runtime?.wieldSlot ?? legacy?.wieldSlot,
      attunementRequired:reference.attunementRequired ?? legacy?.attunementRequired,
      attuned:runtime?.attuned ?? legacy?.attuned,
      charges:maximum !== undefined ? { current:Math.min(current ?? maximum,maximum),max:maximum } : undefined,
      passiveEffects:cp(reference.passiveEffects ?? legacy?.passiveEffects ?? []),
      grantedActionIds:cp(reference.grantedActionIds ?? legacy?.grantedActionIds ?? []),
      provenance:cp(reference.provenance),
    };
  });
}

export function materializeCharacterRecordV1(record:CharacterLibraryRecordV1):CharacterSheet {
  const sheet = cp(record.materializedCache.sheet);
  applySourceSnapshot(sheet,record.source);
  sheet.hp = record.runtime.hp;
  sheet.tempHp = record.runtime.tempHp;
  sheet.resources = materializeResources(record);
  sheet.items = materializeItems(record);
  if (record.source.itemReferences.every((reference)=>typeof reference.name === "string")) {
    sheet.equipment=sheet.items.map((item)=>item.quantity>1 ? `${item.name} ×${item.quantity}` : item.name);
  }
  sheet.goldGp = record.runtime.goldGp;
  sheet.durableLifeFlags = record.runtime.lifeFlags ? cp(record.runtime.lifeFlags) : sheet.durableLifeFlags;
  sheet.creationAuthoringSource = record.source.creationAuthoring
    ? cp(record.source.creationAuthoring)
    : reconstructLegacyCreationAuthoringSourceV1(sheet);
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
