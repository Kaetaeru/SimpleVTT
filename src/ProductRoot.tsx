import { useEffect, useRef, useState, type MouseEvent } from "react";
import { App } from "./App";
import { SessionModeRoot } from "./SessionModeRoot";
import { useSimpleVtt } from "./app/AppProvider";
import "./product-root.css";

type ProductSurface = "product" | "play";

function isReturnToConnectedPlayTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  const control = target.closest("button, a");
  if (!control) return false;
  const label = control.textContent?.replace(/\s+/g, " ").trim() ?? "";
  return label === "플레이로 돌아가기" || label === "기기로 플레이";
}

export function ProductRoot() {
  const { snapshot, loading } = useSimpleVtt();
  const [surface, setSurface] = useState<ProductSurface>("product");
  const wasLiveConnected = useRef(false);

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

  if (liveConnected && surface === "play") {
    return <div className="connected-product-root" data-connected-surface="play">
      <button
        type="button"
        className="connected-product-shell-entry"
        aria-label="제품 메뉴 열기"
        onClick={() => setSurface("product")}
      >
        SimpleVTT 메뉴
      </button>
      <SessionModeRoot />
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
    <App />
  </div>;
}
