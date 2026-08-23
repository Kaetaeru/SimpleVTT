import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(process.cwd());
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("bundled ration compatibility is explicit content data on an isolated module",()=>{
  const module=JSON.parse(read("content/modules/dnd-srd-5.2.1.equipment-rations/module.json")) as {
    moduleId:string;
    capabilities:string[];
    content:Array<{id:string;category:string;presentation:{originalName:string}}>; 
  };
  const generator=read("scripts/generate-builtin-catalog.mjs");

  assert.equal(module.moduleId,"dnd.srd-5.2.1.equipment-rations");
  assert.deepEqual(module.capabilities,["campaign.ration-source"]);
  assert.equal(module.content.length,1);
  assert.equal(module.content[0]?.id,"dnd.srd521.item.gear.rations");
  assert.equal(module.content[0]?.presentation.originalName,"Rations (1 day)");
  assert.match(generator,/capabilities:\[\.\.\.new Set\(module\.capabilities \?\? \[\]\)\]/);
  assert.match(generator,/entry\.id\.startsWith\("dnd\.srd521\.item\."\)/);
});
