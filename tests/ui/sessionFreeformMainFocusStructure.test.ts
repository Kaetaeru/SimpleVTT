import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = readFileSync(new URL("../../src/SessionModeRoot.tsx", import.meta.url), "utf8");
const focus = readFileSync(new URL("../../src/SessionMainFocus.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../../src/session-main-focus.css", import.meta.url), "utf8");
const referenceCss = readFileSync(new URL("../../src/session-integrated-reference-play.css", import.meta.url), "utf8");

test("Session root delegates the dominant mapless center to the accepted Main Focus projection", () => {
  assert.match(root, /<SessionMainFocus role=\{role\}/);
  assert.match(root, /session-reference-mapless-stage/);
  assert.match(root, /onOpenActivity=\{\(button\) => toggleUtility\("activity", button\)\}/);
  assert.doesNotMatch(root, /SCENE ACTORS|HOTBAR_TABS|공통.*클래스.*주문.*아이템/s);
});

test("Freeform matches the accepted restrained Stage focus rather than a dashboard", () => {
  assert.match(focus, /snapshot\.sessionMode === "initiative"/);
  assert.match(focus, />FREEFORM</);
  assert.match(focus, />Mapless shared play context</);
  assert.match(focus, /Current interaction, notices, dice, result and Handout presentation use this space/);
  assert.match(focus, /Actor context <strong>Boards<\/strong>/);
  assert.match(focus, /Dice \/ Result <strong>Center Stage<\/strong>/);
  assert.doesNotMatch(focus, /snapshot\.activity\[0\]|snapshot\.activity\.map|scene\.entities\.map|economyByActor|actionsByActor/);
});

test("Initiative changes only Stage context copy while Actor and economy detail stay elsewhere", () => {
  assert.match(focus, />INITIATIVE</);
  assert.match(focus, />Actor and action context, not a battlemap</);
  assert.match(focus, /Actor identity and targets remain in the boards above and below/);
  assert.doesNotMatch(focus, /currentActorId|current\.hp|current\.maxHp|economyByActor/);
});

test("Stage focus geometry stays centered and compact inside the accepted mapless field", () => {
  assert.match(referenceCss, /\.session-reference-stage-focus[\s\S]*place-items:\s*center/);
  assert.match(referenceCss, /\.session-reference-stage-focus \.session-main-focus-state[\s\S]*width:\s*min\(650px, 72%\)/);
  assert.match(referenceCss, /\.session-reference-stage-focus \.session-focus-heading h1[\s\S]*font-size:\s*22px/);
  assert.match(css, /\.session-reference-stage-chips/);
  assert.match(css, /justify-content:\s*center/);
});
