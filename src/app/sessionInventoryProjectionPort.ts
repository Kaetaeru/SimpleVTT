import type { SessionCharacterInventoryVm } from "./contracts";
import type { MockAdapter } from "./mockAdapter";

type ProjectionWriter=(adapter:MockAdapter,inventory:SessionCharacterInventoryVm)=>void;

let writer:ProjectionWriter=()=>{};

export function installSessionCharacterInventoryProjectionWriter(next:ProjectionWriter) {
  writer=next;
}

export function refreshSessionCharacterInventoryProjection(adapter:MockAdapter,inventory:SessionCharacterInventoryVm) {
  writer(adapter,inventory);
}
