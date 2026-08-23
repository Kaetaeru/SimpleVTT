import type { MockAdapter } from "./mockAdapter";
import type { SessionTransportMessage } from "./tauriSessionTransport";
export interface ConnectedConcentrationResponse {sessionId:string;resolutionId:string;face:number;}
type Handler=(adapter:MockAdapter,message:SessionTransportMessage,response:ConnectedConcentrationResponse)=>Promise<void>;
let handler:Handler|null=null;
export const registerConnectedConcentrationResponseHandler=(next:Handler)=>{handler=next;};
export async function routeConnectedConcentrationResponse(adapter:MockAdapter,message:SessionTransportMessage,response:ConnectedConcentrationResponse){if(!handler)return false;await handler(adapter,message,response);return true;}
