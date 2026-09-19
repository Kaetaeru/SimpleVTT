/**
 * ContentCatalog — one id space for the SRD 5.2.1 modules and installed modules (docs/design/v3/NEW_CLIENT.md §2).
 *
 * The catalog turns RuleModule JSON into typed views the character engine reads: classes (with their level tables),
 * subclasses, species, backgrounds, feats, spells (with class lists), items and starting loadouts. Builtin data that the
 * modules do not carry (subclass feature tables, species choice details, feature descriptions, spell lists above
 * level 1) comes in through `SrdExtras`, JSON under content/srd-extras (H7b, D252).
 */
import { readCustomMonster } from "../compendium/customMonster";
import type { MonsterView } from "../compendium/monsters";
import type {
  AbilityKey, CatalogEntry, CreationIndexJson, EntryJson, IndexClassChoiceJson, IndexClassJson, IndexSpeciesSemanticsJson,
  ProgressionCatalogJson, ProgressionLevelRowJson, RuleModuleJson, SpellPresentationJson,
} from "./types";
import { parseContract, type CommonPlayContract } from "../rules/contract";
import type { ClassOptionPool, ClassRules } from "../rules/classes";
import type { SpeciesOptionEffect, SrdSpeciesData, SrdSubclassChoice, SrdSubclassData } from "../data/srd";

export interface FeatureRecord {
  /** Stable id such as `fighter.second-wind` or `dnd.srd521.feature.cleric.life-domain.preserve-life`. */
  id: string;
  name: string;
  nameEn: string;
  description?: string;
  descriptionSource?: "module" | "srd-summary";
  /**
   * D310: what a level-table row does besides being a feature — ask for the subclass, an Ability Score Improvement or
   * an Epic Boon, or mark where subclass features land. A module class says so; the SRD table is read by its words.
   */
  role?: ClassRowRole;
}

/** D310: the kinds of level-table row that are the table's own structure rather than a feature of their own. */
export type ClassRowRole = "subclass" | "asi" | "epic-boon" | "subclass-feature";
const ROW_ROLES: readonly ClassRowRole[] = ["subclass", "asi", "epic-boon", "subclass-feature"];
/** D310: one row of a module class's `class-definition.levels`. A feature is an entry id, a plain name, or a role. */
interface ModuleClassLevel { level: number; proficiencyBonus?: number; features?: Array<string | { role: ClassRowRole; name?: string }>; columns?: Record<string, string | number | null> }

export interface ClassLevelRow extends ProgressionLevelRowJson { featureRecords: FeatureRecord[] }

export interface ClassView {
  id: string;
  slug: string;
  name: string;
  nameEn: string;
  summary?: string;
  hitDie: number;
  primaryAbilities: AbilityKey[];
  savingThrows: AbilityKey[];
  skillChoice: { count: number; options: string[] | "any" };
  level1Choices: IndexClassChoiceJson[];
  spells?: IndexClassJson["spells"];
  casterKind: "full" | "half" | "pact" | "none";
  progression: ClassLevelRow[];
  multiclassGrants: string[];
  /** H4 (D243): training, multiclass rules, casting ability, resources and option pools from the class definition. */
  rules: ClassRules;
  scope: "builtin" | "installed";
}

export interface SubclassFeature extends FeatureRecord { level: number }

export interface SubclassView {
  id: string;
  classId: string;
  name: string;
  nameEn: string;
  summary?: string;
  description?: string;
  features: SubclassFeature[];
  /** Always-prepared spells by class level (domain/oath/circle spells), resolved to spell ids. */
  spells: Record<number, string[]>;
  /** H7b (D252): the choices the subclass adds, and the spells a chosen option prepares (English names). */
  choices: SrdSubclassChoice[];
  spellsByOption: NonNullable<SrdSubclassData["spellsByOption"]>;
  /** D303: the subclass makes a class that does not cast a one-third caster. */
  spellcasting?: SubclassSpellcasting;
  /** D303: option lists the subclass knows in growing numbers by class level, the way a class's pools work. */
  optionPools: ClassOptionPool[];
  scope: "builtin" | "installed";
}

/** D303: spellcasting a subclass grants — the casting ability, the class list it prepares from, counts by class level. */
export interface SubclassSpellcasting {
  kind: "third";
  ability: AbilityKey;
  /** Class id whose spell list the subclass prepares from. */
  list: string;
  cantrips: Record<string, number>;
  prepared: Record<string, number>;
}

export interface SpeciesTrait extends FeatureRecord { minLevel?: number }

export interface SpeciesChoiceOption { id: string; name: string; nameEn?: string; summary?: string }
export interface SpeciesChoice {
  id: string;
  label: string;
  description?: string;
  count: number;
  /** Option list, or a special pool: "any-skill" | "any-origin-feat" | "spellcasting-ability". */
  options: SpeciesChoiceOption[] | "any-skill" | "any-origin-feat" | "spellcasting-ability";
}

export interface SpeciesView {
  id: string;
  name: string;
  nameEn: string;
  summary?: string;
  description?: string;
  sizes: string[];
  speed: number;
  darkvision?: number;
  traits: SpeciesTrait[];
  choices: SpeciesChoice[];
  semantics: IndexSpeciesSemanticsJson;
  /** H7b (D252): what each option of a choice does (choice id → option id). */
  effects: Record<string, Record<string, SpeciesOptionEffect>>;
  scope: "builtin" | "installed";
}

export interface BackgroundView {
  id: string;
  name: string;
  nameEn: string;
  description?: string;
  abilityChoices: AbilityKey[];
  skills: string[];
  tool?: string;
  toolChoice?: string;
  originFeat: string;
  /** For `magic-initiate-<list>` style references: the base feat id and the preselected choice. */
  originFeatPreset?: Record<string, string>;
  equipmentChoice: boolean;
  scope: "builtin" | "installed";
}

export type FeatTier = "origin" | "general" | "fighting-style" | "epic-boon";

export interface FeatView {
  id: string;
  name: string;
  nameEn: string;
  description?: string;
  tier: FeatTier;
  repeatable: boolean;
  minimumLevel?: number;
  abilityPrerequisite?: { any: AbilityKey[]; minimum: number };
  abilityIncrease?: { any?: AbilityKey[]; amount: number; maximum: number };
  requires?: string;
  grants: string[];
  choices?: Record<string, unknown>;
  config: Record<string, unknown>;
  scope: "builtin" | "installed";
}

export interface SpellView {
  id: string;
  name: string;
  nameEn: string;
  level: number;
  school: string;
  ritual: boolean;
  castingTime: string;
  range: string;
  components: string;
  duration: string;
  summary?: string;
  description?: string;
  /** Class ids whose spell list contains this spell. */
  classes: string[];
  scope: "builtin" | "installed";
}

export type ItemKind = "weapon" | "armor" | "shield" | "tool" | "gear" | "pack" | "focus" | "ammunition" | "consumable";

export interface WeaponDefinition { training: "simple" | "martial"; mode: "melee" | "ranged"; damage: string; damageType: string; properties: string[]; mastery?: string }
export interface ArmorDefinition { training: "light" | "medium" | "heavy"; base: number; dexMax?: number; dexFull: boolean; strengthRequirement?: number; stealthDisadvantage: boolean }

export interface ItemView {
  id: string;
  name: string;
  nameEn: string;
  kind: ItemKind;
  weightLb?: number;
  priceGp?: number;
  weapon?: WeaponDefinition;
  armor?: ArmorDefinition;
  shieldBonus?: number;
  tool?: { ability?: AbilityKey };
  /** H5d (D247): used up when used, and the healing it rolls (`consumable-definition`). */
  consumable?: { healing?: string };
  config: Record<string, unknown>;
  scope: "builtin" | "installed";
}

export type LoadoutOption = { id: string; items: Array<{ itemId: string; quantity: number }>; gp?: number } | { id: string; startingGoldGp: number };
export interface LoadoutView { ownerId: string; options: LoadoutOption[] }

export interface ClassOptionDefinition {
  id: string;
  name: string;
  nameEn?: string;
  description?: string;
  minLevel?: number;
  cost?: number;
  repeatable?: boolean;
  prerequisiteOptionId?: string;
  /** What the option needs besides level: e.g. `damage-cantrip` picks a warlock cantrip. */
  targetKind?: string;
}

/** Builtin data the SRD modules do not carry; JSON under content/srd-extras (H7b, D252). */
export interface SrdExtras {
  classFeatures: Record<string, Array<{ level: number; name: string; nameEn: string; id: string; description: string }>>;
  subclasses: SrdSubclassData[];
  species: Record<string, SrdSpeciesData>;
  feats: Record<string, { description: string }>;
  backgrounds: Record<string, { description: string }>;
  /** Class spell lists by level as English names (levels the index does not cover). */
  spellLists: Record<string, Record<number, string[]>>;
  classOptions: Record<string, ClassOptionDefinition[]>;
}

export interface CatalogInputs {
  modules: readonly RuleModuleJson[];
  installedModules?: readonly RuleModuleJson[];
  index: CreationIndexJson;
  progression: ProgressionCatalogJson;
  spellPresentations: readonly SpellPresentationJson[];
  extras: SrdExtras;
}

const LOCALE = "ko-KR";

function presentationOf(entry: EntryJson) {
  const locale = entry.presentation?.locales?.[LOCALE] ?? entry.presentation?.locales?.[entry.presentation?.defaultLocale ?? LOCALE];
  return { name: locale?.name ?? entry.presentation?.originalName ?? entry.id, nameEn: entry.presentation?.originalName ?? entry.id, summary: locale?.summary, description: locale?.description };
}

/**
 * R62 (D197): merge a patch entry onto the one already in the catalog. Mechanics are matched by kind and their
 * configs shallow-merged with the patch winning; a kind the patch does not mention is kept whole, and so is the
 * presentation unless the patch brings its own. A patch that only carries `feat-definition` therefore adds machine
 * keys to somebody else's feat without touching a word of its text.
 */
function patchEntry(existing: CatalogEntry, patch: CatalogEntry, raw: EntryJson): CatalogEntry {
  const mechanics = [
    ...existing.mechanics.map((item) => {
      const incoming = patch.mechanics.find((candidate) => candidate.kind === item.kind);
      return incoming ? { ...item, config: { ...(item.config ?? {}), ...(incoming.config ?? {}) } } : item;
    }),
    ...patch.mechanics.filter((item) => !existing.mechanics.some((candidate) => candidate.kind === item.kind)),
  ];
  const named = Boolean(raw.presentation);
  return {
    ...existing,
    ...(named ? { name: patch.name, nameEn: patch.nameEn, summary: patch.summary, description: patch.description } : {}),
    tags: [...new Set([...existing.tags, ...patch.tags])],
    mechanics,
    relationships: patch.relationships.length ? patch.relationships : existing.relationships,
    progressionContributions: patch.progressionContributions.length ? patch.progressionContributions : existing.progressionContributions,
    // The text is still the module that wrote it; only the scope changes, so an installed patch is removable.
    moduleId: existing.moduleId,
    scope: patch.scope,
  };
}

function mechanic<T = Record<string, unknown>>(entry: { mechanics: Array<{ kind: string; config?: Record<string, unknown> }> }, kind: string): T | undefined {
  return entry.mechanics.find((item) => item.kind === kind)?.config as T | undefined;
}

export const slugOfId = (id: string) => id.split(".").pop() ?? id;

/**
 * The text under a heading line of a compiled description (installed species traits). D304: a trait may run over
 * several paragraphs (천상의 현현 and its three forms), so the paragraphs after the heading's own block belong to it
 * until the next heading in `stops` — the other traits' names.
 */
export function sectionOf(description: string | undefined, heading: string, stops: readonly string[] = []): string | undefined {
  if (!description) return undefined;
  const wanted = heading.trim();
  const next = new Set(stops.map((stop) => stop.trim()).filter((stop) => stop !== wanted));
  const blocks = description.split(/\n\s*\n/).map((block) => block.split("\n").map((line) => line.trim()).filter(Boolean));
  const start = blocks.findIndex((lines) => lines.length >= 2 && lines[0] === wanted);
  if (start < 0) return undefined;
  const paragraphs = [blocks[start].slice(1).join(" ")];
  for (const lines of blocks.slice(start + 1)) {
    if (!lines.length || next.has(lines[0])) break;
    paragraphs.push(lines.join("\n"));
  }
  return paragraphs.join("\n\n");
}

const normalizeName = (name: string) => name.toLowerCase().replace(/[’']/g, "'").trim();

export class ContentCatalog {
  readonly entries = new Map<string, CatalogEntry>();
  readonly classes: ClassView[];
  readonly subclasses: SubclassView[];
  readonly species: SpeciesView[];
  readonly backgrounds: BackgroundView[];
  readonly feats: FeatView[];
  readonly spells: SpellView[];
  readonly items: ItemView[];
  readonly loadouts: LoadoutView[];
  /** D311: stat blocks the modules define (`combatant` entries with a `monster-definition`). */
  readonly monsters: MonsterView[];
  readonly skills: Record<string, string>;
  readonly languages: { standard: Array<{ id: string; name: string; nameEn: string }>; general: Array<{ id: string; name: string; nameEn: string }> };
  readonly classOptions: Record<string, ClassOptionDefinition[]>;
  readonly index: CreationIndexJson;
  readonly warnings: string[] = [];
  /**
   * R34 (D171): every `common-play` contract in the installed content, keyed by the feature rule key it belongs to
   * (`fighter.action-surge`). The client used to import these modules and read nothing out of them.
   */
  readonly contracts = new Map<string, CommonPlayContract>();
  private readonly spellIdByName = new Map<string, string>();
  /** Module spell ids that name a presentation-catalog spell under a different slug. */
  readonly spellAliases = new Map<string, string>();

  constructor(private readonly inputs: CatalogInputs) {
    for (const module of inputs.modules) this.addModule(module, "builtin");
    for (const module of inputs.installedModules ?? []) this.addModule(module, "installed");
    this.index = inputs.index;
    this.skills = inputs.index.skills;
    this.languages = { standard: inputs.index.standardLanguages, general: inputs.index.generalLanguages };
    this.classOptions = this.buildClassOptions();
    this.spells = this.buildSpells();
    this.classes = this.buildClasses();
    this.subclasses = this.buildSubclasses();
    this.species = this.buildSpecies();
    this.backgrounds = this.buildBackgrounds();
    this.feats = this.buildFeats();
    this.items = this.buildItems();
    this.monsters = this.buildMonsters();
    this.loadouts = this.buildLoadouts();
  }

  private addModule(module: RuleModuleJson, scope: "builtin" | "installed") {
    for (const raw of module.content ?? []) {
      const p = presentationOf(raw);
      const entry: CatalogEntry = {
        id: raw.id, category: raw.category, name: p.name, nameEn: p.nameEn, summary: p.summary, description: p.description,
        tags: raw.tags ?? [], mechanics: raw.mechanics ?? [], relationships: raw.relationships ?? [], progressionContributions: raw.progressionContributions ?? [],
        moduleId: module.moduleId, scope,
      };
      const existing = this.entries.get(raw.id);
      // R62 (D197): a module may *patch* an entry instead of replacing it. Where both carry the same mechanic kind,
      // the configs are merged with the newer one winning key by key, and anything the patch leaves out — the
      // presentation, the description, the other mechanics — is kept. That is what lets a small module fill in the
      // machine-readable half of somebody else's content without restating its text.
      if (existing && scope === "installed") this.entries.set(raw.id, patchEntry(existing, entry, raw));
      else this.entries.set(raw.id, entry);
      const merged = this.entries.get(raw.id)!;
      const contract = mechanic<Record<string, unknown>>(merged, "common-play");
      if (contract) { const parsed = parseContract(contract, merged.id); this.contracts.set(parsed.ruleKey, parsed); }
    }
  }

  entry(id: string) { return this.entries.get(id); }
  /** R34 (D171): the contract for a feature rule key (`featureRuleKey(feature.id)`), when the content ships one. */
  /**
   * A contract by rule key. V3d (D258): `<rule key>#<use>` is one labelled use of it — only that entry point, with its
   * own payments; the plain key is the rest of the contract, without its labelled uses.
   */
  contractFor(ruleKey: string) {
    const hash = ruleKey.indexOf("#");
    const contract = this.contracts.get(hash < 0 ? ruleKey : ruleKey.slice(0, hash));
    if (!contract || !contract.entryPoints.some((entry) => entry.label)) return hash < 0 ? contract : undefined;
    if (hash < 0) {
      const rest = contract.entryPoints.filter((entry) => !entry.label);
      // A feature that is only its uses says so on its own line; each use has the rest.
      const uses = contract.entryPoints.filter((entry) => entry.label).map((entry) => entry.label).join(" · ");
      return { ...contract, entryPoints: rest.length ? rest : [{ id: "uses", invocation: "manual", operations: [{ kind: "property.modify" as const, property: "rule.applied-elsewhere", operation: "set", note: `사용: ${uses} — 아래 줄` }] }] };
    }
    const use = contract.entryPoints.find((entry) => entry.label && entry.id === ruleKey.slice(hash + 1));
    return use ? { ...contract, entryPoints: [use], payments: use.payments ?? contract.payments } : undefined;
  }
  /** V3d (D258): the labelled uses a contract names. */
  contractUses(ruleKey: string) { return (this.contracts.get(ruleKey)?.entryPoints ?? []).filter((entry) => entry.label).map((entry) => ({ id: entry.id, label: entry.label!, when: entry.when })); }
  name(id: string) { return this.entries.get(id)?.name ?? this.spellById(id)?.name ?? id; }
  byCategory(category: string) { return [...this.entries.values()].filter((entry) => entry.category === category); }

  classById(id: string) { return this.classes.find((entry) => entry.id === id); }
  classBySlug(slug: string) { return this.classes.find((entry) => entry.slug === slug); }
  subclassById(id: string) { return this.subclasses.find((entry) => entry.id === id); }
  subclassesOf(classId: string) { return this.subclasses.filter((entry) => entry.classId === classId); }
  speciesById(id: string) { return this.species.find((entry) => entry.id === id); }
  backgroundById(id: string) { return this.backgrounds.find((entry) => entry.id === id); }
  featById(id: string) { return this.feats.find((entry) => entry.id === id); }
  spellById(id: string) { const canonical = this.spellAliases.get(id) ?? id; return this.spells.find((entry) => entry.id === canonical); }
  spellByName(nameEn: string) { const id = this.spellIdByName.get(normalizeName(nameEn)); return id ? this.spellById(id) : undefined; }
  itemById(id: string) { return this.items.find((entry) => entry.id === id); }
  loadoutFor(ownerId: string) { return this.loadouts.find((entry) => entry.ownerId === ownerId); }
  /** Spells of a class list at a level (0 = cantrips). */
  spellsFor(classId: string, level: number) { return this.spells.filter((spell) => spell.level === level && spell.classes.includes(classId)); }

  // ---- builders ----

  /**
   * D311: a module's monster. `monster-definition` is either a whole stat block (`statBlock`, the shape the table
   * keeps) or the paste format a person writes (docs/guides/CUSTOM_NPC_JSON.md), read by the same reader as a paste.
   */
  private buildMonsters(): MonsterView[] {
    const monsters: MonsterView[] = [];
    for (const entry of this.byCategory("combatant")) {
      const def = mechanic<Record<string, unknown>>(entry, "monster-definition");
      if (!def) continue;
      if (def.statBlock && typeof def.statBlock === "object") { monsters.push({ ...(def.statBlock as MonsterView), id: entry.id, slug: slugOfId(entry.id), name: entry.name, nameEn: entry.nameEn }); continue; }
      const read = readCustomMonster({ ...def, name: entry.name, nameEn: entry.nameEn }, Math.random, entry.id);
      if ("error" in read) { this.warnings.push(`괴물 "${entry.id}": ${read.error}`); continue; }
      monsters.push({ ...read.monster, slug: slugOfId(entry.id) });
    }
    return monsters;
  }

  private buildSpells(): SpellView[] {
    const byId = new Map<string, SpellView>();
    for (const p of this.inputs.spellPresentations) {
      byId.set(p.id, { id: p.id, name: p.name, nameEn: p.nameEn, level: p.level, school: p.school, ritual: p.ritual, castingTime: p.castingTime, range: p.range, components: p.components, duration: p.duration, summary: p.summary, description: p.description, classes: [], scope: "builtin" });
    }
    const byName = new Map<string, SpellView>();
    for (const spell of byId.values()) byName.set(normalizeName(spell.nameEn), spell);
    // Installed spells (spell-definition mechanic) and builtin module spells that the presentation catalog lacks.
    // A module entry whose name matches a presentation spell is the same spell (the module ids differ in slug form).
    for (const entry of this.byCategory("spell")) {
      const def = mechanic<{ level?: number; school?: string; ritual?: boolean; castingTimeText?: string; rangeText?: string; componentsText?: string; durationText?: string; summary?: string; classes?: string[] }>(entry, "spell-definition");
      const existing = byId.get(entry.id) ?? byName.get(normalizeName(entry.nameEn));
      if (existing) {
        if (existing.id !== entry.id) this.spellAliases.set(entry.id, existing.id);
        if (entry.scope === "installed" && def?.classes) existing.classes.push(...def.classes.map((key) => this.classIdFromKey(key)));
        continue;
      }
      byId.set(entry.id, {
        id: entry.id, name: entry.name, nameEn: entry.nameEn, level: def?.level ?? 0, school: def?.school ?? "evocation", ritual: def?.ritual ?? false,
        castingTime: def?.castingTimeText ?? "행동", range: def?.rangeText ?? "—", components: def?.componentsText ?? "—", duration: def?.durationText ?? "즉시",
        summary: entry.summary ?? def?.summary, description: entry.description, classes: (def?.classes ?? []).map((key) => this.classIdFromKey(key)), scope: entry.scope,
      });
    }
    const spells = [...byId.values()];
    for (const spell of spells) this.spellIdByName.set(normalizeName(spell.nameEn), spell.id);
    // Class lists: the index (levels 0–1) plus the authored extras (levels 2–9 and any corrections).
    const lists: Record<string, Record<string, string[]>> = {};
    for (const [classId, levels] of Object.entries(this.inputs.index.spellLists)) lists[classId] = { ...levels };
    for (const [classKey, levels] of Object.entries(this.inputs.extras.spellLists)) {
      const classId = this.classIdFromKey(classKey);
      lists[classId] = lists[classId] ?? {};
      for (const [level, names] of Object.entries(levels)) lists[classId][level] = [...(lists[classId][level] ?? []), ...names];
    }
    for (const [classId, levels] of Object.entries(lists)) {
      for (const [level, names] of Object.entries(levels)) {
        for (const nameEn of names) {
          const id = this.spellIdByName.get(normalizeName(nameEn));
          const spell = id ? byId.get(id) : undefined;
          if (!spell) { this.warnings.push(`주문 목록 ${classId} L${level}: "${nameEn}"을(를) 찾을 수 없습니다.`); continue; }
          if (spell.level !== Number(level)) this.warnings.push(`주문 목록 ${classId} L${level}: "${nameEn}"의 레벨은 ${spell.level}입니다.`);
          if (!spell.classes.includes(classId)) spell.classes.push(classId);
        }
      }
    }
    return spells.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, "ko"));
  }

  private classIdFromKey(key: string) {
    if (key.startsWith("dnd.") || key.includes(".class.")) return key;
    return `dnd.srd521.class.${key.toLowerCase()}`;
  }

  private buildClasses(): ClassView[] {
    const abilityText = (text: string): AbilityKey[] => {
      const map: Record<string, AbilityKey> = { 근력: "str", 민첩: "dex", 건강: "con", 지능: "int", 지혜: "wis", 매력: "cha" };
      return Object.entries(map).filter(([ko]) => text.includes(ko)).map(([, key]) => key);
    };
    const views: ClassView[] = [];
    for (const entry of this.byCategory("class")) {
      // D310: a module class carries its whole level table and creation choices here; the SRD's still come from the
      // generated progression and the creation index until the SRD itself is a module (SRD_MODULE_PLAN.md S5).
      const def = mechanic<{ hitDie?: number; primaryAbilities?: AbilityKey[]; savingThrowProficiencies?: AbilityKey[]; skillChoiceCount?: number; casterKind?: ClassView["casterKind"]; levels?: ModuleClassLevel[]; multiclassGrants?: string[]; skillOptions?: ClassView["skillChoice"]; level1Choices?: IndexClassChoiceJson[]; spells?: IndexClassJson["spells"] } & Partial<ClassRules>>(entry, "class-definition") ?? {};
      const slug = slugOfId(entry.id);
      const table = this.inputs.progression.classes.find((row) => row.id === entry.id);
      const indexClass = this.inputs.index.classes[entry.id];
      const descriptions = this.inputs.extras.classFeatures[slug] ?? [];
      const moduleRows: ClassLevelRow[] | undefined = def.levels?.map((row) => {
        const records = (row.features ?? []).map((item): FeatureRecord => {
          if (typeof item === "object" && ROW_ROLES.includes(item.role)) return { id: `${slug}.${item.role}`, name: item.name ?? item.role, nameEn: item.role, role: item.role };
          const id = String(item);
          const found = this.entries.get(id);
          return found ? { id, name: found.name, nameEn: found.nameEn, description: found.description ?? found.summary, descriptionSource: "module" } : { id: `${slug}.${row.level}.${id}`, name: id, nameEn: id };
        });
        const columns = Object.fromEntries(Object.entries(row.columns ?? {}).map(([key, value]) => [key, value === null ? null : String(value)]));
        return { level: row.level, proficiencyBonus: row.proficiencyBonus ?? 2 + Math.floor((row.level - 1) / 4), features: records.map((record) => record.name), columns, featureRecords: records };
      }).sort((a, b) => a.level - b.level);
      const progression: ClassLevelRow[] = moduleRows ?? (table?.progression ?? []).map((row) => ({
        ...row,
        featureRecords: row.features.map((name) => {
          const found = descriptions.find((item) => item.name === name && (item.level === row.level || item.level === 0)) ?? descriptions.find((item) => item.name === name);
          if (!found) { this.warnings.push(`직업 특성 설명 없음: ${slug} ${row.level}레벨 "${name}"`); return { id: `${slug}.${row.level}.${name}`, name, nameEn: name }; }
          return { id: found.id, name: found.name, nameEn: found.nameEn, description: found.description, descriptionSource: "srd-summary" as const };
        }),
      }));
      const casterKind = def.casterKind ?? ((table?.spellcastingMode === "full" || table?.spellcastingMode === "half" || table?.spellcastingMode === "pact") ? table.spellcastingMode : "none");
      views.push({
        id: entry.id, slug, name: entry.name, nameEn: entry.nameEn, summary: entry.summary,
        hitDie: def.hitDie ?? table?.hitDie ?? 8,
        primaryAbilities: def.primaryAbilities ?? abilityText(table?.primaryAbilitiesText ?? ""),
        savingThrows: def.savingThrowProficiencies ?? abilityText(table?.savingThrowsText ?? ""),
        skillChoice: def.skillOptions ?? indexClass?.skills ?? { count: def.skillChoiceCount ?? 2, options: "any" },
        level1Choices: def.level1Choices ?? indexClass?.choices ?? [],
        spells: def.spells ?? indexClass?.spells,
        casterKind,
        progression,
        multiclassGrants: def.multiclassGrants ?? table?.multiclassGrants ?? [],
        rules: {
          armorTraining: def.armorTraining ?? [], weaponTraining: def.weaponTraining ?? ["simple"], toolProficiencies: def.toolProficiencies ?? [],
          multiclass: { armor: [], weapons: [], ...(def.multiclass ?? {}) },
          ...(def.spellcastingAbility ? { spellcastingAbility: def.spellcastingAbility } : {}),
          ...(def.spellcastingFeature ? { spellcastingFeature: def.spellcastingFeature } : {}),
          resources: def.resources ?? [], optionPools: def.optionPools ?? [],
        },
        scope: entry.scope,
      });
    }
    return views.sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }

  /**
   * D303: the option lists a choice can pick from — the builtin ones, and every list a module declares with an
   * `option-list-definition` entry (its options are `option` entries of the same catalog, named by id).
   */
  private buildClassOptions(): Record<string, ClassOptionDefinition[]> {
    const lists: Record<string, ClassOptionDefinition[]> = { ...this.inputs.extras.classOptions };
    for (const entry of this.entries.values()) {
      // D310: an option may carry what gates it — the class level it needs, the option it needs first, its cost, and
      // what it asks for once taken (a cantrip to empower, an origin feat).
      const def = mechanic<{ list?: string; options?: Array<string | ({ id: string; requires?: string } & Pick<ClassOptionDefinition, "minLevel" | "cost" | "repeatable" | "targetKind">)> }>(entry, "option-list-definition");
      if (!def?.list) continue;
      const options: ClassOptionDefinition[] = [];
      for (const item of def.options ?? []) {
        const { id, requires, ...gates } = typeof item === "string" ? { id: item } : item;
        const option = this.entries.get(id);
        if (option) options.push({ id, name: option.name, nameEn: option.nameEn, description: option.description ?? option.summary, ...gates, ...(requires ? { prerequisiteOptionId: requires } : {}) });
        else this.warnings.push(`선택지 목록 "${def.list}"의 항목 "${id}"을(를) 찾을 수 없습니다.`);
      }
      lists[def.list] = [...(lists[def.list] ?? []).filter((item) => !options.some((option) => option.id === item.id)), ...options];
    }
    return lists;
  }

  private buildSubclasses(): SubclassView[] {
    const views: SubclassView[] = [];
    const authored = new Map(this.inputs.extras.subclasses.map((item) => [item.id, item]));
    // SRD subclasses the modules do not list yet come from the authored tables alone.
    for (const data of this.inputs.extras.subclasses) {
      if (this.entries.has(data.id)) continue;
      const spells: Record<number, string[]> = {};
      for (const [level, names] of Object.entries(data.spells ?? {})) spells[Number(level)] = names.map((name) => this.spellByName(name)?.id ?? name);
      views.push({ id: data.id, classId: data.classId, name: data.name, nameEn: data.nameEn, summary: data.summary, features: data.features.map((feature) => ({ ...feature, descriptionSource: "srd-summary" as const })).sort((a, b) => a.level - b.level), spells, choices: data.choices ?? [], spellsByOption: data.spellsByOption ?? {}, optionPools: [], scope: "builtin" });
    }
    for (const entry of this.byCategory("subclass")) {
      const classId = entry.relationships.find((rel) => rel.kind === "parent")?.target ?? "";
      const data = authored.get(entry.id);
      // H7b (D252): a module subclass writes its choices in `subclass-definition`, as the SRD extras do.
      // H7b (D252) + D300: a module subclass writes its choices — and the spells it always prepares, by class level — here.
      const def = mechanic<Pick<SrdSubclassData, "choices" | "spellsByOption"> & { spells?: Record<string, string[]>; spellcasting?: SubclassSpellcasting; optionPools?: ClassOptionPool[] }>(entry, "subclass-definition") ?? {};
      const features: SubclassFeature[] = [];
      if (data) {
        for (const feature of data.features) features.push({ ...feature, descriptionSource: "srd-summary" });
      } else {
        for (const contribution of entry.progressionContributions) {
          for (const grant of contribution.grants) {
            const option = this.entries.get(grant);
            features.push({ level: contribution.threshold, id: grant, name: option?.name ?? grant, nameEn: option?.nameEn ?? grant, description: option?.description, descriptionSource: "module" });
          }
        }
      }
      const spells: Record<number, string[]> = {};
      // D300: the module's own list wins where it has one; either spelling of a spell (id or English name) resolves.
      for (const [level, names] of Object.entries(def.spells ?? data?.spells ?? {})) spells[Number(level)] = (Array.isArray(names) ? names : [names]).map((name) => this.spellById(name)?.id ?? this.spellByName(name)?.id ?? name);
      views.push({ id: entry.id, classId, name: entry.name, nameEn: entry.nameEn, summary: entry.summary ?? data?.summary, description: entry.description, features: features.sort((a, b) => a.level - b.level), spells, choices: def.choices ?? data?.choices ?? [], spellsByOption: def.spellsByOption ?? data?.spellsByOption ?? {}, ...(def.spellcasting ? { spellcasting: def.spellcasting } : {}), optionPools: def.optionPools ?? [], scope: entry.scope });
    }
    return views;
  }

  private buildSpecies(): SpeciesView[] {
    const views: SpeciesView[] = [];
    for (const entry of this.byCategory("species")) {
      // D313: a trait may be written whole (`{ key, name, nameEn, description, minLevel }`), and the choices as full
      // choice objects (labels, option names and summaries) — what the SRD's extras carried, now in the module.
      const def = mechanic<{ size?: string[]; speed?: number; darkvision?: number; traits?: Array<string | { key: string; name: string; nameEn?: string; description?: string; minLevel?: number }>; choices?: Record<string, unknown> | SpeciesChoice[]; semantics?: IndexSpeciesSemanticsJson; effects?: SrdSpeciesData["effects"] }>(entry, "species-definition") ?? {};
      const extras = this.inputs.extras.species[entry.id];
      const semantics = this.inputs.index.species[entry.id] ?? def.semantics ?? {};
      const traits: SpeciesTrait[] = (def.traits ?? []).map((raw, index) => {
        if (typeof raw === "object") return { id: `${entry.id}.trait.${raw.key}`, name: raw.name, nameEn: raw.nameEn ?? raw.key, ...(raw.description ? { description: raw.description, descriptionSource: "module" as const } : {}), ...(raw.minLevel ? { minLevel: raw.minLevel } : {}) };
        const [traitId, level] = raw.split("@");
        const authored = extras?.traits[traitId];
        const installedName = def.semantics?.baseFeatures?.[index]?.replace(/\s*\(.*\)\s*$/, "");
        const traitNames = (def.semantics?.baseFeatures ?? []).map((name) => name.replace(/\s*\(.*\)\s*$/, ""));
        const installedDescription = installedName ? sectionOf(entry.description, installedName, traitNames) : undefined;
        return {
          id: `${entry.id}.trait.${traitId}`,
          name: authored?.name ?? installedName ?? traitId,
          nameEn: authored?.nameEn ?? traitId,
          description: authored?.description ?? installedDescription,
          descriptionSource: authored ? "srd-summary" : installedDescription ? "module" : undefined,
          ...(level ? { minLevel: Number(level) } : {}),
        };
      });
      const choices: SpeciesChoice[] = extras?.choices ? extras.choices : Array.isArray(def.choices) ? def.choices : this.genericSpeciesChoices(def.choices ?? {}, semantics);
      views.push({ id: entry.id, name: entry.name, nameEn: entry.nameEn, summary: entry.summary, description: entry.description ?? extras?.description, sizes: def.size ?? ["medium"], speed: def.speed ?? 30, darkvision: def.darkvision, traits, choices, semantics, effects: def.effects ?? extras?.effects ?? {}, scope: entry.scope });
    }
    return views.sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }

  /** Choices for species without authored details (installed species): derived from the definition's `choices` map. */
  private genericSpeciesChoices(raw: Record<string, unknown>, semantics: IndexSpeciesSemanticsJson): SpeciesChoice[] {
    const choices: SpeciesChoice[] = [];
    for (const [key, value] of Object.entries(raw)) {
      if (value === "any") { choices.push({ id: `species.${key}`, label: key, count: 1, options: "any-skill" }); continue; }
      if (value === "any-origin-feat") { choices.push({ id: `species.${key}`, label: key, count: 1, options: "any-origin-feat" }); continue; }
      if (Array.isArray(value)) {
        const isAbility = value.every((item) => ["int", "wis", "cha"].includes(String(item)));
        choices.push({ id: `species.${key}`, label: key, count: 1, options: isAbility ? "spellcasting-ability" : value.map((item) => ({ id: String(item), name: String(item) })) });
      }
    }
    for (const extra of semantics.extraChoices ?? []) choices.push({ id: extra.id, label: extra.label, description: extra.description, count: extra.count, options: (extra.options ?? []).map((option) => ({ id: option.id, name: option.name, nameEn: option.nameEn, summary: option.summary })) });
    return choices;
  }

  private buildBackgrounds(): BackgroundView[] {
    const views: BackgroundView[] = [];
    for (const entry of this.byCategory("background")) {
      const def = mechanic<{ abilityChoices?: AbilityKey[]; skills?: string[]; tool?: string; toolChoice?: string; originFeat?: string; equipmentChoice?: boolean }>(entry, "background-definition") ?? {};
      const feat = this.resolveFeatReference(def.originFeat ?? "");
      views.push({
        id: entry.id, name: entry.name, nameEn: entry.nameEn, description: entry.description ?? this.inputs.extras.backgrounds[entry.id]?.description,
        abilityChoices: def.abilityChoices ?? ["str", "dex", "con"], skills: def.skills ?? [], tool: def.tool, toolChoice: def.toolChoice,
        originFeat: feat.id, originFeatPreset: feat.preset, equipmentChoice: def.equipmentChoice ?? true, scope: entry.scope,
      });
    }
    return views.sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }

  /** `dnd.srd521.feat.magic-initiate-cleric` → the magic-initiate feat with spellList preset to cleric. */
  resolveFeatReference(id: string): { id: string; preset?: Record<string, string> } {
    if (this.entries.has(id)) return { id };
    // A reference with a class slug appended presets that spell list (`…magic-initiate-cleric`).
    const match = /^(.*)-([a-z]+)$/.exec(id);
    if (match && this.entries.has(match[1]) && this.byCategory("class").some((entry) => slugOfId(entry.id) === match[2])) return { id: match[1], preset: { spellList: match[2] } };
    return { id };
  }

  private buildFeats(): FeatView[] {
    const views: FeatView[] = [];
    for (const entry of this.byCategory("feat")) {
      const config = mechanic<Record<string, unknown>>(entry, "feat-definition") ?? {};
      const tags = entry.tags;
      const tierRaw = (config.tier as string | undefined) ?? (tags.includes("origin") ? "origin" : tags.includes("fighting-style") ? "fighting-style" : tags.includes("epic-boon") ? "epic-boon" : "general");
      const tier: FeatTier = tierRaw === "origin" || tierRaw === "fighting-style" || tierRaw === "epic-boon" ? tierRaw : "general";
      views.push({
        id: entry.id, name: entry.name, nameEn: entry.nameEn, description: entry.description ?? this.inputs.extras.feats[entry.id]?.description,
        tier, repeatable: config.repeatable === true || tags.includes("repeatable"), minimumLevel: config.minimumLevel as number | undefined,
        abilityPrerequisite: config.abilityPrerequisite as FeatView["abilityPrerequisite"], abilityIncrease: config.abilityIncrease as FeatView["abilityIncrease"],
        requires: config.requires as string | undefined, grants: (config.grants as string[] | undefined) ?? [], choices: config.choices as Record<string, unknown> | undefined,
        config, scope: entry.scope,
      });
    }
    return views;
  }

  private buildItems(): ItemView[] {
    const kindOf = (category: string): ItemKind | null => {
      switch (category) {
        case "weapon": return "weapon";
        case "armor": return "armor";
        case "shield": return "shield";
        case "tool": return "tool";
        case "adventuring-gear": return "gear";
        case "ammunition": return "ammunition";
        case "focus": return "focus";
        case "item": return "consumable";
        default: return null;
      }
    };
    const views: ItemView[] = [];
    for (const entry of this.entries.values()) {
      const kind = kindOf(entry.category);
      if (!kind) continue;
      const anyConfig = (entry.mechanics[0]?.config ?? {}) as Record<string, unknown>;
      const weaponDef = mechanic<WeaponDefinition>(entry, "weapon-definition");
      const armorRaw = mechanic<{ training: ArmorDefinition["training"]; ac: { base: number; dex?: string; dexMax?: number }; strengthRequirement?: number; stealthDisadvantage?: boolean }>(entry, "armor-definition");
      const shield = mechanic<{ acBonus?: number }>(entry, "shield-definition");
      const tool = mechanic<{ ability?: AbilityKey }>(entry, "tool-definition");
      const consumable = mechanic<{ healing?: string }>(entry, "consumable-definition");
      const packKind = entry.mechanics.some((item) => item.kind === "pack-definition") ? "pack" : kind;
      views.push({
        id: entry.id, name: entry.name, nameEn: entry.nameEn, kind: packKind,
        weightLb: anyConfig.weightLb as number | undefined, priceGp: anyConfig.priceGp as number | undefined,
        ...(consumable ? { consumable: consumable.healing ? { healing: consumable.healing } : {} } : {}),
        ...(weaponDef ? { weapon: { ...weaponDef, properties: weaponDef.properties ?? [] } } : {}),
        ...(armorRaw ? { armor: { training: armorRaw.training, base: armorRaw.ac.base, dexMax: armorRaw.ac.dexMax, dexFull: armorRaw.ac.dex === "full", strengthRequirement: armorRaw.strengthRequirement, stealthDisadvantage: armorRaw.stealthDisadvantage ?? false } } : {}),
        ...(shield ? { shieldBonus: shield.acBonus ?? 2 } : {}),
        ...(tool ? { tool } : {}),
        config: anyConfig, scope: entry.scope,
      });
    }
    return views;
  }

  private buildLoadouts(): LoadoutView[] {
    const views: LoadoutView[] = [];
    for (const entry of this.byCategory("starting-loadout")) {
      const def = mechanic<{ ownerContentId: string; options: LoadoutOption[] }>(entry, "starting-loadout-definition");
      if (def) views.push({ ownerId: def.ownerContentId, options: def.options });
    }
    return views;
  }
}
