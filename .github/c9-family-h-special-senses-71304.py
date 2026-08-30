from pathlib import Path

contracts = Path("src/app/spatialRuntimeContracts.ts")
text = contracts.read_text()
old = 'import type { SceneVm } from "./contracts";\n'
new = old + 'import type { CommonPlaySense } from "../domain/commonPlaySenseRuntime";\n'
if old not in text:
    raise SystemExit("spatialRuntimeContracts import anchor missing")
text = text.replace(old, new, 1)
old = '  targetCanSeeAttacker:boolean;\n  /** Provider-authored reach eligibility; Core must not infer this from distance. */\n'
new = '  targetCanSeeAttacker:boolean;\n  /** Provider-authored observer senses; Core only composes their rules and never invents them. */\n  observerSenses?:CommonPlaySense[];\n  targetInvisible?:boolean;\n  targetAudible?:boolean;\n  observerCanHear?:boolean;\n  sharedGroundContact?:boolean;\n  /** Provider-authored reach eligibility; Core must not infer this from distance. */\n'
if old not in text:
    raise SystemExit("spatialRuntimeContracts relation anchor missing")
contracts.write_text(text.replace(old, new, 1))

adapter = Path("src/app/commonPlayInterceptorProductionRuntimeAdapter.ts")
text = adapter.read_text()
anchor = 'function interceptorFactProvider(internal:AdapterState,candidate:PassiveReactionCandidate,pending:PendingResolution,runtime:RulesRuntimeState):CommonPlayFactProvider {\n'
helper = '''function composedRelationSenses(relation:NonNullable<ReturnType<typeof authoritativeCommonPlaySpatialRelation>>) {\n  if(relation.light===undefined||relation.obscurement===undefined)return undefined;\n  return resolveCommonPlaySenses(relation.observerSenses??[{kind:"normal-sight"}],{\n    distanceFeet:relation.distanceFeet,\n    light:relation.light==="darkness"?"dark":relation.light,\n    obscurement:relation.obscurement,\n    lineOfSight:relation.visible,\n    lineOfEffect:relation.cover!=="total",\n    targetInvisible:relation.targetInvisible??false,\n    targetHidden:false,\n    targetAudible:relation.targetAudible??false,\n    observerCanHear:relation.observerCanHear??false,\n    sharedGroundContact:relation.sharedGroundContact??false,\n  });\n}\n\n'''
if anchor not in text:
    raise SystemExit("interceptorFactProvider anchor missing")
text = text.replace(anchor, helper + anchor, 1)
old = '''      if(query.fact==="sense.can-see"){\n        if(relation.light===undefined||relation.obscurement===undefined)return {status:"answered",value:relation.visible};\n        const composed=resolveCommonPlaySenses([{kind:"normal-sight"}],{\n          distanceFeet:relation.distanceFeet,\n          light:relation.light==="darkness"?"dark":relation.light,\n          obscurement:relation.obscurement,\n          lineOfSight:relation.visible,\n          lineOfEffect:relation.cover!=="total",\n          targetInvisible:false,\n          targetHidden:false,\n          targetAudible:false,\n          observerCanHear:false,\n          sharedGroundContact:false,\n        });\n        return {status:"answered",value:composed.canSee};\n      }\n      if(query.fact==="sense.light"&&relation.light!==undefined)return {status:"answered",value:relation.light};\n      if(query.fact==="sense.obscurement"&&relation.obscurement!==undefined)return {status:"answered",value:relation.obscurement};\n      if(query.fact==="sense.detected"&&relation.detected!==undefined)return {status:"answered",value:relation.detected};\n'''
new = '''      if(query.fact==="sense.can-see"){\n        const composed=composedRelationSenses(relation);\n        return {status:"answered",value:composed?.canSee??relation.visible};\n      }\n      if(query.fact==="sense.light"&&relation.light!==undefined)return {status:"answered",value:relation.light};\n      if(query.fact==="sense.obscurement"&&relation.obscurement!==undefined)return {status:"answered",value:relation.obscurement};\n      if(query.fact==="sense.detected"){\n        if(relation.detected!==undefined)return {status:"answered",value:relation.detected};\n        const composed=composedRelationSenses(relation);\n        if(composed)return {status:"answered",value:composed.detected};\n      }\n'''
if old not in text:
    raise SystemExit("production sensing block anchor missing")
adapter.write_text(text.replace(old, new, 1))

test_file = Path("tests/ui/installedCommonPlayInterceptorProductionRuntime.test.ts")
text = test_file.read_text()
marker = "portable production special sight composes provider-authored senses under external identity rename"
if marker not in text:
    text += r'''

test("portable production special sight composes provider-authored senses under external identity rename",async()=>{
  const renamed:Identity={...ORIGINAL,moduleId:"external.special-sight-renamed",contentId:"item.special-sight-renamed",mechanicId:"mechanic.special-sight-renamed",interceptorId:"interceptor.special-sight-renamed",interactionId:"interaction.special-sight-renamed",displayName:"Renamed Special Sight"};
  const scenarios=[
    {label:"darkvision in darkness",light:"darkness" as const,obscurement:"none" as const,targetInvisible:false,sense:{kind:"darkvision" as const,rangeFeet:60}},
    {label:"blindsight through heavy obscurement and invisibility",light:"dim" as const,obscurement:"heavy" as const,targetInvisible:true,sense:{kind:"blindsight" as const,rangeFeet:60}},
    {label:"truesight through darkness and invisibility",light:"darkness" as const,obscurement:"none" as const,targetInvisible:true,sense:{kind:"truesight" as const,rangeFeet:120}},
  ];
  for(const identity of [ORIGINAL,renamed]){
    for(const scenario of scenarios){
      const adapter=await prepare(identity,true,"d20",[{kind:"roll.modify",mode:"subtract-die",dice:"1d8"}],undefined,{light:scenario.light,obscurement:scenario.obscurement});
      const internal=adapter as unknown as {activeCharacter:CharacterSheet;scene:SceneVm};
      setSpatialRelation(internal.scene,{
        sourceId:internal.activeCharacter.id,targetId:OTHER_CHARACTER_ID,distanceFeet:30,visible:true,cover:"none",targetCanSeeAttacker:true,
        light:scenario.light,obscurement:scenario.obscurement,detected:true,targetInvisible:scenario.targetInvisible,observerSenses:[scenario.sense],
        provenance:`module:test-special-sight:${scenario.sense.kind}`,
      });
      seedHiddenRuntimeEffect(adapter,OTHER_CHARACTER_ID);
      let snapshot=await openAbilityCheckInterrupt(adapter);
      assert.equal(snapshot.resolution?.stage,"interrupt",`${scenario.label}: ${JSON.stringify(snapshot.resolution)}`);
      snapshot=await adapter.respondToInterrupt(false);
      assert.equal(snapshot.resolution?.stage,"complete",`${scenario.label}: ${JSON.stringify(snapshot.resolution)}`);
    }
  }
});
'''
    test_file.write_text(text)
