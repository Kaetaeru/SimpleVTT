import type { CharacterResourceVm, SceneVm } from "./contracts";
import type { ConnectedCorrectionChange } from "./connectedSessionProtocol";

export type ConnectedCorrectionApplyResult =
  | { status:"committed"; scene:SceneVm; resources:CharacterResourceVm[]; stateChanges:string[] }
  | { status:"rejected"; error:string };

function sameStrings(left:string[],right:string[]) {
  return left.length===right.length&&left.every((value,index)=>value===right[index]);
}

export function applyConnectedCorrections(
  scene:SceneVm,
  resources:CharacterResourceVm[],
  changes:ConnectedCorrectionChange[],
):ConnectedCorrectionApplyResult {
  const nextScene=structuredClone(scene);
  const nextResources=structuredClone(resources);
  const labels:string[]=[];

  for (const change of changes) {
    if (change.kind==="hp") {
      const target=nextScene.entities.find((entry)=>entry.id===change.targetId);
      if (!target) return {status:"rejected",error:`correction target is missing: ${change.targetId}`};
      if (target.hp!==change.before) return {status:"rejected",error:`correction HP drift for ${change.targetId}: expected ${change.before}, current ${target.hp}`};
      target.hp=change.after;
      labels.push(`${change.targetId} HP ${change.before} → ${change.after}`);
      continue;
    }
    if (change.kind==="status") {
      const target=nextScene.entities.find((entry)=>entry.id===change.targetId);
      if (!target) return {status:"rejected",error:`correction target is missing: ${change.targetId}`};
      if (!sameStrings(target.status,change.before)) return {status:"rejected",error:`correction status drift for ${change.targetId}`};
      target.status=[...change.after];
      labels.push(`${change.targetId} status [${change.before.join(", ")}] → [${change.after.join(", ")}]`);
      continue;
    }
    const resource=nextResources.find((entry)=>entry.id===change.resourceId);
    if (!resource) return {status:"rejected",error:`correction resource is missing: ${change.resourceId}`};
    if (resource.current!==change.before) return {status:"rejected",error:`correction resource drift for ${change.resourceId}: expected ${change.before}, current ${resource.current}`};
    resource.current=change.after;
    labels.push(`${change.targetId} resource.${change.resourceId} ${change.before} → ${change.after}`);
  }

  return {status:"committed",scene:nextScene,resources:nextResources,stateChanges:labels};
}
