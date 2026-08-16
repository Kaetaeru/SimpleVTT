import type { ConnectedActionRequest } from "./connectedSessionProtocol";
import type { MockAdapter } from "./mockAdapter";
import type { SessionTransportMessage } from "./tauriSessionTransport";

export type ConnectedActionRequestHandler=(
  adapter:MockAdapter,
  transportMessage:SessionTransportMessage,
  request:ConnectedActionRequest,
)=>Promise<void>;

let handler:ConnectedActionRequestHandler|null=null;

export function registerConnectedActionRequestHandler(next:ConnectedActionRequestHandler) {
  handler=next;
}

export async function routeConnectedActionRequest(
  adapter:MockAdapter,
  transportMessage:SessionTransportMessage,
  request:ConnectedActionRequest,
) {
  if (!handler) return false;
  await handler(adapter,transportMessage,request);
  return true;
}
