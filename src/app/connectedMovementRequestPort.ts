import type { ConnectedMovementRequest } from "./connectedSessionProtocol";
import type { MockAdapter } from "./mockAdapter";
import type { SessionTransportMessage } from "./tauriSessionTransport";

/** V1.3 C1-02 — a player's 접근/물러남/그대로 reaches the Host through this port (mirrors the action request port). */
export type ConnectedMovementRequestHandler=(
  adapter:MockAdapter,
  transportMessage:SessionTransportMessage,
  request:ConnectedMovementRequest,
)=>Promise<void>;

let handler:ConnectedMovementRequestHandler|null=null;

export function registerConnectedMovementRequestHandler(next:ConnectedMovementRequestHandler) {
  handler=next;
}

export async function routeConnectedMovementRequest(
  adapter:MockAdapter,
  transportMessage:SessionTransportMessage,
  request:ConnectedMovementRequest,
) {
  if (!handler) return false;
  await handler(adapter,transportMessage,request);
  return true;
}
