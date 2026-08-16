import type { CatalogEntry } from "./contracts";
import type { ParsedRuleModulePackage } from "./ruleModulePackageImport";

export function ruleModulePackageReviewEntry(pkg:ParsedRuleModulePackage):CatalogEntry {
  return {
    id:`module:${pkg.module.moduleId}@${pkg.module.moduleVersion}`,
    contentId:`module:${pkg.module.moduleId}`,
    category:"option",
    nameKo:`RuleModule 패키지 · ${pkg.module.moduleId}`,
    nameEn:pkg.module.moduleId,
    scope:"local",
    sourceId:pkg.module.moduleId,
    source:pkg.source,
    version:pkg.module.moduleVersion,
    description:`RulesProfile ${pkg.module.rulesProfile.id}@${pkg.module.rulesProfile.version} · 콘텐츠 ${pkg.entries.length}개`,
    relationships:[
      ...pkg.module.dependencies.map((ref)=>({label:"의존성",targetId:`${ref.moduleId}@${ref.version}`,targetName:`${ref.moduleId}@${ref.version}`})),
      ...pkg.module.conflicts.map((ref)=>({label:"충돌",targetId:`${ref.moduleId}@${ref.version}`,targetName:`${ref.moduleId}@${ref.version}`})),
      ...pkg.entries.map((entry)=>({label:"콘텐츠",targetId:entry.contentId,targetName:`${entry.nameKo} (${entry.contentId})`})),
    ],
    capabilities:[...pkg.module.capabilities],
  };
}
