/**
 * ContentCatalog — one id space for the SRD 5.2.1 modules and installed modules (docs/design/v3/NEW_CLIENT.md §2).
 *
 * The catalog turns RuleModule JSON into typed views the character engine reads: classes (with their level tables),
 * subclasses, species, backgrounds, feats, spells (with class lists), items and starting loadouts. Builtin data that the
 * modules do not carry (subclass feature tables, species choice details, feature descriptions, spell lists above
 * level 1) comes in through `SrdExtras`, authored under client/data/srd.
 */
import type {
  AbilityKey, CatalogEntry, CreationIndexJson, EntryJson, IndexClassChoiceJson, IndexClassJson, IndexSpeciesSemanticsJson,
  ProgressionCatalogJson, ProgressionLevelRowJson, RuleModuleJson, SpellPresentationJson,
} from "./types";

export interface FeatureRecord {
  /** Stable id such as `fighter.second-wind` or `dnd.srd521.feature.cleric.life-domain.preserve-life`. */
  id: string;
  name: string;
  nameEn: string;
  description?: string;
  descriptionSource?: "module" | "srd-summary";
}

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
  scope: "builtin" | "installed";
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

/** Builtin data the SRD modules do not carry; authored under client/data/srd. */
export interface SrdExtras {
  classFeatures: Record<string, Array<{ level: number; name: string; nameEn: string; id: string; description: string }>>;
  subclasses: Array<{ id: string; classId: string; name: string; nameEn: string; summary: string; features: Array<{ level: number; id: string; name: string; nameEn: string; description: string }>; spells?: Record<number, string[]> }>;
  species: Record<string, { description?: string; traits: Record<string, { name: string; nameEn: string; description: string }>; choices?: SpeciesChoice[] }>;
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

function mechanic<T = Record<string, unknown>>(entry: { mechanics: Array<{ kind: string; config?: Record<string, unknown> }> }, kind: string): T | undefined {
  return entry.mechanics.find((item) => item.kind === kind)?.config as T | undefined;
}

export const slugOfId = (id: string) => id.split(".").pop() ?? id;

/** The paragraph block of a compiled description that starts with the given heading line (installed species traits). */
export function sectionOf(description: string | undefined, heading: string): string | undefined {
  if (!description) return undefined;
  const wanted = heading.trim();
  for (const block of description.split(/\n\s*\n/)) {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    if (lines.length >= 2 && lines[0] === wanted) return lines.slice(1).join(" ");
  }
  return undefined;
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
  readonly skills: Record<string, string>;
  readonly languages: { standard: Array<{ id: string; name: string; nameEn: string }>; general: Array<{ id: string; name: string; nameEn: string }> };
  readonly classOptions: Record<string, ClassOptionDefinition[]>;
  readonly index: CreationIndexJson;
  readonly warnings: string[] = [];
  private readonly spellIdByName = new Map<string, string>();
  /** Module spell ids that name a presentation-catalog spell under a different slug. */
  readonly spellAliases = new Map<string, string>();

  constructor(private readonly inputs: CatalogInputs) {
    for (const module of inputs.modules) this.addModule(module, "builtin");
    for (const module of inputs.installedModules ?? []) this.addModule(module, "installed");
    this.index = inputs.index;
    this.skills = inputs.index.skills;
    this.languages = { standard: inputs.index.standardLanguages, general: inputs.index.generalLanguages };
    this.classOptions = inputs.extras.classOptions;
    this.spells = this.buildSpells();
    this.classes = this.buildClasses();
    this.subclasses = this.buildSubclasses();
    this.species = this.buildSpecies();
    this.backgrounds = this.buildBackgrounds();
    this.feats = this.buildFeats();
    this.items = this.buildItems();
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
      if (this.entries.has(raw.id) && scope === "installed") this.warnings.push(`설치 모듈 ${module.moduleId}의 ${raw.id}가 기존 항목을 덮어씁니다.`);
      this.entries.set(raw.id, entry);
    }
  }

  entry(id: string) { return this.entries.get(id); }
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
      const def = mechanic<{ hitDie?: number; primaryAbilities?: AbilityKey[]; savingThrowProficiencies?: AbilityKey[]; skillChoiceCount?: number }>(entry, "class-definition") ?? {};
      const slug = slugOfId(entry.id);
      const table = this.inputs.progression.classes.find((row) => row.id === entry.id);
      const indexClass = this.inputs.index.classes[entry.id];
      const descriptions = this.inputs.extras.classFeatures[slug] ?? [];
      const progression: ClassLevelRow[] = (table?.progression ?? []).map((row) => ({
        ...row,
        featureRecords: row.features.map((name) => {
          const found = descriptions.find((item) => item.name === name && (item.level === row.level || item.level === 0)) ?? descriptions.find((item) => item.name === name);
          if (!found) { this.warnings.push(`직업 특성 설명 없음: ${slug} ${row.level}레벨 "${name}"`); return { id: `${slug}.${row.level}.${name}`, name, nameEn: name }; }
          return { id: found.id, name: found.name, nameEn: found.nameEn, description: found.description, descriptionSource: "srd-summary" as const };
        }),
      }));
      const casterKind = (table?.spellcastingMode === "full" || table?.spellcastingMode === "half" || table?.spellcastingMode === "pact") ? table.spellcastingMode : "none";
      views.push({
        id: entry.id, slug, name: entry.name, nameEn: entry.nameEn, summary: entry.summary,
        hitDie: def.hitDie ?? table?.hitDie ?? 8,
        primaryAbilities: def.primaryAbilities ?? abilityText(table?.primaryAbilitiesText ?? ""),
        savingThrows: def.savingThrowProficiencies ?? abilityText(table?.savingThrowsText ?? ""),
        skillChoice: indexClass?.skills ?? { count: def.skillChoiceCount ?? 2, options: "any" },
        level1Choices: indexClass?.choices ?? [],
        spells: indexClass?.spells,
        casterKind,
        progression,
        multiclassGrants: table?.multiclassGrants ?? [],
        scope: entry.scope,
      });
    }
    return views.sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }

  private buildSubclasses(): SubclassView[] {
    const views: SubclassView[] = [];
    const authored = new Map(this.inputs.extras.subclasses.map((item) => [item.id, item]));
    // SRD subclasses the modules do not list yet come from the authored tables alone.
    for (const data of this.inputs.extras.subclasses) {
      if (this.entries.has(data.id)) continue;
      const spells: Record<number, string[]> = {};
      for (const [level, names] of Object.entries(data.spells ?? {})) spells[Number(level)] = names.map((name) => this.spellByName(name)?.id ?? name);
      views.push({ id: data.id, classId: data.classId, name: data.name, nameEn: data.nameEn, summary: data.summary, features: data.features.map((feature) => ({ ...feature, descriptionSource: "srd-summary" as const })).sort((a, b) => a.level - b.level), spells, scope: "builtin" });
    }
    for (const entry of this.byCategory("subclass")) {
      const classId = entry.relationships.find((rel) => rel.kind === "parent")?.target ?? "";
      const data = authored.get(entry.id);
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
      for (const [level, names] of Object.entries(data?.spells ?? {})) spells[Number(level)] = names.map((name) => this.spellByName(name)?.id ?? name);
      views.push({ id: entry.id, classId, name: entry.name, nameEn: entry.nameEn, summary: entry.summary ?? data?.summary, description: entry.description, features: features.sort((a, b) => a.level - b.level), spells, scope: entry.scope });
    }
    return views;
  }

  private buildSpecies(): SpeciesView[] {
    const views: SpeciesView[] = [];
    for (const entry of this.byCategory("species")) {
      const def = mechanic<{ size?: string[]; speed?: number; darkvision?: number; traits?: string[]; choices?: Record<string, unknown>; semantics?: IndexSpeciesSemanticsJson }>(entry, "species-definition") ?? {};
      const extras = this.inputs.extras.species[entry.id];
      const semantics = this.inputs.index.species[entry.id] ?? def.semantics ?? {};
      const traits: SpeciesTrait[] = (def.traits ?? []).map((raw, index) => {
        const [traitId, level] = raw.split("@");
        const authored = extras?.traits[traitId];
        const installedName = def.semantics?.baseFeatures?.[index]?.replace(/\s*\(.*\)\s*$/, "");
        const installedDescription = installedName ? sectionOf(entry.description, installedName) : undefined;
        return {
          id: `${entry.id}.trait.${traitId}`,
          name: authored?.name ?? installedName ?? traitId,
          nameEn: authored?.nameEn ?? traitId,
          description: authored?.description ?? installedDescription,
          descriptionSource: authored ? "srd-summary" : installedDescription ? "module" : undefined,
          ...(level ? { minLevel: Number(level) } : {}),
        };
      });
      const choices: SpeciesChoice[] = extras?.choices ? extras.choices : this.genericSpeciesChoices(def.choices ?? {}, semantics);
      views.push({ id: entry.id, name: entry.name, nameEn: entry.nameEn, summary: entry.summary, description: entry.description ?? extras?.description, sizes: def.size ?? ["medium"], speed: def.speed ?? 30, darkvision: def.darkvision, traits, choices, semantics, scope: entry.scope });
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
      const feat = this.resolveFeatReference(def.originFeat ?? "dnd.srd521.feat.skilled");
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
    const match = /^(.*\.feat\.magic-initiate)-(cleric|druid|wizard)$/.exec(id);
    if (match && this.entries.has(match[1])) return { id: match[1], preset: { spellList: match[2] } };
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
      const packKind = entry.mechanics.some((item) => item.kind === "pack-definition") ? "pack" : kind;
      views.push({
        id: entry.id, name: entry.name, nameEn: entry.nameEn, kind: packKind,
        weightLb: anyConfig.weightLb as number | undefined, priceGp: anyConfig.priceGp as number | undefined,
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
