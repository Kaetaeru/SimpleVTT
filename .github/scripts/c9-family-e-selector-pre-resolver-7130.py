from pathlib import Path


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding="utf-8")
    if old in text:
        path.write_text(text.replace(old, new, 1), encoding="utf-8")
        return
    if new not in text:
        raise SystemExit(f"{path}: patch marker missing")


runtime = Path("src/domain/commonPlayOperationRuntime.ts")
replace_once(
    runtime,
    'export interface CommonPlayTargetingSelector extends Omit<CommonPlaySelector,"from"|"min"|"max"|"orderBy"|"area"> {',
    'export interface CommonPlayTargetingSelector extends Omit<CommonPlaySelector,"from"|"min"|"max"|"orderBy"> {',
)
replace_once(
    runtime,
    'const TARGETING_KEYS=new Set(["from","where","min","max"]);',
    'const TARGETING_KEYS=new Set(["from","where","min","max","area"]);',
)
replace_once(
    runtime,
    'return {from:"targets",min:parsed.min,max:parsed.max,...(parsed.where===undefined?{}:{where:parsed.where})};',
    'return {from:"targets",min:parsed.min,max:parsed.max,...(parsed.where===undefined?{}:{where:parsed.where}),...(parsed.area===undefined?{}:{area:parsed.area})};',
)

domain_test = Path("tests/domain/commonPlayTargetingRuntime.test.ts")
lines = domain_test.read_text(encoding="utf-8").splitlines()
lines = [line for line in lines if not ('from:"targets",area:{kind:"instant"}' in line and 'unsupported fields: area' in line)]
domain_test.write_text("\n".join(lines) + "\n", encoding="utf-8")

ui_test = Path("tests/ui/commonPlayRichSelectorProduction.test.ts")
text = ui_test.read_text(encoding="utf-8")
old = '  assert.notEqual((await adapter.getSnapshot()).resolution?.actionId,actionId,"relation predicate must reject self before Resolver execution");'
new = '  const rejected=(await adapter.getSnapshot()).resolution;\n  assert.equal(rejected?.actionId,actionId);\n  assert.equal(rejected?.finalOutcome,"적용 거부","relation predicate must reject self before production commit");'
if old in text:
    text = text.replace(old, new, 1)
elif new not in text:
    raise SystemExit("relation rejection assertion marker missing")
old = '  assert.notEqual((await adapter.getSnapshot()).resolution?.actionId,actionId,"mapless production must not fabricate area membership");'
new = '  const rejected=(await adapter.getSnapshot()).resolution;\n  assert.equal(rejected?.actionId,actionId);\n  assert.equal(rejected?.finalOutcome,"적용 거부","mapless production must not fabricate area membership");'
if old in text:
    text = text.replace(old, new, 1)
elif new not in text:
    raise SystemExit("area rejection assertion marker missing")
ui_test.write_text(text, encoding="utf-8")
