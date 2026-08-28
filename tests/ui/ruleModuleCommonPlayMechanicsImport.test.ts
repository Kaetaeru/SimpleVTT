import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/installedContentRuntimeAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import {
  getInstalledContentPersistenceStateForTests,
  setInstalledContentStoreForTests,
} from "../../src/app/installedContentRuntimeAdapter";

function payload(mechanicKind="common-play") {
  return JSON.stringify({
    schemaVersion:"0.1-draft",
    moduleId:"external.m1-action-economy",
    moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},
    defaultLocale:"ko",
    source:{document:"External M1 Probe",version:"1",license:"CC0",srdDerived:false},
    capabilities:[],
    content:[{
      id:"external.feature.quickstep",
      category:"option",
      presentation:{defaultLocale:"ko",originalName:"Quickstep",locales:{ko:{name:"퀵스텝",description:"generic M1 probe"}}},
      mechanics:[{
        kind:mechanicKind,
        config:{
          schemaVersion:"0.2-draft",
          id:"external.rule.quickstep",
          payments:[
            {kind:"resource",resource:"resource.external.primary",amount:{value:1},consumeAt:"commit"},
            {kind:"resource",resource:"resource.external.same-turn",amount:{value:1},consumeAt:"commit"},
          ],
          entryPoints:[{
            id:"action.external.quickstep",
            invocation:"manual",
            operations:[{kind:"economy.modify",bucket:"action.extra.non-magic",amount:{value:1}}],
          }],
        },
      }],
    }],
  });
}

test("supported RuleModule Common Play mechanics persist and restore as installed portable data", async () => {
  const store=new MemoryInstalledContentStore();
  const writer=new MockAdapter();
  setInstalledContentStoreForTests(writer,store);

  const preview=await writer.previewContentImport(payload());
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await writer.activateContentImport();

  const written=getInstalledContentPersistenceStateForTests(writer)?.document;
  const installed=written?.entries.find((entry)=>entry.contentId==="external.feature.quickstep");
  assert.ok(installed);
  assert.deepEqual(installed.mechanics?.map((entry)=>entry.kind),["common-play"]);
  assert.equal(installed.mechanics?.[0]?.config.id,"external.rule.quickstep");
  assert.equal(installed.mechanics?.[0]?.config.entryPoints[0]?.id,"action.external.quickstep");

  const reader=new MockAdapter();
  setInstalledContentStoreForTests(reader,store);
  await reader.getSnapshot();
  const restored=getInstalledContentPersistenceStateForTests(reader)?.document?.entries
    .find((entry)=>entry.contentId==="external.feature.quickstep");
  assert.deepEqual(restored?.mechanics,installed.mechanics);
});

test("unsupported RuleModule mechanic kinds remain explicit blocking failures", async () => {
  const store=new MemoryInstalledContentStore();
  const adapter=new MockAdapter();
  setInstalledContentStoreForTests(adapter,store);
  const preview=await adapter.previewContentImport(payload("custom-rule"));
  assert.ok(preview.contentImport?.validation.some((entry)=>entry.severity==="blocking" && /mechanics|mechanic/i.test(entry.message)));
  await adapter.activateContentImport();
  assert.equal((await store.readGenerations()).length,0);
});
