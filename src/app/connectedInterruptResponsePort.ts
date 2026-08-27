import type { MockAdapter } from "./mockAdapter";
import type { SessionTransportMessage } from "./tauriSessionTransport";

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
  await handler(adapter,transportMessage,response);
  return true;
}
