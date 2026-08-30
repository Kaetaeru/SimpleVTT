from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
FEATURE_ID="dnd.srd521.feature.bard.college-of-lore.peerless-skill"


def patch(path,old,new,label):
    file=ROOT/path
    text=file.read_text(encoding="utf-8")
    count=text.count(old)
    if count!=1:
        raise RuntimeError(f"{label}: expected exactly one match, got {count}")
    file.write_text(text.replace(old,new,1),encoding="utf-8")


patch(
    Path("tests/ui/bardCollegeLorePeerlessSkillRuntime.test.ts"),
    '  assert.equal(snapshot.activity.some((entry)=>entry.detail.some((detail)=>detail.includes("비할 데 없는 기술"))),true,JSON.stringify(snapshot.activity));\n\n  snapshot=await adapter.undoLastResolution();',
    '  assert.equal(snapshot.resolution?.provenance.some((entry)=>entry.includes(FEATURE_ID)),true,JSON.stringify(snapshot.resolution));\n\n  snapshot=await adapter.undoLastResolution();',
    "Peerless attack generic provenance assertion",
)

patch(
    Path("tests/ui/connectedProjectedCharacterPeerlessSkillResolution.test.ts"),
    '    assert.equal(snapshot.resolution?.stage,"complete");assert.deepEqual(snapshot.resolution?.authoritativeDice,[4,10]);assert.equal(snapshot.resolution?.rollTotal,failedTotal!+10);assert.equal(snapshot.resolution?.checkOutcome,"성공");',
    '    assert.equal(snapshot.resolution?.stage,"complete");assert.deepEqual(snapshot.resolution?.authoritativeDice,[4]);assert.equal(snapshot.resolution?.provenance.some((entry)=>entry.includes(FEATURE_ID)),true);assert.equal(snapshot.resolution?.rollTotal,failedTotal!+10);assert.equal(snapshot.resolution?.checkOutcome,"성공");',
    "connected Peerless success generic dice evidence",
)

patch(
    Path("tests/ui/connectedProjectedCharacterPeerlessSkillResolution.test.ts"),
    '    assert.deepEqual(snapshot.resolution?.authoritativeDice,[4,3]);assert.equal(snapshot.resolution?.rollTotal,failedTotal!+3);assert.equal(snapshot.resolution?.checkOutcome,"실패");',
    '    assert.deepEqual(snapshot.resolution?.authoritativeDice,[4]);assert.equal(snapshot.resolution?.provenance.some((entry)=>entry.includes(FEATURE_ID)),true);assert.equal(snapshot.resolution?.rollTotal,failedTotal!+3);assert.equal(snapshot.resolution?.checkOutcome,"실패");',
    "connected Peerless no-spend generic dice evidence",
)
