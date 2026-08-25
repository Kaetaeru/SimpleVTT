import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root=readFileSync(new URL("../../src/SessionModeRoot.tsx",import.meta.url),"utf8");
const pane=readFileSync(new URL("../../src/SessionDmLibraryPane.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../../src/session-dm-library.css",import.meta.url),"utf8");
const main=readFileSync(new URL("../../src/main.tsx",import.meta.url),"utf8");
const campaignRuntime=readFileSync(new URL("../../src/app/campaignRuntimeAdapter.ts",import.meta.url),"utf8");

test("DM library is a private independent Session utility with one ungrouped continuous list",()=>{
  assert.match(root,/activeUtility === "library" && role === "dm" && <SessionDmLibraryPane/);
  assert.match(root,/role === "dm" && <button[\s\S]*?utilityClass\(activeUtility, "library"\)[\s\S]*?toggleUtility\("library"/);
  assert.match(pane,/snapshot\.session\.role!=="host"/);
  assert.match(pane,/aria-label="분류 없는 DM 라이브러리 목록"/);
  assert.match(pane,/campaign\?\.dmLibrary\.entries/);
  assert.doesNotMatch(pane,/role="tablist"|role="tab"/);
  assert.match(css,/\.session-dm-library-list\{[^}]*flex:1[^}]*overflow:auto/);
});

test("library entries can be searched or authored in a JSON dialog and dragged without exposing private data",()=>{
  assert.match(pane,/role="dialog" aria-modal="true" aria-label="DM 라이브러리에 추가"/);
  assert.match(pane,/snapshot\.catalog\.filter\(\(entry\)=>entry\.category==="item"\)/);
  assert.match(pane,/snapshot\.combatantDefinitions\.map/);
  assert.match(pane,/공식 아이템·커스텀 아이템·NPC 스탯블럭 검색/);
  assert.match(pane,/parseCampaignDmLibraryJson/);
  assert.match(pane,/DM 라이브러리 커스텀 JSON/);
  assert.match(pane,/upsertCampaignDmLibraryEntry/);
  assert.match(pane,/readLocalImageFile/);
  assert.match(pane,/candidate\.kind==="custom-item"/);
  assert.match(pane,/kind:"npc-definition"/);
  assert.match(pane,/onPointerDown=\{\(event\)=>beginPointerDrag\(event,entry\)\}/);
  assert.match(pane,/setPointerCapture\(event\.pointerId\)/);
  assert.match(pane,/Math\.hypot\(event\.clientX-drag\.startX,event\.clientY-drag\.startY\)>=5/);
  assert.match(pane,/onDrop\(drag\.payload,event\.clientX,event\.clientY\)/);
  assert.match(pane,/entry\.kind!=="note"/);
  assert.match(css,/-webkit-user-drag:none/);
});

test("drop dispatch uses existing authoritative materialization paths and Character targeting",()=>{
  assert.match(root,/instantiateCampaignDmLibraryNpc\(payload\.campaignId,payload\.entryId\)/);
  assert.match(root,/instantiateCampaignDmLibraryPcPreset\(payload\.campaignId,payload\.entryId\)/);
  assert.match(root,/revealCampaignDmLibraryImage\(payload\.campaignId,payload\.entryId\)/);
  assert.match(root,/grantCampaignDmLibraryItem\(payload\.campaignId,payload\.entryId,\{kind:"character",actorId\},1\)/);
  assert.match(root,/closest<HTMLElement>\("\[data-actor-id\]"\)/);
  assert.match(root,/explicitEntity\?\.kind==="combatant"/);
  assert.match(root,/payload\.campaignId!==activeCampaignId/);
  assert.match(root,/document\.elementFromPoint\(clientX,clientY\)/);
  assert.match(root,/playCore\.current\?\.contains\(target\)/);
  assert.match(root,/onDragStateChange=\{setLibraryDropActive\}/);
  assert.match(root,/onDrop=\{handleLibraryPointerDrop\}/);
  assert.doesNotMatch(root,/hasSessionDmLibraryDrag/);
  assert.doesNotMatch(root,/dataTransfer|handleLibraryDragOver/);
  assert.match(css,/\.session-dm-library-drop-guide/);
});

test("image handout presentation installs after connected Session authority",()=>{
  const connected=main.indexOf('import "./app/connectedSessionRuntimeAdapter"');
  const handout=main.indexOf('import "./app/sessionImageHandoutRuntimeAdapter"');
  const product=main.indexOf('import { ProductRoot } from "./ProductRoot"');
  assert.ok(connected>=0&&handout>connected&&product>handout);
  assert.match(campaignRuntime,/await import\("\.\/sessionImageHandoutRuntimeAdapter"\)/);
  assert.doesNotMatch(campaignRuntime,/^import \{ revealSessionImageHandout \}/m);
});
