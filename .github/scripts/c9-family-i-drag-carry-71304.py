from pathlib import Path
import json

TEST = Path("tests/ui/c9FamilyIMovementProduction.test.ts")
LEDGER = Path("docs/rules/v1-mechanism-coverage-ledger.json")

text = TEST.read_text(encoding="utf-8")
if 'id:"apply-drag-carry"' not in text:
    anchor = '''    {
      id:"move-full",
      invocation:"manual" as const,
      operations:[{
        kind:"movement.relocate" as const,
        mode:"move" as const,
        movementType:"walk" as const,
        target:"actor",
        distance:{ref:"movement.walk"},
        destinationFact:destinationFact("destination-full"),
      }],
    },'''
    block = '''    {
      id:"apply-drag-carry",
      invocation:"manual" as const,
      operations:[{
        kind:"property.modify" as const,
        property:"movement.cost.multiplier",
        operation:"set" as const,
        value:{value:2},
        target:"actor",
        owner:"effect" as const,
        source:"definition" as const,
        duration:{kind:"elapsed" as const,amount:{value:1},unit:"minutes" as const},
        lifetime:{kind:"until-duration" as const,onEnd:"destroy" as const},
        instancePolicy:"stack" as const,
      }],
    },
'''
    if anchor not in text:
        raise SystemExit("movement entry-point anchor missing")
    text = text.replace(anchor, block + anchor, 1)

if "runRulesDerivedDragCarry" not in text:
    anchor = 'test("rules-derived alternate speed bounds unknown installed Common Play movement",async()=>{'
    helper = '''async function runRulesDerivedDragCarry(prefix:string) {
  const {adapter,action}=await install(prefix);
  await adapter.resolveAction(action("apply-drag-carry"),["char.aelar"]);
  let snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete","portable drag/carry constraint must commit through production Common Play");
  const effect=turnRuntimeSessions.get(adapter)?.state.effects.find((candidate)=>candidate.propertyModifier?.property==="movement.cost.multiplier");
  assert.deepEqual(effect?.propertyModifier,{property:"movement.cost.multiplier",operation:"set",value:{value:2},source:"definition",instancePolicy:"stack"});
  const before=snapshot.scene.economyByActor["char.aelar"]!.movement;
  await adapter.resolveAction(action("move-walk"),["char.aelar"]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.movement,before-10,"rules-derived drag/carry constraint must double regular movement cost");
  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.movement,before,"drag/carry movement Undo must restore the exact budget while the constraint remains active");
  return before;
}

test("rules-derived drag/carry movement constraint is authoritative for unknown installed Common Play",async()=>{
  assert.equal(await runRulesDerivedDragCarry("unknown-family-i-drag-carry"),30);
});

test("renaming external drag/carry identities preserves movement constraint semantics",async()=>{
  assert.equal(await runRulesDerivedDragCarry("renamed-family-i-drag-carry"),30);
});

'''
    if anchor not in text:
        raise SystemExit("alternate-speed test anchor missing")
    text = text.replace(anchor, helper + anchor, 1)

TEST.write_text(text, encoding="utf-8")

data = json.loads(LEDGER.read_text(encoding="utf-8"))
row = next(entry for entry in data["rows"] if entry.get("family") == "I")
evidence = "c9FamilyIMovementProduction.test.ts proves rules-derived drag/carry movement constraints through generic movement.cost.multiplier Effect authority, production movement consumption, event-native Undo, and full external identity rename"
if evidence not in row["productionEvidence"]:
    row["productionEvidence"].append(evidence)
row["currentState"] = "Canonical movement.relocate parses through the generic operations lowerer. Unknown installed Common Play production-executes walk, climb, swim, fly, crawl, jump, Difficult Terrain and drag/carry cost constraints, push, pull, teleport, explicit no-provoke movement, zero-speed rejection, Undo, connected replay/reconnect, and external identity rename invariance. Rules-derived movement cost multipliers and alternate-speed bounds are production-proven through generic profile properties, and portable compile rejection is normalized into the standard production resolution failure path. Family I remains incomplete only for named movement-grant convergence."
row["remainingNamedSeams"] = ["named movement grants"]
LEDGER.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
