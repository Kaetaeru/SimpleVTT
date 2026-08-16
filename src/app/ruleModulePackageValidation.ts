import { catalogQualifiedId } from "./contentCatalogIdentity";
import { validateInstalledContentCandidate, type ModuleValidationIssue } from "./declarativeModuleValidation";
import type { InstalledCatalogEntryV1, InstalledContentDocumentV1 } from "./installedContentContracts";

export interface RuleModulePackageValidation {
  issues:ModuleValidationIssue[];
  byContentId:Record<string,ModuleValidationIssue[]>;
}

export function validateInstalledContentPackage(
  document:InstalledContentDocumentV1,
  candidates:InstalledCatalogEntryV1[],
):RuleModulePackageValidation {
  const issues:ModuleValidationIssue[]=[];
  const byContentId:Record<string,ModuleValidationIssue[]>={};
  const ids=new Set<string>();

  for (const candidate of candidates) {
    const qualifiedId=catalogQualifiedId(candidate.contentId,candidate.sourceId,candidate.version);
    if (ids.has(qualifiedId)) {
      const issue:ModuleValidationIssue={severity:"blocking",code:"package.identity.duplicate",message:`RuleModule package contains duplicate qualified identity: ${qualifiedId}`};
      issues.push(issue);
      (byContentId[candidate.contentId] ??= []).push(issue);
    }
    ids.add(qualifiedId);
  }

  candidates.forEach((candidate,index)=>{
    const peers=candidates.filter((_,peerIndex)=>peerIndex!==index);
    const candidateIssues=validateInstalledContentCandidate(
      {...document,entries:[...document.entries,...peers]},
      candidate,
    );
    byContentId[candidate.contentId]=candidateIssues;
    issues.push(...candidateIssues);
  });

  const unique=new Map<string,ModuleValidationIssue>();
  for (const issue of issues) unique.set(`${issue.severity}:${issue.code}:${issue.message}`,issue);
  return {issues:[...unique.values()],byContentId};
}
