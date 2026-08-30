import type { AppSnapshot, SceneVm } from "./contracts";
import { catalogQualifiedId } from "./contentCatalogIdentity";
import { requiredSessionInstalledContent } from "./installedContentRuntimeAdapter";
import { parseInstalledCommonPlayActionId, parseRuntimeArtifactCommonPlayActionId } from "./installedCommonPlayActionReference";
import { MockAdapter } from "./mockAdapter";
import { snapshotAdapterTurnRuntimeState } from "./turnRuntimeSessionRegistry";
import { resolveCommonPlaySelector, type CommonPlaySelector, type CommonPlaySelectorCandidate } from "../domain/commonPlaySelectorRuntime";

interface AdapterState {
  scene:SceneVm;
  activeCharacter:{id:string};
  getSnapshot():Promise<AppSnapshot>;
}

const previousResolveAction=MockAdapter.prototype.resolveAction;

function richTargetSelector(value:unknown):CommonPlaySelector|undefined {
  if(!value||typeof value!=="object"||Array.isArray(value)) return undefined;
  const selector=value as CommonPlaySelector&Record<string,unknown>;
  if(selector.from!=="targets") return undefined;
  return selector.where!==undefined||selector.orderBy!==undefined||selector.area!==undefined?selector:undefined;
}

async function installedSelector(adapter:MockAdapter,actionId:string) {
  const runtimeReference=parseRuntimeArtifactCommonPlayActionId(actionId);
  const definitionActionId=runtimeReference?.definitionActionId??actionId;
  const reference=parseInstalledCommonPlayActionId(definitionActionId);
  if(!reference) return undefined;
  const entries=await requiredSessionInstalledContent(adapter,[]);
  const entry=entries.find((candidate)=>catalogQualifiedId(candidate.contentId,candidate.sourceId,candidate.version)===reference.catalogId);
  const mechanic=entry?.mechanics?.find((candidate)=>candidate.kind==="common-play"&&candidate.config.id===reference.mechanicId);
  const point=mechanic?.config.entryPoints?.find((candidate)=>candidate.id===reference.entryPointId);
  return point?{selector:richTargetSelector(point.targeting),actorId:runtimeReference?.actorId}:undefined;
}

function candidate(actor:SceneVm["entities"][number],target:SceneVm["entities"][number]):CommonPlaySelectorCandidate {
  const relation=target.id===actor.id?"self":target.side===actor.side?"ally":"enemy";
  return {
    id:target.id,
    targeting:{id:target.id,kind:"creature",relation},
    properties:{
      relation,
      name:target.name,
      side:target.side,
      kind:target.kind,
      hp:target.hp,
      maxHp:target.maxHp,
      tempHp:target.tempHp,
      ac:target.ac,
      initiative:target.initiative,
      status:[...target.status],
      resistances:[...target.resistances],
      immunities:[...target.immunities],
      vulnerabilities:[...target.vulnerabilities],
    },
  };
}

MockAdapter.prototype.resolveAction=async function resolveInstalledCommonPlayRichSelector(actionId:string,targetIds:string[]) {
  const found=await installedSelector(this,actionId);
  if(!found?.selector) return previousResolveAction.call(this,actionId,targetIds);
  const internal=this as unknown as AdapterState;
  const state=snapshotAdapterTurnRuntimeState(this,internal.scene);
  const actorId=found.actorId??internal.activeCharacter.id;
  const actor=internal.scene.entities.find((entity)=>entity.id===actorId);
  if(!state||!actor||!state.combatants[actorId]) return previousResolveAction.call(this,actionId,targetIds);
  const selection=resolveCommonPlaySelector({
    sourceId:actorId,
    selector:found.selector,
    candidates:internal.scene.entities.filter((entity)=>state.combatants[entity.id]).map((entity)=>candidate(actor,entity)),
    selectedIds:targetIds,
    selection:"manual",
    authority:"host",
    directTarget:false,
  });
  if(selection.status!=="resolved") return internal.getSnapshot();
  return previousResolveAction.call(this,actionId,targetIds);
};
