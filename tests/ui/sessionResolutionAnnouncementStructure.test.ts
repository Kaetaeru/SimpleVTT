import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const sessionRoot = readFileSync(join(root, "src", "SessionModeRoot.tsx"), "utf8");
const playCss = readFileSync(join(root, "src", "v09-production-play.css"), "utf8");

// MP-I02: a shared result is announced once, coherently, from the authoritative ResolutionView.
test("the Session result layer is a status live region with one coherent hidden announcement", () => {
  assert.match(sessionRoot, /role="status" aria-label="판정 결과"/);
  assert.match(sessionRoot, /role="status" aria-live="polite" aria-label="원격 판정 알림"/);
  const announcementRegions = sessionRoot.match(/className="visually-hidden session-resolution-announcement">\{announcement\}/g) ?? [];
  assert.equal(announcementRegions.length, 2, "active and passive-remote result layers both announce");
  assert.match(playCss, /\.visually-hidden\{position:absolute!important/);
});

test("the announcement composes actor, action, targets, dice, total, outcome, and state change from ResolutionView only", () => {
  const block = sessionRoot.slice(sessionRoot.indexOf("const announcement = ["), sessionRoot.indexOf("].filter(Boolean).join"));
  assert.match(block, /\$\{actorName\} · \$\{resolution\.actionName\}/);
  assert.match(block, /대상 \$\{targetNames\.join\(", "\)\}/);
  assert.match(block, /주사위 \$\{resolution\.authoritativeDice\.join\(", "\)\}/);
  assert.match(block, /총합 \$\{announcedTotal\}/);
  assert.match(block, /mainOutcome,/);
  assert.match(block, /stateSummary,/);
  assert.match(sessionRoot, /const announcedTotal = resolution\.attackTotal \?\? resolution\.rollTotal;/);
  assert.match(sessionRoot, /const targetNames = resolution\.targetIds\.map/);
  assert.doesNotMatch(block, /snapshot\.activity|localStorage|fetch\(/);
});

test("the visible result copy is hidden from assistive tech so the sentence is not read twice", () => {
  const copies = sessionRoot.match(/<div className="session-resolution-copy" aria-hidden="true">/g) ?? [];
  assert.equal(copies.length, 2);
});
