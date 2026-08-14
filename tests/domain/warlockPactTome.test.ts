import assert from "node:assert/strict";
import test from "node:test";
import type { ProgressionCharacterState } from "../../src/domain/progression";
import {
  allClassLeveledSpellIds,
  spellRuleMetadataById,
} from "../../src/domain/spellRuleCatalog";
import {
  hasPactOfTheTome,
  pactTomeCandidateIds,
  pactTomePreparedView,
  resolvePactTomeRest,
  WARLOCK_PACT_TOME_INVOCATION_ID,
} from "../../src/domain/warlockPactTome";
import {
  WARLOCK_ID,
  warlockInvocationChoices,
} from "../../src/domain/warlockProgressionChoices";

function baseState():ProgressionCharacterState {
  return {
    revision:7,
    id:"warlock",
    name:"Warlock",
    totalLevel:3,
    abilities:{ str:8, dex:14, con:14, int:12, wis:10, cha:18 },
    hpCurrent:24,
    hpMaximum:24,
    proficiencyBonus:2,
    classTracks:[{ classId:WARLOCK_ID, className:"워락", level:3 }],
    hitDiceByDie:{ d8:3 },
    features:[],
    cantripIds:[],
    preparedSpellIds:[],
    eldritchInvocationIds:[WARLOCK_PACT_TOME_INVOCATION_ID],
    eldritchInvocationSources:{ [WARLOCK_PACT_TOME_INVOCATION_ID]:"워락 기원술" },
  };
}

test("canonical spell rule metadata exposes structured Ritual flags without prose parsing", () => {
  const alarm = spellRuleMetadataById("dnd.srd521.spell.alarm");
  assert.deepEqual(alarm,{ id:"dnd.srd521.spell.alarm", level:1, ritual:true });
});

test("Pact of the Tome is selectable once rest-based nested spell semantics exist", () => {
  const choices = warlockInvocationChoices({
    targetLevel:1,
    count:1,
    knownInvocationIds:[],
    knownCantripIds:[],
    knownFeatureIds:[],
    originFeatOptions:[],
    selections:{},
  });
  const option = choices[0].options.find((entry) => entry.id === WARLOCK_PACT_TOME_INVOCATION_ID);
  assert.ok(option);
  assert.equal(option.disabledReason,undefined);
});

test("Pact of the Tome configures exactly three any-class cantrips and two level-1 Ritual spells as Warlock spells", () => {
  const state = baseState();
  assert.equal(hasPactOfTheTome(state),true);
  const candidates = pactTomeCandidateIds(state);
  assert.ok(candidates.cantripIds.length >= 3);
  assert.ok(candidates.ritualSpellIds.length >= 2);
  const cantripIds = candidates.cantripIds.slice(0,3);
  const ritualSpellIds = candidates.ritualSpellIds.slice(0,2);
  const result = resolvePactTomeRest(state,{
    expectedRevision:7,
    rest:"short",
    cantripIds,
    ritualSpellIds,
  });
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.revision,8);
  assert.deepEqual(result.state.pactTomeCantripIds,cantripIds);
  assert.deepEqual(result.state.pactTomeRitualSpellIds,ritualSpellIds);
  for (const spellId of ritualSpellIds) {
    assert.deepEqual(spellRuleMetadataById(spellId)?.ritual,true);
    assert.equal(spellRuleMetadataById(spellId)?.level,1);
  }
  for (const spellId of [...cantripIds,...ritualSpellIds]) {
    assert.match(result.state.pactTomeSpellSources?.[spellId] ?? "",/functions as a Warlock spell/);
  }
  const view = pactTomePreparedView(result.state);
  cantripIds.forEach((spellId) => assert.ok(view.cantripIds.includes(spellId)));
  ritualSpellIds.forEach((spellId) => assert.ok(view.preparedSpellIds.includes(spellId)));
  assert.deepEqual(new Set(view.warlockSpellIds),new Set([...cantripIds,...ritualSpellIds]));
});

test("a new Book of Shadows can keep or replace the previous Tome choices without treating them as outside preparation", () => {
  const state = baseState();
  const firstCandidates = pactTomeCandidateIds(state);
  const first = resolvePactTomeRest(state,{
    expectedRevision:7,
    rest:"long",
    cantripIds:firstCandidates.cantripIds.slice(0,3),
    ritualSpellIds:firstCandidates.ritualSpellIds.slice(0,2),
  });
  assert.equal(first.status,"committed");
  if (first.status !== "committed") return;

  const keepSame = resolvePactTomeRest(first.state,{
    expectedRevision:8,
    rest:"short",
    cantripIds:[...(first.state.pactTomeCantripIds ?? [])],
    ritualSpellIds:[...(first.state.pactTomeRitualSpellIds ?? [])],
  });
  assert.equal(keepSame.status,"committed","current Tome spells are replaced with the book rather than blocking their own reselection");
});

test("Pact of the Tome rejects spells already prepared outside the current Book of Shadows", () => {
  const state = baseState();
  const candidates = pactTomeCandidateIds(state);
  const alreadyKnown = candidates.cantripIds[0];
  state.cantripIds = [alreadyKnown];
  const refreshed = pactTomeCandidateIds(state);
  assert.equal(refreshed.cantripIds.includes(alreadyKnown),false);
  const result = resolvePactTomeRest(state,{
    expectedRevision:7,
    rest:"long",
    cantripIds:[alreadyKnown,...refreshed.cantripIds.slice(0,2)],
    ritualSpellIds:refreshed.ritualSpellIds.slice(0,2),
  });
  assert.equal(result.status,"rejected");
  assert.match(result.status === "rejected" ? result.error : "",/already prepared outside/);
  assert.equal(result.state,state);
});

test("Pact of the Tome rejects a level-1 non-Ritual spell in a Ritual slot", () => {
  const state = baseState();
  const candidates = pactTomeCandidateIds(state);
  const nonRitual = allClassLeveledSpellIds().find((spellId) => {
    const metadata = spellRuleMetadataById(spellId);
    return metadata?.level === 1 && metadata.ritual === false;
  });
  assert.ok(nonRitual);
  const result = resolvePactTomeRest(state,{
    expectedRevision:7,
    rest:"long",
    cantripIds:candidates.cantripIds.slice(0,3),
    ritualSpellIds:[nonRitual!,candidates.ritualSpellIds[0]],
  });
  assert.equal(result.status,"rejected");
  assert.match(result.status === "rejected" ? result.error : "",/level-1 Ritual spell/);
});

test("stored Tome selections become inactive immediately if Pact of the Tome is no longer known", () => {
  const state = baseState();
  const candidates = pactTomeCandidateIds(state);
  const configured = resolvePactTomeRest(state,{
    expectedRevision:7,
    rest:"long",
    cantripIds:candidates.cantripIds.slice(0,3),
    ritualSpellIds:candidates.ritualSpellIds.slice(0,2),
  });
  assert.equal(configured.status,"committed");
  if (configured.status !== "committed") return;
  configured.state.eldritchInvocationIds = [];
  const view = pactTomePreparedView(configured.state);
  assert.deepEqual(view.warlockSpellIds,[]);
  assert.deepEqual(view.cantripIds,configured.state.cantripIds ?? []);
  assert.deepEqual(view.preparedSpellIds,configured.state.preparedSpellIds ?? []);
});
