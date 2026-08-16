import { catalogQualifiedId } from "./contentCatalogIdentity";
import { validateInstalledContentCandidate, type ModuleValidationIssue } from "./declarativeModuleValidation";
import type { InstalledCatalogEntryV1, InstalledContentDocumentV1 } from "./installedContentContracts";

export interface RuleModulePackageValidation {
  issues:ModuleValidationIssue[];
  byContentId:Record<string,ModuleValidationIssue[]>;
}

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

export function validateInstalledContentPackage(
  document:InstalledContentDocumentV1,
  candidates:InstalledCatalogEntryV1[],
):RuleModulePackageValidation {
  const issues:ModuleValidationIssue[]=[];
  const byContentId:Record<string,ModuleValidationIssue[]>={};
  const ids=new Set<string>();
  const conflictingIds=new Set<string>();
  const existingById=new Map(document.entries.map((entry)=>[
    catalogQualifiedId(entry.contentId,entry.sourceId,entry.version),entry,
  ]));

  for (const candidate of candidates) {
    const qualifiedId=catalogQualifiedId(candidate.contentId,candidate.sourceId,candidate.version);
    if (ids.has(qualifiedId)) {
      const issue:ModuleValidationIssue={severity:"blocking",code:"package.identity.duplicate",message:`RuleModule package contains duplicate qualified identity: ${qualifiedId}`};
      issues.push(issue);
      (byContentId[candidate.contentId] ??= []).push(issue);
    }
    ids.add(qualifiedId);

    const existing=existingById.get(qualifiedId);
    if (existing && !same(existing,candidate)) {
      const issue:ModuleValidationIssue={severity:"blocking",code:"package.identity.conflict",message:`Installed content conflict for ${qualifiedId}: same qualified identity has a different payload`};
      issues.push(issue);
      (byContentId[candidate.contentId] ??= []).push(issue);
      conflictingIds.add(qualifiedId);
    }
  }

  candidates.forEach((candidate,index)=>{
    const qualifiedId=catalogQualifiedId(candidate.contentId,candidate.sourceId,candidate.version);
    if (conflictingIds.has(qualifiedId)) return;
    const peers=candidates.filter((_,peerIndex)=>peerIndex!==index);
    const candidateIssues=validateInstalledContentCandidate(
      {...document,entries:[...document.entries,...peers]},
      candidate,
    );
    byContentId[candidate.contentId]=[...(byContentId[candidate.contentId] ?? []),...candidateIssues];
    issues.push(...candidateIssues);
  });

  const unique=new Map<string,ModuleValidationIssue>();
  for (const issue of issues) unique.set(`${issue.severity}:${issue.code}:${issue.message}`,issue);
  return {issues:[...unique.values()],byContentId};
}
