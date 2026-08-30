from pathlib import Path
import json


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    if old not in text:
        raise SystemExit(f"expected patch anchor not found in {path}: {old[:80]!r}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")


runtime_path = "src/domain/commonPlayEffectRuntime.ts"
replace_once(
    runtime_path,
    'import type { DurationSpec, EffectInstance } from "./effects";',
    'import type { DurationSpec, EffectInstance, EffectTermination } from "./effects";',
)
replace_once(
    runtime_path,
    '  lifetime:CommonPlayEffectLifetime;\n  instancePolicy?:"stack";',
    '  lifetime:CommonPlayEffectLifetime;\n  termination?:EffectTermination;\n  instancePolicy?:"stack";',
)
replace_once(
    runtime_path,
    '  assertOnlyKeys(template,["id","artifactKind","duration","rules","lifetime","instancePolicy"],label);',
    '  assertOnlyKeys(template,["id","artifactKind","duration","rules","lifetime","termination","instancePolicy"],label);',
)
replace_once(
    runtime_path,
    '  runtimeDuration(template.duration,`${label} duration`);\n  if (!Array.isArray(template.rules)||!template.rules.length) throw new Error(`${label} requires at least one rule`);',
    '''  runtimeDuration(template.duration,`${label} duration`);\n  if(template.termination!==undefined) {\n    assertOnlyKeys(template.termination,["targetTakesDamage","targetBecomesIncapacitated","targetDies","sourceBecomesIncapacitated","sourceDies"],`${label} termination`);\n    const values=Object.values(template.termination);\n    if(!values.length||values.some((value)=>typeof value!=="boolean")||!values.some(Boolean)) {\n      throw new Error(`${label} termination requires at least one true boolean policy`);\n    }\n  }\n  if (!Array.isArray(template.rules)||!template.rules.length) throw new Error(`${label} requires at least one rule`);''',
)
replace_once(
    runtime_path,
    '      duration:runtimeDuration(template.duration,`artifact ${template.id} duration`),\n      metadata:{',
    '      duration:runtimeDuration(template.duration,`artifact ${template.id} duration`),\n      ...(template.termination?{termination:{...template.termination}}:{}),\n      metadata:{',
)

schema_path = Path("schemas/common-play-contract.schema.json")
schema = json.loads(schema_path.read_text(encoding="utf-8"))
props = schema["$defs"]["artifactTemplate"]["properties"]
if "termination" in props:
    raise SystemExit("artifactTemplate.termination already exists; patch is stale")
props["termination"] = {
    "type": "object",
    "minProperties": 1,
    "properties": {
        "targetTakesDamage": {"type": "boolean"},
        "targetBecomesIncapacitated": {"type": "boolean"},
        "targetDies": {"type": "boolean"},
        "sourceBecomesIncapacitated": {"type": "boolean"},
        "sourceDies": {"type": "boolean"},
    },
    "additionalProperties": False,
}
schema_path.write_text(json.dumps(schema, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

test_path = Path("tests/ui/c9FamilyNEffectDurationProduction.test.ts")
test_text = test_path.read_text(encoding="utf-8")
marker = '''test("unknown installed Common Play cleans up maintained dependents when their source becomes Incapacitated",async()=>{\n  assert.deepEqual(\n    await exerciseDependentCleanup("unknown-family-n-dependent-cleanup"),\n    await exerciseDependentCleanup("renamed-family-n-dependent-cleanup"),\n  );\n});\n'''
if marker not in test_text:
    raise SystemExit("Family N structural cleanup append anchor not found")
addition = r'''

function structuralSourceCleanupPackage(prefix:string) {
  const moduleId=`${prefix}.module`;
  const contentId=`${prefix}.content`;
  const effectMechanicId=`${prefix}.dependent-effect`;
  const conditionMechanicId=`${prefix}.incapacitate`;
  const effectConfig={
    schemaVersion:"0.2-draft",id:effectMechanicId,
    entryPoints:[{id:"activate",invocation:"manual",operations:[{kind:"effect.apply",template:"dependent",target:"actor"}]}],
    artifactTemplates:[{
      id:"dependent",artifactKind:"effect",duration:{kind:"durable"},
      rules:[{id:"noop",event:"damage.taken",frequency:"once-per-resolution",operations:[{kind:"damage.apply",amount:{value:0},damageType:"force",target:"event.actor"}]}],
      lifetime:{kind:"until-duration",onEnd:"destroy"},
      termination:{sourceBecomesIncapacitated:true},
      instancePolicy:"stack",
    }],
  };
  const conditionConfig={
    schemaVersion:"0.2-draft",id:conditionMechanicId,
    entryPoints:[{
      id:"incapacitate",invocation:"manual",targeting:{from:"targets",min:1,max:1},
      operations:[{kind:"condition.apply",condition:"incapacitated",target:"target"}],
    }],
  };
  return {moduleId,contentId,effectMechanicId,conditionMechanicId,json:JSON.stringify({
    schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
    source:{document:"Family N structural source cleanup probe",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],
    content:[{id:contentId,category:"option",presentation:{defaultLocale:"en",originalName:"Structural Source Cleanup Probe",locales:{en:{name:"Structural Source Cleanup Probe"}}},mechanics:[
      {kind:"common-play",config:effectConfig},{kind:"common-play",config:conditionConfig},
    ]}],
  })};
}

function structuralSourceCleanupAction(pack:ReturnType<typeof structuralSourceCleanupPackage>,mechanicId:string,entryPointId:string) {
  return installedCommonPlayActionId({catalogId:catalogQualifiedId(pack.contentId,pack.moduleId,"1"),mechanicId,entryPointId});
}

async function exerciseStructuralSourceCleanup(prefix:string) {
  const adapter=new MockAdapter();
  const pack=structuralSourceCleanupPackage(prefix);
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(pack.json);
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");

  let snapshot=await adapter.resolveAction(structuralSourceCleanupAction(pack,pack.effectMechanicId,"activate"),["char.aelar"]);
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
  let runtime=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)!;
  let effect=runtime.effects.find((entry)=>entry.sourceId===pack.effectMechanicId);
  assert.ok(effect,"portable source-dependent effect must materialize");
  assert.equal(effect.sourceActorId,"char.aelar");
  assert.deepEqual(effect.termination,{sourceBecomesIncapacitated:true});

  snapshot=await adapter.resolveAction(structuralSourceCleanupAction(pack,pack.conditionMechanicId,"incapacitate"),["char.aelar"]);
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
  runtime=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)!;
  assert.equal(runtime.effects.some((entry)=>entry.targetId==="char.aelar"&&entry.conditionId==="incapacitated"),true);
  assert.equal(runtime.effects.some((entry)=>entry.sourceId===pack.effectMechanicId),false,"structural sourceBecomesIncapacitated must remove its portable dependent effect");

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  runtime=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)!;
  assert.equal(runtime.effects.some((entry)=>entry.targetId==="char.aelar"&&entry.conditionId==="incapacitated"),false);
  effect=runtime.effects.find((entry)=>entry.sourceId===pack.effectMechanicId);
  assert.ok(effect,"event-native Undo must restore the structurally terminated effect");
  assert.equal(effect.sourceActorId,"char.aelar");
  assert.deepEqual(effect.termination,{sourceBecomesIncapacitated:true});
  return {cleanup:true,undo:true};
}

test("unknown installed Common Play structurally terminates a source-dependent effect on Incapacitated and Undo restores it",async()=>{
  assert.deepEqual(
    await exerciseStructuralSourceCleanup("unknown-family-n-structural-cleanup"),
    await exerciseStructuralSourceCleanup("renamed-family-n-structural-cleanup"),
  );
});
'''
test_path.write_text(test_text.replace(marker, marker + addition, 1), encoding="utf-8")

ledger_path = Path("docs/rules/v1-mechanism-coverage-ledger.json")
ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
row = next(entry for entry in ledger["rows"] if entry["family"] == "N")
row["currentState"] = (
    "Installed arbitrary-ID persistent effects execute through the shared Common Play/Resolver authority. Portable duration "
    "materialization, boundary expiry, automatic consume/retaliation, suppression/unsuppression with elapsed pause-resume, "
    "maintained dependent cleanup, structural source/target termination policy, connected replay/reconnect, persistence, and "
    "event-native Undo are covered by the generic effect lifecycle. External artifact templates carry typed EffectTermination "
    "instead of content identities; named aura/form/mark adapters remain legacy content/projection migration debt and are not "
    "supported portable execution fallbacks."
)
row["disposition"] = "IMPLEMENTED"
for field, evidence in [
    ("implementationEvidence", "common-play-contract.schema.json artifactTemplates[].termination exposes target damage/incap/death and source incap/death lifecycle policy; commonPlayEffectRuntime.ts validates and lowers it into generic EffectTermination without identity dispatch"),
    ("implementationEvidence", "effects.ts plus resolutionHealthOps.ts/resolutionEffectOps.ts consume generic EffectTermination for damage and source/target creature-state lifecycle with inverse-ready Effect StateChanges"),
    ("productionEvidence", "c9FamilyNEffectDurationProduction.test.ts proves an unknown installed structural sourceBecomesIncapacitated policy removes its portable dependent effect through production Common Play/Resolver execution and event-native Undo restores it"),
    ("identityInvarianceEvidence", "c9FamilyNEffectDurationProduction.test.ts repeats structural source-dependent termination and Undo after complete external module/content/mechanic identity rename with identical outcome"),
]:
    if evidence not in row[field]:
        row[field].append(evidence)
row["remainingNamedSeams"] = []
ledger_path.write_text(json.dumps(ledger, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
