import { useState } from "react";
import { useSimpleVtt } from "./app/AppProvider";
import "./app/creationContracts";
import "./app/progressionContracts";
import { projectOfficialSheet, signed } from "./app/characterSheetV10Projection";
import { sheetAbilityModifier } from "./app/sheetRollValues";
import { VisualDiceTray } from "./VisualDiceBridge";
import { OfficialCharacterSheetPage } from "./OfficialCharacterSheetPage";
import { OfficialSpellcastingSheetPage } from "./OfficialSpellcastingSheetPage";

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

type Props = { onScene(): void; onLevelUp(): void; onEdit(): void };
type OfficialPage = "character" | "spells";

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

export function OfficialCharacterSheetPlayScreen({ onScene, onLevelUp, onEdit }: Props) {
  const { snapshot, editCharacterDraft, startLevelUp, toggleItemEquipped, toggleItemAttunement, useItem } = useSimpleVtt();
  const [mode, setMode] = useState<SheetRollMode>("normal");
  const [page, setPage] = useState<OfficialPage>("character");
  const [roll, setRoll] = useState<SheetLocalRoll | null>(null);
  if (!snapshot) return null;

  const c = snapshot.activeCharacter;
  const view = projectOfficialSheet(c);
  const spellcasting = snapshot.scene.spellcastingByActor?.[c.id];
  const actions = snapshot.scene.actionsByActor[c.id] ?? [];

  const publish = (next: SheetLocalRoll) => setRoll(next);
  const d20 = (label: string, modifier: number) => {
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
    const value = randomDie(sides);
    publish({ id: `${Date.now()}:${label}`, label, dice: [{ value, sides }], modifier: 0, total: value });
  };
  const damage = (label: string, expression: string) => {
    const parsed = parseDice(expression);
    if (!parsed) return;
    const dice = Array.from({ length: parsed.count }, () => ({ value: randomDie(parsed.sides), sides: parsed.sides }));
    publish({ id: `${Date.now()}:${label}:damage`, label: `${label} 피해`, dice, modifier: parsed.flat, total: dice.reduce((sum, die) => sum + die.value, 0) + parsed.flat, note: expression });
  };

  const edit = async () => { await editCharacterDraft(c.id); onEdit(); };
  const levelUp = async () => { await startLevelUp(c.id); onLevelUp(); };

  return <div className="screen official-sheet-play-screen">
    <header className="sheet-play-toolbar">
      <div><span className="eyebrow accent">OFFICIAL SHEET LAYOUT</span><h1>{c.name}</h1><p>{c.className} {c.level} · {c.species} · {c.background}</p></div>
      <div className="sheet-play-toolbar-actions"><button onClick={edit}>편집</button><button onClick={levelUp}>레벨 업</button><button className="primary" onClick={onScene}>기기로 플레이</button></div>
    </header>

    <div className="sheet-play-statusbar">
      <div><span>AC</span><strong>{c.ac}</strong></div><div><span>HP</span><strong>{c.hp}/{c.maxHp}</strong></div><div><span>이동</span><strong>{c.speed} ft</strong></div><div><span>우선권</span><strong>{signed(sheetAbilityModifier(c, "dex"))}</strong></div><div><span>숙련</span><strong>+{c.proficiencyBonus}</strong></div><div><span>수동 지각</span><strong>{view.passivePerception}</strong></div>
      <div className="sheet-roll-mode" role="group" aria-label="d20 굴림 방식"><button className={mode === "advantage" ? "active" : ""} aria-pressed={mode === "advantage"} onClick={() => setMode("advantage")}>유리</button><button className={mode === "normal" ? "active" : ""} aria-pressed={mode === "normal"} onClick={() => setMode("normal")}>보통</button><button className={mode === "disadvantage" ? "active" : ""} aria-pressed={mode === "disadvantage"} onClick={() => setMode("disadvantage")}>불리</button></div>
    </div>

    {roll && <section className="sheet-roll-result" aria-live="polite"><div className="sheet-roll-result-head"><div><span>ROLL</span><strong>{roll.label}</strong>{roll.note && <small>{roll.note}</small>}</div><div className="sheet-roll-total"><span>{roll.modifier ? `주사위 ${roll.modifier > 0 ? "+" : ""}${roll.modifier}` : "결과"}</span><strong>{roll.total}</strong></div><button onClick={() => setRoll(null)} aria-label="굴림 결과 닫기">×</button></div><VisualDiceTray label={roll.label} dice={roll.dice} caption="local tabletop physics roll" /></section>}

    <div className="official-sheet-page-tabs" role="tablist" aria-label="Official sheet pages"><button role="tab" aria-selected={page === "character"} className={page === "character" ? "active" : ""} onClick={() => setPage("character")}>Character Sheet</button><button role="tab" aria-selected={page === "spells"} className={page === "spells" ? "active" : ""} onClick={() => setPage("spells")}>Spellcasting</button></div>
    {page === "character" ? <OfficialCharacterSheetPage character={c} view={view} d20={d20} rawDie={rawDie} damage={damage} toggleItemEquipped={toggleItemEquipped} toggleItemAttunement={toggleItemAttunement} useItem={useItem} /> : <OfficialSpellcastingSheetPage character={c} view={view} spellcasting={spellcasting} actions={actions} d20={d20} damage={damage} />}
  </div>;
}
