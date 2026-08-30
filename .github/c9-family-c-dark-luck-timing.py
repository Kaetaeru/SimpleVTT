from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one replacement, found {count}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")


# A normal advance can itself create attack-result/save-result, so re-check the generic post-roll
# timing window immediately after the authoritative advance. This stays content-agnostic.
replace_once(
    "src/app/commonPlayInterceptorProductionRuntimeAdapter.ts",
    '''MockAdapter.prototype.advanceResolution=async function advanceWithPortableCommonPlayInterceptors() {\n'''
    '''  const pending=pendingByAdapter.get(this);\n'''
    '''  if(pending&&(this as unknown as AdapterState).resolution?.id===pending.resolutionId)return (this as unknown as AdapterState).getSnapshot();\n'''
    '''  if(await offerPassiveReaction(this))return (this as unknown as AdapterState).getSnapshot();\n'''
    '''  return previousAdvanceResolution.call(this);\n'''
    '''};\n''',
    '''MockAdapter.prototype.advanceResolution=async function advanceWithPortableCommonPlayInterceptors() {\n'''
    '''  const pending=pendingByAdapter.get(this);\n'''
    '''  if(pending&&(this as unknown as AdapterState).resolution?.id===pending.resolutionId)return (this as unknown as AdapterState).getSnapshot();\n'''
    '''  if(await offerPassiveReaction(this))return (this as unknown as AdapterState).getSnapshot();\n'''
    '''  const advanced=await previousAdvanceResolution.call(this);\n'''
    '''  if(await offerPassiveReaction(this))return (this as unknown as AdapterState).getSnapshot();\n'''
    '''  return advanced;\n'''
    '''};\n''',
)

# Portable modifier dice are interaction authority, not the base resolution's authoritative d20 list.
# Preserve that contract in the connected acceptance while still checking the recalculated total.
replace_once(
    "tests/ui/connectedProjectedCharacterDarkOnesOwnLuckResolution.test.ts",
    'assert.equal(snapshot.resolution?.stage,"complete");assert.deepEqual(snapshot.resolution?.authoritativeDice,[4,10]);assert.equal(snapshot.resolution?.rollTotal,failedTotal!+10);',
    'assert.equal(snapshot.resolution?.stage,"complete");assert.deepEqual(snapshot.resolution?.authoritativeDice,[4]);assert.equal(snapshot.resolution?.rollTotal,failedTotal!+10);',
)
