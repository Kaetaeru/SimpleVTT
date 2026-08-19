import { App } from "./App";
import { SessionModeRoot } from "./SessionModeRoot";
import { useSimpleVtt } from "./app/AppProvider";

export function ProductRoot() {
  const { snapshot, loading } = useSimpleVtt();

  if (loading || !snapshot) {
    return <div className="loading-screen">SimpleVTT 불러오는 중…</div>;
  }

  if (snapshot.session.role !== "offline") {
    return <SessionModeRoot />;
  }

  return <App />;
}
