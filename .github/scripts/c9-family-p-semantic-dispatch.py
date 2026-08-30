from pathlib import Path


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding="utf-8")
    if text.count(old) != 1:
        raise SystemExit(f"{path}: expected exactly one patch anchor")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


effect_path = Path("src/domain/commonPlayEffectRuntime.ts")
replace_once(
    effect_path,
    'export type CommonPlayAutomaticEffectEvent=AutomaticDamageEvent|"attack.hit"|"attack.miss"|"save.success"|"save.failure";',
    'export type CommonPlayAutomaticEffectEvent=AutomaticDamageEvent|"attack.hit"|"attack.miss"|"save.success"|"save.failure"|"state.applied"|"rest.short.complete"|"rest.long.complete"|"resource.recharge.success"|"resource.recharge.failure";',
)
replace_once(
    effect_path,
    'if (!["damage.taken","damage.dealt","attack.hit","attack.miss","save.success","save.failure"].includes(rule.event)) throw new Error(`${label} event is unsupported in this runtime slice`);',
    'if (!["damage.taken","damage.dealt","attack.hit","attack.miss","save.success","save.failure","state.applied","rest.short.complete","rest.long.complete","resource.recharge.success","resource.recharge.failure"].includes(rule.event)) throw new Error(`${label} event is unsupported in this runtime slice`);',
)

semantic_path = Path("src/domain/commonPlaySemanticEventRuntime.ts")
semantic = semantic_path.read_text(encoding="utf-8")
needle = '  return operations.length===pending.operations.length?pending:{...pending,operations};\n}\n\nfunction lifecycleSemanticEvent'
if semantic.count(needle) != 1:
    raise SystemExit("semantic trigger insertion anchor changed")
insertion = '''  for(const [semanticIndex,operation] of pending.operations.entries()) {
    const contexts:Array<{
      event:CommonPlayAutomaticEffectEvent;
      subjectId:string;
      actorId:string;
      targetId?:string;
      when?:ResolutionOperation["when"];
    }>=[];
    if(operation.kind==="apply-effect") {
      contexts.push({
        event:"state.applied",
        subjectId:operation.effect.targetId,
        actorId:operation.effect.sourceActorId??pending.actorId,
        targetId:operation.effect.targetId,
        when:operation.when,
      });
    } else if(operation.kind==="short-rest"||operation.kind==="long-rest") {
      contexts.push({
        event:operation.kind==="short-rest"?"rest.short.complete":"rest.long.complete",
        subjectId:operation.targetId,
        actorId:operation.targetId,
        targetId:operation.targetId,
        when:operation.when,
      });
    } else if(operation.kind==="recharge-resource") {
      const actorId=operation.actorId??pending.actorId;
      contexts.push(
        {event:"resource.recharge.success",subjectId:actorId,actorId,targetId:actorId,when:{operationId:operation.id,field:"success",equals:true}},
        {event:"resource.recharge.failure",subjectId:actorId,actorId,targetId:actorId,when:{operationId:operation.id,field:"success",equals:false}},
      );
    }
    for(const context of contexts) {
      if(!creatureKinds[context.subjectId]) continue;
      for(const [definitionIndex,definition] of definitions.entries()) {
        for(const [effectIndex,effect] of state.effects.filter((candidate)=>candidate.targetId===context.subjectId&&candidate.sourceId===definition.id&&candidate.metadata?.[EFFECT_METADATA_DEFINITION]===definition.id).entries()) {
          const templateId=effect.metadata?.[EFFECT_METADATA_TEMPLATE];
          if(typeof templateId!=="string") continue;
          const template=definition.artifactTemplates.find((candidate)=>candidate.id===templateId);
          if(!template) continue;
          for(const [ruleIndex,rule] of template.rules.filter((candidate)=>candidate.event===context.event).entries()) {
            const frequency=resolveCommonPlayFrequency({ruleId:rule.id,subjectId:context.subjectId,frequency:rule.frequency??"once",resolutionId:pending.id,clock:state.clock,markers:effect.metadata??{}});
            if(!frequency.eligible) continue;
            for(const [operationIndex,triggered] of rule.operations.entries()) {
              const targetId=triggered.target==="event.target"?context.targetId:context.actorId;
              if(!targetId) continue;
              const targetCreatureKind=creatureKinds[targetId];
              if(!targetCreatureKind) continue;
              operations.push({
                id:`${pending.id}:automatic:${context.event}:${definitionIndex}:${effectIndex}:${semanticIndex}:${ruleIndex}:${operationIndex}`,
                kind:"damage",targetId,damageType:triggered.damageType,amount:triggered.amount.value,creatureKind:targetCreatureKind,
                ...(context.when?{when:context.when}:{}),
              });
            }
            if(template.lifetime.kind==="until-duration"&&Object.keys(frequency.metadataPatch).length) operations.push({
              id:`${pending.id}:automatic:${context.event}:${definitionIndex}:${effectIndex}:${semanticIndex}:${ruleIndex}:frequency`,
              kind:"update-effect",effectId:effect.id,metadataPatch:frequency.metadataPatch,
              ...(context.when?{when:context.when}:{}),
            });
          }
        }
      }
    }
  }
  return operations.length===pending.operations.length?pending:{...pending,operations};
}

function lifecycleSemanticEvent'''
semantic_path.write_text(semantic.replace(needle, insertion, 1), encoding="utf-8")

test_path = Path("tests/domain/commonPlaySemanticEventRuntime.test.ts")
tests = test_path.read_text(encoding="utf-8")
marker = "Common Play dispatches state, rest, and recharge semantic effect rules in the same resolution"
if marker in tests:
    raise SystemExit("semantic dispatch regression test already exists")
tests += r'''

test("Common Play dispatches state, rest, and recharge semantic effect rules in the same resolution",()=>{
  const definition:CommonPlayPersistentEffectDefinition={
    schemaVersion:"0.2-draft",id:"external.unknown.lifecycle-trigger-ward",
    entryPoints:[{id:"activate",invocation:"manual",operations:[{kind:"effect.apply",template:"ward",target:"actor"}]}],
    artifactTemplates:[{id:"ward",artifactKind:"effect",duration:{kind:"durable"},rules:[
      {id:"state-rule",event:"state.applied",frequency:"once-per-resolution",operations:[{kind:"damage.apply",amount:{value:1},damageType:"force",target:"event.target"}]},
      {id:"rest-rule",event:"rest.short.complete",frequency:"once-per-resolution",operations:[{kind:"damage.apply",amount:{value:2},damageType:"psychic",target:"event.actor"}]},
      {id:"recharge-rule",event:"resource.recharge.success",frequency:"once-per-resolution",operations:[{kind:"damage.apply",amount:{value:4},damageType:"radiant",target:"event.actor"}]},
    ],lifetime:{kind:"until-duration",onEnd:"destroy"}}],
  };
  let state=runtimeState();
  const activated=resolveCommonPlayEffectActivation(TEST_PROFILE,state,definition,{resolutionId:"lifecycle-trigger-ward",actorId:"hero",entryPointId:"activate"});
  assert.equal(activated.status,"committed"); if(activated.status!=="committed") return; state=activated.state;
  const request:PendingResolution={
    id:"semantic-lifecycle-trigger-dispatch",actorId:"hero",sourceId:"external.unseen.lifecycle-source",expectedRevision:state.revision,
    operations:[
      {id:"apply-state",kind:"apply-effect",effect:{id:"foreign-state",sourceId:"external.foreign-state",sourceActorId:"hero",targetId:"hero",kind:"marker",duration:{kind:"permanent"}}},
      {id:"short-rest",kind:"short-rest",targetId:"hero",spends:[]},
      {id:"recharge",kind:"recharge-resource",actorId:"hero",resourceId:"short-resource",timing:"turn-start",die:{sides:6,faces:[6]},succeedsOn:{minimum:5}},
    ],
  };
  const expanded=appendCommonPlaySemanticOutcomeTriggers(state,[definition],request,{hero:"character",goblin:"monster"});
  const resolved=appendCommonPlaySemanticOutcomeEvents(expanded,resolvePendingResolution(TEST_PROFILE,state,expanded));
  assert.equal(resolved.status,"committed"); if(resolved.status!=="committed") return;
  assert.equal(resolved.state.combatants.hero.life.hp.current,13);
  assert.equal(resolved.events.some((event)=>event.kind==="state.applied"),true);
  assert.equal(resolved.events.some((event)=>event.kind==="rest.short.complete"),true);
  assert.equal(resolved.events.some((event)=>event.kind==="resource.recharge.success"),true);
  assert.equal(Object.keys(resolved.results).some((id)=>id.includes("automatic:state.applied")),true);
  assert.equal(Object.keys(resolved.results).some((id)=>id.includes("automatic:rest.short.complete")),true);
  assert.equal(Object.keys(resolved.results).some((id)=>id.includes("automatic:resource.recharge.success")),true);
});
'''
test_path.write_text(tests, encoding="utf-8")
