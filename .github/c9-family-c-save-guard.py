from pathlib import Path

runtime_path = Path("src/domain/commonPlayRuntime.ts")
runtime = runtime_path.read_text(encoding="utf-8")
old_guard = '    if(intercepted.kind!=="d20"||(intercepted.request.family!=="ability-check"&&intercepted.request.family!=="attack-roll")) {\n'
new_guard = '    if(intercepted.kind!=="d20"||(intercepted.request.family!=="ability-check"&&intercepted.request.family!=="saving-throw"&&intercepted.request.family!=="attack-roll")) {\n'
if runtime.count(old_guard) != 1:
    raise SystemExit(f"expected one acceptedPending d20 family guard, found {runtime.count(old_guard)}")
runtime_path.write_text(runtime.replace(old_guard, new_guard, 1), encoding="utf-8")

test_path = Path("tests/ui/installedCommonPlayInterceptorProductionRuntime.test.ts")
test = test_path.read_text(encoding="utf-8")
old_expectation = '    {d20:18,total:20,outcome:"성공"},\n'
new_expectation = '    {d20:18,total:19,outcome:"성공"},\n'
if test.count(old_expectation) != 1:
    raise SystemExit(f"expected one save reroll total expectation, found {test.count(old_expectation)}")
test_path.write_text(test.replace(old_expectation, new_expectation, 1), encoding="utf-8")
