from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one replacement, found {count}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")


# Legacy/reference local sheets may not satisfy the full SessionProjection envelope, but their
# canonical subclassIds are still authoritative source facts. Add the same generic catalog fallback
# that already exists for items and explicit subclass features; no subclass identity selects rules.
replace_once(
    "src/app/commonPlayInterceptorProductionRuntimeAdapter.ts",
    '''function catalogEntryMatchesFeature(entry:CatalogEntry,featureId:string) {\n'''
    '''  const token=featureId.trim();\n'''
    '''  return (entry.category==="option"||entry.category==="feat")&&Boolean(token)&&(\n'''
    '''    entry.id===token||entry.contentId===token||entry.nameKo===token||entry.nameEn===token\n'''
    '''  );\n'''
    '''}\n\n''',
    '''function catalogEntryMatchesFeature(entry:CatalogEntry,featureId:string) {\n'''
    '''  const token=featureId.trim();\n'''
    '''  return (entry.category==="option"||entry.category==="feat")&&Boolean(token)&&(\n'''
    '''    entry.id===token||entry.contentId===token||entry.nameKo===token||entry.nameEn===token\n'''
    '''  );\n'''
    '''}\n\n'''
    '''function catalogEntryMatchesSubclass(entry:CatalogEntry,subclassId:string) {\n'''
    '''  const token=subclassId.trim();\n'''
    '''  return entry.category==="subclass"&&Boolean(token)&&(\n'''
    '''    entry.id===token||entry.contentId===token||entry.nameKo===token||entry.nameEn===token\n'''
    '''  );\n'''
    '''}\n\n''',
)
replace_once(
    "src/app/commonPlayInterceptorProductionRuntimeAdapter.ts",
    '''  for(const item of internal.activeCharacter.items) {\n''',
    '''  for(const subclassId of Object.values(internal.activeCharacter.subclassIds ?? {})) {\n'''
    '''    const matches=internal.catalog.filter((entry)=>catalogEntryMatchesSubclass(entry,subclassId));\n'''
    '''    if(matches.length===1)identities.add(matches[0].id);\n'''
    '''  }\n'''
    '''  for(const item of internal.activeCharacter.items) {\n''',
)

# The portable interrupt id is resolution-scoped by design. Assert the authored interaction suffix
# instead of preserving the removed legacy follow-up id.
local_path = Path("tests/ui/warlockFiendDarkOnesOwnLuckRuntime.test.ts")
local = local_path.read_text(encoding="utf-8")
old_header = 'const INTERRUPT_ID="follow-up.d20-modification";\nconst FEATURE_ID="dnd.srd521.feature.warlock.fiend.dark-ones-own-luck";\n'
new_header = 'const INTERRUPT_SUFFIX=":use-dark-ones-own-luck";\nconst FEATURE_ID="dnd.srd521.feature.warlock.fiend.dark-ones-own-luck";\nconst isDarkLuckInterrupt=(id:string|undefined)=>Boolean(id?.endsWith(INTERRUPT_SUFFIX));\n'
if local.count(old_header) != 1:
    raise SystemExit("local Dark Luck interrupt header not found")
local = local.replace(old_header, new_header, 1)
local = local.replace('assert.equal(snapshot.resolution?.interrupt?.id,INTERRUPT_ID', 'assert.equal(isDarkLuckInterrupt(snapshot.resolution?.interrupt?.id),true')
local = local.replace('assert.notEqual(snapshot.resolution?.interrupt?.id,INTERRUPT_ID);', 'assert.equal(isDarkLuckInterrupt(snapshot.resolution?.interrupt?.id),false);')
if "INTERRUPT_ID" in local:
    raise SystemExit("legacy local Dark Luck interrupt id assertion remains")
local_path.write_text(local, encoding="utf-8")

connected_path = Path("tests/ui/connectedProjectedCharacterDarkOnesOwnLuckResolution.test.ts")
connected = connected_path.read_text(encoding="utf-8")
replace_header = 'const INTERRUPT_ID="follow-up.d20-modification";\n'
if connected.count(replace_header) != 1:
    raise SystemExit("connected Dark Luck interrupt header not found")
connected = connected.replace(
    replace_header,
    'const INTERRUPT_SUFFIX=":use-dark-ones-own-luck";\nconst isDarkLuckInterrupt=(id:string|undefined)=>Boolean(id?.endsWith(INTERRUPT_SUFFIX));\n',
    1,
)
old_assert = 'assert.equal(snapshot.resolution?.stage,"interrupt",JSON.stringify(snapshot.resolution));assert.equal(snapshot.resolution?.checkTarget,10);assert.equal(snapshot.resolution?.interrupt?.id,INTERRUPT_ID);assert.equal(snapshot.resolution?.interrupt?.responderId,remote.id);'
new_assert = 'assert.equal(snapshot.resolution?.stage,"interrupt",JSON.stringify(snapshot.resolution));assert.equal(snapshot.resolution?.checkTarget,10);const promptId=snapshot.resolution?.interrupt?.id;assert.ok(promptId);assert.equal(isDarkLuckInterrupt(promptId),true);assert.equal(snapshot.resolution?.interrupt?.responderId,remote.id);'
if connected.count(old_assert) != 1:
    raise SystemExit("connected Dark Luck primary interrupt assertion not found")
connected = connected.replace(old_assert, new_assert, 1)
connected = connected.replace('assert.equal(prompt!.interrupt?.id,INTERRUPT_ID);', 'assert.equal(prompt!.interrupt?.id,promptId);')
connected = connected.replace('promptId:INTERRUPT_ID', 'promptId')
if "INTERRUPT_ID" in connected:
    raise SystemExit("legacy connected Dark Luck interrupt id assertion remains")
connected_path.write_text(connected, encoding="utf-8")
