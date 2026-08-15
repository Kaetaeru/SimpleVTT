import "./phase09RealResolutionAdapter";
import type {
  ActionVm,
  ActivityEntry,
  AppSnapshot,
  CharacterSheet,
  CharacterSummary,
  ResolutionView,
  SceneEntity,
  SessionMode,
} from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { resolveItemCostTransaction } from "./realItemCostService";

interface Phase09ItemAdapterState {
  entity(id:string):SceneEntity|undefined;
  syncChar():void;
  resolution:ResolutionView|null;
  scene:AppSnapshot["scene"];
  activeCharacter:CharacterSheet;
  characters:CharacterSummary[];
  sessionMode:SessionMode;
  activity:ActivityEntry[];
  before:{ scene:AppSnapshot["scene"]; activeCharacter:CharacterSheet; characters:CharacterSummary[] }|null;
  lastBefore:{ scene:AppSnapshot["scene"]; activeCharacter:CharacterSheet; characters:CharacterSummary[] }|null;
  lastResolutionId:string|null;
}

const prototype = MockAdapter.prototype as unknown as { commit(action:ActionVm):void };
const previousCommit = prototype.commit;

function reject(internal:Phase09ItemAdapterState,error:string) {
  const resolution = internal.resolution;
  if (!resolution) return;
  if (internal.before) {
    internal.scene = structuredClone(internal.before.scene);
    internal.activeCharacter = structuredClone(internal.before.activeCharacter);
    internal.characters = structuredClone(internal.before.characters);
  }
  resolution.stateChanges = [];
  resolution.detail.push(`아이템 비용 transaction 거부: ${error}`);
  resolution.finalOutcome = `적용 거부: ${error}`;
  resolution.stage = "complete";
  resolution.canAdvance = false;
  resolution.nextLabel = undefined;
  internal.before = null;
}

prototype.commit = function commitWithRealItemCosts(action:ActionVm) {
  if (!action.itemCost) return previousCommit.call(this,action);
  const internal = this as unknown as Phase09ItemAdapterState;
  const resolution = internal.resolution;
  const actor = internal.entity(action.actorId);
  const economy = internal.scene.economyByActor[action.actorId];
  if (!resolution || !actor || !economy || actor.id !== internal.activeCharacter.id) {
    return previousCommit.call(this,action);
  }

  const costs = resolveItemCostTransaction({
    resolutionId:resolution.id,
    action,
    actor,
    economy,
    items:internal.activeCharacter.items,
    initiativeMode:internal.sessionMode === "initiative",
  });
  if (costs.status === "rejected") {
    reject(internal,costs.error);
    return;
  }

  internal.scene.economyByActor[action.actorId] = { ...costs.economy };
  internal.activeCharacter.items = structuredClone(costs.items);
  resolution.stateChanges.push(...costs.stateChanges);
  resolution.provenance.push(...costs.provenance);
  resolution.stage = "complete";
  resolution.canAdvance = false;
  resolution.nextLabel = undefined;
  internal.syncChar();

  internal.activity.unshift({
    id:resolution.id,
    time:"지금",
    actor:internal.entity(resolution.actorId)?.name ?? resolution.actorId,
    title:`${resolution.actionName} → ${resolution.targetIds.map((id) => internal.entity(id)?.name ?? id).join(", ") || "—"}`,
    summary:resolution.compact,
    detail:[...resolution.detail,...resolution.provenance.map((entry) => `출처: ${entry}`)],
    stateChanges:structuredClone(resolution.stateChanges),
  });
  internal.lastBefore = internal.before ? structuredClone(internal.before) : null;
  internal.lastResolutionId = resolution.id;
  internal.before = null;
};
