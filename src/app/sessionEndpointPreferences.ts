export interface SessionHostEndpointRequest {
  bindAddress:string;
  port:number;
}

export const DEFAULT_SESSION_PORT=3210;
export const DEFAULT_SESSION_BIND_ADDRESS="0.0.0.0";

let nextHostEndpoint:SessionHostEndpointRequest|null=null;

export function normalizeSessionPort(value:number|string) {
  const port=typeof value==="number"?value:Number(value);
  if (!Number.isInteger(port)||port<1||port>65535) throw new Error("세션 포트는 1~65535 범위의 정수여야 합니다.");
  return port;
}

export function composeSessionEndpoint(address:string,port:number|string) {
  const host=address.trim();
  if (!host) throw new Error("IP 또는 네트워크 인터페이스 주소가 필요합니다.");
  const safePort=normalizeSessionPort(port);
  if (host.startsWith("[")&&host.endsWith("]")) return `${host}:${safePort}`;
  return host.includes(":") ? `[${host}]:${safePort}` : `${host}:${safePort}`;
}

export function configureNextSessionHostEndpoint(request:SessionHostEndpointRequest) {
  nextHostEndpoint={bindAddress:request.bindAddress.trim(),port:normalizeSessionPort(request.port)};
  if (!nextHostEndpoint.bindAddress) throw new Error("Host Bind / Listen IP가 필요합니다.");
  return structuredClone(nextHostEndpoint);
}

export function consumeNextSessionHostEndpoint(fallback:string) {
  const request=nextHostEndpoint;
  nextHostEndpoint=null;
  return request ? composeSessionEndpoint(request.bindAddress,request.port) : fallback;
}

export function clearNextSessionHostEndpointForTests() {
  nextHostEndpoint=null;
}
