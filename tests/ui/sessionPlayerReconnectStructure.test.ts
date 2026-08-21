import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = readFileSync(new URL("../../src/SessionModeRoot.tsx", import.meta.url), "utf8");
const playerSession = readFileSync(new URL("../../src/SessionPlayerSession.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../../src/session-player-session.css", import.meta.url), "utf8");
const referenceCss = readFileSync(new URL("../../src/session-integrated-reference-play.css", import.meta.url), "utf8");

test("Player connection utility launches from accepted Session chrome inside persistent Play", () => {
  assert.match(root, /SessionPlayerRecoveryStrip, SessionPlayerSessionPane/);
  assert.match(root, /"player-session"/);
  assert.match(root, /toggleUtility\(role === "dm" \? "session" : "player-session"/);
  assert.match(root, />세션<\/button>/);
  assert.match(root, /<SessionPlayerSessionPane onClose=\{closeUtility\}/);
  assert.match(root, /session-reference-utility-host/);
  assert.doesNotMatch(playerSession, /setRoute|AppRoute|플레이로 돌아가기/);
});

test("healthy connected play stays quiet while reconnecting remains actionable over the mounted shell", () => {
  assert.match(playerSession, /snapshot\.connectionState === "connected"\) return null/);
  assert.match(playerSession, /snapshot\.connectionState === "reconnecting"/);
  assert.match(root, /activeUtility !== "player-session" && <SessionPlayerRecoveryStrip/);
  assert.match(playerSession, /세션 상태를 유지하고 있습니다/);
});

test("automatic reconnect does not start a new Join and terminal rejoin is explicit", () => {
  assert.match(playerSession, /const canRejoin = snapshot\.connectionState === "disconnected" && Boolean\(snapshot\.session\.address\)/);
  assert.match(playerSession, /if \(snapshot\.connectionState !== "disconnected" \|\| !snapshot\.session\.address \|\| pending\) return/);
  assert.match(playerSession, /await joinSession\(snapshot\.session\.address\)/);
  assert.match(playerSession, /재연결은 자동으로 진행됩니다/);
});

test("Player session pane exposes only player-relevant identity connection and leave actions", () => {
  assert.match(playerSession, /snapshot\.activeCharacter\.name/);
  assert.match(playerSession, /snapshot\.session\.address/);
  assert.match(playerSession, /await stopSession\(\)/);
  assert.doesNotMatch(playerSession, /instantiateCombatant|removeCombatant|selectDmActor|startInitiative|participants\.map/);
});

test("Player reconnect pane internals remain responsive while accepted Play owns contextual right-pane geometry", () => {
  assert.match(referenceCss, /\.session-reference-utility-host\s*\{[\s\S]*width:\s*338px/);
  assert.match(referenceCss, /\.session-reference-utility-host > \*[\s\S]*width:\s*100% !important/);
  assert.match(css, /@media \(max-width: 620px\)[\s\S]*\.session-player-session-pane \{ width: 100%; \}/);
  assert.match(css, /\.session-player-recovery\s*\{[\s\S]*position:\s*absolute;/);
});
