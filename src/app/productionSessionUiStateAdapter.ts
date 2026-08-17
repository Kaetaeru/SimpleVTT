import "./productionSessionLifecycleAdapter";
import { MockAdapter } from "./mockAdapter";
import { connectedInternal } from "./connectedSessionRuntimeAdapter";

const previousStopSession=MockAdapter.prototype.stopSession;

MockAdapter.prototype.stopSession=async function stopProductionSessionAndRestoreOfflineShell() {
  const snapshot=await previousStopSession.call(this);
  if (snapshot.session.role!=="offline"||snapshot.session.lifecycle!=="offline") return snapshot;

  const app=connectedInternal(this);
  app.role="player";
  return app.getSnapshot();
};
