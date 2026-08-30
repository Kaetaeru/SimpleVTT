from pathlib import Path
import json

TEST = Path("tests/ui/c9FamilyIMovementProduction.test.ts")
LEDGER = Path("docs/rules/v1-mechanism-coverage-ledger.json")

text = TEST.read_text(encoding="utf-8")
old_entry = 'movementPropertyEffect("apply-drag-carry","movement.cost.multiplier",2),'
new_entry = 'movementPropertyEffect("apply-drag-carry","movement.drag-carry.multiplier",2),'
if old_entry in text:
    text = text.replace(old_entry, new_entry, 1)
elif new_entry not in text:
    raise SystemExit("drag/carry entry-point anchor missing")

old_helper = 'async function runRulesDerivedMovementCost(prefix:string,entryPointId:string){'
new_helper = 'async function runRulesDerivedMovementCost(prefix:string,entryPointId:string,property="movement.cost.multiplier"){' 
if old_helper in text:
    text = text.replace(old_helper, new_helper, 1)
elif new_helper not in text:
    raise SystemExit("rules-derived movement helper anchor missing")

old_find = 'find((candidate)=>candidate.propertyModifier?.property==="movement.cost.multiplier");assert.deepEqual(effect?.propertyModifier,{property:"movement.cost.multiplier",operation:"set",value:{value:2},source:"definition",instancePolicy:"stack"});'
new_find = 'find((candidate)=>candidate.propertyModifier?.property===property);assert.deepEqual(effect?.propertyModifier,{property,operation:"set",value:{value:2},source:"definition",instancePolicy:"stack"});'
if old_find in text:
    text = text.replace(old_find, new_find, 1)
elif new_find not in text:
    raise SystemExit("rules-derived movement effect assertion anchor missing")

old_drag_test = 'runRulesDerivedMovementCost("unknown-family-i-drag-carry","apply-drag-carry")'
new_drag_test = 'runRulesDerivedMovementCost("unknown-family-i-drag-carry","apply-drag-carry","movement.drag-carry.multiplier")'
if old_drag_test in text:
    text = text.replace(old_drag_test, new_drag_test, 1)
elif new_drag_test not in text:
    raise SystemExit("drag/carry production test anchor missing")

old_rename_test = 'runRulesDerivedMovementCost("renamed-family-i-drag-carry","apply-drag-carry")'
new_rename_test = 'runRulesDerivedMovementCost("renamed-family-i-drag-carry","apply-drag-carry","movement.drag-carry.multiplier")'
if old_rename_test in text:
    text = text.replace(old_rename_test, new_rename_test, 1)
elif new_rename_test not in text:
    raise SystemExit("drag/carry rename test anchor missing")

TEST.write_text(text, encoding="utf-8")

data = json.loads(LEDGER.read_text(encoding="utf-8"))
row = next(entry for entry in data["rows"] if entry.get("family") == "I")
evidence = "c9FamilyIMovementProduction.test.ts proves rules-derived drag/carry movement constraints through dedicated movement.drag-carry.multiplier Effect authority, production movement consumption, event-native Undo, and full external identity rename"
if evidence not in row["productionEvidence"]:
    row["productionEvidence"].append(evidence)
row["currentState"] = "Canonical movement.relocate parses through the generic operations lowerer. Unknown installed Common Play production-executes walk, climb, swim, fly, crawl, jump, Difficult Terrain and drag/carry cost constraints, push, pull, teleport, explicit no-provoke movement, zero-speed rejection, Undo, connected replay/reconnect, and external identity rename invariance. Rules-derived movement cost, dedicated drag/carry multiplier, and alternate-speed bounds are production-proven through generic profile properties, and portable compile rejection is normalized into the standard production resolution failure path. Family I remains incomplete only for named movement-grant convergence."
row["remainingNamedSeams"] = ["named movement grants"]
LEDGER.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
