import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read=(path:string)=>readFileSync(new URL(path,import.meta.url),"utf8");

test("S1-01: the refusal notice is mounted in the session workspace above the command dock and styled by its own sheet", () => {
  const root=read("../../src/SessionModeRoot.tsx");
  assert.match(root,/import \{ SessionRefusalNotice \} from "\.\/SessionRefusalNotice"/);
  const noticeAt=root.indexOf("<SessionRefusalNotice />");
  const dockAt=root.indexOf("<footer className=\"session-mode-action-dock\"");
  assert.ok(noticeAt>0&&dockAt>noticeAt,"the notice renders right before the dock footer");
  const component=read("../../src/SessionRefusalNotice.tsx");
  assert.match(component,/import "\.\/session-refusal\.css"/);
  assert.match(component,/role="alert"/);
  assert.match(component,/data-refusal-code=\{current\.code\}/);
  assert.match(component,/subscribeRefusal\(show\)/,"UI-local refusals reach the same notice");
  assert.match(component,/snapshot\?\.refusal/,"adapter and Host refusals reach the same notice");
});

test("S1-01: the notice sits above the dock, shakes the dock, and respects reduced motion", () => {
  const css=read("../../src/session-refusal.css");
  assert.match(css,/\.session-refusal-notice \{[\s\S]*bottom: calc\(var\(--svtt-command-h/);
  assert.match(css,/\.session-mode-action-dock\.refused \{ animation: session-refusal-shake/);
  assert.match(css,/:root\[data-motion="reduced"\] \.session-refusal-notice \{ animation: none; \}/);
  assert.match(css,/:root\[data-motion="reduced"\] \.session-mode-action-dock\.refused \{ animation: none; \}/);
  assert.match(css,/\.session-refusal-notice\.origin-host/,"a Host refusal is told apart from a local one");
});

test("S1-01: the base adapter, the connected client and the Host all record refusals; the provider catches silent no-ops", () => {
  const mock=read("../../src/app/mockAdapter.ts");
  assert.match(mock,/async resolveAction\(actionId:string,targetIds:string\[\]\)\{const a=this\.action\(actionId\);if\(!a\)return this\.refuse\("action-unknown"/);
  assert.match(mock,/this\.refuse\("action-unavailable",live\.reason/);
  assert.match(mock,/this\.refuse\("target-ineligible"/);
  assert.match(mock,/this\.refuse\("too-many-targets"/);
  assert.match(mock,/refusal:this\.refusal,session:this\.session/);
  const runtime=read("../../src/app/connectedSessionRuntimeAdapter.ts");
  assert.match(runtime,/app\.refusal=makeRefusal\(wire\.code,refusalMessageFor\(wire\.code,wire\.message\),\{origin:"host"\}\)/);
  const routing=read("../../src/app/connectedActionRoutingAdapter.ts");
  assert.match(routing,/const reason=next\.refusal\?\.message\?\?refusalMessageFor\("action-rejected"\)/,"the Host's own reason travels on the wire");
  assert.match(routing,/origin:"remote",actorId:request\.actorId/,"the Host sees the player's refusal");
  assert.match(routing,/makeRefusal\("not-connected"/);
  assert.match(routing,/makeRefusal\("remote-pending"/);
  const provider=read("../../src/app/AppProvider.tsx");
  assert.match(provider,/commandWasNoOp\(before, after\)/);
  assert.match(provider,/after\.session\.role !== "client"/,"a client's request is answered by the Host later");
  const dock=read("../../src/SessionActionDock.tsx");
  assert.match(dock,/announceRefusal\("action-unavailable",reason,\{actionId:action\.id,actorId:action\.actorId\}\)/);
  const contracts=read("../../src/app/contracts.ts");
  assert.match(contracts,/refusal\?: SessionRefusalVm \| null;/);
});

test("S1-01: the refusal suites and the V1.5 feedback suites run in CI", () => {
  const workflow=read("../../.github/workflows/ui.yml");
  assert.match(workflow,/tests\/ui\/sessionRefusal\.test\.ts tests\/ui\/sessionRefusalStructure\.test\.ts/);
  assert.match(workflow,/tests\/ui\/combatFeedbackEvents\.test\.ts tests\/ui\/combatFeedbackStructure\.test\.ts/);
});
