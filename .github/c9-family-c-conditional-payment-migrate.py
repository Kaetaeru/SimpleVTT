import json
import os
import re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
FEATURE_ID="dnd.srd521.feature.bard.college-of-lore.peerless-skill"
RUN_ID=os.environ.get("GITHUB_RUN_ID","pending")


def read(path):
    return (ROOT/path).read_text(encoding="utf-8")


def write(path,text):
    (ROOT/path).write_text(text,encoding="utf-8")


def replace_once(text,old,new,label):
    count=text.count(old)
    if count!=1:
        raise RuntimeError(f"{label}: expected exactly one match, got {count}")
    return text.replace(old,new,1)


def migrate_schema():
    path=Path("schemas/common-play-contract.schema.json")
    data=json.loads(read(path))
    defs=data["$defs"]
    defs["d20ResultCondition"]={
        "type":"object",
        "required":["kind","outcome"],
        "properties":{
            "kind":{"const":"d20-result"},
            "outcome":{"enum":["success","failure"]},
        },
        "additionalProperties":False,
    }
    for variant in defs["payment"]["oneOf"]:
        kind=variant.get("properties",{}).get("kind",{}).get("const")
        if kind in {"resource","economy"}:
            variant["properties"]["condition"]={"$ref":"#/$defs/d20ResultCondition"}
    write(path,json.dumps(data,ensure_ascii=False,indent=2)+"\n")


def migrate_reaction_types():
    path=Path("src/domain/commonPlayRuntime.ts")
    text=read(path)
    text=replace_once(
        text,
        'type CommonPlayPayment =\n',
        'type CommonPlayD20ResultCondition={kind:"d20-result";outcome:"success"|"failure"};\n\ntype CommonPlayPayment =\n',
        "commonPlayRuntime condition type",
    )
    text=replace_once(
        text,
        '      refundOnCancel?:boolean;\n    }\n  | {\n      kind:"economy";',
        '      refundOnCancel?:boolean;\n      condition?:CommonPlayD20ResultCondition;\n    }\n  | {\n      kind:"economy";',
        "resource condition field",
    )
    text=replace_once(
        text,
        '      refundOnCancel?:boolean;\n    };\n',
        '      refundOnCancel?:boolean;\n      condition?:CommonPlayD20ResultCondition;\n    };\n',
        "economy condition field",
    )
    start=text.index('function paymentOperations(')
    end=text.index('\nfunction d20RollModifications(',start)
    replacement='''function paymentOperations(\n  definition:CommonPlayReactionDefinition,\n  sourceActorId:string,\n  interceptorId:string,\n  d20Outcome?:D20TestResult["outcome"],\n  eligibilityOnly=false,\n):ResolutionOperation[] {\n  return definition.payments.flatMap((payment,index):ResolutionOperation[]=>{\n    if (payment.condition) {\n      if (payment.condition.kind!=="d20-result") throw new Error(`unsupported reaction payment condition: ${String((payment.condition as {kind?:unknown}).kind)}`);\n      if (!eligibilityOnly) {\n        if (!d20Outcome) throw new Error("d20-result payment condition requires a d20.roll interceptor");\n        if (payment.condition.outcome!==d20Outcome) return [];\n      }\n    }\n    if (payment.consumeAt!=="commit") throw new Error("reaction runtime supports commit-time payments only");\n    const amount=literalValue(payment.amount,`${payment.kind} payment amount`);\n    if (payment.kind==="resource") {\n      if (amount<=0) throw new Error("resource payment amount must be positive");\n      return [{\n        id:`common-play-${interceptorId}-payment-${index+1}`,\n        kind:"spend-resource" as const,\n        actorId:sourceActorId,\n        resourceId:payment.resource,\n        amount,\n      }];\n    }\n    if (amount!==1) throw new Error("economy payment amount must be exactly 1 in the reaction runtime slice");\n    if (!(["action","bonus-action","reaction"] as string[]).includes(payment.bucket)) {\n      throw new Error(`unsupported economy bucket: ${payment.bucket}`);\n    }\n    return [{\n      id:`common-play-${interceptorId}-payment-${index+1}`,\n      kind:"use-economy" as const,\n      actorId:sourceActorId,\n      slot:payment.bucket as TurnSlot,\n      bonusActionGranted:payment.bucket==="bonus-action",\n    }];\n  });\n}\n'''
    text=text[:start]+replacement+text[end:]
    text=replace_once(
        text,
        'function acceptedPending(awaiting:AwaitingCommonPlayInteraction,authority?:CommonPlayInteractionAuthority):PendingResolution {',
        'function acceptedPending(profile:RulesProfileLike,inputState:RulesRuntimeState,awaiting:AwaitingCommonPlayInteraction,authority?:CommonPlayInteractionAuthority):PendingResolution {',
        "acceptedPending signature",
    )
    text=replace_once(text,'  const payments=paymentOperations(definition,sourceActorId,interceptor.id);\n\n  if(interceptor.slot==="d20.roll") {','  if(interceptor.slot==="d20.roll") {',"early payments")
    needle='''    const recalculated:ResolutionOperation={\n      ...intercepted,\n      request:{\n        ...intercepted.request,\n        rollModifications:[...(intercepted.request.rollModifications??[]),...d20RollModifications(definition,interceptor,authority)],\n      },\n    };\n    return {...pending,operations:[...pending.operations.slice(0,operationIndex),...payments,recalculated,...pending.operations.slice(operationIndex+1)]};'''
    repl='''    const recalculated:ResolutionOperation={\n      ...intercepted,\n      request:{\n        ...intercepted.request,\n        rollModifications:[...(intercepted.request.rollModifications??[]),...d20RollModifications(definition,interceptor,authority)],\n      },\n    };\n    const preview=stagePendingResolution(profile,inputState,{...pending,operations:[...pending.operations.slice(0,operationIndex),recalculated]});\n    if(preview.status==="rejected")throw new Error(preview.error??"conditional payment d20 preview rejected");\n    const result=preview.results[recalculated.id] as D20TestResult|undefined;\n    if(!result)throw new Error("conditional payment d20 preview result is missing");\n    const payments=paymentOperations(definition,sourceActorId,interceptor.id,result.outcome);\n    return {...pending,operations:[...pending.operations.slice(0,operationIndex),...payments,recalculated,...pending.operations.slice(operationIndex+1)]};'''
    text=replace_once(text,needle,repl,"d20 conditional payment preview")
    text=replace_once(
        text,
        '  if(interceptor.slot==="primary.damage") {\n',
        '  if(interceptor.slot==="primary.damage") {\n    const payments=paymentOperations(definition,sourceActorId,interceptor.id);\n',
        "damage payments",
    )
    text=replace_once(
        text,
        '  const recalculated:ResolutionOperation={\n    ...intercepted,\n    request:{...intercepted.request,target,targetSource:`common-play:${definition.id}:${interceptor.id}`},\n  };\n  return {...pending,operations:[...pending.operations.slice(0,operationIndex),...payments,recalculated,...pending.operations.slice(operationIndex+1)]};',
        '  const recalculated:ResolutionOperation={\n    ...intercepted,\n    request:{...intercepted.request,target,targetSource:`common-play:${definition.id}:${interceptor.id}`},\n  };\n  const payments=paymentOperations(definition,sourceActorId,interceptor.id);\n  return {...pending,operations:[...pending.operations.slice(0,operationIndex),...payments,recalculated,...pending.operations.slice(operationIndex+1)]};',
        "attack payments",
    )
    text=replace_once(
        text,
        '    payments=paymentOperations(definition,sourceActorId,interceptor.id);',
        '    payments=paymentOperations(definition,sourceActorId,interceptor.id,undefined,true);',
        "eligibility conditional payments",
    )
    text=replace_once(
        text,
        '    return resolvePendingResolution(profile,inputState,acceptedPending(awaiting,authority));',
        '    return resolvePendingResolution(profile,inputState,acceptedPending(profile,inputState,awaiting,authority));',
        "resume accepted pending",
    )
    write(path,text)


def migrate_reaction_lowerer():
    path=Path("src/domain/commonPlayReactionDefinitionRuntime.ts")
    text=read(path)
    marker='''function eligibility(value:Obj,label:string) {'''
    helper='''function d20ResultCondition(value:unknown,label:string):CommonPlayReactionDefinition["payments"][number]["condition"] {\n  if(value===undefined)return undefined;\n  const raw=object(value,label);\n  const unsupported=Object.keys(raw).filter((key)=>key!=="kind"&&key!=="outcome");\n  if(unsupported.length)throw new DomainEvaluationError(`${label} contains unsupported fields: ${unsupported.join(", ")}`);\n  if(raw.kind!=="d20-result")throw new DomainEvaluationError(`${label}.kind must be d20-result`);\n  if(raw.outcome!=="success"&&raw.outcome!=="failure")throw new DomainEvaluationError(`${label}.outcome must be success or failure`);\n  return {kind:"d20-result",outcome:raw.outcome};\n}\n\n'''
    text=replace_once(text,marker,helper+marker,"condition lowerer helper")
    text=replace_once(
        text,
        '  const amount=literalNumber(value.amount,`${label}.amount`);\n',
        '  const amount=literalNumber(value.amount,`${label}.amount`);\n  const condition=d20ResultCondition(value.condition,`${label}.condition`);\n',
        "payment condition parse",
    )
    text=text.replace(
        '      ...(typeof value.refundOnCancel==="boolean"?{refundOnCancel:value.refundOnCancel}:{}),\n    };',
        '      ...(typeof value.refundOnCancel==="boolean"?{refundOnCancel:value.refundOnCancel}:{}),\n      ...(condition?{condition}:{}),\n    };',
        2,
    )
    write(path,text)


def migrate_adapter_ui():
    path=Path("src/app/commonPlayInterceptorProductionRuntimeAdapter.ts")
    text=read(path)
    old='''function interactionCost(definition:CommonPlayReactionDefinition) {\n  return definition.payments.map((payment)=>payment.kind==="economy"?payment.bucket:`${payment.resource} ${payment.amount.value}`).join(" + ")||"비용 없음";\n}'''
    new='''function interactionCost(definition:CommonPlayReactionDefinition) {\n  return definition.payments.map((payment)=>{\n    const base=payment.kind==="economy"?payment.bucket:`${payment.resource} ${payment.amount.value}`;\n    const condition=payment.condition?.kind==="d20-result"?` (${payment.condition.outcome==="success"?"성공":"실패"} 시)`:"";\n    return `${base}${condition}`;\n  }).join(" + ")||"비용 없음";\n}'''
    text=replace_once(text,old,new,"interaction conditional cost")
    old2='''      updateD20Presentation(resolution,pending,d20,authority);\n    }'''
    new2='''      updateD20Presentation(resolution,pending,d20,authority);\n      if(pending.candidate.definition.payments.some((payment)=>payment.condition?.kind==="d20-result"&&payment.condition.outcome!==d20.outcome)) {\n        resolution.detail.push(`${pending.candidate.optionName}: 결과 조건 불충족 · 자원 보존`);\n      }\n    }'''
    text=replace_once(text,old2,new2,"conditional payment presentation")
    write(path,text)


def migrate_peerless_content():
    path=Path("content/modules/dnd-srd-5.2.1.subclasses/module.json")
    data=json.loads(read(path))
    content=data["content"]
    if any(entry.get("id")==FEATURE_ID for entry in content):
        raise RuntimeError("Peerless Skill portable content already exists")
    peerless={
        "id":FEATURE_ID,
        "category":"option",
        "presentation":{
            "originalName":"Peerless Skill",
            "defaultLocale":"ko-KR",
            "locales":{"ko-KR":{"name":"비할 데 없는 기술","summary":"실패한 능력 판정이나 공격 굴림에 바드의 영감 주사위를 더하고, 성공으로 바뀔 때만 사용 횟수를 소비한다."}},
        },
        "relationships":[{"kind":"parent","target":"dnd.srd521.subclass.bard.college-of-lore"}],
        "mechanics":[{"kind":"common-play","config":{
            "$schema":"https://simplevtt.local/schemas/common-play-contract.schema.json",
            "schemaVersion":"0.2-draft",
            "id":FEATURE_ID,
            "payments":[{"kind":"resource","resource":"resource:bard.bardic-inspiration","amount":{"value":1},"consumeAt":"commit","condition":{"kind":"d20-result","outcome":"success"}}],
            "interceptors":[{
                "id":"peerless-skill-d20",
                "timing":"d20.outcome-determined",
                "interaction":{"id":"use-peerless-skill","kind":"choice","responder":"actor-owner","mode":"blocking","input":{"type":"boolean"},"revalidate":"if-revision-changed","stalePolicy":"reject"},
                "operation":"recalculate",
                "slot":"d20.roll",
                "families":["ability-check","attack-roll"],
                "outcomes":["failure"],
                "operations":[{"kind":"roll.modify","mode":"add-die","dice":"1d12"}],
            }],
        }}],
    }
    lore_index=next(i for i,entry in enumerate(content) if entry.get("id")=="dnd.srd521.subclass.bard.college-of-lore")
    content.insert(lore_index+1,peerless)
    write(path,json.dumps(data,ensure_ascii=False,separators=(",",":"))+"\n")


def remove_named_peerless():
    path=Path("src/app/productionPlayRuntimeAdapter.ts")
    text=read(path)
    text=replace_once(text,'import { BARD_COLLEGE_LORE_SUBCLASS_ID, LORE_PEERLESS_SKILL_SOURCE } from "../domain/bardCollegeLore";\n','',"peerless imports")
    pattern=re.compile(r'  if\(bardLevel>=14&&character\.subclassIds\?\.\[BARD_ID\]===BARD_COLLEGE_LORE_SUBCLASS_ID&&inspiration\)\{\n    const sides=bardicInspirationDieSides\(bardLevel\);actions\.at\(-1\)!\.runtimeD20FollowUps=\[\.\.\.\(actions\.at\(-1\)!\.runtimeD20FollowUps\?\?\[\]\),\{sourceId:LORE_PEERLESS_SKILL_SOURCE,.*?\}\];\n  \}\n',re.S)
    text,count=pattern.subn('',text,count=1)
    if count!=1: raise RuntimeError(f"named Peerless block: expected 1, got {count}")
    write(path,text)


def migrate_peerless_tests():
    path=Path("tests/ui/bardCollegeLorePeerlessSkillRuntime.test.ts")
    text=read(path)
    text=replace_once(text,'const INTERRUPT_ID="follow-up.d20-modification";\n',f'const FEATURE_ID="{FEATURE_ID}";\nconst isPeerlessInterrupt=(id:string|undefined)=>Boolean(id?.includes(FEATURE_ID)&&id.includes("common-play-interceptor"));\n',"local Peerless interrupt helper")
    text=replace_once(text,'    subclassIds:{[BARD_LORE_CLASS_ID]:BARD_COLLEGE_LORE_SUBCLASS_ID},\n    resources:[','    subclassIds:{[BARD_LORE_CLASS_ID]:BARD_COLLEGE_LORE_SUBCLASS_ID},\n    subclassFeatureIds:level>=14?[FEATURE_ID]:[],\n    resources:[',"local Peerless feature ownership")
    text=text.replace('assert.equal(snapshot.resolution?.interrupt?.id,INTERRUPT_ID,JSON.stringify(snapshot.resolution));','assert.equal(isPeerlessInterrupt(snapshot.resolution?.interrupt?.id),true,JSON.stringify(snapshot.resolution));')
    text=text.replace('if(snapshot.resolution?.interrupt?.id===INTERRUPT_ID)break;','if(isPeerlessInterrupt(snapshot.resolution?.interrupt?.id))break;')
    text=text.replace('assert.notEqual(snapshot.resolution?.interrupt?.id,INTERRUPT_ID);','assert.equal(isPeerlessInterrupt(snapshot.resolution?.interrupt?.id),false);')
    identity='''\n\ntest("Peerless Skill mechanics are selected from the owned feature identity, not presentation text",async()=>{\n  const adapter=new MockAdapter();\n  await prepareLoreBard(adapter);\n  const internal=adapter as unknown as {catalog:Array<{contentId?:string;nameKo:string;nameEn?:string}>};\n  const feature=internal.catalog.find((entry)=>entry.contentId===FEATURE_ID);\n  assert.ok(feature);\n  feature.nameKo="완전히 다른 표시 이름";\n  feature.nameEn="Renamed Peerless Presentation";\n  const before=inspirationUses(await adapter.getSnapshot());\n  let snapshot=await startFailedCheck(adapter,4);\n  assert.equal(isPeerlessInterrupt(snapshot.resolution?.interrupt?.id),true);\n  await adapter.setQueuedD20(6);\n  snapshot=await adapter.respondToInterrupt(true);\n  assert.equal(snapshot.resolution?.checkOutcome,"성공");\n  assert.equal(inspirationUses(snapshot),before!-1);\n});\n'''
    text+=identity
    write(path,text)

    path=Path("tests/ui/connectedProjectedCharacterPeerlessSkillResolution.test.ts")
    text=read(path)
    text=replace_once(text,'const INTERRUPT_ID="follow-up.d20-modification";\n',f'const FEATURE_ID="{FEATURE_ID}";\nconst isPeerlessInterrupt=(id:string|undefined)=>Boolean(id?.includes(FEATURE_ID)&&id.includes("common-play-interceptor"));\n',"connected Peerless interrupt helper")
    text=replace_once(text,'    classLevels:[{classId:BARD_LORE_CLASS_ID,className:bard.nameKo||bard.nameEn,level:14,subclassName:lore.nameKo||lore.nameEn}],subclassIds:{[BARD_LORE_CLASS_ID]:BARD_COLLEGE_LORE_SUBCLASS_ID},\n','    classLevels:[{classId:BARD_LORE_CLASS_ID,className:bard.nameKo||bard.nameEn,level:14,subclassName:lore.nameKo||lore.nameEn}],subclassIds:{[BARD_LORE_CLASS_ID]:BARD_COLLEGE_LORE_SUBCLASS_ID},subclassFeatureIds:[FEATURE_ID],\n',"connected Peerless feature ownership")
    text=text.replace('assert.equal(snapshot.resolution?.interrupt?.id,INTERRUPT_ID)','assert.equal(isPeerlessInterrupt(snapshot.resolution?.interrupt?.id),true)')
    text=text.replace('assert.equal(prompt!.interrupt?.id,INTERRUPT_ID);','assert.equal(prompt!.interrupt?.id,snapshot.resolution!.interrupt!.id);')
    text=text.replace('promptId:INTERRUPT_ID','promptId:snapshot.resolution!.interrupt!.id')
    write(path,text)


def add_domain_tests():
    path=Path("tests/domain/commonPlayReactionRuntime.test.ts")
    text=read(path)
    marker='conditional d20-result payment spends only when the modified roll succeeds'
    if marker in text: raise RuntimeError("conditional payment tests already present")
    addition='''\n\nconst CONDITIONAL_D20_PAYMENT:CommonPlayReactionDefinition={\n  id:"external.unknown.conditional-d20-payment",\n  payments:[{kind:"resource",resource:"spell-slot-1",amount:{value:1},consumeAt:"commit",refundOnCancel:true,condition:{kind:"d20-result",outcome:"success"}}],\n  interceptors:[{\n    id:"conditional-add-die",timing:"d20.outcome-determined",\n    interaction:{id:"use-conditional-add-die",kind:"choice",responder:"actor-owner",mode:"blocking",input:{type:"boolean"},revalidate:"always",stalePolicy:"cancel"},\n    operation:"recalculate",slot:"d20.roll",families:["ability-check"],outcomes:["failure"],\n    operations:[{kind:"roll.modify",mode:"add-die",dice:"1d10"}],\n  }],\n};\n\nfunction failedConditionalCheck():PendingResolution {\n  return {id:"conditional-check",actorId:"hero",sourceId:"external.conditional-check",expectedRevision:0,operations:[{\n    id:"check",kind:"d20",actorId:"hero",request:{family:"ability-check",target:20,modifierContributions:[{source:"base",value:5}],dice:{id:"conditional-check-d20",purpose:"conditional check",sides:20,faces:[10]}},\n  }]};\n}\n\ntest("conditional d20-result payment spends only when the modified roll succeeds",()=>{\n  const state=runtimeState();\n  const awaiting=requireAwaiting(startCommonPlayResolution(TEST_PROFILE,state,failedConditionalCheck(),CONDITIONAL_D20_PAYMENT,"hero"));\n  const accepted=resumeCommonPlayInteraction(TEST_PROFILE,state,awaiting,{interactionId:awaiting.interaction.id,idempotencyKey:awaiting.interaction.idempotencyKey,value:true},{modifierDiceFaces:{0:[6]}});\n  assert.equal(accepted.status,"committed");\n  if(accepted.status!=="committed")return;\n  assert.equal((accepted.results.check as {outcome:string;total:number}).outcome,"success");\n  assert.equal((accepted.results.check as {total:number}).total,21);\n  assert.equal(accepted.state.combatants.hero.resources.find((pool)=>pool.id==="spell-slot-1")?.current,1);\n});\n\ntest("conditional d20-result payment preserves the resource when the modified roll still fails",()=>{\n  const state=runtimeState();\n  const awaiting=requireAwaiting(startCommonPlayResolution(TEST_PROFILE,state,failedConditionalCheck(),CONDITIONAL_D20_PAYMENT,"hero"));\n  const accepted=resumeCommonPlayInteraction(TEST_PROFILE,state,awaiting,{interactionId:awaiting.interaction.id,idempotencyKey:awaiting.interaction.idempotencyKey,value:true},{modifierDiceFaces:{0:[2]}});\n  assert.equal(accepted.status,"committed");\n  if(accepted.status!=="committed")return;\n  assert.equal((accepted.results.check as {outcome:string;total:number}).outcome,"failure");\n  assert.equal((accepted.results.check as {total:number}).total,17);\n  assert.equal(accepted.state.combatants.hero.resources.find((pool)=>pool.id==="spell-slot-1")?.current,2);\n});\n'''
    write(path,text+addition)


def product():
    migrate_schema()
    migrate_reaction_types()
    migrate_reaction_lowerer()
    migrate_adapter_ui()
    migrate_peerless_content()
    remove_named_peerless()
    migrate_peerless_tests()
    add_domain_tests()


def ledger():
    path=Path("docs/rules/v1-mechanism-coverage-ledger.json")
    data=json.loads(read(path))
    row=next(entry for entry in data["families"] if entry.get("family")=="C")
    row["currentState"]=(
        "The generic d20 Resolver now supports post-roll resource/economy payments conditioned on the recalculated d20 outcome without content identity dispatch. "
        "Peerless Skill is builtin portable Common Play discovered from the existing durable subclassFeatureIds identity and pays Bardic Inspiration only when its added die changes the failed ability-check/attack result to success. "
        "Cutting Words and Dark One's Own Luck remain portable. Family C remains INCOMPLETE because productionPlayRuntimeAdapter.ts still injects Tactical Mind and Indomitable: Tactical Mind now has expressible conditional payment semantics but lacks a canonical class-feature content identity owner in Character SessionProjection, while Indomitable still lacks a generic authoritative actor/progression numeric value for its Fighter-level reroll bonus."
    )
    evidence=f"C9 Family C Conditional Payment + Peerless Migration run {RUN_ID}: conditional d20 payment success/no-spend, portable Peerless local/connected/rename/Undo/persistence regressions, tsc --noEmit, vite build"
    for key in ["implementationEvidence","productionEvidence","identityInvarianceEvidence","connectedEvidenceIfRelevant","persistenceEvidenceIfRelevant"]:
        values=row.setdefault(key,[])
        if evidence not in values: values.append(evidence)
    row["remainingNamedSeams"]=[
        "productionPlayRuntimeAdapter.ts still injects Tactical Mind and Indomitable runtimeD20FollowUps; Peerless Skill named injection is removed",
        "Tactical Mind conditional pay-on-success is now expressible, but Character SessionProjection has no canonical class-feature identity owner analogous to subclassFeatureIds; define/reuse that owner before removing its named projection",
        "Indomitable requires a generic authoritative actor/progression numeric value for its Fighter-level reroll bonus; do not encode Fighter identity or a literal class bonus in the portable d20 path",
    ]
    write(path,json.dumps(data,ensure_ascii=False,indent=2)+"\n")


def state():
    path=Path(".chatgpt-rerun/STATE.md")
    text=read(path)
    section=f'''## Family C reconciliation — conditional payment and Peerless Skill portable\n\nFamily C (`d20-test-lifecycle`) remains `INCOMPLETE`, but the generic post-roll payment boundary and Peerless Skill named seam advanced:\n\n- The Common Play payment contract now supports a narrow `d20-result` condition on resource/economy commit payments. The reaction runtime previews the already-authoritative modified d20 result with the same fixed dice, then includes the payment in the final Resolver transaction only when the declared success/failure outcome matches. Availability still checks the potential payment before offering the interaction. No refund side channel or second roll engine was added.\n- Peerless Skill is now an `option` Common Play definition owned through the existing durable `subclassFeatureIds` content identity. Its failed ability-check/attack d12 and Bardic Inspiration payment are handled by the generic d20 interceptor; the resource is spent only if the recalculated result succeeds. The named `runtimeD20FollowUps` injection was deleted.\n- Run `{RUN_ID}` passed the focused domain/Peerless/Dark-Luck/unknown-interceptor suite, `tsc --noEmit`, and `vite build`, including local success/no-spend, feature presentation rename invariance, connected owner routing, exactly-once/duplicate replay, reconnect, Client persistence, and event-native Undo.\n- Tactical Mind is deliberately still named. Conditional pay-on-success is no longer the blocker; the remaining gap is ownership: current Character SessionProjection has durable subclass feature identities but no canonical class-feature identity list that can own Tactical Mind without inferring mechanics from Fighter ID/name or presentation text.\n- Indomitable remains named for the previously recorded generic actor/progression numeric-source gap.\n- Coverage totals remain `IMPLEMENTED=4`, `INCOMPLETE=32`, `PROVEN_UNNEEDED=0`; `gateNBlockingNamedFallbacks` remains empty and overall verdict remains `V1 INCOMPLETE`.\n\n## Next Exact Action\n\nContinue Family C at the class-feature ownership boundary. Reuse or define the smallest canonical Character/SessionProjection identity source for granted class features so Tactical Mind can be owned as portable content and its now-supported conditional d20 payment can replace the named runtimeD20FollowUps injection. Do not infer feature mechanics from Fighter ID/name, localized feature text, or action placement. Keep Indomitable named until a separate generic authoritative actor/progression numeric expression source exists for its Fighter-level reroll bonus.\n'''
    marker="## Next Exact Action\n"
    pos=text.rfind(marker)
    if pos<0: raise RuntimeError("STATE Next Exact Action not found")
    text=text[:pos]+section
    write(path,text)


def control():
    path=Path(".chatgpt-rerun/control.json")
    data=json.loads(read(path))
    data["status"]="continue"
    data["reason"]=(
        f"C9 remains active at IMPLEMENTED=4, INCOMPLETE=32, PROVEN_UNNEEDED=0. Run {RUN_ID} adds generic conditional d20-result commit payments and migrates Peerless Skill to durable subclassFeatureIds-owned portable Common Play with local/connected/rename/persistence/Undo verification. Family C remains INCOMPLETE: Tactical Mind now needs a canonical class-feature identity owner in Character SessionProjection, and Indomitable still needs a generic authoritative actor/progression numeric source for its Fighter-level reroll bonus."
    )
    data["updated_at"]="2026-08-30"
    write(path,json.dumps(data,ensure_ascii=False,indent=2)+"\n")


if __name__=="__main__":
    mode=os.sys.argv[1] if len(os.sys.argv)>1 else "product"
    {"product":product,"ledger":ledger,"state":state,"control":control}[mode]()
