from pathlib import Path

source = Path("src/app/installedCommonPlayRuntimeAdapter.ts")
text = source.read_text(encoding="utf-8")
old_import = 'import type { RulesRuntimeState } from "../domain/combatState";\n'
new_import = old_import + 'import type { ResolutionOperation } from "../domain/resolutionTypes";\n'
if 'import type { ResolutionOperation } from "../domain/resolutionTypes";' not in text:
    if old_import not in text:
        raise SystemExit("RulesRuntimeState import anchor missing")
    text = text.replace(old_import, new_import, 1)

old = '''  const resolutionId=`common-play-ready.${Date.now()}.${Math.floor(Math.random()*1000)}`;
  const committed=resolveCommonPlayStoredInvocationCapture(SIMPLEVTT_APP_RULES_PROFILE,state,{
    resolutionId,actorId:command.actorId,definitionId:action.lowered.definition.id,entryPointId:action.entryPointId,
    definitionRevision:reference.catalogId,binding:"live",
    trigger:{op:"eq",left:{ref:"trigger.declared"},right:{value:true}},
    metadata:{triggerLabel:command.trigger.trim()||"DM이 선언한 트리거"},
    captureOperations:[{id:`${resolutionId}:action`,kind:"use-economy",actorId:command.actorId,slot:"action",actionKind:"other"}],
  });'''
new = '''  const resolutionId=`common-play-ready.${Date.now()}.${Math.floor(Math.random()*1000)}`;
  const heldSpellConcentrationGroupId=action.category==="spell"?`${resolutionId}:held-spell`:undefined;
  const captureOperations:ResolutionOperation[]=[
    {id:`${resolutionId}:action`,kind:"use-economy",actorId:command.actorId,slot:"action",actionKind:action.category==="spell"?"magic":"other"},
  ];
  if(heldSpellConcentrationGroupId) captureOperations.push({
    id:`${resolutionId}:hold-concentration`,kind:"start-concentration",actorId:command.actorId,
    groupId:heldSpellConcentrationGroupId,sourceId:action.lowered.definition.id,
  });
  const committed=resolveCommonPlayStoredInvocationCapture(SIMPLEVTT_APP_RULES_PROFILE,state,{
    resolutionId,actorId:command.actorId,definitionId:action.lowered.definition.id,entryPointId:action.entryPointId,
    definitionRevision:reference.catalogId,binding:"live",
    trigger:{op:"eq",left:{ref:"trigger.declared"},right:{value:true}},
    metadata:{triggerLabel:command.trigger.trim()||"DM이 선언한 트리거"},
    ...(heldSpellConcentrationGroupId?{concentrationGroupId:heldSpellConcentrationGroupId,onTriggerConcentration:"end" as const}:{}),
    captureOperations,
  });'''
if old not in text:
    raise SystemExit("Ready capture anchor missing")
source.write_text(text.replace(old, new, 1), encoding="utf-8")
