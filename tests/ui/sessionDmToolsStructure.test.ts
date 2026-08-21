import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root=readFileSync(new URL("../../src/SessionModeRoot.tsx",import.meta.url),"utf8");
const tools=readFileSync(new URL("../../src/SessionDmTools.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../../src/session-dm-tools.css",import.meta.url),"utf8");
const referenceCss=readFileSync(new URL("../../src/session-integrated-reference-play.css",import.meta.url),"utf8");
const combatantAdapter=readFileSync(new URL("../../src/app/productionCombatantPreparationAdapter.ts",import.meta.url),"utf8");
const quick=readFileSync(new URL("../../src/SessionQuickPalette.tsx",import.meta.url),"utf8");

test("DM utilities launch from accepted Play chrome and render in the contextual right pane",()=>{
  assert.match(root,/SessionDmActorPane, SessionDmEncounterPane, SessionParticipantsPane, SessionSharePane/);
  assert.match(root,/activeUtility === "encounter"/);
  assert.match(root,/activeUtility === "participants"/);
  assert.match(root,/activeUtility === "session"/);
  assert.match(root,/>인카운터<\/button>/);
  assert.match(root,/>세션<\/button>/);
  assert.match(quick,/destination:"participants"/);
  assert.match(quick,/label:"참가자"/);
  assert.match(root,/session-reference-utility-host/);
  assert.doesNotMatch(root,/session-mode-rail|navigate\(|setRoute\(|플레이로 돌아가기/);
});

test("Actor switch delegates to the existing selected-Actor command and never changes turn authority locally",()=>{
  assert.match(tools,/const \{ snapshot, selectDmActor \} = useSimpleVtt\(\)/);
  assert.match(tools,/await selectDmActor\(actorId\)/);
  assert.match(tools,/snapshot\.scene\.selectedActorId/);
  assert.doesNotMatch(tools,/setCurrentActor|currentActorId\s*=|economyByActor/);
});

test("Encounter pane uses canonical Combatant and Initiative commands without lifecycle gates in presentation",()=>{
  assert.match(tools,/instantiateCombatant, removeCombatant, startInitiative, endInitiative/);
  assert.match(tools,/await instantiateCombatant\(definitionId\)/);
  assert.match(tools,/await removeCombatant\(combatantId\)/);
  assert.match(tools,/snapshot\.combatantDefinitions/);
  assert.match(tools,/snapshot\.scene\.entities\.filter\(\(entity\) => entity\.kind === "combatant"\)/);
  assert.doesNotMatch(tools,/lifecycle|preparing|Ready|플레이 시작/);
});

test("safe Combatant removal preserves preparation and extends only to active live Freeform",()=>{
  assert.match(combatantAdapter,/canRemove=lifecycle==="preparing"\|\|\(lifecycle==="live"&&internal\.sessionMode==="freeform"\)/);
  assert.match(combatantAdapter,/if \(!canRemove\)/);
  assert.match(combatantAdapter,/internal\.resolution/);
  assert.match(combatantAdapter,/delete internal\.scene\.actionsByActor\[combatantId\]/);
  assert.match(combatantAdapter,/delete internal\.scene\.economyByActor\[combatantId\]/);
});

test("Participants and Session panes are status/share surfaces without Ready or start gates",()=>{
  assert.match(tools,/snapshot\.session\.participants\.filter/);
  assert.match(tools,/participant\.state/);
  assert.match(tools,/participant\.characterName/);
  assert.match(tools,/snapshot\.session\.address/);
  assert.match(tools,/snapshot\.session\.sessionContent/);
  assert.match(tools,/navigator\.clipboard\.writeText/);
  assert.doesNotMatch(tools,/participant\.ready|setSessionReady|startPreparedSession|rulesProfileId/);
});

test("DM pane internals remain responsive while accepted Play owns their right-side geometry",()=>{
  assert.match(referenceCss,/\.session-reference-utility-host\s*\{[\s\S]*width:\s*338px/);
  assert.match(referenceCss,/\.session-reference-utility-host > \*[\s\S]*position:\s*absolute !important;[\s\S]*width:\s*100% !important/);
  assert.match(referenceCss,/@media \(max-width: 1000px\)[\s\S]*width: 308px; max-width: 42%/);
  assert.match(css,/@media \(max-width: 899px\)/);
  assert.match(css,/@media \(max-width: 620px\)/);
});
