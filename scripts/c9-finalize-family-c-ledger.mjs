import fs from "node:fs";

const ledgerPath="docs/rules/v1-mechanism-coverage-ledger.json";
const ledger=JSON.parse(fs.readFileSync(ledgerPath,"utf8"));
const row=ledger.rows.find((candidate)=>candidate.family==="C");
if(!row)throw new Error("Family C row missing");
const pushUnique=(key,...values)=>{for(const value of values)if(!row[key].includes(value))row[key].push(value);};

row.currentState="Family C is ACCEPTED through the canonical Common Play d20 path. Generic checks, saves, attacks, advantage/disadvantage, flat/additional-die/DC modification, reroll/replace/minimum, outcome/critical recalculation, structural family/outcome post-roll decisions, conditional payments, and outcome follow-up execute through the shared PendingResolution/ResolutionEvent authority. Cutting Words, Dark One's Own Luck, Peerless Skill, Tactical Mind, and Indomitable are builtin portable Common Play reference probes. Stable class/subclass ownership and authoritative progression expression refs supply their data without content-name execution dispatch. Reconstructed named fallbacks and the legacy ActionVm.runtimeD20FollowUps DSL/adapter were removed after portable local/connected regressions passed; unknown installed content remains identity-invariant and does not fall through to a second d20 engine.";
row.disposition="IMPLEMENTED";
row.remainingNamedSeams=[];
row.implementationEvidence=row.implementationEvidence.filter((entry)=>entry!=="d20FollowUpRuntimeAdapter.ts");
pushUnique("implementationEvidence",
  "09eaf85632a4a198fa1fbc5cc8e0e686636c5945 preserves class progression contributions into canonical SessionProjection feature ownership and executes Tactical Mind through Common Play",
  "e684898cd28bc60a1ad4808f0d24ac65840da943 resolves Common Play numeric expression refs from authoritative owner progression and migrates Indomitable declaratively",
  "6d1ebebc806a3e1fa782943d710569959cd7e2b3 removes reconstructed Dark One's Own Luck and Peerless Skill runtimeD20FollowUps fallbacks",
  "863808513b45d7afc6179c93b7b0a7d649091aae removes the legacy ActionVm.runtimeD20FollowUps contract, production adapter, offline import, and legacy-only test after a zero-producer scan"
);
pushUnique("productionEvidence",
  "C9 Family C Class Feature Ownership run 33294017741: Tactical Mind portable production, completed-check success effects, connected exactly-once, 22/22 focused tests, tsc --noEmit, vite build",
  "C9 Family C Indomitable Portable Migration run 33294258177: portable progression-ref reroll bonus, local/connected/Undo regression, ledger checker, tsc --noEmit, vite build",
  "C9 Family C Reconstruction Fallback Removal run 33294479836: Dark One's Own Luck and Peerless Skill local/connected portable regressions pass without reconstructed named injection, tsc --noEmit, vite build",
  "C9 Family C Retire Legacy D20 Engine run 33294577227: all migrated Family C probes plus unknown portable interceptor regressions pass after legacy d20 engine deletion, ledger checker, tsc --noEmit, vite build"
);
pushUnique("identityInvarianceEvidence",
  "09eaf85632a4a198fa1fbc5cc8e0e686636c5945 class feature execution is owned by stable progression grants rather than localized Fighter/feature names",
  "e684898cd28bc60a1ad4808f0d24ac65840da943 Indomitable bonus resolves an authoritative progression ref rather than a Fighter identity execution branch",
  "863808513b45d7afc6179c93b7b0a7d649091aae zero-producer scan proves supported d20 content no longer selects the removed ActionVm compatibility DSL"
);
pushUnique("connectedEvidenceIfRelevant",
  "C9 Family C Class Feature Ownership run 33294017741 connected Tactical Mind exactly-once production proof",
  "C9 Family C Indomitable Portable Migration run 33294258177 connected Indomitable owner/Host event and Undo proof",
  "C9 Family C Retire Legacy D20 Engine run 33294577227 retains connected Dark Luck/Peerless and generic interceptor regressions after second-engine deletion"
);
pushUnique("persistenceEvidenceIfRelevant",
  "09eaf85632a4a198fa1fbc5cc8e0e686636c5945 stable class progression grants survive Character SessionProjection ownership",
  "C9 Family C Indomitable Portable Migration run 33294258177 reuses persisted Character class tracks/resource state for progression-ref execution",
  "C9 Family C Retire Legacy D20 Engine run 33294577227 retains portable connected reconstruction/writeback/Undo paths with no legacy ActionVm d20 payload"
);
fs.writeFileSync(ledgerPath,JSON.stringify(ledger,null,2)+"\n");

const checklistPath="docs/rules/resolver-execution-checklist-v2.md";
let checklist=fs.readFileSync(checklistPath,"utf8");
const board=/^- \[x\] tests \/ rolls \/ outcomes — .*$/m;
if(!board.test(checklist))throw new Error("tests/rolls/outcomes maturity-board line missing");
checklist=checklist.replace(board,"- [x] tests / rolls / outcomes — `ACCEPTED`; Common Play owns structural d20 families/outcomes, deterministic and dice-backed post-roll modifiers, conditional payments, completed-check outcome effects, stable class/subclass ownership, authoritative progression refs, connected replay/reconnect/Undo, and unknown-ID rename invariance. Cutting Words, Dark One's Own Luck, Peerless Skill, Tactical Mind, and Indomitable are portable reference probes; the reconstructed named fallbacks and legacy `ActionVm.runtimeD20FollowUps` side engine have been removed.");
fs.writeFileSync(checklistPath,checklist);
