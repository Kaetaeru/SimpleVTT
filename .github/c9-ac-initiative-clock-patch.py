from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if new in text:
        return
    if old not in text:
        raise SystemExit(f"expected patch anchor missing in {path}")
    file.write_text(text.replace(old, new, 1))


replace_once(
    "src/domain/effects.ts",
    "  elapsedSeconds: number;\n  activeActorId?: string;",
    "  elapsedSeconds: number;\n  initiativeCount?: number;\n  activeActorId?: string;",
)

replace_once(
    "src/domain/resolutionTypes.ts",
    "  | (OperationBase & {\n      kind: \"end-turn\";\n      actorId: string;\n      round: number;\n    })\n  | (OperationBase & {\n      kind: \"advance-time\";",
    "  | (OperationBase & {\n      kind: \"end-turn\";\n      actorId: string;\n      round: number;\n    })\n  | (OperationBase & {\n      kind: \"set-initiative-count\";\n      count: number;\n    })\n  | (OperationBase & {\n      kind: \"advance-time\";",
)

replace_once(
    "src/domain/resolutionTurnOps.ts",
    "type AdvanceTimeOp = Extract<ResolutionOperation, { kind:\"advance-time\" }>;",
    "type AdvanceTimeOp = Extract<ResolutionOperation, { kind:\"advance-time\" }>;\ntype SetInitiativeCountOp = Extract<ResolutionOperation, { kind:\"set-initiative-count\" }>;",
)

replace_once(
    "src/domain/resolutionTurnOps.ts",
    "export function executeAdvanceTime(ctx:ResolutionExecutionContext, operation:AdvanceTimeOp):OperationExecution {",
    '''export function executeSetInitiativeCount(ctx:ResolutionExecutionContext, operation:SetInitiativeCountOp):OperationExecution {
  if(!Number.isInteger(operation.count)||operation.count<0) throw new DomainEvaluationError("initiative count must be a non-negative integer");
  const clockBefore=structuredClone(ctx.state.clock);
  ctx.state.clock={...ctx.state.clock,initiativeCount:operation.count};
  const provenance:ProvenanceRecord[]=[{source:"initiative:count",status:"applied",reason:`initiative count advanced to ${operation.count}`}];
  const changes:RuntimeStateChange[]=[turnClockStateChange(clockBefore,ctx.state.clock,provenance)];
  const result={initiativeCount:operation.count};
  return {
    result,
    event:makeEvent(ctx.pending,operation,`initiative count advanced to ${operation.count}`,result,provenance,changes),
  };
}

export function executeAdvanceTime(ctx:ResolutionExecutionContext, operation:AdvanceTimeOp):OperationExecution {''',
)

replace_once(
    "src/domain/resolution.ts",
    'import { executeAdvanceTime, executeBeginTurn, executeEndTurn } from "./resolutionTurnOps";',
    'import { executeAdvanceTime, executeBeginTurn, executeEndTurn, executeSetInitiativeCount } from "./resolutionTurnOps";',
)
replace_once(
    "src/domain/resolution.ts",
    '    case "end-turn": return executeEndTurn(ctx, operation);\n    case "advance-time": return executeAdvanceTime(ctx, operation);',
    '    case "end-turn": return executeEndTurn(ctx, operation);\n    case "set-initiative-count": return executeSetInitiativeCount(ctx, operation);\n    case "advance-time": return executeAdvanceTime(ctx, operation);',
)

replace_once(
    "src/domain/commonPlaySpecialTimingRuntime.ts",
    '  if(request.requesterActorId!==definition.ownerActorId)throw new DomainEvaluationError("only the special action owner can invoke it");\n  if(!eligible(definition,request.event))throw new DomainEvaluationError("special action is outside its eligible timing window");',
    '  if(request.requesterActorId!==definition.ownerActorId)throw new DomainEvaluationError("only the special action owner can invoke it");\n  if(request.event.kind==="initiative-count"&&state.clock.initiativeCount!==request.event.initiativeCount)throw new DomainEvaluationError("initiative-count event must match the authoritative runtime clock");\n  if(!eligible(definition,request.event))throw new DomainEvaluationError("special action is outside its eligible timing window");',
)

replace_once(
    "tests/domain/commonPlayC6Runtime.test.ts",
    'test("portable special timing authoring binds owner at runtime and validates option entry points",()=>{',
    '''test("initiative-count timing is sourced from the authoritative Resolver clock",()=>{
  const runtime=state();
  const definition={id:"external.lair",ownerActorId:"dragon",timing:{kind:"initiative-count" as const,count:20},options:[{id:"pulse",cost:0,operations:[]}]};
  assert.throws(()=>compileCommonPlaySpecialAction(runtime,definition,{resolutionId:"forged",requesterActorId:"dragon",optionId:"pulse",event:{kind:"initiative-count",initiativeCount:20}}),/authoritative runtime clock/);
  const advanced=resolvePendingResolution(profile,runtime,{id:"initiative-20",actorId:"dragon",sourceId:"session.initiative",expectedRevision:0,operations:[{id:"count",kind:"set-initiative-count",count:20}]});
  assert.equal(advanced.status,"committed");
  if(advanced.status!=="committed")return;
  assert.equal(advanced.state.clock.initiativeCount,20);
  const clockChange=advanced.events[0].stateChanges.find((change)=>change.kind==="turn-clock");
  assert.equal(clockChange?.kind,"turn-clock");
  if(clockChange?.kind==="turn-clock") {
    assert.equal(clockChange.before.initiativeCount,undefined);
    assert.equal(clockChange.after.initiativeCount,20);
  }
  const pending=compileCommonPlaySpecialAction(advanced.state,definition,{resolutionId:"lair-20",requesterActorId:"dragon",optionId:"pulse",event:{kind:"initiative-count",initiativeCount:20}});
  assert.equal(resolvePendingResolution(profile,advanced.state,pending).status,"committed");
  assert.throws(()=>compileCommonPlaySpecialAction(advanced.state,definition,{resolutionId:"wrong-count",requesterActorId:"dragon",optionId:"pulse",event:{kind:"initiative-count",initiativeCount:19}}),/authoritative runtime clock/);
  const invalid=resolvePendingResolution(profile,runtime,{id:"initiative-invalid",actorId:"dragon",sourceId:"session.initiative",expectedRevision:0,operations:[{id:"count",kind:"set-initiative-count",count:-1}]});
  assert.equal(invalid.status,"rejected");
});

test("portable special timing authoring binds owner at runtime and validates option entry points",()=>{''',
)
