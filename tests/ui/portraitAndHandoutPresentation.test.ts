import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { HANDOUT_IMAGE_MAX_BYTES, isLocalImageAssetV1, parseLocalImageDataUrl, PORTRAIT_IMAGE_MAX_BYTES } from "../../src/app/localImageAsset";

const portrait=readFileSync(new URL("../../src/CharacterPortraitBridge.tsx",import.meta.url),"utf8");
const handout=readFileSync(new URL("../../src/SessionImageHandoutBridge.tsx",import.meta.url),"utf8");
const runtime=readFileSync(new URL("../../src/app/sessionImageHandoutRuntimeAdapter.ts",import.meta.url),"utf8");
const main=readFileSync(new URL("../../src/main.tsx",import.meta.url),"utf8");
const actorBoards=readFileSync(new URL("../../src/SessionActorBoards.tsx",import.meta.url),"utf8");
const mainFocus=readFileSync(new URL("../../src/SessionMainFocus.tsx",import.meta.url),"utf8");
const actionDock=readFileSync(new URL("../../src/SessionActionDock.tsx",import.meta.url),"utf8");

test("portrait accepts only bounded local PNG/JPEG/WebP and exposes preview replace remove and focal controls",()=>{
  const png=parseLocalImageDataUrl("data:image/png;base64,iVBORw0KGgo=","hero.png",PORTRAIT_IMAGE_MAX_BYTES);
  assert.equal(png.mimeType,"image/png");
  assert.equal(isLocalImageAssetV1({...png,byteLength:PORTRAIT_IMAGE_MAX_BYTES+1},PORTRAIT_IMAGE_MAX_BYTES),false);
  assert.throws(()=>parseLocalImageDataUrl("data:image/svg+xml;base64,PHN2Zz4=","hero.svg",PORTRAIT_IMAGE_MAX_BYTES),/PNG, JPEG, WebP/);
  assert.equal(HANDOUT_IMAGE_MAX_BYTES,4*1024*1024);
  for(const pattern of [/accept=\{LOCAL_IMAGE_ACCEPT\}/,/사진 선택 \/ 교체/,/가로 초점/,/세로 초점/,/제거/,/updateActiveCharacterPortrait/,/character-portrait-hover/,/persisted\?"변경":"\+"/]) assert.match(portrait,pattern);
  assert.match(portrait,/\.official-2024-appearance, \.sheet-play-toolbar/);
  assert.doesNotMatch(portrait,/official-identity-grid/);
});

test("host Session portrait surfaces resolve remote owner projections without copying them into the Host library",()=>{
  for(const source of [actorBoards,mainFocus,actionDock]){
    assert.match(source,/projectedCharacterById\(mockAdapter/);
    assert.match(source,/sanitizeCharacterPortrait/);
  }
});

test("DM handout is contextual presentation state with explicit reveal withdraw dismiss reopen and no mechanics path",()=>{
  for(const pattern of [/이미지 보여주기/,/공유 철회/,/플레이어에게 공개/,/이미지 다시 열기/,/dismissSessionImageHandout/,/reopenSessionImageHandout/]) assert.match(handout,pattern);
  assert.match(runtime,/presentation-handout/);
  assert.match(runtime,/compatibility\?\.status==="compatible"|compatibility\.status==="compatible"/);
  assert.match(runtime,/sendToWithHandoutRestore/);
  assert.doesNotMatch(`${runtime}\n${handout}`,/ResolutionEvent|undoLastResolution|tactical grid|fog of war|public URL|cloud hosting/i);
  const handoutImport=main.indexOf("sessionImageHandoutRuntimeAdapter");
  const parityImport=main.indexOf("sessionContentParityRuntimeAdapter");
  assert.ok(handoutImport>=0&&parityImport>handoutImport,"presentation transport decorator must be installed before parity wraps the same transport listener");
});
