import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { ClientProvider } from "./app/context";
import "./ui/tokens.css";
import "./ui/app.css";
import "./ui/dice/dice.css";

/**
 * R71 (D206): in the exe every window of this app shares one WebView2 profile, so two windows on one PC were one
 * person — the second one asking to join was refused as "the host's own user id". Each window now claims the first
 * free instance lock; the first window stays who it always was, the next ones become seats "2", "3" … with their own
 * stable ids. The lock is held for the life of the window, so closing it frees the seat for the next launch.
 */
async function claimInstanceSeat(): Promise<string | null> {
  const locks = (navigator as Navigator & { locks?: LockManager }).locks;
  if (!("__TAURI_INTERNALS__" in window) || !locks) return null;
  for (let n = 1; n <= 8; n += 1) {
    const claimed = await new Promise<boolean>((resolve) => {
      void locks.request(`simplevtt-instance-${n}`, { ifAvailable: true }, (lock) => {
        if (!lock) { resolve(false); return undefined; }
        resolve(true);
        return new Promise<void>(() => undefined);
      });
    });
    if (claimed) return n === 1 ? null : String(n);
  }
  return null;
}

void claimInstanceSeat().catch(() => null).then((seat) => {
  (window as Window & { __SIMPLEVTT_INSTANCE_SEAT__?: string | null }).__SIMPLEVTT_INSTANCE_SEAT__ = seat;
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ClientProvider>
        <App />
      </ClientProvider>
    </StrictMode>,
  );
});
