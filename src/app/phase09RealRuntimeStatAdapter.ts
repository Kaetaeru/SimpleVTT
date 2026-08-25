import "./phase09RealTurnRuntimeAdapter";
import type { ActionVm, AppSnapshot, CharacterSheet, CombatantDefinitionVm, ResolutionView, SceneEntity } from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { resolveRuntimeSaveModifier } from "./realRuntimeStatProvider";
import { resolveSavingThrowResolution } from "./realSavingThrowService";
import { projectedCharacterById } from "./characterSessionProjectionRegistry";

interface Phase09RuntimeStatAdapterState {
  action(id:string):ActionVm|undefined;
  entity(id:string):SceneEntity|undefined;
  availability(action:ActionVm):{ available:boolean; reason?:string };
  eligible(action:ActionVm):string[];
  capture():void;
  d20(actionId:string,index?:number):number;
  activeCharacter:CharacterSheet;
  combatantDefinitions:CombatantDefinitionVm[];
  resolution:ResolutionView|null;
  getSnapshot():Promise<AppSnapshot>;
}

const DODGING_STATUS="회피";

function isDexteritySave(action:ActionVm) {
  return ["dex","dexterity","민첩"].includes(String(action.saveAbility??"").toLowerCase());
}

function resolutionId() {
  return `resolution.phase09.runtime-stats.${Date.now()}.${Math.floor(Math.random() * 1000)}`;
}

function rejectMissingRuntimeStat(
  internal:Phase09RuntimeStatAdapterState,
  action:ActionVm,
  targetIds:string[],
  error:string,
) {
  internal.resolution = {
    id:resolutionId(),
    actorId:action.actorId,
    targetIds:[...targetIds],
    actionId:action.id,
    actionName:action.name,
    rollKind:"save",
    stage:"complete",
    authoritativeDice:[],
    saveResults:[],
    damageComponents:[],
    compact:`적용 거부 · ${error}`,
    detail:[`Runtime stat provider 거부: ${error}`],
    provenance:["Phase 09 · runtime Character/Combatant stat provider · explicit reject"],
    calculatedOutcome:"적용 거부",
    finalOutcome:`적용 거부: ${error}`,
    stateChanges:[],
    adjudicated:false,
    canAdvance:false,
  };
}

const previousResolveAction = MockAdapter.prototype.resolveAction;

MockAdapter.prototype.resolveAction = async function resolveActionWithRuntimeSaveStats(actionId:string,targetIds:string[]) {
  const internal = this as unknown as Phase09RuntimeStatAdapterState;
  const action = internal.action(actionId);
  if (!action || action.resolutionKind !== "saving-throw") {
    return previousResolveAction.call(this,actionId,targetIds);
  }

  const availability = internal.availability(action);
  if (!availability.available) return internal.getSnapshot();
  const allowed = new Set(internal.eligible(action));
  if (targetIds.some((id) => !allowed.has(id))) return internal.getSnapshot();
  if (action.target === "multi-enemy" && targetIds.length > (action.maxTargets ?? Number.POSITIVE_INFINITY)) {
    return internal.getSnapshot();
  }

  const ability = action.saveAbility ?? "내성";
  try {
    const targets = targetIds.map((id) => {
      const target = internal.entity(id);
      if (!target) throw new Error(`missing runtime target entity: ${id}`);
      const targetCharacter=id===internal.activeCharacter.id
        ? internal.activeCharacter
        : projectedCharacterById(this,id)?.sheet ?? internal.activeCharacter;
      const stat = resolveRuntimeSaveModifier(target,targetCharacter,ability,internal.combatantDefinitions);
      return {
        id,
        name:target.name,
        modifier:stat.modifier,
        modifierSource:stat.source,
        rollStateContributions:isDexteritySave(action)&&target.status.includes(DODGING_STATUS)
          ? [{ source:`condition:${DODGING_STATUS}:dexterity-save`,state:"advantage" as const }]
          : undefined,
      };
    });
    internal.capture();
    const primaryFaces=targetIds.map((_,index) => internal.d20(action.id,index));
    internal.resolution = resolveSavingThrowResolution({
      resolutionId:resolutionId(),
      action,
      targets,
      diceFaces:primaryFaces,
      diceFacesByTarget:Object.fromEntries(targets.flatMap((target,index)=>target.rollStateContributions?.length
        ? [[target.id,[primaryFaces[index],internal.d20(`${action.id}:dodge-save`,index)]]]
        : [])),
    });
  } catch (error) {
    rejectMissingRuntimeStat(internal,action,targetIds,error instanceof Error ? error.message : String(error));
  }
  return internal.getSnapshot();
};
