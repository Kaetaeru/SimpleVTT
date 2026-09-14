import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read=(path:string)=>readFileSync(new URL(`../../${path}`,import.meta.url),"utf8");

/** T2-07: the V2 table runtime is the product session path; the old play screens are an explicit legacy opt-out. */
test("main.tsx composes the table facade by default and only `table=legacy` restores the old play screens", () => {
  const main=read("src/main.tsx");
  assert.match(main,/const tableFacade=legacyRequested\?null:createTableSessionFacade\(mockAdapter\);/);
  assert.match(main,/get\("table"\)==="legacy"/);
  assert.match(main,/getItem\("simplevtt\.table"\)==="legacy"/);
  assert.doesNotMatch(main,/==="v2"/,"no opt-in flag remains");
  assert.match(main,/<AppProvider adapter=\{tableFacade\?\.adapter\}>/);
  assert.match(main,/<TableFacadeContext\.Provider value=\{tableFacade\}>/);
});

test("the live session surface and the dev preview render the DM workspace whenever the facade is present", () => {
  const root=read("src/ProductRoot.tsx");
  assert.match(root,/tableFacade \? <TableWorkspace onLeave=/);
  const preview=read("src/SessionDebugPreview.tsx");
  assert.match(preview,/if \(facade\) return <TableWorkspace onLeave=\{onExit\} \/>;/);
});
