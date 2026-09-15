/**
 * Level up, apart from the creation wizard: pick the class and how many levels, roll or take the fixed hit points
 * for each new level (dice overlay), answer only the choices the new levels opened, see what changed, save.
 */
import { useMemo, useState } from "react";
import { useClient } from "../app/context";
import { ABILITY_KO } from "../catalog/types";
import { autofill } from "../character/autofill";
import { deriveCharacter } from "../character/derive";
import { choicesOpenedByLevelUp, summarizeLevelUp } from "../character/levelup";
import { noteLog } from "../character/play";
import { reconcileRuntime } from "../character/runtime";
import { addLevel, setChoice, setTrackHp, toggleChoiceValue } from "../character/source";
import type { CharacterSource, ChoiceRequest } from "../character/types";
import { fixedHitPoints } from "../rules/tables";
import { Notice, Pill, Section, signed } from "../ui/components";
import { useDice } from "../ui/dice/DiceProvider";
import { ChoicePicker } from "./ChoicePicker";
import { ValidationList } from "./SheetView";

export function LevelUpScreen({ id }: { id: string }) {
  const { catalog, characters, navigate, saveCharacter } = useClient();
  const record = characters.find((item) => item.id === id);
  const dice = useDice();
  const [source, setSource] = useState<CharacterSource | null>(() => record?.source ?? null);
  const [classId, setClassId] = useState<string>(() => record?.source.tracks.at(-1)?.classId ?? catalog.classes[0]?.id ?? "");
  const [rolling, setRolling] = useState<number | null>(null);
  if (!record || !source) return <div className="cl-page"><Notice tone="bad">캐릭터를 찾을 수 없습니다.</Notice></div>;
  const before = useMemo(() => deriveCharacter(record.source, catalog), [record.source, catalog]);
  const after = useMemo(() => deriveCharacter(source, catalog), [source, catalog]);
  const fromLevel = record.source.tracks.length;
  const newTracks = source.tracks.slice(fromLevel);
  const opened = choicesOpenedByLevelUp(after, fromLevel);
  const summary = summarizeLevelUp(before, after);
  const blocking = after.validation.blocking;
  const canSave = newTracks.length > 0 && blocking.length === 0;
  const cls = catalog.classById(classId);
  const classLevelAt = (index: number) => source.tracks.slice(0, index + 1).filter((track) => track.classId === source.tracks[index].classId).length;

  const gain = () => { if (source.tracks.length < 20 && classId) setSource(addLevel(source, classId)); };
  const undo = () => { if (newTracks.length > 0) setSource({ ...source, tracks: source.tracks.slice(0, -1), choices: Object.fromEntries(Object.entries(source.choices).filter(([key]) => !key.startsWith(`class.${source.tracks.length - 1}.`) && !key.startsWith(`feat.class.${source.tracks.length - 1}.`))) }); };
  const rollHp = async (index: number) => {
    const track = source.tracks[index];
    const die = catalog.classById(track.classId)?.hitDie ?? 8;
    setRolling(index);
    try {
      const result = await dice.roll({ label: `${index + 1}레벨 히트 다이스`, formula: `1d${die}`, note: `건강 ${signed(after.abilities.con.modifier)}`, kind: "hit-die" });
      setSource((current) => (current ? setTrackHp(current, index, { kind: "roll", value: result.total }) : current));
    } finally { setRolling(null); }
  };
  const toggle = (choice: ChoiceRequest, value: string) => setSource(toggleChoiceValue(source, choice.id, value, choice.count));
  const clear = (choice: ChoiceRequest) => setSource(setChoice(source, choice.id, []));
  const save = async () => {
    if (!canSave) return;
    const runtime = reconcileRuntime(noteLog(record.runtime, `레벨 업: ${summary.classes.map((item) => `${item.name} ${item.from}→${item.to}`).join(", ")} (총 ${summary.fromLevel}→${summary.toLevel}, 최대 HP ${summary.hpFrom}→${summary.hpTo})`), after);
    await saveCharacter({ ...source, updatedAt: new Date().toISOString() }, runtime);
    navigate({ screen: "sheet", id });
  };

  return (
    <div className="cl-page">
      <div className="cl-page-head">
        <h1>레벨 업</h1>
        <span className="cl-sub">{record.source.name} · {fromLevel}레벨 → {source.tracks.length}레벨</span>
        <div className="cl-actions">
          {opened.some((choice) => !choice.satisfied) ? <button type="button" className="cl-btn" onClick={() => setSource(autofill(source, catalog).source)}>남은 선택 빠르게 채우기</button> : null}
          <button type="button" className="cl-btn quiet" onClick={() => navigate({ screen: "sheet", id })}>취소</button>
          <button type="button" className="cl-btn primary" disabled={!canSave} onClick={save} title={blocking[0]}>레벨 업 적용</button>
        </div>
      </div>

      <div className="cl-grid-2">
        <Section title="얼마나 올릴까요">
          <div className="cl-row">
            <select className="cl-select" value={classId} onChange={(event) => setClassId(event.target.value)} aria-label="올릴 직업">
              {catalog.classes.map((item) => {
                const current = before.classes.find((entry) => entry.classId === item.id)?.level ?? 0;
                return <option key={item.id} value={item.id}>{item.name} {current ? `(현재 ${current})` : "(새 직업 — 멀티클래스)"}</option>;
              })}
            </select>
            <button type="button" className="cl-btn primary" disabled={source.tracks.length >= 20 || !classId} onClick={gain}>+1 레벨</button>
            <button type="button" className="cl-btn" disabled={newTracks.length === 0} onClick={undo}>되돌리기</button>
            <Pill>총 {source.tracks.length}레벨</Pill>
          </div>
          {cls && !before.classes.some((entry) => entry.classId === cls.id) ? <p className="cl-muted cl-small">멀티클래스 조건: {cls.primaryAbilities.map((key) => `${ABILITY_KO[key]} 13`).join(" · ")}. 1레벨 숙련 일부만 받습니다.</p> : null}
          {blocking.filter((line) => line.includes("조건")).map((line) => <Notice tone="bad" key={line}>{line}</Notice>)}
          {newTracks.length === 0 ? <p className="cl-quiet">올릴 레벨을 추가하세요.</p> : (
            <div className="cl-list">
              {newTracks.map((track, offset) => {
                const index = fromLevel + offset;
                const trackClass = catalog.classById(track.classId);
                const die = trackClass?.hitDie ?? 8;
                const con = after.abilities.con.modifier;
                return (
                  <div className="cl-hp-roll" key={index}>
                    <span style={{ minWidth: 120 }}><strong>{index + 1}레벨</strong> {trackClass?.name} {classLevelAt(index)}</span>
                    <button type="button" className={`cl-btn small${track.hp.kind === "fixed" ? " primary" : ""}`} onClick={() => setSource(setTrackHp(source, index, { kind: "fixed" }))}>고정 {fixedHitPoints(die)}</button>
                    <button type="button" className="cl-btn small" disabled={rolling !== null} onClick={() => void rollHp(index)}>{track.hp.kind === "roll" ? `d${die} 다시 굴림` : `d${die} 굴림`}</button>
                    {track.hp.kind === "roll" ? <span className="cl-big">{track.hp.value}</span> : null}
                    <span className="cl-muted cl-small">{track.hp.kind === "roll" ? `굴림 ${track.hp.value}` : `고정 ${fixedHitPoints(die)}`} {con >= 0 ? "+" : "−"} 건강 {Math.abs(con)} = <strong>{Math.max(1, (track.hp.kind === "roll" ? track.hp.value : fixedHitPoints(die)) + con)} HP</strong></span>
                  </div>
                );
              })}
            </div>
          )}
        </Section>
        <Section title="바뀌는 것">
          {newTracks.length === 0 ? <p className="cl-quiet">아직 없음</p> : (
            <>
              <dl className="cl-kv">
                <dt>레벨</dt><dd>{summary.fromLevel} → {summary.toLevel} · {summary.classes.map((item) => `${item.name} ${item.from}→${item.to}`).join(", ")}</dd>
                <dt>최대 HP</dt><dd>{summary.hpFrom} → {summary.hpTo}</dd>
                <dt>숙련 보너스</dt><dd>{signed(summary.proficiencyFrom)}{summary.proficiencyTo !== summary.proficiencyFrom ? ` → ${signed(summary.proficiencyTo)}` : ""}</dd>
              </dl>
              {summary.newFeatures.length ? <div className="cl-list" style={{ gap: 4 }}>{summary.newFeatures.map((feature) => <div className="cl-feature" key={`${feature.sourceLabel}|${feature.id}`}><div className="cl-head"><span className="cl-name">{feature.name}</span>{feature.level ? <Pill>{feature.level}레벨</Pill> : null}<span className="cl-src">{feature.sourceLabel}</span></div>{feature.description ? <div className="cl-desc">{feature.description}</div> : null}</div>)}</div> : null}
            </>
          )}
        </Section>
      </div>

      {newTracks.length > 0 ? (
        <Section title="새 레벨의 선택" badge={<Pill tone={opened.every((choice) => choice.satisfied) ? "good" : undefined}>{opened.filter((choice) => choice.satisfied).length}/{opened.length}</Pill>} hint="이 레벨 업으로 새로 열린 선택만 나옵니다. 나머지 시트는 그대로입니다.">
          {opened.length === 0 ? <p className="cl-quiet">고를 것이 없습니다. 바로 적용할 수 있습니다.</p> : opened.map((choice) => <ChoicePicker key={choice.id} choice={choice} onToggle={(value) => toggle(choice, value)} onClear={() => clear(choice)} />)}
          <ValidationList derived={after} />
        </Section>
      ) : null}
    </div>
  );
}
