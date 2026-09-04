import type { CatalogEntry } from "./contracts";

/** A subclass contributed by an installed RuleModule, keyed by the class it declares as its parent. */
export interface InstalledSubclassOption {
  id:string;
  label:string;
  description?:string;
  classId:string;
  sourceId?:string;
  source:string;
}

const PARENT_RELATIONSHIP_LABELS=new Set(["상위","parent"]);

function parentClassIds(entry:CatalogEntry) {
  const semantic=(entry as {semanticRelationships?:Array<{kind:string;target:string}>}).semanticRelationships;
  if (semantic?.length) return semantic.filter((relationship)=>relationship.kind==="parent").map((relationship)=>relationship.target);
  return entry.relationships.filter((relationship)=>PARENT_RELATIONSHIP_LABELS.has(relationship.label)).map((relationship)=>relationship.targetId);
}

/** Installed subclasses as progression subclass-acquisition options; builtin SRD subclasses stay on their existing catalog path. */
export function installedSubclassOptions(catalog:CatalogEntry[]):InstalledSubclassOption[] {
  return catalog
    .filter((entry)=>entry.category==="subclass"&&entry.scope==="local")
    .flatMap((entry)=>parentClassIds(entry).filter(Boolean).map((classId)=>({
      id:entry.contentId??entry.id,
      label:entry.nameKo,
      ...(entry.description?{description:entry.description}:{}),
      classId,
      ...(entry.sourceId?{sourceId:entry.sourceId}:{}),
      source:entry.source,
    })));
}

export function installedSubclassEntry(catalog:CatalogEntry[],contentId:string) {
  return catalog.find((entry)=>entry.category==="subclass"&&(entry.contentId===contentId||entry.id===contentId));
}
