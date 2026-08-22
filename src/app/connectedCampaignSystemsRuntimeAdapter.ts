import type { CampaignSessionSystemsProjection } from "./campaignPersistenceContracts";
import { connectedStateFor } from "./connectedSessionState";
import { publishConnectedSnapshot } from "./connectedSessionRuntimeAdapter";
import { MockAdapter } from "./mockAdapter";
import { tauriSessionTransport, type SessionTransportMessage } from "./tauriSessionTransport";

interface CampaignSystemsEnvelope {type:"campaign-systems-projection";sessionId:string;revision:number;projection:CampaignSessionSystemsProjection;}
type Raw=Record<string,unknown>;
const remoteProjections=new WeakMap<MockAdapter,{sessionId:string;revision:number;projection:CampaignSessionSystemsProjection}>();
let activeHostAdapter:MockAdapter|null=null;
let registeringClientAdapter:MockAdapter|null=null;
const baseSendTo=tauriSessionTransport.sendTo.bind(tauriSessionTransport);
const baseOnMessage=tauriSessionTransport.onMessage.bind(tauriSessionTransport);

function object(value:unknown):Raw|undefined{return value&&typeof value==="object"&&!Array.isArray(value)?value as Raw:undefined;}
function safeProjection(projection:CampaignSessionSystemsProjection):CampaignSessionSystemsProjection{
  const copy=structuredClone(projection);
  if(!copy.rations.visibleToPlayers) copy.rations={enabled:copy.rations.enabled,visibleToPlayers:false};
  return copy;
}
export function decodeCampaignSystemsEnvelope(raw:string):CampaignSystemsEnvelope|null{
  let value:unknown;try{value=JSON.parse(raw);}catch{return null;}
  const record=object(value);const projection=object(record?.projection);const calendar=object(projection?.calendar);const rations=object(projection?.rations);
  if(record?.type!=="campaign-systems-projection"||typeof record.sessionId!=="string"||!record.sessionId||!Number.isInteger(record.revision)||Number(record.revision)<1) return null;
  if(typeof projection?.campaignId!=="string"||typeof projection.campaignName!=="string"||!Number.isInteger(projection.campaignRevision)) return null;
  if(typeof calendar?.enabled!=="boolean"||typeof calendar.providerId!=="string"||!Number.isInteger(calendar.absoluteMinute)||!object(calendar.displayAnchor)) return null;
  if(typeof rations?.enabled!=="boolean"||typeof rations.visibleToPlayers!=="boolean") return null;
  for(const key of ["balance","dailyRequired","shortage"] as const) if(rations[key]!==undefined&&(!Number.isInteger(rations[key])||Number(rations[key])<0)) return null;
  return {type:"campaign-systems-projection",sessionId:record.sessionId,revision:Number(record.revision),projection:structuredClone(projection) as unknown as CampaignSessionSystemsProjection};
}
function compatibleHelloAck(raw:string){try{const value=object(JSON.parse(raw));const compatibility=object(value?.compatibility);return value?.type==="hello-ack"&&typeof value.sessionId==="string"&&compatibility?.status==="compatible"?value.sessionId:null;}catch{return null;}}
async function envelopeFor(adapter:MockAdapter):Promise<CampaignSystemsEnvelope|null>{
  const state=connectedStateFor(adapter);if(state.mode!=="host"||!state.sessionId) return null;
  const snapshot=await adapter.getSnapshot();if(!snapshot.campaignSessionSystems) return null;
  return {type:"campaign-systems-projection",sessionId:state.sessionId,revision:snapshot.campaignSessionSystems.campaignRevision,projection:safeProjection(snapshot.campaignSessionSystems)};
}
async function broadcastProjection(adapter:MockAdapter){const envelope=await envelopeFor(adapter);if(envelope) await tauriSessionTransport.send(JSON.stringify(envelope));}
async function sendToWithCampaignSystems(peer:string,message:string){
  const result=await baseSendTo(peer,message);const sessionId=compatibleHelloAck(message);const host=activeHostAdapter;
  if(!host||!sessionId) return result;const envelope=await envelopeFor(host);if(envelope&&envelope.sessionId===sessionId) await baseSendTo(peer,JSON.stringify(envelope));return result;
}
async function onMessageWithCampaignSystems(handler:(message:SessionTransportMessage)=>void){
  const client=registeringClientAdapter;
  return baseOnMessage((message)=>{
    if(client){const decoded=decodeCampaignSystemsEnvelope(message.message);if(decoded){
      const state=connectedStateFor(client);if(state.sessionId&&state.sessionId!==decoded.sessionId) return;
      const current=remoteProjections.get(client);if(!current||current.sessionId!==decoded.sessionId||decoded.revision>=current.revision){remoteProjections.set(client,{sessionId:decoded.sessionId,revision:decoded.revision,projection:decoded.projection});void publishConnectedSnapshot(client).catch(()=>undefined);}return;
    }}
    handler(message);
  });
}
tauriSessionTransport.sendTo=sendToWithCampaignSystems;
tauriSessionTransport.onMessage=onMessageWithCampaignSystems;

const previousGetSnapshot=MockAdapter.prototype.getSnapshot;
MockAdapter.prototype.getSnapshot=async function getSnapshotWithRemoteCampaignSystems(){
  const snapshot=await previousGetSnapshot.call(this);if(snapshot.session.role!=="client") return snapshot;
  return {...snapshot,campaignSessionSystems:structuredClone(remoteProjections.get(this)?.projection??null),campaignSessionSnapshot:null};
};
const previousHostSession=MockAdapter.prototype.hostSession;
MockAdapter.prototype.hostSession=async function hostSessionWithCampaignSystems(){activeHostAdapter=this;return previousHostSession.call(this);};
const previousJoinSession=MockAdapter.prototype.joinSession;
MockAdapter.prototype.joinSession=async function joinSessionWithCampaignSystems(address:string){registeringClientAdapter=this;remoteProjections.delete(this);try{return await previousJoinSession.call(this,address);}finally{registeringClientAdapter=null;}};
const previousStopSession=MockAdapter.prototype.stopSession;
MockAdapter.prototype.stopSession=async function stopSessionWithCampaignSystems(){const result=await previousStopSession.call(this);remoteProjections.delete(this);if(activeHostAdapter===this)activeHostAdapter=null;if(registeringClientAdapter===this)registeringClientAdapter=null;return {...result,campaignSessionSystems:null,campaignSessionSnapshot:null};};

function broadcastAfter<T extends unknown[], R>(previous:(...args:T)=>Promise<R>){return async function(this:MockAdapter,...args:T):Promise<R>{const result=await previous.apply(this,args);await broadcastProjection(this).catch(()=>undefined);return result;};}
MockAdapter.prototype.advanceCampaignCalendar=broadcastAfter(MockAdapter.prototype.advanceCampaignCalendar);
MockAdapter.prototype.correctCampaignCalendar=broadcastAfter(MockAdapter.prototype.correctCampaignCalendar);
MockAdapter.prototype.correctCampaignCalendarDateTime=broadcastAfter(MockAdapter.prototype.correctCampaignCalendarDateTime);
MockAdapter.prototype.setCampaignCalendarNote=broadcastAfter(MockAdapter.prototype.setCampaignCalendarNote);
MockAdapter.prototype.undoCampaignCalendar=broadcastAfter(MockAdapter.prototype.undoCampaignCalendar);
MockAdapter.prototype.adjustCampaignRations=broadcastAfter(MockAdapter.prototype.adjustCampaignRations);
MockAdapter.prototype.consumeCampaignDailyRations=broadcastAfter(MockAdapter.prototype.consumeCampaignDailyRations);
MockAdapter.prototype.undoCampaignRationConsumption=broadcastAfter(MockAdapter.prototype.undoCampaignRationConsumption);
MockAdapter.prototype.advanceCampaignDay=broadcastAfter(MockAdapter.prototype.advanceCampaignDay);
