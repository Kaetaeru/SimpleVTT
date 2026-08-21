import { tauriSessionTransport } from "./tauriSessionTransport";
import { consumeNextSessionHostEndpoint } from "./sessionEndpointPreferences";

const startHostTransport=tauriSessionTransport.startHost.bind(tauriSessionTransport);

tauriSessionTransport.startHost=async function startConfiguredSessionHost(bindAddress="0.0.0.0:3210") {
  return startHostTransport(consumeNextSessionHostEndpoint(bindAddress));
};
