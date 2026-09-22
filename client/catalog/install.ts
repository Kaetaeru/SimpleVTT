/**
 * RuleModule JSON install: parse and validate a module file (the format the SRD modules and the supplement compiler
 * share), summarize what it adds, and check its dependencies against the modules already present. Structural errors
 * reject the file; content-level oddities (unknown categories, entries without mechanics) become warnings so a
 * supplement still installs and its text still shows on the sheet.
 */
import type { EntryJson, RuleModuleJson } from "./types";

export const KNOWN_CATEGORIES = new Set([
  "class", "subclass", "species", "background", "feat", "spell", "option", "weapon", "armor", "shield", "tool", "item", "adventuring-gear", "ammunition", "focus",
  "starting-loadout", "combatant", "condition", "magic-item",
]);

/** Categories that flow into character creation; the rest are carried along for the table. */
export const CREATION_CATEGORIES = ["species", "background", "feat", "subclass", "spell", "class"] as const;

export interface ModuleSummary {
  moduleId: string;
  moduleVersion?: string;
  document?: string;
  license?: string;
  srdDerived: boolean;
  dependencies: string[];
  counts: Record<string, number>;
  entries: Array<{ id: string; category: string; name: string; nameEn: string }>;
}

export interface ParsedModule {
  module?: RuleModuleJson;
  summary?: ModuleSummary;
  errors: string[];
  warnings: string[];
}

type Obj = Record<string, unknown>;
const isObject = (value: unknown): value is Obj => Boolean(value) && typeof value === "object" && !Array.isArray(value);

export function looksLikeModuleJson(value: unknown): boolean {
  return isObject(value) && typeof value.moduleId === "string" && Array.isArray(value.content);
}

export function parseModuleJson(input: string | unknown): ParsedModule {
  const errors: string[] = [];
  const warnings: string[] = [];
  let raw: unknown = input;
  if (typeof input === "string") {
    try { raw = JSON.parse(input); } catch (error) { return { errors: [`JSON을 읽을 수 없습니다: ${(error as Error).message}`], warnings }; }
  }
  if (!isObject(raw)) return { errors: ["모듈 파일은 JSON 객체여야 합니다."], warnings };
  if (typeof raw.moduleId !== "string" || !raw.moduleId.trim()) errors.push("moduleId가 없습니다.");
  if (!Array.isArray(raw.content)) errors.push("content 배열이 없습니다.");
  if (errors.length) return { errors, warnings };
  const content = raw.content as unknown[];
  if (content.length === 0) errors.push("content가 비어 있습니다.");
  const ids = new Set<string>();
  const entries: EntryJson[] = [];
  content.forEach((item, index) => {
    if (!isObject(item)) { errors.push(`content[${index}]이(가) 객체가 아닙니다.`); return; }
    const id = typeof item.id === "string" ? item.id.trim() : "";
    const category = typeof item.category === "string" ? item.category.trim() : "";
    if (!id) { errors.push(`content[${index}]에 id가 없습니다.`); return; }
    if (!category) { errors.push(`content[${index}] (${id})에 category가 없습니다.`); return; }
    if (ids.has(id)) { errors.push(`content id가 중복됩니다: ${id}`); return; }
    ids.add(id);
    if (!KNOWN_CATEGORIES.has(category)) warnings.push(`${id}: 알 수 없는 category "${category}" — 목록에만 표시됩니다.`);
    const presentation = isObject(item.presentation) ? item.presentation : undefined;
    if (!presentation || typeof presentation.originalName !== "string") warnings.push(`${id}: presentation.originalName이 없어 id를 이름으로 씁니다.`);
    const mechanics = Array.isArray(item.mechanics) ? item.mechanics.filter(isObject) : [];
    if (item.mechanics !== undefined && !Array.isArray(item.mechanics)) errors.push(`${id}: mechanics는 배열이어야 합니다.`);
    for (const mechanic of mechanics) if (typeof mechanic.kind !== "string") errors.push(`${id}: mechanics 항목에 kind가 없습니다.`);
    if ((category === "species" || category === "background" || category === "feat") && !mechanics.some((mechanic) => mechanic.kind === `${category}-definition`)) warnings.push(`${id}: ${category}-definition 메커닉이 없어 설명만 표시됩니다.`);
    if (category === "spell" && !mechanics.some((mechanic) => mechanic.kind === "spell-definition")) warnings.push(`${id}: spell-definition이 없어 주문 목록에 들어가지 않습니다.`);
    if (category === "subclass") {
      const parent = Array.isArray(item.relationships) && item.relationships.some((relation) => isObject(relation) && relation.kind === "parent");
      if (!parent) errors.push(`${id}: 서브클래스에 parent 관계(직업)가 없습니다.`);
    }
    entries.push(item as unknown as EntryJson);
  });
  if (errors.length) return { errors, warnings };
  const module: RuleModuleJson = { ...(raw as unknown as RuleModuleJson), content: entries };
  return { module, summary: summarizeModule(module), errors, warnings };
}

export function summarizeModule(module: RuleModuleJson): ModuleSummary {
  const counts: Record<string, number> = {};
  const entries = module.content.map((entry) => {
    counts[entry.category] = (counts[entry.category] ?? 0) + 1;
    const locale = entry.presentation?.locales?.[module.defaultLocale ?? "ko-KR"] ?? entry.presentation?.locales?.["ko-KR"];
    return { id: entry.id, category: entry.category, name: locale?.name ?? entry.presentation?.originalName ?? entry.id, nameEn: entry.presentation?.originalName ?? entry.id };
  });
  return {
    moduleId: module.moduleId,
    moduleVersion: module.moduleVersion,
    document: module.source?.document,
    license: module.source?.license,
    srdDerived: module.source?.srdDerived === true,
    dependencies: (module.dependencies ?? []).map((dependency) => dependency.moduleId),
    counts,
    entries,
  };
}

/** Dependencies the module names that are neither builtin nor installed. */
export function missingDependencies(module: RuleModuleJson, present: Iterable<string>): string[] {
  const have = new Set(present);
  return (module.dependencies ?? []).map((dependency) => dependency.moduleId).filter((id) => !have.has(id));
}

/** Ids of installed content a character source refers to, by module — for "this character needs module X". */
export function modulesReferencedBy(ids: string[], modules: readonly RuleModuleJson[]): string[] {
  const owner = new Map<string, string>();
  for (const module of modules) for (const entry of module.content) owner.set(entry.id, module.moduleId);
  const needed = new Set<string>();
  for (const id of ids) { const moduleId = owner.get(id); if (moduleId) needed.add(moduleId); }
  return [...needed];
}
