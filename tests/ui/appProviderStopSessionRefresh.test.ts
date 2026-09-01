import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appProviderSource=readFileSync(new URL("../../src/app/AppProvider.tsx",import.meta.url),"utf8").replace(/\r\n/g,"\n");

test("AppProvider stopSession refreshes from the adapter after stop completes",()=>{
  const match=appProviderSource.match(/stopSession:\s*async\s*\(\)\s*=>\s*\{([\s\S]*?)\n\s*\},\n\s*setSessionReady:/);
  assert.ok(match,"AppProvider stopSession must remain an explicit async block");
  const body=match[1];
  const stopIndex=body.indexOf("await apply(() => mockAdapter.stopSession());");
  const refreshIndex=body.indexOf("await refresh();");
  assert.ok(stopIndex>=0,"stopSession must await the existing adapter stop path");
  assert.ok(refreshIndex>stopIndex,"stopSession must authoritatively refresh after adapter stop completes");
});

test("authoritative refresh wins an external snapshot published during stop",async()=>{
  let operationSequence=0;
  let renderedRole="host-live";
  const publishIfLatest=(sequence:number,next:string)=>{
    if(sequence===operationSequence)renderedRole=next;
  };
  const apply=async(operation:()=>Promise<string>)=>{
    const sequence=++operationSequence;
    const next=await operation();
    publishIfLatest(sequence,next);
  };
  const refresh=async()=>{
    const sequence=++operationSequence;
    publishIfLatest(sequence,"offline");
  };

  await apply(async()=>{
    const transportSequence=++operationSequence;
    publishIfLatest(transportSequence,"host-disconnected");
    return "offline";
  });
  assert.equal(renderedRole,"host-disconnected","the reproduced transport publication must stale the original stop apply result");

  await refresh();
  assert.equal(renderedRole,"offline","the post-stop authoritative refresh must restore the final offline state");
});
