import { parseCommonPlayOperationDefinition, type CommonPlayOperationDefinition } from "../domain/commonPlayOperationRuntime";
import type { InstalledContentMechanicV1 } from "./installedContentContracts";

type Obj=Record<string,unknown>;

function object(value:unknown,label:string):Obj {
  if (!value || typeof value!=="object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Obj;
}
function text(value:unknown,label:string) {
  if (typeof value!=="string" || !value.trim()) throw new Error(`${label} must be a non-empty string`);
  return value.trim();
}
function only(value:Obj,label:string,allowed:readonly string[]) {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Error(`${label}.${key} is unsupported by the installed Common Play runtime`);
}

export function parseSupportedCommonPlayDefinition(value:unknown,label:string):CommonPlayOperationDefinition {
  return parseCommonPlayOperationDefinition(value,label);
}

export function parseInstalledContentMechanics(value:unknown,label:string):InstalledContentMechanicV1[] {
  if (value===undefined) return [];
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value.map((raw,index)=>{
    const mechanicLabel=`${label}[${index}]`;
    const mechanic=object(raw,mechanicLabel);
    only(mechanic,mechanicLabel,["id","kind","config"]);
    if (mechanic.kind!=="common-play") throw new Error(`${label} cannot be activated: unsupported mechanic kind ${String(mechanic.kind)}`);
    const id=mechanic.id===undefined ? undefined : text(mechanic.id,`${mechanicLabel}.id`);
    return {
      ...(id?{id}:{}),
      kind:"common-play" as const,
      config:parseCommonPlayOperationDefinition(mechanic.config,`${mechanicLabel}.config`),
    };
  });
}
