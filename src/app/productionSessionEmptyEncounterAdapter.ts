import "./productionSessionLifecycleAdapter";
import { MockAdapter } from "./mockAdapter";
import { connectedInternal } from "./connectedSessionRuntimeAdapter";

const previousHostSession=MockAdapter.prototype.hostSession;

MockAdapter.prototype.hostSession=async function hostProductionSessionWithEmptyEncounter() {
  const snapshot=await previousHostSession.call(this);
  if (snapshot.session.role!=="host"||snapshot.session.lifecycle!=="preparing") return snapshot;

  const app=connectedInternal(this);
  app.scene={
    ...app.scene,
    round:0,
    currentActorId:"",
    selectedActorId:"",
    entities:[],
    actionsByActor:{},
    economyByActor:{},
  };
  app.resolution=null;
  return app.getSnapshot();
};
