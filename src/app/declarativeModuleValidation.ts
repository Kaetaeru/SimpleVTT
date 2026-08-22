import profile from "../../rules/profiles/dnd.srd-5.2.1.profile.json";
import { catalogQualifiedId } from "./contentCatalogIdentity";
import { parseInstalledCampaignProviderProfile, requiredCapabilityForCampaignProvider } from "./campaignProviderProfiles";
import type {
  InstalledCatalogEntryV1,
  InstalledContentDocumentV1,
  InstalledContentRelationshipV1,
  InstalledModuleManifestV1,
  InstalledModuleRefV1,
} from "./installedContentContracts";

export interface ModuleValidationIssue {
  severity:"blocking"|"warning"|"info";
  code:string;
  message:string;
}

const ACTIVE_PROFILE={
  id:profile.profileId,
  version:profile.profileVersion,
  capabilities:new Set(profile.capabilities),
  contentCategories:new Set(profile.contentCategories),
};

function moduleKey(ref:InstalledModuleRefV1|InstalledModuleManifestV1) {
  return "moduleVersion" in ref ? `${ref.moduleId}@${ref.moduleVersion}` : `${ref.moduleId}@${ref.version}`;
}

function syntheticModule(entry:InstalledCatalogEntryV1):InstalledModuleManifestV1 {
  return {
    moduleId:entry.sourceId,
    moduleVersion:entry.version,
    rulesProfile:{id:ACTIVE_PROFILE.id,version:ACTIVE_PROFILE.version},
    dependencies:[],
    conflicts:[],
    capabilities:[],
    extensionPoints:[],
  };
}

function manifestOf(entry:InstalledCatalogEntryV1) {
  return entry.module ?? syntheticModule(entry);
}

function uniqueModules(entries:InstalledCatalogEntryV1[]) {
  const modules=new Map<string,InstalledModuleManifestV1>();
  for (const entry of entries) {
    const manifest=manifestOf(entry);
    const key=moduleKey(manifest);
    const prior=modules.get(key);
    if (!prior) modules.set(key,manifest);
    else if (JSON.stringify(prior)!==JSON.stringify(manifest)) {
      throw new Error(`Module manifest drift inside installed content: ${key}`);
    }
  }
  return modules;
}

function graphCycles(graph:Map<string,string[]>) {
  const cycles:string[][]=[];
  const state=new Map<string,0|1|2>();
  const stack:string[]=[];
  const visit=(node:string) => {
    const s=state.get(node) ?? 0;
    if (s===2) return;
    if (s===1) {
      const start=stack.lastIndexOf(node);
      cycles.push([...stack.slice(start),node]);
      return;
    }
    state.set(node,1);
    stack.push(node);
    for (const next of graph.get(node) ?? []) visit(next);
    stack.pop();
    state.set(node,2);
  };
  for (const node of [...graph.keys()].sort()) visit(node);
  return cycles;
}

function candidatesForTarget(entries:InstalledCatalogEntryV1[],relationship:InstalledContentRelationshipV1) {
  return entries.filter((entry)=>
    entry.contentId===relationship.target &&
    (!relationship.targetVersion || entry.version===relationship.targetVersion),
  );
}

function relationshipTargetId(target:InstalledCatalogEntryV1) {
  return catalogQualifiedId(target.contentId,target.sourceId,target.version);
}

function validateRelationships(entries:InstalledCatalogEntryV1[],issues:ModuleValidationIssue[]) {
  const resolvedEdges=new Map<string,string[]>();
  const replacements=new Map<string,string[]>();
  for (const entry of entries) {
    const sourceId=catalogQualifiedId(entry.contentId,entry.sourceId,entry.version);
    resolvedEdges.set(sourceId,[]);
    for (const relationship of entry.semanticRelationships ?? []) {
      const candidates=candidatesForTarget(entries,relationship);
      if (!candidates.length) {
        issues.push({severity:"blocking",code:"relationship.target.missing",message:`${sourceId} ${relationship.kind} target is missing: ${relationship.target}${relationship.targetVersion?`@${relationship.targetVersion}`:""}`});
        continue;
      }
      if (candidates.length>1) {
        issues.push({severity:"blocking",code:"relationship.target.ambiguous",message:`${sourceId} ${relationship.kind} target is ambiguous: ${relationship.target}${relationship.targetVersion?`@${relationship.targetVersion}`:""}`});
        continue;
      }
      const target=candidates[0];
      const targetId=relationshipTargetId(target);
      resolvedEdges.get(sourceId)!.push(targetId);
      if (relationship.kind==="extends") {
        if (!relationship.extensionPoint) {
          issues.push({severity:"blocking",code:"relationship.extension-point.required",message:`${sourceId} extends ${targetId} without extensionPoint`});
        } else {
          const point=(target.extensionPoints ?? []).find((candidate)=>candidate.id===relationship.extensionPoint);
          if (!point) issues.push({severity:"blocking",code:"relationship.extension-point.missing",message:`${sourceId} references missing extension point ${relationship.extensionPoint} on ${targetId}`});
          else if (!point.acceptsCategories.includes(entry.category)) issues.push({severity:"blocking",code:"relationship.extension-point.category",message:`${sourceId} category ${entry.category} is not accepted by ${targetId}/${point.id}`});
        }
      }
      if (relationship.kind==="replaces") {
        const list=replacements.get(targetId) ?? [];
        list.push(sourceId);
        replacements.set(targetId,list);
      }
    }
  }
  for (const [target,replacers] of replacements) {
    if (replacers.length>1) issues.push({severity:"blocking",code:"relationship.replaces.competing",message:`Multiple active entries replace ${target}: ${replacers.sort().join(", ")}`});
  }
  for (const cycle of graphCycles(resolvedEdges)) {
    issues.push({severity:"blocking",code:"relationship.cycle",message:`Content relationship cycle: ${cycle.join(" -> ")}`});
  }
}

export function validateInstalledContentCandidate(
  document:InstalledContentDocumentV1,
  candidate:InstalledCatalogEntryV1,
):ModuleValidationIssue[] {
  const issues:ModuleValidationIssue[]=[];
  const entries=[...document.entries,candidate];
  const module=manifestOf(candidate);

  if (module.rulesProfile.id!==ACTIVE_PROFILE.id || module.rulesProfile.version!==ACTIVE_PROFILE.version) {
    issues.push({severity:"blocking",code:"module.rules-profile",message:`Module ${moduleKey(module)} requires RulesProfile ${module.rulesProfile.id}@${module.rulesProfile.version}; active profile is ${ACTIVE_PROFILE.id}@${ACTIVE_PROFILE.version}`});
  }
  if (!ACTIVE_PROFILE.contentCategories.has(candidate.category)) {
    issues.push({severity:"blocking",code:"content.category.unsupported",message:`RulesProfile ${ACTIVE_PROFILE.id} does not allow content category ${candidate.category}`});
  }

  if(candidate.campaignProvider){
    try{
      const provider=parseInstalledCampaignProviderProfile(candidate.campaignProvider);
      const required=requiredCapabilityForCampaignProvider(provider);
      if(candidate.category!=="option") issues.push({severity:"blocking",code:"campaign-provider.category",message:`Campaign provider ${candidate.contentId} category must be option`});
      if(!module.capabilities.includes(required)) issues.push({severity:"blocking",code:"campaign-provider.capability",message:`Campaign provider ${candidate.contentId} requires module capability ${required}`});
    }catch(error){
      issues.push({severity:"blocking",code:"campaign-provider.invalid",message:error instanceof Error?error.message:String(error)});
    }
  }

  let modules:Map<string,InstalledModuleManifestV1>;
  try { modules=uniqueModules(entries); }
  catch(error) {
    issues.push({severity:"blocking",code:"module.manifest.drift",message:error instanceof Error?error.message:String(error)});
    return issues;
  }
  const hostModule:InstalledModuleManifestV1={
    moduleId:ACTIVE_PROFILE.id,
    moduleVersion:ACTIVE_PROFILE.version,
    rulesProfile:{id:ACTIVE_PROFILE.id,version:ACTIVE_PROFILE.version},
    dependencies:[],conflicts:[],capabilities:[...ACTIVE_PROFILE.capabilities],extensionPoints:[],
  };
  modules.set(moduleKey(hostModule),hostModule);

  for (const dependency of module.dependencies) {
    if (!modules.has(moduleKey(dependency))) issues.push({severity:"blocking",code:"module.dependency.missing",message:`Module ${moduleKey(module)} requires missing dependency ${moduleKey(dependency)}`});
  }
  for (const conflict of module.conflicts) {
    if (modules.has(moduleKey(conflict))) issues.push({severity:"blocking",code:"module.conflict",message:`Module ${moduleKey(module)} conflicts with active ${moduleKey(conflict)}`});
  }
  for (const other of modules.values()) {
    if (other.moduleId===module.moduleId && other.moduleVersion===module.moduleVersion) continue;
    if (other.conflicts.some((ref)=>moduleKey(ref)===moduleKey(module))) issues.push({severity:"blocking",code:"module.conflict.reverse",message:`Active module ${moduleKey(other)} conflicts with ${moduleKey(module)}`});
  }

  const availableCapabilities=new Set(ACTIVE_PROFILE.capabilities);
  for (const installed of modules.values()) for (const capability of installed.capabilities) availableCapabilities.add(capability);
  for (const required of candidate.requiresCapabilities ?? []) {
    if (!availableCapabilities.has(required)) issues.push({severity:"blocking",code:"content.capability.missing",message:`${candidate.contentId} requires unsupported capability ${required}`});
  }

  const dependencyGraph=new Map<string,string[]>();
  for (const [key,installed] of modules) dependencyGraph.set(key,installed.dependencies.map(moduleKey).filter((dep)=>modules.has(dep)));
  for (const cycle of graphCycles(dependencyGraph)) {
    issues.push({severity:"blocking",code:"module.dependency.cycle",message:`Module dependency cycle: ${cycle.join(" -> ")}`});
  }

  validateRelationships(entries,issues);
  if (!issues.some((issue)=>issue.severity==="blocking")) issues.push({severity:"info",code:"module.validation.ok",message:`Declarative module validation passed for ${moduleKey(module)}`});
  return issues;
}

export function activeRulesProfileCompatibility() {
  return {id:ACTIVE_PROFILE.id,version:ACTIVE_PROFILE.version,capabilities:[...ACTIVE_PROFILE.capabilities],contentCategories:[...ACTIVE_PROFILE.contentCategories]};
}
