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
  assert.match(rust,/context\.config_mut\(\)\.app\.windows/);
  assert.match(rust,/window\.data_directory\s*=\s*Some/);
  assert.match(rust,/acceptance-\{profile\}/);
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

test("Tauri UI E2E launcher drives isolated Host and Client windows through real inputs",()=>{
  const cargo=text("src-tauri/Cargo.toml");
  const rust=text("src-tauri/src/lib.rs");
  const runner=text("scripts/run-tauri-e2e.mjs");
  const wrapper=text("scripts/run-tauri-e2e.ps1");
  const cmd=text("Run SimpleVTT Tauri UI Test.cmd");

  assert.match(cargo,/tauri-e2e\s*=\s*\["dep:tauri-plugin-wdio-webdriver"\]/);
  assert.match(rust,/cfg\(all\(debug_assertions, feature = "tauri-e2e"\)\)/);
  assert.match(runner,/TAURI_WEBDRIVER_PORT/);
  assert.match(runner,/Tauri E2E Host/);
  assert.match(runner,/Tauri E2E Client/);
  assert.match(runner,/10 GP 보관/);
  assert.match(runner,/Host owner inventory after Player stash deposit/);
  assert.match(runner,/Party Stash must not duplicate the deposit/);
  assert.match(runner,/takeScreenshot/);
  assert.match(wrapper,/CARGO_TARGET_DIR/);
  assert.match(wrapper,/--features tauri-e2e/);
  assert.match(cmd,/run-tauri-e2e\.ps1/);
});
