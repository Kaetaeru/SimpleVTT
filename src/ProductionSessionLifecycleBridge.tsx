import { useSimpleVtt } from "./app/AppProvider";

export function ProductionSessionLifecycleBridge() {
  const { snapshot, stopSession } = useSimpleVtt();
  if (!snapshot || snapshot.session.role !== "host" || snapshot.session.lifecycle !== "preparing") return null;

  return (
    <aside
      aria-live="polite"
      aria-label="Host 세션 준비 상태"
      data-testid="production-host-preparation"
      style={{
        position: "fixed",
        right: 18,
        bottom: 18,
        zIndex: 70,
        width: "min(360px, calc(100vw - 36px))",
        padding: 16,
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,.18)",
        background: "rgba(18,20,28,.96)",
        boxShadow: "0 18px 48px rgba(0,0,0,.35)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <span className="eyebrow accent">Host 준비 중</span>
          <strong style={{ display: "block", marginTop: 4 }}>{snapshot.session.name}</strong>
        </div>
        <span className={`status-text ${snapshot.connectionState}`}>● 서버 열림</span>
      </div>
      <p style={{ margin: "10px 0 12px" }}>실제 Host transport가 열렸습니다. 아래 주소를 참가자에게 공유하고 세션을 준비하세요.</p>
      <div className="review-rows">
        <div><span>공유 주소</span><strong>{snapshot.session.address || "주소 확인 중"}</strong></div>
        <div><span>참가자</span><strong>{snapshot.session.participants.length}명</strong></div>
        <div><span>호환성</span><strong>{snapshot.session.compatibility}</strong></div>
      </div>
      <p style={{ margin: "10px 0 12px", opacity: .78 }}>{snapshot.session.compatibilityMessage}</p>
      <button type="button" onClick={() => void stopSession()}>Host 중지</button>
    </aside>
  );
}
