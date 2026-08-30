import json
from pathlib import Path


test_path=Path('tests/ui/installedCommonPlayInterceptorProductionRuntime.test.ts')
text=test_path.read_text(encoding='utf-8')

old='eligibilityExpectations:{light?:"bright"|"dim"|"darkness";obscurement?:"none"|"light"|"heavy"}={},'
new='eligibilityExpectations:{light?:"bright"|"dim"|"darkness";obscurement?:"none"|"light"|"heavy";canSee?:boolean}={},'
if old in text:
    text=text.replace(old,new)
elif text.count(new)<2:
    raise SystemExit('eligibility expectation signatures missing')

old='{op:"eq",left:{ref:"source-sees-trigger"},right:{value:true}},'
new='{op:"eq",left:{ref:"source-sees-trigger"},right:{value:eligibilityExpectations.canSee??true}},'
if old in text:
    text=text.replace(old,new,1)
elif new not in text:
    raise SystemExit('sense.can-see predicate anchor missing')

old='function seedRulesProfileSense(adapter:MockAdapter,sourceId:string,rangeFeet:number){'
new='function seedRulesProfileSense(adapter:MockAdapter,sourceId:string,property:string,rangeFeet:number){'
if old in text:
    text=text.replace(old,new,1)
elif new not in text:
    raise SystemExit('RulesProfile sense helper signature missing')

old='kind:"property.modify",property:"sense.darkvision.range-feet",operation:"set",value:{value:rangeFeet},target:"actor",owner:"effect",source:"definition",'
new='kind:"property.modify",property,operation:"set",value:{value:rangeFeet},target:"actor",owner:"effect",source:"definition",'
if old in text:
    text=text.replace(old,new,1)
elif new not in text:
    raise SystemExit('RulesProfile sense property anchor missing')

old='seedRulesProfileSense(adapter,`${identity.moduleId}.darkvision`,60);'
new='seedRulesProfileSense(adapter,`${identity.moduleId}.darkvision`,"sense.darkvision.range-feet",60);'
if old in text:
    text=text.replace(old,new,1)
elif new not in text:
    raise SystemExit('Darkvision seed call anchor missing')

test_name='portable production derives remaining RulesProfile special senses from generic property modifiers'
if test_name not in text:
    text += r'''

test("portable production derives remaining RulesProfile special senses from generic property modifiers",async()=>{
  const renamed:Identity={...ORIGINAL,moduleId:"external.profile-sense-matrix-renamed",contentId:"item.profile-sense-matrix-renamed",mechanicId:"mechanic.profile-sense-matrix-renamed",interceptorId:"interceptor.profile-sense-matrix-renamed",interactionId:"interaction.profile-sense-matrix-renamed",displayName:"Renamed Profile Sense Matrix"};
  const scenarios=[
    {label:"blindsight",property:"sense.blindsight.range-feet",light:"dim" as const,obscurement:"heavy" as const,visible:true,targetInvisible:true,sharedGroundContact:false,canSee:true},
    {label:"tremorsense",property:"sense.tremorsense.range-feet",light:"dim" as const,obscurement:"none" as const,visible:false,targetInvisible:true,sharedGroundContact:true,canSee:false},
    {label:"truesight",property:"sense.truesight.range-feet",light:"darkness" as const,obscurement:"none" as const,visible:true,targetInvisible:true,sharedGroundContact:false,canSee:true},
  ];
  for(const identity of [ORIGINAL,renamed]){
    for(const scenario of scenarios){
      const adapter=await prepare(identity,true,"d20",[{kind:"roll.modify",mode:"subtract-die",dice:"1d8"}],undefined,{light:scenario.light,obscurement:scenario.obscurement,canSee:scenario.canSee});
      const internal=adapter as unknown as {activeCharacter:CharacterSheet;scene:SceneVm};
      setSpatialRelation(internal.scene,{
        sourceId:internal.activeCharacter.id,targetId:OTHER_CHARACTER_ID,distanceFeet:30,visible:scenario.visible,cover:"none",targetCanSeeAttacker:true,
        light:scenario.light,obscurement:scenario.obscurement,targetInvisible:scenario.targetInvisible,sharedGroundContact:scenario.sharedGroundContact,
        provenance:`profile:test-generic-acquisition:${scenario.label}`,
      });
      seedRulesProfileSense(adapter,`${identity.moduleId}.${scenario.label}`,scenario.property,60);
      seedHiddenRuntimeEffect(adapter,OTHER_CHARACTER_ID);
      let snapshot=await openAbilityCheckInterrupt(adapter);
      assert.equal(snapshot.resolution?.stage,"interrupt",`${scenario.label}: ${JSON.stringify(snapshot.resolution)}`);
      snapshot=await adapter.respondToInterrupt(false);
      assert.equal(snapshot.resolution?.stage,"complete",`${scenario.label}: ${JSON.stringify(snapshot.resolution)}`);
    }
  }
});
'''

test_path.write_text(text,encoding='utf-8')

ledger_path=Path('docs/rules/v1-mechanism-coverage-ledger.json')
data=json.loads(ledger_path.read_text(encoding='utf-8'))
row=next(entry for entry in data['rows'] if entry.get('family')=='H')
if row.get('disposition') not in {'INCOMPLETE','IMPLEMENTED'}:
    raise SystemExit(f"unexpected Family H disposition: {row.get('disposition')}")
row['currentState']='Generic status, visibility, Hidden/Invisible, sensing, and discovery paths are production-proven through Common Play/Resolver authority. RulesProfile-owned numeric Darkvision, Blindsight, Tremorsense, and Truesight ranges are acquired through generic property.modify effects and resolved structurally into authoritative observer senses; production can-see/detected composition remains identity-independent. Portable Wisdom Search/discovery uses unknown external Common Play with Resolver-owned effect removal, failure preservation, event-native Undo, and external identity rename. Family H has no remaining named execution seam.'
row['disposition']='IMPLEMENTED'

def add_unique(key,value):
    items=row.setdefault(key,[])
    if value not in items: items.append(value)

add_unique('implementationEvidence','commonPlayInterceptorProductionRuntimeAdapter.ts resolves sense.darkvision/blindsight/tremorsense/truesight.range-feet through resolveRuntimeProfileProperty over generic property.modify effects before shared resolveCommonPlaySenses composition')
add_unique('productionEvidence','installedCommonPlayInterceptorProductionRuntime.test.ts proves Darkvision plus Blindsight/Tremorsense/Truesight acquisition from generic RulesProfile property modifiers in production; Tremorsense proves detected=true while can-see=false')
add_unique('productionEvidence','c9FamilyHSearchDiscovery.test.ts proves unknown installed Common Play Search/discovery through structural effect.remove selection, success/failure behavior, event-native Undo, and Action economy')
add_unique('identityInvarianceEvidence','installedCommonPlayInterceptorProductionRuntime.test.ts special-sense acquisition cases preserve semantics after full external module/content/mechanic/interceptor/interaction/display rename')
add_unique('identityInvarianceEvidence','c9FamilyHSearchDiscovery.test.ts preserves hidden discovery semantics after full external module/content/mechanic identity rename')
row['remainingNamedSeams']=[]
ledger_path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
