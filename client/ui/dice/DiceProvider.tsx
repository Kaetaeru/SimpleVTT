/**
 * Dice roller for the client: `useDice().roll(spec)` rolls in code, shows the physics dice overlay (copied from the
 * earlier client) with the result reel, and resolves once the dice have settled. Rolls queue; the overlay is one at a
 * time. Reduced motion skips the physics and shows the result at once.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { physicalSides, rollFormula, type RollResult, type RollSpec } from "../../character/dice";
import { PhysicsDice3D, type PhysicsDie } from "./PhysicsDice3D";

const RESULT_HOLD_MS = 2600;
const RESULT_FADE_MS = 420;

interface DiceApi {
  /** Roll and animate; resolves with the result when the animation has settled (or at once when the page has no DOM). */
  roll: (spec: RollSpec) => Promise<RollResult>;
  /** Rolls without animation (tests, batch rolls). */
  rollSilently: (spec: RollSpec) => RollResult;
  history: RollResult[];
}

const DiceContext = createContext<DiceApi | null>(null);

export const isReducedMotion = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function DiceProvider({ children }: { children: ReactNode }) {
  // A queue in state (not a ref mutated inside updaters — StrictMode runs updaters twice).
  const [pending, setPending] = useState<Array<{ result: RollResult; resolve: () => void }>>([]);
  const [history, setHistory] = useState<RollResult[]>([]);
  const finish = useCallback(() => setPending((list) => list.slice(1)), []);
  const roll = useCallback((spec: RollSpec) => {
    const result = rollFormula(spec);
    setHistory((list) => [...list, result].slice(-50));
    if (typeof document === "undefined") return Promise.resolve(result);
    return new Promise<RollResult>((resolve) => {
      const item = { result, resolve: () => resolve(result) };
      setPending((list) => (list.some((entry) => entry.result.id === result.id) ? list : [...list, item]));
    });
  }, []);
  const rollSilently = useCallback((spec: RollSpec) => { const result = rollFormula(spec); setHistory((list) => [...list, result].slice(-50)); return result; }, []);
  const api = useMemo<DiceApi>(() => ({ roll, rollSilently, history }), [roll, rollSilently, history]);
  const current = pending[0] ?? null;
  return (
    <DiceContext.Provider value={api}>
      {children}
      {current ? <DiceOverlay key={current.result.id} result={current.result} onSettled={current.resolve} onFinished={finish} /> : null}
    </DiceContext.Provider>
  );
}

export function useDice() {
  const api = useContext(DiceContext);
  if (!api) throw new Error("useDice outside DiceProvider");
  return api;
}

function modifierText(value: number) { return value > 0 ? `+ ${value}` : value < 0 ? `− ${Math.abs(value)}` : "+ 0"; }

function DiceOverlay({ result, onSettled, onFinished }: { result: RollResult; onSettled: () => void; onFinished: () => void }) {
  const reduced = isReducedMotion();
  const [resolved, setResolved] = useState(false);
  const [fading, setFading] = useState(false);
  const [reel, setReel] = useState<number | null>(null);
  const settledRef = useRef(false);
  const rawTotal = result.total - result.modifier;
  const dice: PhysicsDie[] = result.dice.map((die) => ({ sides: physicalSides(die.sides), value: die.value }));
  const sides = result.dice[0]?.sides;
  const notation = sides && result.dice.every((die) => die.sides === sides) ? `${result.dice.length === 1 ? "" : result.dice.length}d${sides}` : result.dice.map((die) => `d${die.sides}`).join(" + ");
  const tone = resolved ? (result.natural === 20 ? "natural-20" : result.natural === 1 ? "natural-1" : "normal") : "normal";
  const settle = useCallback(() => {
    if (settledRef.current) return;
    settledRef.current = true;
    setReel(rawTotal);
    setResolved(true);
    onSettled();
    window.setTimeout(() => { setFading(true); window.setTimeout(onFinished, RESULT_FADE_MS); }, RESULT_HOLD_MS);
  }, [rawTotal, onSettled, onFinished]);
  useEffect(() => {
    const upper = Math.max(2, result.dice.reduce((sum, die) => sum + die.sides, 0));
    const reelTimer = window.setInterval(() => setReel(1 + Math.floor(Math.random() * upper)), 42);
    const fallback = window.setTimeout(settle, reduced || dice.length === 0 ? 180 : 4000);
    return () => { window.clearInterval(reelTimer); window.clearTimeout(fallback); };
  }, [result.id, reduced, dice.length, settle, result.dice]);
  return createPortal(
    <div className={`visual-dice-overlay v09 standalone-roll ${fading ? "is-fading" : ""}`.trim()} data-phase={resolved ? "resolved" : "rolling"} onClick={settle}>
      {dice.length > 0 && !reduced ? <PhysicsDice3D key={result.id} dice={dice} cinematic className="visual-dice-world" onResolved={settle} /> : null}
      <div className={`visual-roll-notice ${resolved ? "resolved rolling-complete" : "rolling"} ${tone}`} role="status" aria-live="polite">
        <div className="visual-roll-notice-core">
          <span className="visual-roll-label">{result.label}</span>
          <span className="visual-roll-die">{notation || "—"}</span>
          <span className="visual-roll-reel" aria-label={resolved ? `주사위 결과 ${rawTotal}` : "주사위 굴리는 중"}><b>{reel ?? "—"}</b></span>
        </div>
        <div className="visual-roll-notice-extension">
          <span className="visual-roll-formula"><b>{notation || "0"} {rawTotal}</b><small>{modifierText(result.modifier)} 수정치{result.note ? ` · ${result.note}` : ""}</small></span>
          <span className="visual-roll-equals">=</span>
          <strong className="visual-roll-total">{result.total}</strong>
        </div>
        {resolved && tone !== "normal" ? <span className="visual-roll-natural">{tone === "natural-20" ? "NATURAL 20" : "NATURAL 1"}</span> : null}
      </div>
    </div>,
    document.body,
  );
}
