import type { MockAdapter } from "./mockAdapter";
import { requiredSessionInstalledContent } from "./installedContentRuntimeAdapter";
import type { RulesRuntimeState } from "../domain/combatState";
import { lowerCommonPlay, parseCommonPlayDefinition } from "../domain/commonPlayDefinitionRuntime";
import { compileCommonPlayZoneTurnEventOperations, type CommonPlayZoneDefinition } from "../domain/commonPlayZoneRuntime";
import type { ResolutionOperation } from "../domain/resolutionTypes";

export async function installedCommonPlayZoneDefinitions(adapter:MockAdapter,state:RulesRuntimeState) {
  const activeIds=new Set((state.artifacts??[]).filter((artifact)=>artifact.artifactKind==="zone").map((artifact)=>artifact.sourceId));
  const definitions=new Map<string,CommonPlayZoneDefinition>();
  for(const entry of await requiredSessionInstalledContent(adapter,[])) {
    for(const mechanic of entry.mechanics??[]) {
      if(mechanic.kind!=="common-play"||!activeIds.has(mechanic.config.id)||definitions.has(mechanic.config.id)) continue;
      const canonical=parseCommonPlayDefinition(mechanic.config);
      for(const point of canonical.entryPoints??[]) {
        const lowered=lowerCommonPlay(canonical,point.id);
        if(lowered.kind!=="zone") continue;
        definitions.set(lowered.definition.id,lowered.definition);
        break;
      }
    }
  }
  return definitions;
}

export function compileInstalledCommonPlayZoneTurnOperations(
  state:RulesRuntimeState,
  definitions:Map<string,CommonPlayZoneDefinition>,
  input:{id:string;kind:"zone.turn-start"|"zone.turn-end";actorId:string;subjectCreatureKind:"character"|"monster"},
):ResolutionOperation[] {
  return (state.artifacts??[]).flatMap((artifact,index)=>{
    if(artifact.artifactKind!=="zone") return [];
    const definition=definitions.get(artifact.sourceId);
    if(!definition) return [];
    const compiled=compileCommonPlayZoneTurnEventOperations(state,definition,{
      id:`${input.id}:zone:${index+1}`,kind:input.kind,artifactId:artifact.id,
      subjectId:input.actorId,subjectCreatureKind:input.subjectCreatureKind,
    });
    return compiled.status==="compiled"?compiled.operations:[];
  });
}
