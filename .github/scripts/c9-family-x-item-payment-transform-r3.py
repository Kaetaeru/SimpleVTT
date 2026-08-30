from pathlib import Path

source=Path('.github/scripts/c9-family-x-item-payment-step.py')
text=source.read_text()

start=text.index('\nm1 = Path(".github/workflows/m1-common-play-resource-economy.yml")')
end=text.index('\n\nPath("tests/ui/installedCommonPlayItemPaymentProduction.test.ts")',start)
text=text[:start]+text[end:]

text=text.replace(
    'const ITEM_PAYMENT_SELECTOR_KEYS=new Set(["from","where","min","max"]);',
    'const ITEM_PAYMENT_SELECTOR_KEYS=new Set(["from","where","min","max","definitionId"]);',
)
text=text.replace(
    '  if(selector.min!==1||selector.max!==1) throw new DomainEvaluationError(`${label} must select exactly one item stack with min=1 and max=1`);',
    '  if(typeof selector.definitionId==="string") return {from:"items",definitionId:nonEmptyString(selector.definitionId,`${label}.definitionId`)};\n  if(selector.min!==1||selector.max!==1) throw new DomainEvaluationError(`${label} must select exactly one item stack with min=1 and max=1`);',
)

old="""    '    operationEntryPoint=entryPoint;\\n    const pending=compileCommonPlayEntryPointOperations(SIMPLEVTT_APP_RULES_PROFILE,state,lowered.definition,operationExecutionInput(internal,actionId,action,prepared,resolutionId,interactionId));',
    '    operationEntryPoint=entryPoint;\\n    const itemContext=itemPaymentRuntimeContext(internal,state,lowered.definition);\\n    const pending=compileCommonPlayEntryPointOperations(SIMPLEVTT_APP_RULES_PROFILE,itemContext.state,lowered.definition,operationExecutionInput(internal,actionId,action,prepared,resolutionId,interactionId,itemContext.itemPaymentResourceIds));',"""
new="""    '    const pending=compileCommonPlayEntryPointOperations(SIMPLEVTT_APP_RULES_PROFILE,state,lowered.definition,operationExecutionInput(internal,actionId,action,prepared,resolutionId,interactionId));',
    '    const itemContext=itemPaymentRuntimeContext(internal,state,lowered.definition);\\n    const pending=compileCommonPlayEntryPointOperations(SIMPLEVTT_APP_RULES_PROFILE,itemContext.state,lowered.definition,operationExecutionInput(internal,actionId,action,prepared,resolutionId,interactionId,itemContext.itemPaymentResourceIds));',"""
if old not in text:
    raise SystemExit('missing transformer anchor for post-allocation pending compile')
text=text.replace(old,new,1)

Path('/tmp/c9-family-x-item-payment-step.py').write_text(text)
