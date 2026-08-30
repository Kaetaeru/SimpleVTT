import type { MockAdapter } from "./mockAdapter";
import type { SessionTransportMessage } from "./tauriSessionTransport";
import type { CommonPlaySimultaneousOrderingResponse } from "../domain/commonPlaySimultaneousOrderingRuntime";

export interface ConnectedTurnSimultaneousOrderingResponse {
  sessionId:string;
  response:CommonPlaySimultaneousOrderingResponse;
}

export type ConnectedTurnSimultaneousOrderingResponseHandler=(
  adapter:MockAdapter,
  transportMessage:SessionTransportMessage,
  envelope:ConnectedTurnSimultaneousOrderingResponse,
)=>Promise<void>;

let handler:ConnectedTurnSimultaneousOrderingResponseHandler|null=null;

export function registerConnectedTurnSimultaneousOrderingResponseHandler(next:ConnectedTurnSimultaneousOrderingResponseHandler) {
  handler=next;
}

export async function routeConnectedTurnSimultaneousOrderingResponse(
  adapter:MockAdapter,
  transportMessage:SessionTransportMessage,
  envelope:ConnectedTurnSimultaneousOrderingResponse,
) {
  if(!handler)return false;
  await handler(adapter,transportMessage,envelope);
  return true;
}
