import { effectIsActive, type EffectInstance } from "./effects";
import { DomainEvaluationError, evaluateExpression, renderExpression, type PropertyResolution, type ProvenanceRecord, type RulesProfileLike } from "./profileEngine";

export function resolveEffectModifiedProfileProperty(
  profile:RulesProfileLike,
  effects:EffectInstance[],
  targetId:string,
  property:string,
  inputProperties:Record<string,number>,
):PropertyResolution {
  const memo=new Map<string,PropertyResolution>();
  const resolving=new Set<string>();

  const resolve=(propertyId:string):PropertyResolution=>{
    const cached=memo.get(propertyId);
    if(cached) return cached;
    if(resolving.has(propertyId)) throw new DomainEvaluationError(`cyclic property formula or modifier: ${propertyId}`);
    resolving.add(propertyId);
    try {
      const provenance:ProvenanceRecord[]=[];
      const append=(entries:ProvenanceRecord[])=>{
        for(const entry of entries) {
          if(!provenance.some((candidate)=>candidate.source===entry.source&&candidate.status===entry.status&&candidate.reason===entry.reason)) provenance.push(entry);
        }
      };
      const reference=(referenceId:string)=>{
        const dependency=resolve(referenceId);
        append(dependency.provenance);
        return dependency.value;
      };

      let value=inputProperties[propertyId];
      if(!Number.isFinite(value)) {
        const definition=profile.properties[propertyId];
        if(!definition?.formula) throw new DomainEvaluationError(`unresolved property reference: ${propertyId}`);
        value=evaluateExpression(definition.formula,reference);
        const usesDefaultFloor="op" in definition.formula&&definition.formula.op==="floor"&&profile.roundingPolicy?.id;
        provenance.push({
          source:usesDefaultFloor?`profile:${profile.profileId}/${profile.roundingPolicy!.id}`:`profile:${profile.profileId}/property:${propertyId}`,
          status:"applied",
          reason:`${renderExpression(definition.formula,reference)} = ${value}`,
        });
      }

      for(const effect of effects) {
        const modifier=effect.propertyModifier;
        if(effect.targetId!==targetId||!modifier||modifier.property!==propertyId) continue;
        if(!effectIsActive(effect)) {
          provenance.push({source:`effect:${effect.id}`,status:"suppressed",reason:effect.suppression?.reason??"effect suppressed"});
          continue;
        }
        const operand=evaluateExpression(modifier.value,(referenceId)=>referenceId===propertyId?value:reference(referenceId));
        const before=value;
        switch(modifier.operation) {
          case "add": value+=operand; break;
          case "subtract": value-=operand; break;
          case "set": value=operand; break;
          case "min": value=Math.min(value,operand); break;
          case "max": value=Math.max(value,operand); break;
          case "multiply": value*=operand; break;
        }
        if(!Number.isFinite(value)) throw new DomainEvaluationError(`property modifier produced a non-finite ${propertyId}`);
        provenance.push({source:`effect:${effect.id}`,status:"applied",reason:`${modifier.operation} ${operand}: ${before} -> ${value}`});
      }

      const result={property:propertyId,value,provenance};
      memo.set(propertyId,result);
      return result;
    } finally {
      resolving.delete(propertyId);
    }
  };

  return resolve(property);
}
