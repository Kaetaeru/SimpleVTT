import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pane=readFileSync(new URL("../../src/SessionInventoryPane.tsx",import.meta.url),"utf8");

test("Player inventory opens a separate left-side shared stash with bidirectional arrows and GP amount",()=>{
  assert.match(pane,/공유 보관함 \{stashOpen\?"닫기":"열기"\}/);
  assert.match(pane,/session-shared-stash-pane/);
  assert.match(pane,/옮길 GP/);
  assert.match(pane,/가져오기 →/);
  assert.match(pane,/← 보관하기/);
  assert.match(pane,/move-arrow/);
  assert.match(pane,/내 인벤토리로 이동/);
  assert.match(pane,/공유 보관함으로 이동/);
  assert.match(pane,/direction:"character-to-stash"/);
  assert.match(pane,/direction:"stash-to-character"/);
  assert.match(pane,/forceUnequip:active/);
  assert.match(pane,/itemTemplate:stashTemplateFromItem\(item\)/);
  assert.match(pane,/templateForStashReference/);
  assert.doesNotMatch(pane,/pending\|\|!canTransfer\|\|!entry/);
  assert.match(pane,/stashPermission==="request"\|\|member\?\.stashPermission==="manage"/);
  assert.doesNotMatch(pane,/이 화면에서는 확인만 가능합니다/);
});
