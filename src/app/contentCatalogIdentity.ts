import type { CatalogEntry } from "./contracts";
import type { InstalledCatalogEntryV1 } from "./installedContentContracts";

const cp = <T,>(value:T):T => structuredClone(value);

function component(value:string) {
  return encodeURIComponent(value.trim());
}

export function catalogQualifiedId(contentId:string,sourceId:string,version:string) {
  return `content:${component(sourceId)}@${component(version)}#${component(contentId)}`;
}

export function builtinCatalogSourceId(entry:CatalogEntry) {
  if (entry.sourceId?.trim()) return entry.sourceId.trim();
  if (entry.source === "SRD 5.2.1") return "dnd.srd-5.2.1";
  throw new Error(`Builtin catalog entry is missing a stable source identity: ${entry.id} / ${entry.source}`);
}

export function installedEntryFromPreview(entry:CatalogEntry):InstalledCatalogEntryV1 {
  const sourceId=entry.sourceId?.trim();
  const contentId=(entry.contentId ?? entry.id).trim();
  if (!contentId) throw new Error("Installed content is missing contentId");
  if (!sourceId) throw new Error("Installed content requires sourceId separate from display source");
  if (!entry.version.trim()) throw new Error("Installed content is missing version");
  return cp({
    contentId,
    category:entry.category,
    nameKo:entry.nameKo,
    nameEn:entry.nameEn,
    sourceId,
    source:entry.source,
    version:entry.version,
    description:entry.description,
    relationships:entry.relationships,
    capabilities:entry.capabilities,
  });
}

export function resolvedCatalogEntryFromInstalled(entry:InstalledCatalogEntryV1):CatalogEntry {
  return {
    id:catalogQualifiedId(entry.contentId,entry.sourceId,entry.version),
    contentId:entry.contentId,
    category:entry.category,
    nameKo:entry.nameKo,
    nameEn:entry.nameEn,
    scope:"local",
    sourceId:entry.sourceId,
    source:entry.source,
    version:entry.version,
    description:entry.description,
    relationships:cp(entry.relationships),
    capabilities:cp(entry.capabilities),
  };
}

export function resolvedBuiltinCatalogEntry(entry:CatalogEntry):CatalogEntry {
  const contentId=entry.contentId ?? entry.id;
  const sourceId=builtinCatalogSourceId(entry);
  return {
    ...cp(entry),
    id:catalogQualifiedId(contentId,sourceId,entry.version),
    contentId,
    sourceId,
    scope:"builtin",
  };
}

export function composeContentCatalog(
  builtin:CatalogEntry[],
  installed:InstalledCatalogEntryV1[],
):CatalogEntry[] {
  const resolved=[
    ...builtin.map(resolvedBuiltinCatalogEntry),
    ...installed.map(resolvedCatalogEntryFromInstalled),
  ];
  const seen=new Set<string>();
  for (const entry of resolved) {
    if (seen.has(entry.id)) throw new Error(`ContentCatalog qualified identity conflict: ${entry.id}`);
    seen.add(entry.id);
  }
  return resolved.sort((a,b) => a.id.localeCompare(b.id,"en"));
}
