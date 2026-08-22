import assert from "node:assert/strict";
import test from "node:test";
import { parseRuleModulePackage } from "../../src/app/ruleModulePackageImport";
import { validateInstalledContentPackage } from "../../src/app/ruleModulePackageValidation";
import { emptyInstalledContentDocument } from "../../src/app/installedContentPersistence";
import { CAMPAIGN_CALENDAR_PROFILE_CAPABILITY, CAMPAIGN_RATION_PROFILE_CAPABILITY } from "../../src/app/campaignProviderProfiles";

function providerPackage(capability:string,content:Record<string,unknown>){
  return JSON.stringify({
    schemaVersion:"0.1-draft",
    moduleId:"homebrew.campaign-providers",
    moduleVersion:"1.2.0",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},
    defaultLocale:"ko",
    source:{document:"Campaign Providers",version:"1.2.0",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[capability],
    content:[content],
  });
}

const presentation={defaultLocale:"ko",originalName:"Kingdom Calendar",locales:{ko:{name:"왕국 달력",description:"선언형 달력"}}};
const calendarProvider={kind:"calendar",defaultEra:"왕국력",weekdays:["해","달"],months:[{id:"first",label:"첫달",days:30},{id:"second",label:"둘째달",days:30}]};

test("RuleModule import preserves a validated declarative Campaign provider profile",()=>{
  const parsed=parseRuleModulePackage(providerPackage(CAMPAIGN_CALENDAR_PROFILE_CAPABILITY,{
    id:"calendar.kingdom",category:"option",presentation,campaignProvider:calendarProvider,
  }));
  const entry=parsed.entries[0];
  assert.deepEqual(entry.campaignProvider,calendarProvider);
  const validation=validateInstalledContentPackage(emptyInstalledContentDocument(),parsed.entries);
  assert.equal(validation.issues.some((issue)=>issue.severity==="blocking"),false,JSON.stringify(validation.issues));
});

test("Campaign provider entry must be option category and module must declare the matching capability",()=>{
  const wrongCategory=parseRuleModulePackage(providerPackage(CAMPAIGN_CALENDAR_PROFILE_CAPABILITY,{
    id:"calendar.kingdom",category:"item",presentation,campaignProvider:calendarProvider,
  }));
  assert.ok(validateInstalledContentPackage(emptyInstalledContentDocument(),wrongCategory.entries).issues.some((issue)=>/category/i.test(issue.message)));

  const missingCapability=parseRuleModulePackage(providerPackage("unrelated.capability",{
    id:"calendar.kingdom",category:"option",presentation,campaignProvider:calendarProvider,
  }));
  assert.ok(validateInstalledContentPackage(emptyInstalledContentDocument(),missingCapability.entries).issues.some((issue)=>/capability/i.test(issue.message)));
});

test("ration provider uses its own declared capability and remains data-only",()=>{
  const parsed=parseRuleModulePackage(providerPackage(CAMPAIGN_RATION_PROFILE_CAPABILITY,{
    id:"ration.gritty",category:"option",presentation:{...presentation,originalName:"Gritty Rations"},
    campaignProvider:{kind:"ration",defaultUnitsPerDay:1,unitsByRosterKind:{companion:2},shortageConsequences:["DM 경고"]},
  }));
  const validation=validateInstalledContentPackage(emptyInstalledContentDocument(),parsed.entries);
  assert.equal(validation.issues.some((issue)=>issue.severity==="blocking"),false,JSON.stringify(validation.issues));
  assert.equal(parsed.entries[0].campaignProvider?.kind,"ration");
});
