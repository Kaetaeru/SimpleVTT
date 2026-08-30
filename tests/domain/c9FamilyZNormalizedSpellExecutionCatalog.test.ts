import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { NORMALIZED_SPELL_EXECUTION_COUNT, normalizedSpellDefinitionById } from "../../src/domain/spellExecutionCatalog";
import { SPELL_EXECUTION_COVERAGE, spellMechanicById } from "../../src/domain/spellMechanics";

test("all spell execution data is normalized before production runtime",()=>{
  assert.equal(NORMALIZED_SPELL_EXECUTION_COUNT,339);
  assert.equal(NORMALIZED_SPELL_EXECUTION_COUNT,SPELL_EXECUTION_COVERAGE.total);
  for (const id of ["dnd.srd521.spell.fire-bolt","dnd.srd521.spell.alarm","dnd.srd521.spell.meteor-swarm"]) {
    assert.deepEqual(normalizedSpellDefinitionById(id),JSON.parse(JSON.stringify(spellMechanicById(id))));
  }
});

test("runtime callers receive independent spell definitions",()=>{
  const first=normalizedSpellDefinitionById("dnd.srd521.spell.fire-bolt")!;
  first.baseLevel=9;
  assert.equal(normalizedSpellDefinitionById("dnd.srd521.spell.fire-bolt")?.baseLevel,0);
});

test("production adapters do not select algorithms through the legacy spell authoring helper",async()=>{
  const files=["productionSpellRuntimeAdapter.ts","productionPlayRuntimeAdapter.ts","phase09AuthoritativeSpellcastingAdapter.ts","spellcastingRuntimeAdapter.ts"];
  for (const file of files) {
    const path=fileURLToPath(new URL(`../../src/app/${file}`,import.meta.url));
    assert.doesNotMatch(await readFile(path,"utf8"),/spellMechanicById/);
  }
});
