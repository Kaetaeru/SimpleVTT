import assert from "node:assert/strict";
import test from "node:test";
import { validateInstalledContentCandidate } from "../../src/app/declarativeModuleValidation";
import type { InstalledCatalogEntryV1, InstalledContentDocumentV1, InstalledModuleManifestV1 } from "../../src/app/installedContentContracts";

const manifest=(moduleId:string,moduleVersion="1",overrides:Partial<InstalledModuleManifestV1>={}):InstalledModuleManifestV1 => ({
  moduleId,moduleVersion,
  rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},
  dependencies:[],conflicts:[],capabilities:[],extensionPoints:[],...overrides,
});
const entry=(contentId:string,sourceId:string,module:InstalledModuleManifestV1,overrides:Partial<InstalledCatalogEntryV1>={}):InstalledCatalogEntryV1 => ({
  contentId,category:"option",nameKo:contentId,nameEn:contentId,sourceId,source:sourceId,version:module.moduleVersion,description:"test",relationships:[],capabilities:[],module,...overrides,
});
const doc=(entries:InstalledCatalogEntryV1[]):InstalledContentDocumentV1 => ({schemaId:"simplevtt.installed-content",schemaVersion:1,storageRevision:entries.length,entries});
const blocking=(issues:ReturnType<typeof validateInstalledContentCandidate>) => issues.filter((issue)=>issue.severity==="blocking");

test("dependency validation requires the exact module version declared by the existing RuleModule contract", () => {
  const base=entry("option.base","mod.base",manifest("mod.base","1"));
  const good=entry("option.good","mod.good",manifest("mod.good","1",{dependencies:[{moduleId:"mod.base",version:"1"}]}));
  assert.equal(blocking(validateInstalledContentCandidate(doc([base]),good)).length,0);

  const wrong=entry("option.wrong","mod.wrong",manifest("mod.wrong","1",{dependencies:[{moduleId:"mod.base",version:"2"}]}));
  assert.ok(blocking(validateInstalledContentCandidate(doc([base]),wrong)).some((issue)=>issue.code==="module.dependency.missing"));
});

test("RulesProfile, capability and category incompatibility are explicit blockers", () => {
  const incompatible=entry("option.profile","mod.profile",manifest("mod.profile","1",{rulesProfile:{id:"other.profile",version:"1"}}),{
    requiresCapabilities:["capability.not-supported"],
    category:"vehicle" as InstalledCatalogEntryV1["category"],
  });
  const issues=blocking(validateInstalledContentCandidate(doc([]),incompatible));
  assert.ok(issues.some((issue)=>issue.code==="module.rules-profile"));
  assert.ok(issues.some((issue)=>issue.code==="content.capability.missing"));
  assert.ok(issues.some((issue)=>issue.code==="content.category.unsupported"));
});

test("declared conflicts block in both candidate-to-active and active-to-candidate directions", () => {
  const active=entry("option.active","mod.active",manifest("mod.active","1",{conflicts:[{moduleId:"mod.reverse",version:"1"}]}));
  const direct=entry("option.direct","mod.direct",manifest("mod.direct","1",{conflicts:[{moduleId:"mod.active",version:"1"}]}));
  assert.ok(blocking(validateInstalledContentCandidate(doc([active]),direct)).some((issue)=>issue.code==="module.conflict"));
  const reverse=entry("option.reverse","mod.reverse",manifest("mod.reverse"));
  assert.ok(blocking(validateInstalledContentCandidate(doc([active]),reverse)).some((issue)=>issue.code==="module.conflict.reverse"));
});

test("module dependency cycles are rejected deterministically", () => {
  const a=entry("option.a","mod.a",manifest("mod.a","1",{dependencies:[{moduleId:"mod.b",version:"1"}]}));
  const b=entry("option.b","mod.b",manifest("mod.b","1",{dependencies:[{moduleId:"mod.a",version:"1"}]}));
  assert.ok(blocking(validateInstalledContentCandidate(doc([a]),b)).some((issue)=>issue.code==="module.dependency.cycle"));
});

test("relationships require an unambiguous target and valid extension point category", () => {
  const target=entry("class.target","mod.target",manifest("mod.target"),{category:"class",extensionPoints:[{id:"subclasses",acceptsCategories:["subclass"]}]});
  const valid=entry("subclass.valid","mod.valid",manifest("mod.valid"),{category:"subclass",semanticRelationships:[{kind:"extends",target:"class.target",targetVersion:"1",extensionPoint:"subclasses"}]});
  assert.equal(blocking(validateInstalledContentCandidate(doc([target]),valid)).length,0);

  const missing=entry("subclass.missing","mod.missing",manifest("mod.missing"),{category:"subclass",semanticRelationships:[{kind:"parent",target:"class.unknown"}]});
  assert.ok(blocking(validateInstalledContentCandidate(doc([target]),missing)).some((issue)=>issue.code==="relationship.target.missing"));

  const wrongPoint=entry("item.extender","mod.item",manifest("mod.item"),{category:"item",semanticRelationships:[{kind:"extends",target:"class.target",targetVersion:"1",extensionPoint:"subclasses"}]});
  assert.ok(blocking(validateInstalledContentCandidate(doc([target]),wrongPoint)).some((issue)=>issue.code==="relationship.extension-point.category"));
});

test("content relationship cycles and competing replacements are rejected instead of using load order", () => {
  const a=entry("option.a","mod.a",manifest("mod.a"),{semanticRelationships:[{kind:"parent",target:"option.b",targetVersion:"1"}]});
  const b=entry("option.b","mod.b",manifest("mod.b"),{semanticRelationships:[{kind:"parent",target:"option.a",targetVersion:"1"}]});
  assert.ok(blocking(validateInstalledContentCandidate(doc([a]),b)).some((issue)=>issue.code==="relationship.cycle"));

  const target=entry("option.target","mod.target",manifest("mod.target"));
  const first=entry("option.first","mod.first",manifest("mod.first"),{semanticRelationships:[{kind:"replaces",target:"option.target",targetVersion:"1"}]});
  const second=entry("option.second","mod.second",manifest("mod.second"),{semanticRelationships:[{kind:"replaces",target:"option.target",targetVersion:"1"}]});
  assert.ok(blocking(validateInstalledContentCandidate(doc([target,first]),second)).some((issue)=>issue.code==="relationship.replaces.competing"));
});
