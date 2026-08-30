from pathlib import Path

path = Path("tests/ui/installedCommonPlayInterceptorProductionRuntime.test.ts")
text = path.read_text(encoding="utf-8")
old = '''  snapshot=await adapter.advanceResolution();\n  assert.equal(snapshot.resolution?.stage,"save-result",JSON.stringify(snapshot.resolution));\n  assert.equal(snapshot.resolution?.saveResults[0]?.outcome,"실패");\n  snapshot=await adapter.advanceResolution();\n  return snapshot;\n'''
new = '''  snapshot=await adapter.advanceResolution();\n  assert.equal(snapshot.resolution?.stage,"interrupt",JSON.stringify(snapshot.resolution));\n  assert.equal(snapshot.resolution?.saveResults[0]?.outcome,"실패");\n  return snapshot;\n'''
if text.count(old) != 1:
    raise SystemExit("saving-throw helper timing assertion not found")
path.write_text(text.replace(old, new, 1), encoding="utf-8")
