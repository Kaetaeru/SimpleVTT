import type { MockAdapter } from "./mockAdapter";

type Handler=(adapter:MockAdapter)=>Promise<void>;
let handler:Handler=async()=>{};

/** The campaign-systems runtime adapter registers the projection-refresh sender here at import time. */
export function registerConnectedOwnerWriteBackHandler(next:Handler){handler=next;}

/**
 * A connected Client calls this after a Host-confirmed resolution changed its durable Character (HP, resources,
 * items): the owner's library revision moved, and the Host's mounted projection must follow it, or every later
 * owner-revision check (the connected Long Rest offer, for one) rejects the wounded Character.
 */
export function notifyConnectedOwnerWriteBack(adapter:MockAdapter){return handler(adapter);}
