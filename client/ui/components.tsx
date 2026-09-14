import type { ReactNode } from "react";

export function Section({ title, badge, children, hint }: { title: string; badge?: ReactNode; hint?: string; children: ReactNode }) {
  return (
    <section className="cl-section">
      <h2>{title}{badge}</h2>
      {hint ? <p className="cl-muted cl-small">{hint}</p> : null}
      {children}
    </section>
  );
}

export function Pill({ children, tone }: { children: ReactNode; tone?: "good" | "bad" | "accent" }) {
  return <span className={`cl-pill${tone ? ` ${tone}` : ""}`}>{children}</span>;
}

export function Notice({ children, tone }: { children: ReactNode; tone?: "bad" | "warn" | "good" }) {
  return <div className={`cl-notice${tone ? ` ${tone}` : ""}`}>{children}</div>;
}

export function Modal({ title, onClose, children, actions }: { title: string; onClose: () => void; children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="cl-modal-backdrop" onClick={onClose} role="presentation">
      <div className="cl-modal" role="dialog" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <h2>{title}</h2>
        {children}
        <div className="cl-row" style={{ justifyContent: "flex-end" }}>
          {actions}
          <button type="button" className="cl-btn" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}

export const signed = (value: number) => (value >= 0 ? `+${value}` : `−${Math.abs(value)}`);

/** Copy text to the clipboard where available; returns whether it worked. */
export async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

/** Offer a text file for download (browser); the caller also shows the text for environments that block downloads. */
export function downloadText(fileName: string, text: string) {
  try {
    const blob = new Blob([text], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch { return false; }
}

export function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsText(file);
  });
}
