/**
 * The NPC sheet (ROLL20_TABLE_SPEC.md §4.3 "NPC 시트"): a compendium stat block with roll buttons on every action,
 * play state (HP with the -5/+3/12 grammar, conditions, recharge and legendary counters) and the GM fields of any
 * journal entry. Also renders a read-only stat block for the compendium tab.
 */
import { useMemo, useState } from "react";
import { useCampaigns } from "../app/campaigns";
import type { JournalEntry, JournalNpc, NpcRuntime } from "../campaign/journal";
import { canEdit } from "../campaign/journal";
import { CONDITION_MARKERS, MARKER_GLYPH } from "../campaign/page";
import { ABILITY_KEYS, ABILITY_KO } from "../catalog/types";
import type { MonsterAction, MonsterView } from "../compendium/monsters";
import { damageFormula, SIZE_KO } from "../compendium/monsters";
import type { RollResult, RollSpec } from "../character/dice";
import { Notice, Pill, signed } from "../ui/components";
import { useDice } from "../ui/dice/DiceProvider";

const modifier = (score: number) => Math.floor((score - 10) / 2);
const d20 = (bonus: number) => `1d20${bonus >= 0 ? "+" : "-"}${Math.abs(bonus)}`;

function useViewer() {
  const c = useCampaigns();
  const snapshot = c.table.snapshot!;
  const role = snapshot.players.find((player) => player.userId === c.userId)?.role ?? "player";
  return { userId: c.userId, role, isGm: role === "gm", snapshot, viewer: { userId: c.userId, role } };
}

/** Rolls through the 3D dice and posts the card to chat under the monster's name. */
export function useNpcRoller(name: string) {
  const c = useCampaigns();
  const dice = useDice();
  return async (spec: RollSpec): Promise<RollResult> => {
    const result = await dice.roll(spec);
    c.sendRoll({ formula: result.formula, total: result.total, dice: result.dice.map((die) => ({ sides: die.sides, value: die.value })), modifier: result.modifier, label: `${name} · ${result.label}${result.note ? ` (${result.note})` : ""}` });
    return result;
  };
}

export function NpcWindow({ entry, onClose, onOpen: _onOpen }: { entry: JournalNpc; onClose: () => void; onOpen: (id: string) => void }) {
  const c = useCampaigns();
  const viewer = useViewer();
  const editable = canEdit(entry, viewer);
  const [hpInput, setHpInput] = useState("");
  const [gmOpen, setGmOpen] = useState(false);
  const roll = useNpcRoller(entry.name);
  const runtime = entry.runtime;
  const save = (patch: Partial<NpcRuntime>) => c.putJournal({ ...entry, runtime: { ...runtime, ...patch, updatedAt: new Date().toISOString() }, updatedAt: new Date().toISOString() });
  // R10: the stat block's per-day spells and how many casts are left today.
  const perDay = (entry.statBlock.actions.find((action) => action.kind === "spellcasting" && action.spellcasting)?.spellcasting?.lists ?? []).filter((list) => list.frequency === "per-day").flatMap((list) => list.entries.filter((item) => item.spellId).map((item) => ({ spellId: item.spellId!, name: item.name, uses: list.uses ?? 1 })));
  const hpPreview = useMemo(() => previewHp(runtime, hpInput), [runtime, hpInput]);
  const block = entry.statBlock;
  return (
    <div className="cl-journal-window">
      <div className="cl-row" style={{ gap: 10, alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <h2 className="cl-journal-title">{entry.name}</h2>
          <div className="cl-quiet cl-small">{SIZE_KO[block.size] ?? block.size} {block.typeText}, {block.alignment} · CR {block.crText} ({block.xp} XP) · {block.nameEn}</div>
        </div>
        {viewer.isGm ? <div className="cl-row" style={{ gap: 4 }}><button type="button" className="cl-btn small primary" onClick={() => c.showJournal(entry.id)}>플레이어에게 보여주기</button><button type="button" className="cl-btn small" onClick={() => setGmOpen((value) => !value)}>{gmOpen ? "GM 필드 닫기" : "GM 필드"}</button><button type="button" className="cl-btn small danger" onClick={() => { if (confirm(`"${entry.name}"을(를) 지울까요?`)) { c.removeJournal(entry.id); onClose(); } }}>삭제</button></div> : null}
      </div>
      {editable ? (
        <div className="cl-card" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div className="cl-row" style={{ gap: 8 }}>
            <span className="cl-hp-big">{runtime.hp.current}<small> / {runtime.hp.max}</small></span>
            {runtime.hp.temp ? <Pill tone="accent">임시 HP {runtime.hp.temp}</Pill> : null}
            <input className="cl-input" style={{ width: 110 }} placeholder="12 · -4 · +4 · ++4" aria-label="NPC HP 입력" value={hpInput} onChange={(event) => setHpInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && hpPreview) { save({ hp: hpPreview }); setHpInput(""); } }} />
            <button type="button" className="cl-btn small primary" disabled={!hpPreview} onClick={() => { if (hpPreview) { save({ hp: hpPreview }); setHpInput(""); } }}>적용</button>
            <span className="cl-quiet cl-small">토큰의 바는 따로입니다 (몹은 토큰마다 HP, D78). 이 HP는 시트의 것.</span>
          </div>
          <div className="cl-cond">{CONDITION_MARKERS.map((condition) => <button type="button" key={condition} className={runtime.conditions.includes(condition) ? "on" : ""} onClick={() => save({ conditions: runtime.conditions.includes(condition) ? runtime.conditions.filter((item) => item !== condition) : [...runtime.conditions, condition] })}>{MARKER_GLYPH[condition]} {condition}</button>)}</div>
          {block.legendaryActionsPerRound ? <div className="cl-row cl-small" style={{ gap: 6 }}><span>전설 행동 {block.legendaryActionsPerRound - runtime.legendaryUsed}/{block.legendaryActionsPerRound} 남음</span><button type="button" className="cl-btn small" disabled={runtime.legendaryUsed >= block.legendaryActionsPerRound} onClick={() => save({ legendaryUsed: runtime.legendaryUsed + 1 })}>1 사용</button><button type="button" className="cl-btn small quiet" onClick={() => save({ legendaryUsed: 0 })}>초기화</button>{block.legendaryResistance ? <Pill>전설 저항 {block.legendaryResistance}/일</Pill> : null}</div> : null}
        </div>
      ) : null}
      {editable && block.legendaryResistance ? <div className="cl-row cl-small" style={{ gap: 6 }}><span>전설 저항 {Math.max(0, block.legendaryResistance - (runtime.legendaryResistanceUsed ?? 0))}/{block.legendaryResistance} 남음</span><span className="cl-quiet">— 주문 카드의 실패한 내성에서 "전설 저항"으로 씁니다</span><button type="button" className="cl-btn small quiet" onClick={() => save({ legendaryResistanceUsed: 0 })}>초기화</button></div> : null}
      {editable && perDay.length ? (
        <div className="cl-card cl-row cl-small" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span className="cl-quiet">주문 횟수 (일)</span>
          {perDay.map((item) => <Pill key={item.spellId} tone={(runtime.uses?.[item.spellId] ?? 0) >= item.uses ? "bad" : "good"}>{item.name} {Math.max(0, item.uses - (runtime.uses?.[item.spellId] ?? 0))}/{item.uses}</Pill>)}
          <button type="button" className="cl-btn small" onClick={() => save({ uses: {}, legendaryResistanceUsed: 0 })} title="긴 휴식: 주문·특성의 하루 횟수와 전설 저항을 모두 되돌립니다">횟수 초기화</button>
        </div>
      ) : null}
      {viewer.isGm && block.traits.length ? (
        <div className="cl-card cl-small" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="cl-quiet">특성 횟수 (일) — SRD 스탯 블록에는 특성의 횟수가 없습니다. 하루 몇 번인지 여기서 정하면 테이블이 세어 줍니다.</span>
          {block.traits.map((trait) => {
            const most = runtime.traitUses?.[trait.name];
            const used = runtime.uses?.[`trait:${trait.name}`] ?? 0;
            return (
              <label key={trait.name} className="cl-row" style={{ gap: 6 }}>
                <span style={{ flex: 1 }}>{trait.name}</span>
                {most ? <Pill tone={used >= most ? "bad" : "good"}>{Math.max(0, most - used)}/{most} 남음</Pill> : <span className="cl-quiet">제한 없음</span>}
                <input className="cl-input" style={{ width: 66, height: 24 }} type="number" min={0} max={20} aria-label={`${trait.name} 하루 횟수`} value={most ?? ""} placeholder="–"
                  onChange={(event) => { const value = Number(event.target.value); const next = { ...(runtime.traitUses ?? {}) }; if (!value) delete next[trait.name]; else next[trait.name] = Math.max(1, Math.min(20, value)); save({ traitUses: next }); }} />
              </label>
            );
          })}
        </div>
      ) : null}
      <StatBlock block={block} runtime={editable ? runtime : undefined} onRoll={editable ? roll : undefined} onSpend={editable ? (name, spent) => save({ spent: { ...runtime.spent, [name]: spent } }) : undefined} />
      {gmOpen && viewer.isGm ? <NpcGmFields entry={entry} /> : null}
    </div>
  );
}

function previewHp(runtime: NpcRuntime, text: string): NpcRuntime["hp"] | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (/^\+\+\d+$/.test(trimmed)) return { ...runtime.hp, temp: Math.max(runtime.hp.temp, Number(trimmed.slice(2))) };
  if (!/^[+-]?\d+$/.test(trimmed)) return null;
  if (trimmed.startsWith("-")) {
    let amount = Number(trimmed.slice(1));
    let temp = runtime.hp.temp;
    if (temp > 0) { const absorbed = Math.min(temp, amount); temp -= absorbed; amount -= absorbed; }
    return { ...runtime.hp, temp, current: Math.max(0, runtime.hp.current - amount) };
  }
  if (trimmed.startsWith("+")) return { ...runtime.hp, current: Math.min(runtime.hp.max, runtime.hp.current + Number(trimmed.slice(1))) };
  return { ...runtime.hp, current: Math.max(0, Math.min(runtime.hp.max, Number(trimmed))) };
}

function NpcGmFields({ entry }: { entry: JournalNpc }) {
  const c = useCampaigns();
  const { snapshot } = useViewer();
  const players = snapshot.players.filter((player) => player.role !== "gm");
  const put = (patch: Partial<JournalEntry>) => c.putJournal({ ...entry, ...patch, updatedAt: new Date().toISOString() } as JournalNpc);
  const mode = entry.canView === "all" ? "all" : entry.canView.length === 0 ? "none" : "some";
  return (
    <div className="cl-card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="cl-field"><label>볼 수 있는 사람</label><div className="cl-row" style={{ gap: 6 }}><select className="cl-select" aria-label="볼 수 있는 사람" value={mode} onChange={(event) => put({ canView: event.target.value === "all" ? "all" : event.target.value === "none" ? [] : players.slice(0, 1).map((player) => player.userId) })}><option value="none">없음 (GM만)</option><option value="all">모든 플레이어</option><option value="some">선택한 플레이어</option></select>{mode === "some" ? players.map((player) => <label key={player.userId} className="cl-row cl-small" style={{ gap: 4 }}><input type="checkbox" checked={entry.canView !== "all" && entry.canView.includes(player.userId)} onChange={(event) => { const list = entry.canView === "all" ? [] : entry.canView; put({ canView: event.target.checked ? [...list, player.userId] : list.filter((id) => id !== player.userId) }); }} />{player.displayName}</label>) : null}</div><span className="cl-quiet cl-small">플레이어에게 보이면 그들의 저널에 스탯 블록이 읽기 전용으로 나타납니다 (Roll20의 NPC 시트 공개).</span></div>
      <div className="cl-row" style={{ gap: 6 }}>
        <div className="cl-field" style={{ flex: 1 }}><label htmlFor={`npc-folder-${entry.id}`}>폴더</label><input id={`npc-folder-${entry.id}`} className="cl-input" value={entry.folder} onChange={(event) => put({ folder: event.target.value })} /></div>
        <div className="cl-field" style={{ flex: 1 }}><label htmlFor={`npc-name-${entry.id}`}>이름 (예: 고블린 2)</label><input id={`npc-name-${entry.id}`} className="cl-input" value={entry.name} onChange={(event) => put({ name: event.target.value })} /></div>
      </div>
      <div className="cl-field"><label htmlFor={`npc-gm-${entry.id}`}>GM 노트</label><textarea id={`npc-gm-${entry.id}`} className="cl-textarea" rows={3} value={entry.gmNotes} onChange={(event) => put({ gmNotes: event.target.value })} /></div>
    </div>
  );
}

/* ---------- Stat block ---------- */

export function StatBlock({ block, runtime, onRoll, onSpend, compact = false }: { block: MonsterView; runtime?: NpcRuntime; onRoll?: (spec: RollSpec) => Promise<RollResult> | void; onSpend?: (actionName: string, spent: boolean) => void; compact?: boolean }) {
  const rollable = Boolean(onRoll);
  const section = (title: string, actions: MonsterAction[]) => (actions.length ? (
    <section className="cl-statblock-section">
      <h4>{title}{title === "전설 행동" && block.legendaryActionsPerRound ? <span className="cl-quiet cl-small"> · 라운드당 {block.legendaryActionsPerRound}</span> : null}</h4>
      {actions.map((action) => <ActionRow key={action.name} action={action} block={block} spent={runtime?.spent[action.name]} onRoll={onRoll} onSpend={onSpend} />)}
    </section>
  ) : null);
  return (
    <div className={`cl-statblock${compact ? " compact" : ""}`}>
      <div className="cl-statblock-line"><strong>방어도</strong> {block.acText} · <strong>HP</strong> {block.hp} ({block.hitDice}) · <strong>이동</strong> {block.speedText} · <strong>이니셔티브</strong> {signed(block.initiativeBonus)}{rollable ? <button type="button" className="cl-roll" onClick={() => void onRoll!({ label: "이니셔티브", formula: d20(block.initiativeBonus), kind: "initiative" })}>굴림</button> : null}</div>
      <table className="cl-table cl-statblock-abilities"><thead><tr>{ABILITY_KEYS.map((key) => <th key={key}>{ABILITY_KO[key]}</th>)}</tr></thead><tbody>
        <tr>{ABILITY_KEYS.map((key) => <td key={key}><strong>{block.abilities[key]}</strong> <span className="cl-quiet">({signed(modifier(block.abilities[key]))})</span>{rollable ? <button type="button" className="cl-roll" title="판정" onClick={() => void onRoll!({ label: `${ABILITY_KO[key]} 판정`, formula: d20(modifier(block.abilities[key])), kind: "check" })}>판정</button> : null}</td>)}</tr>
        <tr>{ABILITY_KEYS.map((key) => <td key={key}><span className="cl-quiet cl-small">내성 {signed(block.saves[key])}</span>{rollable ? <button type="button" className="cl-roll" onClick={() => void onRoll!({ label: `${ABILITY_KO[key]} 내성`, formula: d20(block.saves[key]), kind: "save" })}>내성</button> : null}</td>)}</tr>
      </tbody></table>
      <div className="cl-statblock-line cl-small">
        {Object.keys(block.skills).length ? <span><strong>기술</strong> {Object.entries(block.skills).map(([skill, bonus]) => `${skill} ${signed(bonus)}`).join(", ")} · </span> : null}
        {block.damageResistances.length ? <span><strong>저항</strong> {block.damageResistances.join(", ")} · </span> : null}
        {block.damageImmunities.length ? <span><strong>면역</strong> {block.damageImmunities.join(", ")} · </span> : null}
        {block.damageVulnerabilities.length ? <span><strong>취약</strong> {block.damageVulnerabilities.join(", ")} · </span> : null}
        {block.conditionImmunities.length ? <span><strong>상태 면역</strong> {block.conditionImmunities.join(", ")} · </span> : null}
        <span><strong>감각</strong> {block.sensesText}</span> · <span><strong>언어</strong> {block.languagesText || "—"}</span>
      </div>
      {section("특성", block.traits)}
      {section("행동", block.actions)}
      {section("추가 행동", block.bonusActions)}
      {section("반응", block.reactions)}
      {section("전설 행동", block.legendaryActions)}
    </div>
  );
}

function ActionRow({ action, block, spent, onRoll, onSpend }: { action: MonsterAction; block: MonsterView; spent?: boolean; onRoll?: (spec: RollSpec) => Promise<RollResult> | void; onSpend?: (name: string, spent: boolean) => void }) {
  const recharge = action.timing?.recharge;
  const rollable = Boolean(onRoll);
  return (
    <div className="cl-statblock-action">
      <div className="cl-row" style={{ gap: 6 }}>
        <strong>{action.name}</strong>
        {action.nameEn ? <span className="cl-quiet cl-small">{action.nameEn}</span> : null}
        {recharge ? <Pill tone={spent ? "bad" : "good"}>재충전 {recharge.min}{recharge.min < recharge.sides ? `–${recharge.sides}` : ""}{spent ? " · 대기" : ""}</Pill> : null}
        {action.legendaryCost ? <Pill>전설 {action.legendaryCost}</Pill> : null}
        {action.timing?.usesPerRound ? <Pill>라운드당 {action.timing.usesPerRound}</Pill> : null}
        {rollable && action.kind === "attack" && action.attack ? <>
          <button type="button" className="cl-roll" onClick={() => void onRoll!({ label: `${action.name} 명중`, formula: d20(action.attack!.bonus), kind: "attack" })}>명중 {signed(action.attack.bonus)}</button>
          {action.attack.damage.map((damage, index) => <button type="button" key={index} className="cl-roll" onClick={() => void onRoll!({ label: `${action.name} 피해`, formula: damageFormula(damage), note: damage.type, kind: "damage" })}>피해 {damageFormula(damage)} {damage.type}</button>)}
        </> : null}
        {rollable && action.kind === "save" && action.save ? <>
          <Pill tone="accent">{ABILITY_KO[action.save.ability]} 내성 DC {action.save.dc}</Pill>
          {(action.save.failDamage ?? []).map((damage, index) => <button type="button" key={index} className="cl-roll" onClick={() => void onRoll!({ label: `${action.name} 피해`, formula: damageFormula(damage), note: damage.type, kind: "damage" })}>피해 {damageFormula(damage)} {damage.type}</button>)}
        </> : null}
        {recharge && onSpend ? <button type="button" className="cl-btn small" onClick={() => onSpend(action.name, !spent)}>{spent ? "재충전됨으로" : "사용 (재충전 대기)"}</button> : null}
      </div>
      <p className="cl-small cl-statblock-text">{action.text}</p>
      {action.kind === "spellcasting" && action.spellcasting ? <p className="cl-quiet cl-small">주문 능력치 {ABILITY_KO[action.spellcasting.ability]} · DC {action.spellcasting.dc} · {action.spellcasting.lists.map((list) => `${list.frequency}: ${list.spells.join(", ")}`).join(" / ")}</p> : null}
      {block.legendaryActionsPerRound && action.legendaryCost ? null : null}
    </div>
  );
}

export const npcSummary = (block: MonsterView) => `${SIZE_KO[block.size] ?? block.size} ${block.typeText} · AC ${block.acText} · HP ${block.hp} · CR ${block.crText}`;

export function NpcNotice() { return <Notice tone="warn">NPC</Notice>; }
