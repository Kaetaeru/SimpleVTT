import type { MockAdapter } from "./mockAdapter";
import type { SessionTransportMessage } from "./tauriSessionTransport";
import { activateProjectedCharacterResolutionContext, restoreProjectionResolutionContext } from "./characterSessionProjectionMount";
import { projectedCharacterForPeer } from "./characterSessionProjectionRegistry";

export interface ConnectedInterruptResponse {
  sessionId:string;
  resolutionId:string;
  promptId:string;
  accept:boolean;
}

export type ConnectedInterruptResponseHandler=(
  adapter:MockAdapter,
  transportMessage:SessionTransportMessage,
  response:ConnectedInterruptResponse,
)=>Promise<void>;

let handler:ConnectedInterruptResponseHandler|null=null;

export function registerConnectedInterruptResponseHandler(next:ConnectedInterruptResponseHandler) {
  handler=next;
}

export async function routeConnectedInterruptResponse(
  adapter:MockAdapter,
  transportMessage:SessionTransportMessage,
  response:ConnectedInterruptResponse,
) {
  if(!handler)return false;
  const mounted=projectedCharacterForPeer(adapter,transportMessage.peer);
  if(!mounted){
    await handler(adapter,transportMessage,response);
    return true;
  }
  const activated=activateProjectedCharacterResolutionContext(adapter,transportMessage.peer);
  if(activated.status==="rejected")throw new Error(activated.error);
  try {
    await handler(adapter,transportMessage,response);
  } finally {
    restoreProjectionResolutionContext(adapter,activated.context);
  }
  return true;
}
