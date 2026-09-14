/**
 * Character JSON (M1 acceptance 5a): one file carries the source (what was chosen) and the runtime (usage).
 * Import validates the structure field by field and reports every problem at once; unknown content ids are not
 * errors here (a module may be missing) — the derivation reports them as blocking messages with the ids.
 */
import type { ContentCatalog } from "../catalog/catalog";
import { ABILITY_KEYS } from "../catalog/types";
import { initialRuntime, type CharacterRuntime } from "./runtime";
import type { CharacterSource, DerivedCharacter } from "./types";

export const CHARACTER_FILE_FORMAT = "simplevtt.character";
export const CHARACTER_SCHEMA = 2;

export interface CharacterFile {
  format: typeof CHARACTER_FILE_FORMAT;
  schema: typeof CHARACTER_SCHEMA;
  exportedAt: string;
  app: { name: string; version?: string };
  source: CharacterSource;
  runtime?: CharacterRuntime;
  /** Convenience snapshot for humans and other tools; never read back. */
  summary?: { name: string; level: number; species?: string; background?: string; classes: string[] };
}

export function exportCharacterFile(source: CharacterSource, runtime: CharacterRuntime | undefined, derived?: DerivedCharacter, version?: string): CharacterFile {
  return {
    format: CHARACTER_FILE_FORMAT,
    schema: CHARACTER_SCHEMA,
    exportedAt: new Date().toISOString(),
    app: { name: "SimpleVTT", version },
    source: structuredClone(source),
    runtime: runtime ? structuredClone(runtime) : undefined,
    summary: derived ? { name: derived.name, level: derived.level, species: derived.species?.name, background: derived.background?.name, classes: derived.classes.map((cls) => `${cls.name} ${cls.level}`) } : undefined,
  };
}

export const serializeCharacterFile = (file: CharacterFile) => `${JSON.stringify(file, null, 2)}\n`;

export interface ParsedCharacterFile {
  source?: CharacterSource;
  runtime?: CharacterRuntime;
  errors: string[];
  warnings: string[];
}

type Obj = Record<string, unknown>;
const isObject = (value: unknown): value is Obj => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === "string");
/** Drop undefined-valued keys so a parsed source equals its exported form key for key. */
const compact = <T extends object>(value: T): T => Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;

export function looksLikeCharacterFile(value: unknown): boolean {
  return isObject(value) && (value.format === CHARACTER_FILE_FORMAT || (isObject(value.source) && "tracks" in value.source));
}

export function parseCharacterFile(input: string | unknown): ParsedCharacterFile {
  const errors: string[] = [];
  const warnings: string[] = [];
  let raw: unknown = input;
  if (typeof input === "string") {
    try { raw = JSON.parse(input); } catch (error) { return { errors: [`JSON을 읽을 수 없습니다: ${(error as Error).message}`], warnings }; }
  }
  if (!isObject(raw)) return { errors: ["캐릭터 파일은 JSON 객체여야 합니다."], warnings };
  // A bare source (no envelope) is accepted too.
  const envelope = raw.format === CHARACTER_FILE_FORMAT || isObject(raw.source) ? raw : { source: raw };
  if (envelope.format !== undefined && envelope.format !== CHARACTER_FILE_FORMAT) errors.push(`알 수 없는 파일 형식: ${String(envelope.format)}`);
  if (envelope.schema !== undefined && envelope.schema !== CHARACTER_SCHEMA) errors.push(`지원하지 않는 스키마 ${String(envelope.schema)} (지원: ${CHARACTER_SCHEMA})`);
  const source = validateSource(envelope.source, errors, warnings);
  const runtime = envelope.runtime === undefined ? undefined : validateRuntime(envelope.runtime, errors, warnings);
  if (errors.length) return { errors, warnings };
  return { source, runtime, errors, warnings };
}

function validateSource(value: unknown, errors: string[], warnings: string[]): CharacterSource | undefined {
  if (!isObject(value)) { errors.push("source가 없습니다."); return undefined; }
  const at = (path: string, message: string) => errors.push(`source.${path}: ${message}`);
  if (value.schema !== undefined && value.schema !== CHARACTER_SCHEMA) at("schema", `지원하지 않는 값 ${String(value.schema)}`);
  const id = typeof value.id === "string" && value.id.trim() ? value.id : undefined;
  if (!id) at("id", "문자열이어야 합니다.");
  const name = typeof value.name === "string" ? value.name : undefined;
  if (name === undefined) at("name", "문자열이어야 합니다.");
  const rules = isObject(value.rules) ? value.rules : undefined;
  if (!rules) at("rules", "객체여야 합니다 (profile, modules).");
  const origin = isObject(value.origin) ? value.origin : undefined;
  if (!origin) at("origin", "객체여야 합니다 (speciesId, backgroundId).");
  else {
    if (typeof origin.speciesId !== "string") at("origin.speciesId", "문자열이어야 합니다.");
    if (typeof origin.backgroundId !== "string") at("origin.backgroundId", "문자열이어야 합니다.");
  }
  const abilities = isObject(value.abilities) ? value.abilities : undefined;
  if (!abilities) at("abilities", "객체여야 합니다 (method, base).");
  else {
    if (!["point-buy", "standard-array", "manual"].includes(String(abilities.method))) at("abilities.method", "point-buy | standard-array | manual 중 하나여야 합니다.");
    const base = isObject(abilities.base) ? abilities.base : undefined;
    if (!base) at("abilities.base", "객체여야 합니다.");
    else for (const key of ABILITY_KEYS) if (!Number.isInteger(base[key])) at(`abilities.base.${key}`, "정수여야 합니다.");
  }
  if (!Array.isArray(value.tracks)) at("tracks", "배열이어야 합니다.");
  else value.tracks.forEach((track, index) => {
    if (!isObject(track) || typeof track.classId !== "string") { at(`tracks[${index}]`, "classId가 필요합니다."); return; }
    const hp = track.hp;
    if (!isObject(hp) || (hp.kind !== "fixed" && hp.kind !== "roll") || (hp.kind === "roll" && !Number.isInteger(hp.value))) at(`tracks[${index}].hp`, "{kind:\"fixed\"} 또는 {kind:\"roll\", value}여야 합니다.");
  });
  if (Array.isArray(value.tracks) && value.tracks.length > 20) at("tracks", "최대 20레벨입니다.");
  const choices: Record<string, string[]> = {};
  if (value.choices !== undefined) {
    if (!isObject(value.choices)) at("choices", "객체여야 합니다.");
    else for (const [key, list] of Object.entries(value.choices)) {
      if (isStringArray(list)) choices[key] = list; else warnings.push(`source.choices.${key}: 문자열 배열이 아니어서 무시합니다.`);
    }
  }
  const equipment = isObject(value.equipment) ? value.equipment : undefined;
  if (!equipment || (equipment.mode !== "loadout" && equipment.mode !== "gold")) at("equipment.mode", "loadout | gold 여야 합니다.");
  if (errors.length) return undefined;
  const now = new Date().toISOString();
  const parsed: CharacterSource = {
    schema: CHARACTER_SCHEMA,
    id: id!,
    name: name!,
    portrait: typeof value.portrait === "string" ? value.portrait : undefined,
    alignment: typeof value.alignment === "string" ? value.alignment : undefined,
    notes: isObject(value.notes) ? (value.notes as CharacterSource["notes"]) : undefined,
    rules: { profile: typeof rules!.profile === "string" ? rules!.profile : "dnd.srd-5.2.1", modules: isStringArray(rules!.modules) ? rules!.modules : [] },
    origin: { speciesId: origin!.speciesId as string, backgroundId: origin!.backgroundId as string },
    abilities: { method: abilities!.method as CharacterSource["abilities"]["method"], base: Object.fromEntries(ABILITY_KEYS.map((key) => [key, (abilities!.base as Obj)[key] as number])) as CharacterSource["abilities"]["base"] },
    tracks: (value.tracks as Array<{ classId: string; hp: CharacterSource["tracks"][number]["hp"] }>).map((track) => ({ classId: track.classId, hp: track.hp.kind === "roll" ? { kind: "roll", value: track.hp.value } : { kind: "fixed" } })),
    choices,
    equipment: compact({ mode: equipment!.mode as "loadout" | "gold", startingGold: typeof equipment!.startingGold === "number" ? equipment!.startingGold : undefined }),
    xp: typeof value.xp === "number" ? value.xp : undefined,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : now,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : now,
  };
  return compact(parsed);
}

function validateRuntime(value: unknown, errors: string[], warnings: string[]): CharacterRuntime | undefined {
  if (!isObject(value)) { warnings.push("runtime이 객체가 아니어서 무시합니다."); return undefined; }
  const hp = isObject(value.hp) ? value.hp : undefined;
  if (!hp || !Number.isInteger(hp.current)) { errors.push("runtime.hp.current: 정수여야 합니다."); return undefined; }
  const numberMap = (input: unknown): Record<string, number> => (isObject(input) ? Object.fromEntries(Object.entries(input).filter(([, count]) => Number.isInteger(count))) as Record<string, number> : {});
  const equipped = isObject(value.equipped) ? value.equipped : {};
  const pick = (key: string) => (typeof equipped[key] === "string" ? (equipped[key] as string) : undefined);
  return {
    schema: CHARACTER_SCHEMA,
    characterId: typeof value.characterId === "string" ? value.characterId : "",
    hp: { current: hp.current as number, temp: Number.isInteger(hp.temp) ? (hp.temp as number) : 0, maxSeen: Number.isInteger(hp.maxSeen) ? (hp.maxSeen as number) : (hp.current as number) },
    hitDiceSpent: numberMap(value.hitDiceSpent),
    slotsUsed: numberMap(value.slotsUsed) as Record<number, number>,
    pactSlotsUsed: Number.isInteger(value.pactSlotsUsed) ? (value.pactSlotsUsed as number) : 0,
    resourcesUsed: numberMap(value.resourcesUsed),
    conditions: isStringArray(value.conditions) ? value.conditions : [],
    exhaustion: Number.isInteger(value.exhaustion) ? (value.exhaustion as number) : 0,
    deathSaves: isObject(value.deathSaves) ? { success: Number(value.deathSaves.success ?? 0), failure: Number(value.deathSaves.failure ?? 0) } : { success: 0, failure: 0 },
    heroicInspiration: value.heroicInspiration === true,
    equipped: compact({ armor: pick("armor"), shield: pick("shield"), mainHand: pick("mainHand"), offHand: pick("offHand") }),
    attuned: isStringArray(value.attuned) ? value.attuned : [],
    gold: typeof value.gold === "number" ? value.gold : 0,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString(),
  };
}

/** Content ids the source names that the catalog does not know — the modules to install before the sheet works. */
export function unknownContentIds(source: CharacterSource, catalog: ContentCatalog): string[] {
  const missing: string[] = [];
  if (source.origin.speciesId && !catalog.speciesById(source.origin.speciesId)) missing.push(source.origin.speciesId);
  if (source.origin.backgroundId && !catalog.backgroundById(source.origin.backgroundId)) missing.push(source.origin.backgroundId);
  for (const track of source.tracks) if (!catalog.classById(track.classId) && !missing.includes(track.classId)) missing.push(track.classId);
  for (const values of Object.values(source.choices)) {
    for (const value of values) {
      if (!/^[a-z0-9]+(\.[a-z0-9-]+){2,}$/i.test(value) || !value.includes(".")) continue;
      if (catalog.entry(value) || catalog.spellById(value) || catalog.subclassById(value) || catalog.itemById(value)) continue;
      if (value.startsWith("invocation.") || value.startsWith("metamagic.") || value.startsWith("subclass.") || value.startsWith("species.")) continue;
      if (!missing.includes(value)) missing.push(value);
    }
  }
  return missing;
}

/** Import: a parsed source (optionally with runtime) becomes a fresh record with a new id when asked. */
export function importedRecord(parsed: ParsedCharacterFile, derived: DerivedCharacter, options: { newId?: string } = {}) {
  const source = options.newId ? { ...parsed.source!, id: options.newId } : parsed.source!;
  const runtime = parsed.runtime ? { ...parsed.runtime, characterId: source.id } : initialRuntime({ ...derived, id: source.id });
  return { source, runtime };
}
