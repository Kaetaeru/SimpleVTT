from __future__ import annotations

import json
from pathlib import Path

FEATURE_ID = "dnd.srd521.feature.warlock.fiend.dark-ones-own-luck"
RESOURCE_ID = "resource:warlock.fiend.dark-ones-own-luck"
FIEND_ID = "dnd.srd521.subclass.warlock.fiend-patron"


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one replacement, found {count}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")


# Remove only the Dark One's Own Luck named follow-up injection and imports made obsolete by it.
replace_once(
    "src/app/productionPlayRuntimeAdapter.ts",
    'import { FIEND_DARK_ONES_OWN_LUCK_FEATURE_ID, FIEND_DARK_ONES_OWN_LUCK_RESOURCE_ID } from "../domain/warlockFiend";\n'
    'import { WARLOCK_FIEND_SUBCLASS_ID } from "../domain/srdSubclassCatalog";\n'
    'import { WARLOCK_ID } from "../domain/warlockProgressionChoices";\n',
    "",
)
replace_once(
    "src/app/productionPlayRuntimeAdapter.ts",
    '''  const warlockLevel=character.classLevels?.find((entry)=>entry.classId===WARLOCK_ID)?.level??0;\n'''
    '''  const darkOnesOwnLuck=character.resources.find((resource)=>resource.id===FIEND_DARK_ONES_OWN_LUCK_RESOURCE_ID);\n'''
    '''  if(warlockLevel>=6&&character.subclassIds?.[WARLOCK_ID]===WARLOCK_FIEND_SUBCLASS_ID&&darkOnesOwnLuck){\n'''
    '''    actions.at(-1)!.runtimeD20FollowUps=[...(actions.at(-1)!.runtimeD20FollowUps??[]),{sourceId:FIEND_DARK_ONES_OWN_LUCK_FEATURE_ID,families:["ability-check","saving-throw"],trigger:"after-roll",modification:{mode:"add-die",diceSides:10},payment:{resourceId:darkOnesOwnLuck.id,amount:1,consumeWhen:"accept"},presentation:{optionName:"어둠의 존재의 행운 d10",cost:"사용 횟수 1회",effect:"d10을 판정 총합에 더합니다.",source:"SRD 5.2.1 · Fiend Patron · Dark One's Own Luck"}}];\n'''
    '''  }\n''',
    "",
)

# Presentation lookup may use the Common Play definition id for display only. Candidate ownership
# still comes exclusively from the already-owned content entry, so identity never selects mechanics.
replace_once(
    "src/app/commonPlayInterceptorProductionRuntimeAdapter.ts",
    '''        const canonical=parseCommonPlayDefinition(mechanic.config,`Installed passive Common Play ${qualifiedId} mechanic ${mechanicIndex}`);\n'''
    '''        const definition=lowerCommonPlayReactionDefinition(canonical,{resolveResourceDie:(resourceId)=>owner.sheet.resources.find((resource)=>resource.id===resourceId)?.dieSides});\n'''
    '''        if(!definition)continue;\n'''
    '''        for(const interceptor of definition.interceptors){\n''',
    '''        const canonical=parseCommonPlayDefinition(mechanic.config,`Installed passive Common Play ${qualifiedId} mechanic ${mechanicIndex}`);\n'''
    '''        const definition=lowerCommonPlayReactionDefinition(canonical,{resolveResourceDie:(resourceId)=>owner.sheet.resources.find((resource)=>resource.id===resourceId)?.dieSides});\n'''
    '''        if(!definition)continue;\n'''
    '''        const presentationEntry=internal.catalog.find((candidate)=>\n'''
    '''          candidate.contentId===canonical.id&&candidate.sourceId===entry.sourceId&&candidate.version===entry.version\n'''
    '''        );\n'''
    '''        for(const interceptor of definition.interceptors){\n''',
)
replace_once(
    "src/app/commonPlayInterceptorProductionRuntimeAdapter.ts",
    '''            optionName:entry.nameKo||entry.nameEn||entry.contentId||qualifiedId,\n''',
    '''            optionName:presentationEntry?.nameKo||presentationEntry?.nameEn||entry.nameKo||entry.nameEn||entry.contentId||qualifiedId,\n''',
)

# The actor already owns Fiend Patron through the durable subclass source projection. Attach the
# portable mechanic to that owned content object. Level availability remains structural: the
# dedicated Dark One's Own Luck resource only exists when the canonical resource owner grants it.
module_path = Path("content/modules/dnd-srd-5.2.1.subclasses/module.json")
module = json.loads(module_path.read_text(encoding="utf-8"))
content = module["content"]
fiend = next((entry for entry in content if entry.get("id") == FIEND_ID), None)
if fiend is None:
    raise SystemExit("Fiend Patron content entry not found")
if any(entry.get("id") == FEATURE_ID for entry in content):
    raise SystemExit("Dark One's Own Luck presentation entry already exists")
if fiend.get("mechanics"):
    raise SystemExit("Fiend Patron already has mechanics; migration must be reconciled manually")

fiend["mechanics"] = [{
    "kind": "common-play",
    "config": {
        "$schema": "https://simplevtt.local/schemas/common-play-contract.schema.json",
        "schemaVersion": "0.2-draft",
        "id": FEATURE_ID,
        "payments": [{
            "kind": "resource",
            "resource": RESOURCE_ID,
            "amount": {"value": 1},
            "consumeAt": "commit",
        }],
        "interceptors": [{
            "id": "dark-ones-own-luck-d20",
            "timing": "d20.outcome-determined",
            "interaction": {
                "id": "use-dark-ones-own-luck",
                "kind": "choice",
                "responder": "actor-owner",
                "mode": "blocking",
                "input": {"type": "boolean"},
                "revalidate": "if-revision-changed",
                "stalePolicy": "reject",
            },
            "operation": "recalculate",
            "slot": "d20.roll",
            "families": ["ability-check", "saving-throw"],
            "outcomes": ["success", "failure"],
            "operations": [{"kind": "roll.modify", "mode": "add-die", "dice": "1d10"}],
        }],
    },
}]

feature_entry = {
    "id": FEATURE_ID,
    "category": "option",
    "presentation": {
        "originalName": "Dark One's Own Luck",
        "defaultLocale": "ko-KR",
        "locales": {
            "ko-KR": {
                "name": "어둠의 존재의 행운",
                "summary": "d20 판정 결과를 본 뒤 사용 횟수를 소비해 d10을 판정에 더한다.",
            }
        },
    },
    "relationships": [{"kind": "parent", "target": FIEND_ID}],
}
fiend_index = content.index(fiend)
content.insert(fiend_index + 1, feature_entry)
module_path.write_text(json.dumps(module, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")

# Add a focused structural regression: the named production action projector must no longer own
# Dark One's Own Luck, while Indomitable remains intentionally untouched in this slice.
test_path = Path("tests/ui/warlockFiendDarkOnesOwnLuckRuntime.test.ts")
test_text = test_path.read_text(encoding="utf-8")
needle = 'const INTERRUPT_ID="follow-up.d20-modification";\n'
if needle not in test_text:
    raise SystemExit("Dark Luck test insertion point not found")
test_text = test_text.replace(
    needle,
    needle + 'const FEATURE_ID="dnd.srd521.feature.warlock.fiend.dark-ones-own-luck";\n',
    1,
)
# Ownership/identity regression: renaming only the feature presentation must not change mechanics.
test_text += '''\n\ntest("Dark One's Own Luck mechanics are selected structurally from owned Fiend content, not feature presentation identity",async()=>{\n  const adapter=new MockAdapter();\n  const internal=adapter as unknown as Internal&{catalog:Array<{contentId?:string;nameKo:string;nameEn?:string}>};\n  await prepareFiend(adapter);\n  const feature=internal.catalog.find((entry)=>entry.contentId===FEATURE_ID);\n  assert.ok(feature);\n  feature.nameKo="완전히 다른 표시 이름";\n  feature.nameEn="Renamed Presentation Only";\n  await adapter.startInitiative();\n  let snapshot=await adapter.getSnapshot();\n  const actorId=snapshot.activeCharacter.id;\n  await adapter.setCurrentActor(actorId);\n  snapshot=await adapter.getSnapshot();\n  const check=abilityCheckAction(snapshot);\n  assert.ok(check);\n  const before=snapshot.activeCharacter.resources.find((entry)=>entry.id===FIEND_DARK_ONES_OWN_LUCK_RESOURCE_ID)!.current;\n  await adapter.setQueuedD20(2);\n  await adapter.resolveAction(check.id,[]);\n  await adapter.advanceResolution();\n  snapshot=await adapter.applyDmAdjudication({type:"ability-check-dc",scope:"resolution",value:15});\n  assert.equal(snapshot.resolution?.interrupt?.id,INTERRUPT_ID);\n  await adapter.setQueuedD20(10);\n  snapshot=await adapter.respondToInterrupt(true);\n  assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id===FIEND_DARK_ONES_OWN_LUCK_RESOURCE_ID)?.current,before-1);\n});\n'''
test_path.write_text(test_text, encoding="utf-8")
