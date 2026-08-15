import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/progressionContracts";
import { MockAdapter } from "../../src/app/mockAdapter";
import {
  applyProgressionCharacterState,
  projectProgressionCharacterState,
} from "../../src/app/progressionCharacterApplicationService";
import { upsertCharacterResource } from "../../src/app/characterResourceApplicationService";

test("shared progression projection preserves canonical CharacterSheet fields and can exclude current Pact Tome spells from base lists", async () => {
  const adapter=new MockAdapter();
  const snapshot=await adapter.getSnapshot();
  const sheet=structuredClone(snapshot.activeCharacter);
  sheet.progressionRevision=7;
  sheet.classLevels=[{ classId:"dnd.srd521.class.warlock",className:"워락",level:5 }];
  sheet.cantrips=["spell:base-cantrip","spell:tome-cantrip"];
  sheet.preparedSpells=["spell:base-prepared","spell:tome-ritual"];
  sheet.pactTomeCantripIds=["spell:tome-cantrip"];
  sheet.pactTomeRitualSpellIds=["spell:tome-ritual"];
  sheet.pactTomeSpellSources={ "spell:tome-cantrip":"tome", "spell:tome-ritual":"tome" };

  const normal=projectProgressionCharacterState(sheet);
  assert.equal(normal.revision,7);
  assert.deepEqual(normal.classTracks,sheet.classLevels);
  assert.deepEqual(normal.cantripIds,["spell:base-cantrip","spell:tome-cantrip"]);
  assert.deepEqual(normal.preparedSpellIds,["spell:base-prepared","spell:tome-ritual"]);
  assert.deepEqual(normal.pactTomeCantripIds,["spell:tome-cantrip"]);

  const tomeBase=projectProgressionCharacterState(sheet,{ excludePactTomeFromBaseSpells:true });
  assert.deepEqual(tomeBase.cantripIds,["spell:base-cantrip"]);
  assert.deepEqual(tomeBase.preparedSpellIds,["spell:base-prepared"]);
  assert.deepEqual(tomeBase.pactTomeCantripIds,["spell:tome-cantrip"]);
  assert.deepEqual(tomeBase.pactTomeRitualSpellIds,["spell:tome-ritual"]);
});

test("Wizard Long Rest application writes only revision/preparation/mastery fields and preserves unrelated character state", async () => {
  const adapter=new MockAdapter();
  const snapshot=await adapter.getSnapshot();
  const sheet=structuredClone(snapshot.activeCharacter);
  sheet.progressionRevision=3;
  sheet.classLevels=[{ classId:"dnd.srd521.class.wizard",className:"위저드",level:10 }];
  sheet.features=["unchanged-feature"];
  sheet.hp=17;
  sheet.maxHp=42;
  sheet.languages=["공용어"];
  sheet.preparedSpells=["spell:old"];
  sheet.preparedSpellSources={ "spell:old":"old-source" };
  sheet.spellMasterySpellIds={ 1:"spell:old-mastery" };
  sheet.spellMasterySources={ 1:"old-mastery-source" };

  const next=projectProgressionCharacterState(sheet);
  next.revision=4;
  next.preparedSpellIds=["spell:new"];
  next.preparedSpellSources={ "spell:new":"new-source" };
  next.spellMasterySpellIds={ 1:"spell:new-mastery" };
  next.spellMasterySources={ 1:"new-mastery-source" };
  next.hpCurrent=1;
  next.hpMaximum=1;
  next.features=["should-not-write"];
  next.languages=["should-not-write"];

  applyProgressionCharacterState(sheet,next,{ scope:"wizard-long-rest" });
  assert.equal(sheet.progressionRevision,4);
  assert.deepEqual(sheet.preparedSpells,["spell:new"]);
  assert.deepEqual(sheet.preparedSpellSources,{ "spell:new":"new-source" });
  assert.deepEqual(sheet.spellMasterySpellIds,{ 1:"spell:new-mastery" });
  assert.deepEqual(sheet.spellMasterySources,{ 1:"new-mastery-source" });
  assert.equal(sheet.hp,17);
  assert.equal(sheet.maxHp,42);
  assert.deepEqual(sheet.features,["unchanged-feature"]);
  assert.deepEqual(sheet.languages,["공용어"]);
});

test("Pact Tome application writes only revision and Book of Shadows fields", async () => {
  const adapter=new MockAdapter();
  const snapshot=await adapter.getSnapshot();
  const sheet=structuredClone(snapshot.activeCharacter);
  sheet.progressionRevision=11;
  sheet.cantrips=["spell:base"];
  sheet.preparedSpells=["spell:prepared"];
  const next=projectProgressionCharacterState(sheet);
  next.revision=12;
  next.pactTomeCantripIds=["spell:tome-a","spell:tome-b","spell:tome-c"];
  next.pactTomeRitualSpellIds=["spell:ritual-a","spell:ritual-b"];
  next.pactTomeSpellSources={ "spell:tome-a":"source:a" };
  next.cantripIds=["should-not-write"];
  next.preparedSpellIds=["should-not-write"];

  applyProgressionCharacterState(sheet,next,{ scope:"pact-tome" });
  assert.equal(sheet.progressionRevision,12);
  assert.deepEqual(sheet.pactTomeCantripIds,next.pactTomeCantripIds);
  assert.deepEqual(sheet.pactTomeRitualSpellIds,next.pactTomeRitualSpellIds);
  assert.deepEqual(sheet.pactTomeSpellSources,next.pactTomeSpellSources);
  assert.deepEqual(sheet.cantrips,["spell:base"]);
  assert.deepEqual(sheet.preparedSpells,["spell:prepared"]);
});

test("shared resource upsert creates full once but never refills an existing depleted resource", async () => {
  const adapter=new MockAdapter();
  const snapshot=await adapter.getSnapshot();
  const sheet=structuredClone(snapshot.activeCharacter);
  sheet.resources=[];
  const definition={
    resourceId:"resource.test",
    label:"테스트 자원",
    maximum:3,
    source:"feature:test",
    recovery:{ longRest:"all" as const },
  };

  const created=upsertCharacterResource(sheet,definition);
  assert.equal(created.current,3);
  assert.equal(created.max,3);
  assert.equal(sheet.resources.length,1);

  created.current=1;
  const updated=upsertCharacterResource(sheet,{ ...definition,maximum:5,source:"feature:test:upgraded" });
  assert.equal(updated.current,1,"maximum growth must not refill the resource");
  assert.equal(updated.max,5);
  assert.equal(updated.source,"feature:test:upgraded");
  assert.equal(sheet.resources.length,1,"repeated materialization stays idempotent");

  const shrunk=upsertCharacterResource(sheet,{ ...definition,maximum:0 });
  assert.equal(shrunk.current,0,"current clamps down when maximum shrinks");
  assert.equal(shrunk.max,0);
  assert.equal(sheet.resources.length,1);
});
