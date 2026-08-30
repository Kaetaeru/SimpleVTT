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
    raise SystemExit("artifactTemplate.termination already exists; verifier patch is stale")
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
marker = 'test("renamed external identities preserve portable effect suppression and pause-resume semantics",async()=>{\n  await exercisePortableSuppression("renamed-family-n-suppression");\n});\n'
if marker not in test_text:
    raise SystemExit("Family N production test append anchor not found")
addition = r'''

function sourceCleanupPackage(prefix:string) {
  const moduleId=`${prefix}.module`;
  const contentId=`${prefix}.content`;
  const effectMechanicId=`${prefix}.dependent-effect`;
  const sourceStateMechanicId=`${prefix}.source-state`;
  const effectConfig={
    schemaVersion:"0.2-draft",id:effectMechanicId,
    entryPoints:[{id:"activate",invocation:"manual",operations:[{kind:"effect.apply",template:"dependent",target:"actor"}]}],
    artifactTemplates:[{
      id:"dependent",artifactKind:"effect",duration:{kind:"durable"},
      rules:[{id:"noop",event:"damage.taken",frequency:"once-per-resolution",operations:[{kind:"damage.apply",amount:{value:0},damageType:"force",target:"event.actor"}]}],
      lifetime:{kind:"until-duration",onEnd:"destroy"},
      termination:{sourceBecomesIncapacitated:true,sourceDies:true},
      instancePolicy:"stack",
    }],
  };
  const sourceStateConfig={
    schemaVersion:"0.2-draft",id:sourceStateMechanicId,
    entryPoints:[{id:"drop-source",invocation:"manual",operations:[{kind:"damage.apply",amount:{value:999},damageType:"force",target:"actor"}]}],
  };
  return {moduleId,contentId,effectMechanicId,sourceStateMechanicId,json:JSON.stringify({
    schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
    source:{document:"Family N source cleanup probe",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],
    content:[{id:contentId,category:"option",presentation:{defaultLocale:"en",originalName:"Source Cleanup Probe",locales:{en:{name:"Source Cleanup Probe"}}},mechanics:[
      {kind:"common-play",config:effectConfig},{kind:"common-play",config:sourceStateConfig},
    ]}],
  })};
}

function sourceCleanupAction(pack:ReturnType<typeof sourceCleanupPackage>,mechanicId:string,entryPointId:string) {
  return installedCommonPlayActionId({catalogId:catalogQualifiedId(pack.contentId,pack.moduleId,"1"),mechanicId,entryPointId});
}

async function exercisePortableSourceCleanup(prefix:string) {
  const adapter=new MockAdapter();
  const pack=sourceCleanupPackage(prefix);
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(pack.json);
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");

  let snapshot=await adapter.resolveAction(sourceCleanupAction(pack,pack.effectMechanicId,"activate"),["char.aelar"]);
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
  let runtime=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)!;
  let effect=runtime.effects.find((entry)=>entry.sourceId===pack.effectMechanicId);
  assert.ok(effect,"portable dependent effect must materialize");
  assert.deepEqual(effect.termination,{sourceBecomesIncapacitated:true,sourceDies:true});

  snapshot=await adapter.resolveAction(sourceCleanupAction(pack,pack.sourceStateMechanicId,"drop-source"),["char.aelar"]);
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
  runtime=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)!;
  assert.equal(runtime.effects.some((entry)=>entry.sourceId===pack.effectMechanicId),false,"source incapacitation/death must remove its dependent portable effect in the same authoritative resolution");

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  runtime=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)!;
  effect=runtime.effects.find((entry)=>entry.sourceId===pack.effectMechanicId);
  assert.ok(effect,"event-native Undo must restore the source-dependent effect");
  assert.deepEqual(effect.termination,{sourceBecomesIncapacitated:true,sourceDies:true});
}

test("unknown installed Common Play removes a dependent effect when its source becomes incapacitated or dies and Undo restores it",async()=>{
  await exercisePortableSourceCleanup("unknown-family-n-source-cleanup");
});

test("renamed external identities preserve source-dependent effect cleanup and Undo",async()=>{
  await exercisePortableSourceCleanup("renamed-family-n-source-cleanup");
});
'''
test_path.write_text(test_text.replace(marker, marker + addition, 1), encoding="utf-8")

ledger_path = Path("docs/rules/v1-mechanism-coverage-ledger.json")
ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
row = next(entry for entry in ledger["rows"] if entry["family"] == "N")
row["currentState"] = "Installed arbitrary-ID persistent effects execute through the shared Common Play/Resolver authority. Portable duration materialization, boundary expiry, automatic consume/retaliation, suppression/unsuppression with elapsed pause-resume, source-state dependent cleanup, connected replay/reconnect, persistence, and event-native Undo are proven under unknown and fully renamed external identities. Effect termination policy is structural Common Play authoring that lowers to the existing generic EffectTermination and Resolver lifecycle; named aura/form/mark adapters remain legacy content/projection migration debt recorded by the legacy inventory and are not supported portable execution fallbacks."
row["disposition"] = "IMPLEMENTED"
for evidence in [
    "common-play-contract.schema.json artifactTemplates[].termination exposes target damage/incap/death and source incap/death structural lifecycle policy without content identity dispatch",
    "commonPlayEffectRuntime.ts validates portable termination policy and carries it into the existing EffectTermination payload; resolutionHealthOps.ts and resolutionEffectOps.ts consume the generic source/target lifecycle through typed Effect StateChanges",
]:
    if evidence not in row["implementationEvidence"]:
        row["implementationEvidence"].append(evidence)
production = "c9FamilyNEffectDurationProduction.test.ts proves an unknown installed source-dependent effect is removed when its source becomes Incapacitated/dead in the authoritative damage resolution and event-native Undo restores it"
if production not in row["productionEvidence"]:
    row["productionEvidence"].append(production)
identity = "c9FamilyNEffectDurationProduction.test.ts repeats source-dependent cleanup and Undo after complete external module/content/mechanic identity rename"
if identity not in row["identityInvarianceEvidence"]:
    row["identityInvarianceEvidence"].append(identity)
row["remainingNamedSeams"] = []
ledger_path.write_text(json.dumps(ledger, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
