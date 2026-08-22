import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root=process.cwd();

function text(path:string) {
  return readFileSync(resolve(root,path),"utf8");
}

test("Tauri acceptance instances support isolated local data and visible labels",()=>{
  const rust=text("src-tauri/src/lib.rs");
  assert.match(rust,/SIMPLEVTT_LOCAL_DATA_ROOT/);
  assert.match(rust,/SIMPLEVTT_INSTANCE_LABEL/);
  assert.match(rust,/get_webview_window\("main"\)/);
});

test("two-instance launcher preflights Live Dev and isolates Host and Client data",()=>{
  const launcher=text("scripts/start-acceptance-pair.ps1");
  assert.match(launcher,/src-tauri\\target\\debug\\simplevtt\.exe/);
  assert.match(launcher,/127\.0\.0\.1' -Port 1420/);
  assert.match(launcher,/127\.0\.0\.1' -Port 3210/);
  assert.match(launcher,/acceptanceRoot 'host\\data'/);
  assert.match(launcher,/acceptanceRoot 'client\\data'/);
  assert.match(launcher,/SIMPLEVTT_LOCAL_DATA_ROOT/);
  assert.match(launcher,/Acceptance Host/);
  assert.match(launcher,/Acceptance Client/);

  const cmd=text("Start SimpleVTT Acceptance Pair.cmd");
  assert.match(cmd,/start-acceptance-pair\.ps1/);
  assert.match(cmd,/ExecutionPolicy Bypass/);
});
