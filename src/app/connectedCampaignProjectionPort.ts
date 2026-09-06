import type { MockAdapter } from "./mockAdapter";

type Broadcaster=(adapter:MockAdapter)=>Promise<void>;
let broadcaster:Broadcaster=async()=>{};

/** The campaign-systems runtime adapter registers its projection broadcast here at import time. */
export function registerConnectedCampaignProjectionBroadcaster(next:Broadcaster){broadcaster=next;}

/**
 * Host-side writers that bypass the wrapped calendar/ration methods (the connected Long Rest commit writes the
 * Campaign library store directly) push the campaign-systems projection to the players through this port.
 */
export function broadcastConnectedCampaignProjection(adapter:MockAdapter){return broadcaster(adapter);}
