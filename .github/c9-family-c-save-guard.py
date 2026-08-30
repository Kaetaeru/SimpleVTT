from pathlib import Path

path = Path("src/domain/commonPlayRuntime.ts")
text = path.read_text(encoding="utf-8")
old = '    if(intercepted.kind!=="d20"||(intercepted.request.family!=="ability-check"&&intercepted.request.family!=="attack-roll")) {\n'
new = '    if(intercepted.kind!=="d20"||(intercepted.request.family!=="ability-check"&&intercepted.request.family!=="saving-throw"&&intercepted.request.family!=="attack-roll")) {\n'
if text.count(old) != 1:
    raise SystemExit(f"expected one acceptedPending d20 family guard, found {text.count(old)}")
path.write_text(text.replace(old, new, 1), encoding="utf-8")
