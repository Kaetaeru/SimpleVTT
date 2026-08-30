import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/installedContentRuntimeAdapter";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import {
  registerAuthoritativeCommonPlayAreaMembershipProvider,
  unregisterAuthoritativeCommonPlayAreaMembershipProvider,
} from "../../src/app/installedCommonPlayRuntimeAdapter";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";

type Identity={moduleId:string;contentId:string;mechanicId:string;entryPointId:string;displayName:string};
const ORIGINAL:Identity={moduleId:"homebrew.family-e-area",contentId:"option.family-e-area",mechanicId:"external.unknown.family-e-area",entryPointId:"self-area",displayName:"Self Area"};
const RENAMED:Identity={moduleId:"homebrew.renamed-family-e-area",contentId:"option.renamed-family-e-area",mechanicId:"external.renamed.family-e-area",entryPointId:"renamed-self-area",displayName:"Renamed Self Area"};
const TARGET_ID="combatant.goblin-a";

function payload(identity:Identity) {
  return JSON.stringify({
    schemaVersion:"0.1-draft",moduleId:identity.moduleId,moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
    source:{document:"Family E area selector probe",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],
    content:[{
      id:identity.contentId,category:"option",
      presentation:{defaultLocale:"en",originalName:identity.displayName,locales:{en:{name:identity.displayName}}},
      mechanics:[{kind:"common-play",config:{
        schemaVersion:"0.2-draft",id:identity.mechanicId,
        entryPoints:[{
          id:identity.entryPointId,invocation:"manual",
          targeting:{
            from:"targets",min:1,max:1,
            area:{kind:"instant",shape:"sphere",origin:"self",radiusFeet:10},
          },
          operations:[],
        }],
      }}],
    }],
  });
}

async function exercise(identity:Identity) {
  const adapter=new MockAdapter();
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(payload(identity));
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  const actionId=installedCommonPlayActionId({
    catalogId:catalogQualifiedId(identity.contentId,identity.moduleId,"1"),
    mechanicId:identity.mechanicId,entryPointId:identity.entryPointId,
  });
  const seen:Array<{sourceId:string;targetId:string;area:{kind:string;shape:string;origin:string;radiusFeet?:number}}>=[];
  registerAuthoritativeCommonPlayAreaMembershipProvider(adapter,{
    areaMember(input) {
      seen.push(structuredClone(input));
      return input.targetId===TARGET_ID;
    },
  });
  try {
    const accepted=await adapter.resolveAction(actionId,[TARGET_ID]);
    assert.equal(accepted.resolution?.stage,"complete",JSON.stringify(accepted.resolution));
    assert.deepEqual(accepted.resolution?.targetIds,[TARGET_ID]);
    assert.ok(seen.some((input)=>
      input.sourceId==="char.aelar"&&
      input.targetId===TARGET_ID&&
      input.area.kind==="instant"&&
      input.area.shape==="sphere"&&
      input.area.origin==="self"&&
      input.area.radiusFeet===10
    ),JSON.stringify(seen));
    return accepted.resolution?.targetIds;
  } finally {
    unregisterAuthoritativeCommonPlayAreaMembershipProvider(adapter);
  }
}

test("unknown installed self-area selector consumes authoritative provider membership under identity rename",async()=>{
  const original=await exercise(ORIGINAL);
  const renamed=await exercise(RENAMED);
  assert.deepEqual(renamed,original);
});
