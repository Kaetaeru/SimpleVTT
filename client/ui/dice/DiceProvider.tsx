/**
 * Dice roller for the client: `useDice().roll(spec)` rolls in code, shows the physics dice overlay (copied from the
 * earlier client) with the result reel, and resolves once the dice have settled. Rolls queue; the overlay is one at a
 * time. Reduced motion shortens the physics to a guided settle; without WebGL the component shows DOM dice.
 *
 * The dice tumble by default. The OS "reduce motion" switch is not read: on Windows it is often off-by-default-on,
 * and it turned every roll into a die that popped up still in the middle of the screen. Reduced dice are the
 * viewer's own choice (`setReducedMotion`, kept in this browser).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { physicalSides, rollFormula, type RollResult, type RollSpec } from "../../character/dice";
import { diceSignature } from "./messageDice";
import { PhysicsDice3D, type PhysicsDie } from "./PhysicsDice3D";

const RESULT_HOLD_MS = 2600;
const RESULT_FADE_MS = 420;

interface DiceApi {
  /** Roll and animate; resolves with the result when the animation has settled (or at once when the page has no DOM). */
  roll: (spec: RollSpec) => Promise<RollResult>;
  /** Rolls without animation (tests, batch rolls). */
  rollSilently: (spec: RollSpec) => RollResult;
  /** Animate dice somebody else already rolled (a chat card the host resolved). A roll this viewer just watched
   *  tumble locally is not shown twice. */
  show: (result: RollResult) => void;
  history: RollResult[];
}

const DiceContext = createContext<DiceApi | null>(null);

const MOTION_KEY = "simplevtt.dice.motion";
export const isReducedMotion = () => { try { return typeof window !== "undefined" && window.localStorage.getItem(MOTION_KEY) === "reduced"; } catch { return false; } };
export const setReducedMotion = (reduced: boolean) => { try { if (reduced) window.localStorage.setItem(MOTION_KEY, "reduced"); else window.localStorage.removeItem(MOTION_KEY); } catch { /* storage blocked: the default (rolling) stays */ } };
const RECENT_MS = 20000;

export function DiceProvider({ children }: { children: ReactNode }) {
  // A queue in state (not a ref mutated inside updaters — StrictMode runs updaters twice).
  const [pending, setPending] = useState<Array<{ result: RollResult; resolve: () => void; /** Somebody else's dice, replayed. */ shown?: boolean }>>([]);
  const [history, setHistory] = useState<RollResult[]>([]);
  const finish = useCallback(() => setPending((list) => list.slice(1)), []);
  const recent = useRef(new Map<string, number>());
  const roll = useCallback((spec: RollSpec) => {
    const result = rollFormula(spec);
    recent.current.set(diceSignature(result.dice), Date.now());
    setHistory((list) => [...list, result].slice(-50));
    if (typeof document === "undefined") return Promise.resolve(result);
    return new Promise<RollResult>((resolve) => {
      const item = { result, resolve: () => resolve(result) };
      // The viewer's own roll goes ahead of other people's dice still waiting their turn: a click is never kept
      // waiting behind a replay. The one already on screen finishes.
      setPending((list) => (list.some((entry) => entry.result.id === result.id) ? list : [...list.slice(0, 1), item, ...list.slice(1)]));
    });
  }, []);
  const rollSilently = useCallback((spec: RollSpec) => { const result = rollFormula(spec); setHistory((list) => [...list, result].slice(-50)); return result; }, []);
  const show = useCallback((result: RollResult) => {
    if (typeof document === "undefined") return;
    const signature = diceSignature(result.dice);
    const at = recent.current.get(signature);
    if (at !== undefined && Date.now() - at < RECENT_MS) { recent.current.delete(signature); return; }
    // ponytail: at most two replays wait; a burst (a fireball on six) keeps the newest, older ones stay in the chat.
    setPending((list) => {
      if (list.some((entry) => entry.result.id === result.id)) return list;
      const waiting = list.slice(1).filter((entry) => entry.shown);
      const drop = waiting.length >= 2 ? waiting[0] : undefined;
      return [...list.filter((entry) => entry !== drop), { result, resolve: () => undefined, shown: true }];
    });
  }, []);
  const api = useMemo<DiceApi>(() => ({ roll, rollSilently, show, history }), [roll, rollSilently, show, history]);
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
  const reelTimer = useRef<number | null>(null);
  const rawTotal = result.total - result.modifier;
  // Stable per roll: the physics component rebuilds its scene whenever this array identity changes.
  const dice = useMemo<PhysicsDie[]>(() => result.dice.map((die) => ({ sides: physicalSides(die.sides), value: die.value })), [result.id, result.dice]);
  const sides = result.dice[0]?.sides;
  const notation = sides && result.dice.every((die) => die.sides === sides) ? `${result.dice.length === 1 ? "" : result.dice.length}d${sides}` : result.dice.map((die) => `d${die.sides}`).join(" + ");
  const tone = resolved ? (result.natural === 20 ? "natural-20" : result.natural === 1 ? "natural-1" : "normal") : "normal";
  const settle = useCallback(() => {
    if (settledRef.current) return;
    settledRef.current = true;
    if (reelTimer.current !== null) { window.clearInterval(reelTimer.current); reelTimer.current = null; }
    setReel(rawTotal);
    setResolved(true);
    onSettled();
    window.setTimeout(() => { setFading(true); window.setTimeout(onFinished, RESULT_FADE_MS); }, RESULT_HOLD_MS);
  }, [rawTotal, onSettled, onFinished]);
  useEffect(() => {
    const upper = Math.max(2, result.dice.reduce((sum, die) => sum + die.sides, 0));
    reelTimer.current = window.setInterval(() => setReel(1 + Math.floor(Math.random() * upper)), 42);
    // Reduced motion still shows the dice (a short, guided settle) — only the tumble is skipped.
    const fallback = window.setTimeout(settle, dice.length === 0 ? 180 : reduced ? 1500 : 4000);
    return () => { if (reelTimer.current !== null) window.clearInterval(reelTimer.current); window.clearTimeout(fallback); };
  }, [result.id, reduced, dice.length, settle, result.dice]);
  return createPortal(
    <div className={`visual-dice-overlay v09 standalone-roll ${fading ? "is-fading" : ""}`.trim()} data-phase={resolved ? "resolved" : "rolling"} onClick={settle}>
      {dice.length > 0 ? <PhysicsDice3D key={result.id} dice={dice} cinematic reducedMotion={reduced} className="visual-dice-world" onResolved={settle} /> : null}
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
