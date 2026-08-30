from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if text.count(old) != 1:
        raise SystemExit(f"{label} anchor mismatch")
    return text.replace(old, new, 1)


damage = Path("src/domain/damage.ts")
text = damage.read_text(encoding="utf-8")
anchor = '''export interface DamageAdjustment {
  source: string;
  operation: DamageAdjustmentOperation;
  value: number;
}
'''
addition = '''export interface DamageReductionContribution {
  source: string;
  amount: number;
}

export interface DamageThresholdContribution {
  source: string;
  threshold: number;
}
'''
if addition not in text:
    if text.count(anchor) != 1:
        raise SystemExit("damage contribution anchor mismatch")
    text = text.replace(anchor, anchor + "\n" + addition, 1)
text = replace_once(
    text,
    '''export interface DamageComponentRequest {
  damageType: string;
  amount: number;
  adjustments?: DamageAdjustment[];
  defenses?: DamageDefenseContribution[];
}
''',
    '''export interface DamageComponentRequest {
  damageType: string;
  amount: number;
  adjustments?: DamageAdjustment[];
  defenses?: DamageDefenseContribution[];
  reductions?: DamageReductionContribution[];
  thresholds?: DamageThresholdContribution[];
}
''',
    "damage request",
)
text = replace_once(
    text,
    '''export interface CompoundDamageRequest {
  hp: HpState;
  components: DamageComponentRequest[];
}
''',
    '''export interface CompoundDamageRequest {
  hp: HpState;
  components: DamageComponentRequest[];
  reductions?: DamageReductionContribution[];
  thresholds?: DamageThresholdContribution[];
}
''',
    "compound request",
)
anchor = '''function appliesToType(contribution: DamageDefenseContribution, damageType: string) {
  return contribution.damageType === damageType || contribution.damageType === "*";
}
'''
addition = '''
function applyFinalDamageMitigation(
  amount:number,
  reductions:DamageReductionContribution[]|undefined,
  thresholds:DamageThresholdContribution[]|undefined,
  provenance:ProvenanceRecord[],
) {
  let adjusted=amount;
  for (const reduction of reductions ?? []) {
    requireNonNegativeInteger(reduction.amount, `damage reduction from ${reduction.source}`);
    const before=adjusted;
    adjusted=Math.max(0,adjusted-reduction.amount);
    provenance.push({
      source:reduction.source,
      status:before!==adjusted ? "applied" : "suppressed",
      reason:before!==adjusted
        ? `Damage reduction ${before} -> ${adjusted}`
        : `Damage reduction ${reduction.amount} had no remaining damage to reduce`,
    });
  }
  for (const threshold of thresholds ?? []) {
    requireNonNegativeInteger(threshold.threshold, `damage threshold from ${threshold.source}`);
    const before=adjusted;
    if (adjusted>0 && adjusted<threshold.threshold) {
      adjusted=0;
      provenance.push({source:threshold.source,status:"applied",reason:`Damage ${before} is below threshold ${threshold.threshold}; damage becomes 0`});
    } else {
      provenance.push({
        source:threshold.source,
        status:"suppressed",
        reason:adjusted===0
          ? `Damage threshold ${threshold.threshold} had no remaining damage to test`
          : `Damage ${adjusted} meets threshold ${threshold.threshold}`,
      });
    }
  }
  return adjusted;
}
'''
if "function applyFinalDamageMitigation(" not in text:
    if text.count(anchor) != 1:
        raise SystemExit("damage mitigation helper anchor mismatch")
    text = text.replace(anchor, anchor + addition, 1)
old = '''  if (immunity.length > 0) {
    const before = adjusted;
    adjusted = 0;
    immunity.forEach((entry, index) => provenance.push({
      source: entry.source,
      status: index === 0 ? "applied" : "suppressed",
      reason: index === 0
        ? `Immunity ${before} -> 0`
        : "duplicate Immunity has no additional effect",
    }));
  }

  requireNonNegativeInteger(adjusted, "final damage");
'''
new = old.replace(
    '\n\n  requireNonNegativeInteger(adjusted, "final damage");',
    '\n\n  adjusted=applyFinalDamageMitigation(adjusted,request.reductions,request.thresholds,provenance);\n  requireNonNegativeInteger(adjusted, "final damage");',
)
text = replace_once(text, old, new, "single damage mitigation")
text = replace_once(
    text,
    '''  const finalDamage = components.reduce((sum, component) => sum + component.finalDamage, 0);
  const provenance = components.flatMap((component) => component.provenance.map((entry) => ({
    ...entry,
    reason:`${component.damageType}: ${entry.reason}`,
  })));
  const hp = applyDamageToHp(request.hp, finalDamage, provenance);
''',
    '''  let finalDamage = components.reduce((sum, component) => sum + component.finalDamage, 0);
  const provenance = components.flatMap((component) => component.provenance.map((entry) => ({
    ...entry,
    reason:`${component.damageType}: ${entry.reason}`,
  })));
  finalDamage=applyFinalDamageMitigation(finalDamage,request.reductions,request.thresholds,provenance);
  const hp = applyDamageToHp(request.hp, finalDamage, provenance);
''',
    "compound damage mitigation",
)
damage.write_text(text, encoding="utf-8")

health = Path("src/domain/resolutionHealthOps.ts")
text = health.read_text(encoding="utf-8")
text = replace_once(
    text,
    'import { resolveCompoundDamage, resolveDamage, resolveHealing, type DamageDefenseContribution, type DamageResolution } from "./damage";',
    'import { resolveCompoundDamage, resolveDamage, resolveHealing, type DamageDefenseContribution, type DamageReductionContribution, type DamageResolution, type DamageThresholdContribution } from "./damage";',
    "health damage import",
)
text = replace_once(
    text,
    'import { terminateEffectsForCreatureState, terminateEffectsForDamage } from "./effects";',
    'import { resolveEffectModifiedProperty, terminateEffectsForCreatureState, terminateEffectsForDamage } from "./effects";',
    "health effects import",
)
anchor = '''function effectDamageDefenses(ctx:ResolutionExecutionContext,targetId:string):DamageDefenseContribution[] {
  const defenses:DamageDefenseContribution[] = [];
  for (const effect of ctx.state.effects.filter((entry) => entry.targetId === targetId)) {
    for (const tag of effect.tags) {
      const match = /^(damage-resistance|damage-vulnerability|damage-immunity):(.+)$/.exec(tag);
      if (!match) continue;
      const kind = match[1] === "damage-resistance"
        ? "resistance"
        : match[1] === "damage-vulnerability"
          ? "vulnerability"
          : "immunity";
      defenses.push({ source:effect.sourceId, kind, damageType:match[2] });
    }
  }
  return defenses;
}
'''
addition = '''
function structuralDamageMitigation(ctx:ResolutionExecutionContext,targetId:string) {
  const target=requireCombatant(ctx.state,targetId);
  const inputs={...(target.baseProperties ?? {})};
  const resolve=(property:string)=>resolveEffectModifiedProperty(ctx.state.effects,targetId,property,{...inputs,[property]:inputs[property] ?? 0});
  const reduction=resolve("damage.reduction");
  const threshold=resolve("damage.threshold");
  for (const entry of [reduction,threshold]) {
    if(!Number.isInteger(entry.value)||entry.value<0) throw new DomainEvaluationError(`${entry.property} must resolve to a non-negative integer`);
  }
  const reductions:DamageReductionContribution[]=reduction.value>0 ? [{source:"property:damage.reduction",amount:reduction.value}] : [];
  const thresholds:DamageThresholdContribution[]=threshold.value>0 ? [{source:"property:damage.threshold",threshold:threshold.value}] : [];
  return {reductions,thresholds,provenance:[...reduction.provenance,...threshold.provenance]};
}
'''
if "function structuralDamageMitigation(" not in text:
    if text.count(anchor) != 1:
        raise SystemExit("health mitigation helper anchor mismatch")
    text = text.replace(anchor, anchor + addition, 1)
text = replace_once(
    text,
    '  const damage = resolveDamage({ damageType:operation.damageType, amount, hp:beforeHp, adjustments:operation.adjustments, defenses });\n  return finalizeDamage(\n',
    '  const mitigation=structuralDamageMitigation(ctx,operation.targetId);\n  const damage = resolveDamage({ damageType:operation.damageType, amount, hp:beforeHp, adjustments:operation.adjustments, defenses, reductions:mitigation.reductions, thresholds:mitigation.thresholds });\n  damage.provenance.unshift(...mitigation.provenance);\n  return finalizeDamage(\n',
    "executeDamage",
)
text = replace_once(
    text,
    '''  const damage = resolveCompoundDamage({
    hp:beforeHp,
    components:operation.components.map((component) => ({
      damageType:component.damageType,
      amount:valueFromResult(ctx.results, component.amount),
      adjustments:component.adjustments,
      defenses:[...commonDefenses, ...(component.defenses ?? [])],
    })),
  });
''',
    '''  const mitigation=structuralDamageMitigation(ctx,operation.targetId);
  const damage = resolveCompoundDamage({
    hp:beforeHp,
    components:operation.components.map((component) => ({
      damageType:component.damageType,
      amount:valueFromResult(ctx.results, component.amount),
      adjustments:component.adjustments,
      defenses:[...commonDefenses, ...(component.defenses ?? [])],
    })),
    reductions:mitigation.reductions,
    thresholds:mitigation.thresholds,
  });
  damage.provenance.unshift(...mitigation.provenance);
''',
    "executeCompoundDamage",
)
health.write_text(text, encoding="utf-8")

test_path = Path("tests/ui/c9FamilyLDamageDefenseProduction.test.ts")
tests = test_path.read_text(encoding="utf-8")
marker = "unknown installed damage.apply consumes portable structural damage reduction and threshold"
if marker not in tests:
    tests += r'''

function mitigationPackage(prefix:string,property:"damage.reduction"|"damage.threshold",value:number) {
  const moduleId=`${prefix}.module`,contentId=`${prefix}.option`,mechanicId=`${prefix}.damage`;
  return {moduleId,contentId,mechanicId,json:JSON.stringify({
    schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
    source:{document:"Portable Damage Mitigation Probe",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],content:[{
      id:contentId,category:"option",
      presentation:{defaultLocale:"en",originalName:"Portable Mitigation",locales:{en:{name:"Portable Mitigation"}}},
      mechanics:[{kind:"common-play",config:{schemaVersion:"0.2-draft",id:mechanicId,entryPoints:[
        {id:"mitigate",invocation:"manual",targeting:{from:"targets",min:1,max:1},operations:[{
          kind:"property.modify",property,operation:"add",value:{value},target:"target",owner:"effect",source:"definition",
          duration:{kind:"elapsed",amount:{value:1},unit:"hours"},lifetime:{kind:"until-duration",onEnd:"destroy"},instancePolicy:"stack",
        }]},
        {id:"hit",invocation:"manual",targeting:{from:"targets",min:1,max:1},operations:[{kind:"damage.apply",amount:{value:4},damageType:"fire",target:"target"}]},
      ]}}],
    }],
  })};
}

async function executePortableMitigation(prefix:string,property:"damage.reduction"|"damage.threshold",value:number) {
  const adapter=new MockAdapter();
  const pack=mitigationPackage(prefix,property,value);
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(pack.json);
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  const action=(entryPointId:string)=>installedCommonPlayActionId({catalogId:catalogQualifiedId(pack.contentId,pack.moduleId,"1"),mechanicId:pack.mechanicId,entryPointId});
  let snapshot=await adapter.resolveAction(action("mitigate"),[TARGET_ID]);
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
  const before=hp(snapshot,TARGET_ID);
  snapshot=await adapter.resolveAction(action("hit"),[TARGET_ID]);
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
  const dealt=before-hp(snapshot,TARGET_ID);
  await adapter.undoLastResolution();
  assert.equal(hp(await adapter.getSnapshot(),TARGET_ID),before,"event-native Undo must restore mitigated damage");
  return dealt;
}

test("unknown installed damage.apply consumes portable structural damage reduction and threshold with rename invariance and Undo",async()=>{
  assert.equal(await executePortableMitigation("external.family-l-reduction","damage.reduction",3),1);
  assert.equal(await executePortableMitigation("completely.renamed-family-l-reduction","damage.reduction",3),1);
  assert.equal(await executePortableMitigation("external.family-l-threshold","damage.threshold",5),0);
  assert.equal(await executePortableMitigation("completely.renamed-family-l-threshold","damage.threshold",5),0);
  assert.equal(await executePortableMitigation("external.family-l-threshold-equal","damage.threshold",4),4,"meeting the threshold must preserve full damage");
});
'''
    test_path.write_text(tests, encoding="utf-8")
