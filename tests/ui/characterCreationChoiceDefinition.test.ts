import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/characterCreationV10Adapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import {
  creationChoiceDefinitions,
  validateCreationChoiceDefinitions,
} from "../../src/app/characterCreationChoiceDefinition";
import { creationChoiceSpecs } from "../../src/app/characterCreationV10Choices";
import { CLASSES } from "../../src/app/characterCreationV10Data";

async function configuredDraft(className:string,species="인간",background="군인") {
  const adapter=new MockAdapter();
  await adapter.createCharacterDraft("guided");
  await adapter.updateCharacterDraft({ type:"set-name",value:`Choice ${className}` });
  await adapter.updateCharacterDraft({ type:"set-species",value:species });
  await adapter.updateCharacterDraft({ type:"set-background",value:background });
  await adapter.updateCharacterDraft({ type:"set-class",value:className });
  const snapshot=await adapter.getSnapshot();
  assert.ok(snapshot.createDraft);
  return { adapter,draft:snapshot.createDraft! };
}

test("shared creation ChoiceDefinitions preserve legacy IDs, counts, option IDs, and sources exactly", async () => {
  const { draft }=await configuredDraft("파이터");
  const legacy=creationChoiceSpecs(draft);
  const shared=creationChoiceDefinitions(draft);
  assert.deepEqual(
    shared.map((definition)=>({
      id:definition.id,
      count:definition.count,
      source:definition.source,
      options:definition.options.map((option)=>option.id),
    })),
    legacy.map((spec)=>({
      id:spec.id,
      count:spec.count,
      source:spec.source,
      options:spec.options.map((option)=>option.id),
    })),
  );
  assert.equal(shared.find((definition)=>definition.id==="identity.languages")?.kind,"language");
  assert.equal(shared.find((definition)=>definition.id==="class.weapon-mastery")?.kind,"weapon-mastery");
  assert.equal(shared.find((definition)=>definition.id==="species.skillProficiency")?.kind,"skill");
  const originFeat=shared.find((definition)=>definition.id==="species.originFeat");
  if (originFeat) {
    const first=originFeat.options[0];
    assert.ok(first);
    assert.equal(originFeat.presentationOptions[first.id]?.id,first.id);
    assert.ok(originFeat.presentationOptions[first.id]?.nameEn);
  }
});

test("creation adapter toggles selections that are validated by the shared ChoiceDefinition validator", async () => {
  const { adapter,draft }=await configuredDraft("파이터");
  const languages=creationChoiceDefinitions(draft).find((definition)=>definition.id==="identity.languages");
  assert.ok(languages);
  assert.equal(languages!.count,2);
  assert.ok(validateCreationChoiceDefinitions(draft).some((issue)=>issue.choiceId==="identity.languages"));

  await adapter.updateCharacterDraft({ type:"toggle-class-choice",choiceId:"identity.languages",value:languages!.options[0].id });
  await adapter.updateCharacterDraft({ type:"toggle-class-choice",choiceId:"identity.languages",value:languages!.options[1].id });
  const snapshot=await adapter.getSnapshot();
  assert.deepEqual(snapshot.createDraft?.choiceSelections?.["identity.languages"],[languages!.options[0].id,languages!.options[1].id]);
  assert.equal(validateCreationChoiceDefinitions(snapshot.createDraft!).some((issue)=>issue.choiceId==="identity.languages"),false);

  await adapter.updateCharacterDraft({ type:"toggle-class-choice",choiceId:"identity.languages",value:"language.unknown" });
  const unchanged=await adapter.getSnapshot();
  assert.deepEqual(unchanged.createDraft?.choiceSelections?.["identity.languages"],[languages!.options[0].id,languages!.options[1].id]);
});

test("Wizard prepared-spell ChoiceDefinition remains blocked until the shared spellbook choice is complete", async () => {
  const { adapter,draft }=await configuredDraft("위저드","엘프","현자");
  let definitions=creationChoiceDefinitions(draft);
  const spellbook=definitions.find((definition)=>definition.id==="class.spells.spellbook");
  let prepared=definitions.find((definition)=>definition.id==="class.spells.prepared");
  assert.ok(spellbook && prepared);
  assert.equal(spellbook!.kind,"spell");
  assert.equal(spellbook!.count,6);
  assert.equal(prepared!.kind,"spell");
  assert.equal(prepared!.blocked,true);
  assert.equal(prepared!.required,false);
  assert.equal(validateCreationChoiceDefinitions(draft).some((issue)=>issue.choiceId==="class.spells.prepared"),false);

  for (const option of spellbook!.options.slice(0,spellbook!.count)) {
    await adapter.updateCharacterDraft({ type:"toggle-class-choice",choiceId:spellbook!.id,value:option.id });
  }
  const snapshot=await adapter.getSnapshot();
  assert.ok(snapshot.createDraft);
  definitions=creationChoiceDefinitions(snapshot.createDraft!);
  prepared=definitions.find((definition)=>definition.id==="class.spells.prepared");
  assert.ok(prepared);
  assert.equal(prepared!.blocked,false);
  assert.equal(prepared!.required,true);
  const selectedBook=new Set(snapshot.createDraft!.choiceSelections?.[spellbook!.id] ?? []);
  assert.equal(selectedBook.size,6);
  assert.ok(prepared!.options.length>=4);
  assert.ok(prepared!.options.every((option)=>selectedBook.has(option.id)));
  assert.ok(validateCreationChoiceDefinitions(snapshot.createDraft!).some((issue)=>issue.choiceId==="class.spells.prepared"));
});

test("level-1 creation definitions never manufacture progression-only ASI or subclass choices", async () => {
  const adapter=new MockAdapter();
  await adapter.createCharacterDraft("guided");
  for (const klass of CLASSES) {
    await adapter.updateCharacterDraft({ type:"set-class",value:klass.name });
    const snapshot=await adapter.getSnapshot();
    assert.ok(snapshot.createDraft);
    const definitions=creationChoiceDefinitions(snapshot.createDraft!);
    assert.equal(definitions.some((definition)=>definition.kind==="asi-or-feat"),false,`${klass.name}: creation exposed ASI`);
    assert.equal(definitions.some((definition)=>definition.kind==="subclass"),false,`${klass.name}: creation exposed subclass`);
  }
});
