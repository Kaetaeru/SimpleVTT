import {
  parseCommonPlayOperationDefinition,
  type CommonPlayOperationDefinition,
} from "../domain/commonPlayOperationRuntime";

export interface InstalledCommonPlayMechanicV1 {
  kind:"common-play";
  config:CommonPlayOperationDefinition;
}

export type InstalledPortableMechanicV1=InstalledCommonPlayMechanicV1;

type Obj=Record<string,unknown>;
function object(value:unknown,label:string):Obj {
  if(!value||typeof value!=="object"||Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Obj;
}

export function parseInstalledPortableMechanics(value:unknown,label:string):InstalledPortableMechanicV1[] {
  if(value===undefined) return [];
  if(!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value.map((raw,index)=>{
    const mechanic=object(raw,`${label}[${index}]`);
    if(mechanic.kind!=="common-play") {
      throw new Error(`${label}[${index}].kind is unsupported: ${String(mechanic.kind??"<missing>")}`);
    }
    return {
      kind:"common-play",
      config:parseCommonPlayOperationDefinition(mechanic.config,`${label}[${index}].config`),
    };
  });
}
