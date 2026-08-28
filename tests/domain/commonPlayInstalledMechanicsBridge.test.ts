import assert from "node:assert/strict";
import test from "node:test";
import { parseRuleModulePackage } from "../../src/app/ruleModulePackageImport";

function packagePayload(contentId="external.unknown.action") {
  return JSON.stringify({
    schemaVersion:"0.1-draft",
    moduleId:"external.unknown.module",
    moduleVersion:"1.0.0",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1.0"},
    defaultLocale:"en",
    source:{document:"External fixture",version:"1.0.0",license:"test",srdDerived:false},
    content:[{
      id:contentId,
      category:"feat",
      presentation:{locales:{en:{name:"External Action"}}},
      mechanics:[{
        schemaVersion:"0.2-draft",
        id:`${contentId}.mechanic`,
        payments:[
          {kind:"resource",resource:"resource.external.primary",amount:{value:1},consumeAt:"commit"},
        ],
        entryPoints:[{
          id:"activate",
          invocation:"manual",
          operations:[{kind:"economy.modify",bucket:"action.extra.non-magic",amount:{value:1}}],
        }],
      }],
    }],
  });
}

test("RuleModule import preserves supported Common Play mechanics as portable installed data", () => {
  const parsed=parseRuleModulePackage(packagePayload());
  const entry=parsed.entries[0] as typeof parsed.entries[number] & { mechanics?:unknown[] };
  assert.equal(entry.contentId,"external.unknown.action");
  assert.equal(entry.mechanics?.length,1);
});

test("portable mechanics do not depend on the external content display identity", () => {
  const first=parseRuleModulePackage(packagePayload("external.unknown.action"));
  const renamed=parseRuleModulePackage(packagePayload("external.renamed.action"));
  const firstMechanics=(first.entries[0] as typeof first.entries[number] & { mechanics?:unknown[] }).mechanics;
  const renamedMechanics=(renamed.entries[0] as typeof renamed.entries[number] & { mechanics?:unknown[] }).mechanics;
  assert.equal(firstMechanics?.length,1);
  assert.equal(renamedMechanics?.length,1);
});
