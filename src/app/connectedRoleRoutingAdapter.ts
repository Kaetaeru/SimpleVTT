import { MockAdapter } from "./mockAdapter";
import { connectedInternal } from "./connectedSessionRuntimeAdapter";

const previousHostSession=MockAdapter.prototype.hostSession;
const previousJoinSession=MockAdapter.prototype.joinSession;

MockAdapter.prototype.hostSession=async function hostWithDmRole() {
  const snapshot=await previousHostSession.call(this);
  if (snapshot.session.role!=="host"||snapshot.connectionState!=="connected") return snapshot;
  connectedInternal(this).role="dm";
  return connectedInternal(this).getSnapshot();
};

MockAdapter.prototype.joinSession=async function joinWithPlayerRole(address:string) {
  const snapshot=await previousJoinSession.call(this,address);
  if (snapshot.session.role!=="client"||snapshot.connectionState==="disconnected") return snapshot;
  connectedInternal(this).role="player";
  return connectedInternal(this).getSnapshot();
};
