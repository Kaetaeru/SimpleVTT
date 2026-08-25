import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useSimpleVtt } from "./app/AppProvider";
import "./app/creationContracts";
import "./app/progressionContracts";
import { projectOfficialSheet } from "./app/characterSheetV10Projection";
import { StandaloneDicePresentation } from "./VisualDiceBridge";
import { OfficialCharacterSheetPage } from "./OfficialCharacterSheetPage";
import { OfficialSpellcastingSheetPage } from "./OfficialSpellcastingSheetPage";
import type { CharacterSheetHostMode } from "./CharacterSheetPlayScreen";

export type SheetRollMode = "normal" | "advantage" | "disadvantage";
export type SheetDieSides = 4 | 6 | 8 | 10 | 12 | 20;
export type SheetLocalRoll = {
  id: string;
  label: string;
  dice: Array<{ value: number; sides: SheetDieSides }>;
  modifier: number;
  total: number;
  note?: string;
};

type Props = { hostMode?: CharacterSheetHostMode; onLevelUp?: () => void; onEdit?: () => void };

function OfficialSheetFitFrame({ children }: { children: ReactNode }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ scale: 1, height: 1284 });

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const canvas = canvasRef.current;
    if (!frame || !canvas) return;
    const update = () => {
      const width = canvas.scrollWidth;
      const height = canvas.scrollHeight;
      if (!width || !height || !frame.clientWidth || !frame.clientHeight) return;
      const scale = Math.min(1, frame.clientWidth / width);
      const scaledHeight = height * scale;
      setFit((current) => Math.abs(current.scale - scale) < .001 && Math.abs(current.height - scaledHeight) < .5 ? current : { scale, height: scaledHeight });
    };
    const observer = new ResizeObserver(update);
    observer.observe(frame);
    observer.observe(canvas);
    update();
    return () => observer.disconnect();
  }, []);

  return <div ref={frameRef} className="official-sheet-fit-frame">
    <div className="official-sheet-fit-sizer" style={{ height: fit.height }}>
      <div ref={canvasRef} className="official-sheet-fit-canvas" style={{ transform: `scale(${fit.scale})` }}>{children}</div>
    </div>
  </div>;
}

function randomDie(sides: SheetDieSides) {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return (values[0] % sides) + 1;
}

function parseDice(expression: string) {
  const match = expression.match(/(\d+)d(\d+)(?:\s*([+-])\s*(\d+))?/i);
  if (!match) return null;
  const count = Number(match[1]);
  const sides = Number(match[2]) as SheetDieSides;
  if (![4, 6, 8, 10, 12, 20].includes(sides) || count < 1 || count > 20) return null;
  const flat = match[3] ? Number(match[4]) * (match[3] === "-" ? -1 : 1) : 0;
  return { count, sides, flat };
}

export function OfficialCharacterSheetPlayScreen({ hostMode = "standalone", onLevelUp, onEdit }: Props) {
  const { snapshot, editCharacterDraft, startLevelUp, toggleItemEquipped, toggleItemAttunement, useItem } = useSimpleVtt();
  const [mode, setMode] = useState<SheetRollMode>("normal");
  const [roll, setRoll] = useState<SheetLocalRoll | null>(null);
  const [sessionNotice, setSessionNotice] = useState("");
  if (!snapshot) return null;

  const c = snapshot.activeCharacter;
  const view = projectOfficialSheet(c);
  const spellcasting = snapshot.scene.spellcastingByActor?.[c.id];
  const actions = snapshot.scene.actionsByActor[c.id] ?? [];

  const sessionReference = (label: string) => {
    setSessionNotice(`${label} · 연결된 세션의 공유 판정은 Session Action 경로에서 실행합니다.`);
  };
  const publish = (next: SheetLocalRoll) => setRoll(next);
  const d20 = (label: string, modifier: number) => {
    if (hostMode === "session") { sessionReference(label); return; }
    const first = randomDie(20);
    const second = mode === "normal" ? null : randomDie(20);
    const face = second === null ? first : mode === "advantage" ? Math.max(first, second) : Math.min(first, second);
    publish({
      id: `${Date.now()}:${label}`,
      label,
      dice: second === null ? [{ value: first, sides: 20 }] : [{ value: first, sides: 20 }, { value: second, sides: 20 }],
      modifier,
      total: face + modifier,
      note: second === null ? undefined : `${mode === "advantage" ? "유리" : "불리"}: ${face} 채택`,
    });
  };
  const rawDie = (sides: SheetDieSides, label = `d${sides}`) => {
    if (hostMode === "session") { sessionReference(label); return; }
    const value = randomDie(sides);
    publish({ id: `${Date.now()}:${label}`, label, dice: [{ value, sides }], modifier: 0, total: value });
  };
  const damage = (label: string, expression: string) => {
    if (hostMode === "session") { sessionReference(`${label} 피해`); return; }
    const parsed = parseDice(expression);
    if (!parsed) return;
    const dice = Array.from({ length: parsed.count }, () => ({ value: randomDie(parsed.sides), sides: parsed.sides }));
    publish({ id: `${Date.now()}:${label}:damage`, label: `${label} 피해`, dice, modifier: parsed.flat, total: dice.reduce((sum, die) => sum + die.value, 0) + parsed.flat, note: expression });
  };

  const edit = async () => { await editCharacterDraft(c.id); onEdit?.(); };
  const levelUp = async () => { await startLevelUp(c.id); onLevelUp?.(); };

  return <div className="screen official-sheet-play-screen" data-sheet-host={hostMode}>
    <div className="official-sheet-notice-slot">{hostMode === "session" && <div className="session-sheet-roll-policy" role="status"><strong>세션 시트</strong><span>{sessionNotice || "수치·주문·장비는 같은 canonical Character를 표시합니다. 공유 판정은 Session Action 경로를 사용합니다."}</span></div>}</div>
    {hostMode === "standalone" && roll && <StandaloneDicePresentation roll={roll} onFinished={() => setRoll(null)} />}

    <OfficialSheetFitFrame>
      <OfficialCharacterSheetPage character={c} view={view} rollMode={mode} showRollMode={hostMode === "standalone"} onRollModeChange={setMode} onEdit={edit} onLevelUp={levelUp} d20={d20} rawDie={rawDie} damage={damage} />
      <OfficialSpellcastingSheetPage character={c} view={view} spellcasting={spellcasting} actions={actions} d20={d20} damage={damage} toggleItemEquipped={toggleItemEquipped} toggleItemAttunement={toggleItemAttunement} useItem={useItem} />
    </OfficialSheetFitFrame>
  </div>;
}
