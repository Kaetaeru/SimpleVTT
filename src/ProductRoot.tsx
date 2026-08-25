import { useEffect, useRef, useState, type MouseEvent } from "react";
import { App } from "./App";
import { SessionDebugPreview, type SessionDebugPreviewState } from "./SessionDebugPreview";
import { SessionModeRoot } from "./SessionModeRoot";
import { useSimpleVtt } from "./app/AppProvider";
import "./product-root.css";

type ProductSurface = "product" | "play";

function readSessionDebugPreview(): SessionDebugPreviewState | null {
  if (!import.meta.env.DEV) return null;
  const params = new URLSearchParams(window.location.search);
  const role = params.get("session-preview");
  if (role !== "dm" && role !== "player") return null;
  return { role, mode: params.get("mode") === "initiative" ? "initiative" : "freeform" };
}

function writeSessionDebugPreview(state: SessionDebugPreviewState | null) {
  const url = new URL(window.location.href);
  if (state) {
    url.searchParams.set("session-preview", state.role);
    url.searchParams.set("mode", state.mode);
  } else {
    url.searchParams.delete("session-preview");
    url.searchParams.delete("mode");
  }
  window.history.replaceState(null, "", url);
}

function isReturnToConnectedPlayTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  const control = target.closest("button, a");
  if (!control) return false;
  const label = control.textContent?.replace(/\s+/g, " ").trim() ?? "";
  return label === "플레이로 돌아가기";
}

export function ProductRoot() {
  const { snapshot, loading, debug } = useSimpleVtt();
  const [surface, setSurface] = useState<ProductSurface>("product");
  const [debugPreview, setDebugPreview] = useState<SessionDebugPreviewState | null>(() => readSessionDebugPreview());
  const wasLiveConnected = useRef(false);

  useEffect(() => {
    if (debugPreview) void debug.setMode(debugPreview.mode);
  }, [debugPreview?.mode]);

  const liveConnected = Boolean(
    snapshot
    && snapshot.session.role !== "offline"
    && snapshot.session.lifecycle === "live",
  );

  useEffect(() => {
    if (!snapshot) return;

    if (!liveConnected) {
      setSurface("product");
      wasLiveConnected.current = false;
      return;
    }

    if (!wasLiveConnected.current) {
      setSurface("play");
    }
    wasLiveConnected.current = true;
  }, [liveConnected, snapshot]);

  if (loading || !snapshot) {
    return <div className="loading-screen">SimpleVTT 불러오는 중…</div>;
  }

  const changeDebugPreview = (next: SessionDebugPreviewState | null) => {
    writeSessionDebugPreview(next);
    setDebugPreview(next);
  };

  if (debugPreview) {
    return <SessionDebugPreview state={debugPreview} onChange={changeDebugPreview} onExit={() => changeDebugPreview(null)} />;
  }

  if (liveConnected && surface === "play") {
    return <div className="connected-product-root" data-connected-surface="play">
      <SessionModeRoot onOpenProduct={() => setSurface("product")} />
    </div>;
  }

  const captureConnectedReturn = (event: MouseEvent<HTMLDivElement>) => {
    if (!liveConnected || !isReturnToConnectedPlayTarget(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    setSurface("play");
  };

  return <div
    className="connected-product-root"
    data-connected-surface={liveConnected ? "product" : "offline"}
    onClickCapture={captureConnectedReturn}
  >
    <App onOpenSessionPreview={import.meta.env.DEV ? (role) => changeDebugPreview({ role, mode: "freeform" }) : undefined} />
  </div>;
}
