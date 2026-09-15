/**
 * The character sheet rendered from a DerivedCharacter. Every number carries its provenance (hover shows the
 * addends). With `actions` the sheet is live: slots, resources, gold and the bag can be changed in place — the
 * offline session feel. `compact` is the wizard's live preview: one column, read-only.
 */
import { useState } from "react";
import type { ContentCatalog } from "../catalog/catalog";
import { ABILITY_KEYS, ABILITY_KO } from "../catalog/types";
import type { CharacterRuntime } from "../character/runtime";
import type { DerivedCharacter, DerivedFeature } from "../character/types";
import { Pill, signed } from "../ui/components";
import { Explain } from "../ui/Explain";

const SOURCE_ORDER: DerivedFeature["source"][] = ["species", "background", "class", "subclass", "feat", "invocation", "metamagic"];
const SOURCE_KO: Record<DerivedFeature["source"], string> = { species: "종족 특성", background: "배경", class: "직업 특성", subclass: "서브클래스 특성", feat: "재주", invocation: "섬뜩한 기원술", metamagic: "메타매직" };

export interface SheetActions {
  useSlot: (level: number) => void;
  restoreSlot: (level: number) => void;
  usePactSlot: () => void;
  restorePactSlot: () => void;
  useResource: (id: string) => void;
  restoreResource: (id: string) => void;
  adjustGold: (delta: number) => void;
  setGold: (gold: number) => void;
  toggleEquip: (instanceId: string) => void;
  setQuantity: (instanceId: string, quantity: number) => void;
  removeItem: (instanceId: string) => void;
  openAddItem: () => void;
  /** Roll dice with the overlay: label, formula ("1d20+5"), note. */
  roll: (label: string, formula: string, note?: string, kind?: "check" | "attack" | "damage" | "save" | "initiative" | "custom") => void;
}

const d20 = (bonus: number) => `1d20${bonus >= 0 ? "+" : "-"}${Math.abs(bonus)}`;

export function SheetView({ derived, catalog, runtime, compact = false, actions }: { derived: DerivedCharacter; catalog: ContentCatalog; runtime?: CharacterRuntime; compact?: boolean; actions?: SheetActions }) {
  const [openFeatures, setOpenFeatures] = useState<Record<string, boolean>>({});
  const [goldInput, setGoldInput] = useState("");
  const classLine = derived.classes.map((cls) => `${cls.name}${cls.subclassName ? ` (${cls.subclassName})` : ""} ${cls.level}`).join(" / ") || "직업 없음";
  const spellName = (id: string) => catalog.spellById(id)?.name ?? catalog.name(id);
  const spellLevel = (id: string) => catalog.spellById(id)?.level ?? 0;
  const byLevel = (ids: string[]) => {
    const groups = new Map<number, string[]>();
    for (const id of ids) { const level = spellLevel(id); groups.set(level, [...(groups.get(level) ?? []), spellName(id)]); }
    return [...groups.entries()].sort((a, b) => a[0] - b[0]);
  };
  const live = Boolean(actions && runtime);
  const gold = runtime ? runtime.gold : derived.gold;
  return (
    <div className={`cl-sheet${compact ? " compact" : ""}`}>
      <div className="cl-sheet-head">
        <div className="cl-avatar" aria-hidden="true">{(derived.name || "?").slice(0, 1)}</div>
        <div>
          <div className="cl-name">{derived.name || "(이름 없음)"}</div>
          <div className="cl-line">{derived.species?.name ?? "종족 없음"} · {derived.background?.name ?? "배경 없음"} · {classLine} · 총 {derived.level}레벨</div>
        </div>
        <div className="cl-row" style={{ marginLeft: "auto" }}>
          <Pill>숙련 보너스 {signed(derived.proficiencyBonus)}</Pill>
          <Pill>{derived.size}</Pill>
          {runtime?.heroicInspiration ? <Pill tone="accent">영웅적 영감</Pill> : null}
        </div>
      </div>

      <div className="cl-stat-row">
        <Stat label="최대 HP" value={<Explain terms={derived.hp.terms} total={derived.hp.max} label="최대 HP">{derived.hp.max}</Explain>} sub={runtime ? `현재 ${runtime.hp.current}${runtime.hp.temp ? ` (+${runtime.hp.temp} 임시)` : ""}` : `히트 다이스 ${Object.entries(derived.hitDice).map(([die, count]) => `${count}${die}`).join(" ")}`} />
        <Stat label="AC" value={<Explain terms={derived.ac.terms} total={derived.ac.value} label={`AC (${derived.ac.source})`}>{derived.ac.value}</Explain>} sub={derived.ac.source} />
        <Stat label="이니셔티브" value={<Explain terms={derived.initiativeTerms} total={derived.initiative} label="이니셔티브">{signed(derived.initiative)}</Explain>} sub={live ? undefined : undefined} action={live ? <RollButton onClick={() => actions!.roll("이니셔티브", d20(derived.initiative), undefined, "initiative")} /> : null} />
        <Stat label="이동 속도" value={<Explain terms={derived.speed.terms} total={derived.speed.walk} label="이동 속도 (피트)">{derived.speed.walk}ft</Explain>} sub={[derived.speed.fly ? `비행 ${derived.speed.fly}` : "", derived.speed.swim ? `수영 ${derived.speed.swim}` : "", derived.speed.climb ? `등반 ${derived.speed.climb}` : ""].filter(Boolean).join(" · ") || undefined} />
        <Stat label="패시브 지각" value={<Explain terms={derived.passivePerceptionTerms} total={derived.passivePerception} label="패시브 지각">{derived.passivePerception}</Explain>} />
        <Stat label="감각" value={derived.senses.darkvision ? `암시야 ${derived.senses.darkvision}` : "—"} sub={[derived.senses.blindsight ? `맹안시야 ${derived.senses.blindsight}` : "", derived.senses.truesight ? `진실시야 ${derived.senses.truesight}` : ""].filter(Boolean).join(" · ") || undefined} />
      </div>

      <div className="cl-ability-grid">
        {ABILITY_KEYS.map((key) => {
          const ability = derived.abilities[key];
          const terms = [{ label: "기본 점수", value: ability.base }, ...ability.bonuses.map((bonus) => ({ label: bonus.source, value: bonus.value }))];
          return (
            <div className="cl-ability" key={key}>
              <div className="cl-key">{ABILITY_KO[key]}</div>
              <Explain terms={terms} total={ability.score} label={`${ABILITY_KO[key]} 점수`}><div className="cl-score">{ability.score}</div></Explain>
              <div className="cl-mod">{signed(ability.modifier)}</div>
              <Explain terms={derived.saves[key].terms} total={derived.saves[key].bonus} label={`${ABILITY_KO[key]} 내성`}><div className="cl-small cl-quiet">내성 {signed(derived.saves[key].bonus)}{derived.saves[key].proficient ? " ●" : ""}</div></Explain>
              {live ? <div className="cl-row" style={{ gap: 3 }}><RollButton label="판정" onClick={() => actions!.roll(`${ABILITY_KO[key]} 판정`, d20(ability.modifier), undefined, "check")} /><RollButton label="내성" onClick={() => actions!.roll(`${ABILITY_KO[key]} 내성`, d20(derived.saves[key].bonus), undefined, "save")} /></div> : null}
            </div>
          );
        })}
      </div>

      <div className="cl-sheet-cols">
        <div className="cl-sheet-left" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <section className="cl-section">
            <h2>기술</h2>
            <div>
              {derived.skills.map((skill) => (
                <div className="cl-skill" key={skill.id}>
                  <span className={`cl-dot${skill.proficient ? " on" : ""}${skill.expertise ? " x2" : ""}`} title={skill.expertise ? "전문화" : skill.proficient ? "숙련" : ""} />
                  <span>{skill.name} <span className="cl-quiet cl-small">{ABILITY_KO[skill.ability]}</span></span>
                  <span className="cl-row" style={{ gap: 4, justifyContent: "flex-end" }}>
                    <Explain terms={skill.terms} total={skill.bonus} label={skill.name}><span className="cl-bonus">{signed(skill.bonus)}</span></Explain>
                    {live ? <RollButton onClick={() => actions!.roll(`${skill.name} 판정`, d20(skill.bonus), undefined, "check")} /> : null}
                  </span>
                </div>
              ))}
            </div>
          </section>
          <section className="cl-section">
            <h2>숙련</h2>
            <dl className="cl-kv">
              <dt>방어구</dt><dd>{derived.proficiencies.armor.join(", ") || "없음"}</dd>
              <dt>무기</dt><dd>{derived.proficiencies.weapons.join(", ") || "없음"}</dd>
              <dt>도구</dt><dd>{derived.proficiencies.tools.join(", ") || "없음"}</dd>
              <dt>언어</dt><dd>{derived.proficiencies.languages.join(", ")}</dd>
              {derived.weaponMasteries.length ? <><dt>무기 통달</dt><dd>{derived.weaponMasteries.join(", ")}</dd></> : null}
            </dl>
          </section>
          {derived.defenses.resistances.length || derived.defenses.immunities.length || derived.defenses.conditionImmunities.length ? (
            <section className="cl-section">
              <h2>방어</h2>
              <dl className="cl-kv">
                {derived.defenses.resistances.length ? <><dt>저항</dt><dd>{derived.defenses.resistances.join(", ")}</dd></> : null}
                {derived.defenses.immunities.length ? <><dt>면역</dt><dd>{derived.defenses.immunities.join(", ")}</dd></> : null}
                {derived.defenses.conditionImmunities.length ? <><dt>상태 면역</dt><dd>{derived.defenses.conditionImmunities.join(", ")}</dd></> : null}
              </dl>
            </section>
          ) : null}
          {derived.resources.length ? (
            <section className="cl-section">
              <h2>자원 {live ? <span className="cl-quiet cl-small">● 클릭: 사용 · ○ 클릭: 회복</span> : null}</h2>
              <table className="cl-table">
                <tbody>
                  {derived.resources.map((resource) => {
                    const used = runtime?.resourcesUsed[resource.id] ?? 0;
                    return (
                      <tr key={resource.id}>
                        <td>{resource.label}</td>
                        <td className="num">
                          {live && resource.max <= 12 ? <Pips max={resource.max} used={used} onUse={() => actions!.useResource(resource.id)} onRestore={() => actions!.restoreResource(resource.id)} /> : <>{runtime ? `${resource.max - used}/` : ""}{resource.max}</>}
                          {live && resource.max > 12 ? <span className="cl-inline-btns"><button type="button" className="cl-btn small" onClick={() => actions!.useResource(resource.id)}>−</button><button type="button" className="cl-btn small" onClick={() => actions!.restoreResource(resource.id)}>+</button></span> : null}
                        </td>
                        <td className="cl-quiet cl-small">{resource.recovery}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          ) : null}
          <section className="cl-section">
            <h2>가방 <Pill>{gold} GP</Pill>
              {live ? (
                <span className="cl-row" style={{ gap: 4, marginLeft: "auto" }}>
                  <button type="button" className="cl-btn small" onClick={() => actions!.adjustGold(-1)}>−1</button>
                  <button type="button" className="cl-btn small" onClick={() => actions!.adjustGold(1)}>+1</button>
                  <input className="cl-input" style={{ width: 70, height: 26 }} placeholder="±GP" aria-label="금화 증감" value={goldInput} onChange={(event) => setGoldInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && goldInput.trim()) { actions!.adjustGold(Number(goldInput)); setGoldInput(""); } }} />
                  <button type="button" className="cl-btn small" disabled={!goldInput.trim() || Number.isNaN(Number(goldInput))} onClick={() => { actions!.adjustGold(Number(goldInput)); setGoldInput(""); }}>적용</button>
                  <button type="button" className="cl-btn small primary" onClick={() => actions!.openAddItem()}>아이템 추가</button>
                </span>
              ) : null}
            </h2>
            {derived.inventory.length === 0 ? <p className="cl-quiet">장비 없음</p> : (
              <div>
                {derived.inventory.map((item) => {
                  const equippable = item.kind === "armor" || item.kind === "shield" || item.kind === "weapon";
                  return (
                    <div className="cl-item-row" key={item.instanceId}>
                      {live ? <button type="button" className={`cl-eq${item.equipped ? " on" : ""}`} disabled={!equippable} title={equippable ? (item.equipped ? "해제" : "착용/장비") : "착용 불가"} aria-label={`${item.name} ${item.equipped ? "해제" : "장비"}`} onClick={() => actions!.toggleEquip(item.instanceId)} /> : <span className="cl-small">{item.equipped ? "●" : "○"}</span>}
                      <span>{item.name}{item.custom ? <span className="cl-quiet cl-small"> (직접 입력)</span> : null}{item.equipped && item.wieldSlot === "off-hand" ? <span className="cl-quiet cl-small"> 보조손</span> : null}</span>
                      {live ? <input className="cl-input cl-qty" type="number" min={0} value={item.quantity} aria-label={`${item.name} 수량`} onChange={(event) => actions!.setQuantity(item.instanceId, Number(event.target.value))} /> : <span className="cl-small">{item.quantity > 1 ? `×${item.quantity}` : ""}</span>}
                      {live ? <button type="button" className="cl-btn small quiet" title="버리기" onClick={() => actions!.removeItem(item.instanceId)}>✕</button> : <span />}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <div className="cl-sheet-right" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <section className="cl-section">
            <h2>공격</h2>
            <table className="cl-table">
              <thead><tr><th>이름</th><th>명중</th><th>피해</th><th>속성</th></tr></thead>
              <tbody>
                {derived.attacks.map((attack) => (
                  <tr key={attack.id}>
                    <td>{attack.name}{attack.masteryActive ? <Pill tone="accent">통달 {attack.mastery}</Pill> : null}</td>
                    <td className="num"><Explain terms={attack.attackTerms} total={attack.attackBonus} label={`${attack.name} 명중`}>{signed(attack.attackBonus)}</Explain>{live ? <RollButton onClick={() => actions!.roll(`${attack.name} 명중`, d20(attack.attackBonus), undefined, "attack")} /> : null}</td>
                    <td>{attack.damage} <Explain terms={attack.damageTerms} total={attack.damageBonus} label={`${attack.name} 피해 보너스`}>{signed(attack.damageBonus)}</Explain> {attack.damageType}{live ? <RollButton label="피해" onClick={() => actions!.roll(`${attack.name} 피해`, `${attack.damage.split(" ")[0]}${attack.damageBonus ? `${attack.damageBonus > 0 ? "+" : "-"}${Math.abs(attack.damageBonus)}` : ""}`, attack.damageType, "damage")} /> : null}</td>
                    <td className="cl-quiet cl-small">{[...attack.properties, attack.range ? `사거리 ${attack.range}` : ""].filter(Boolean).join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {derived.spellcasting.length || Object.keys(derived.spellSlots).length || derived.pactMagic ? (
            <section className="cl-section">
              <h2>주문 {live ? <span className="cl-quiet cl-small">● 클릭: 슬롯 사용 · ○ 클릭: 회복</span> : null}</h2>
              {Object.keys(derived.spellSlots).length || derived.pactMagic ? (
                <div className="cl-slots">
                  {Object.entries(derived.spellSlots).map(([level, count]) => {
                    const used = runtime?.slotsUsed[Number(level)] ?? 0;
                    return (
                      <div className="cl-slot" key={level}>
                        <span className="cl-k">{level}레벨</span>
                        {live ? <Pips max={count} used={used} onUse={() => actions!.useSlot(Number(level))} onRestore={() => actions!.restoreSlot(Number(level))} /> : <span className="cl-v">{runtime ? `${count - used}/` : ""}{count}</span>}
                      </div>
                    );
                  })}
                  {derived.pactMagic ? (
                    <div className="cl-slot">
                      <span className="cl-k">계약 {derived.pactMagic.level}레벨</span>
                      {live ? <Pips max={derived.pactMagic.count} used={runtime!.pactSlotsUsed} onUse={() => actions!.usePactSlot()} onRestore={() => actions!.restorePactSlot()} /> : <span className="cl-v">{runtime ? `${derived.pactMagic.count - runtime.pactSlotsUsed}/` : ""}{derived.pactMagic.count}</span>}
                    </div>
                  ) : null}
                </div>
              ) : null}
              {derived.spellcasting.map((entry) => (
                <div className="cl-feature" key={entry.key}>
                  <div className="cl-head">
                    <span className="cl-name">{entry.className}</span>
                    <span className="cl-quiet cl-small">{ABILITY_KO[entry.ability]} · DC <Explain terms={entry.saveDcTerms} total={entry.saveDc} label={`${entry.className} 내성 DC`}>{entry.saveDc}</Explain> · 명중 <Explain terms={entry.attackTerms} total={entry.attackBonus} label={`${entry.className} 주문 명중`}>{signed(entry.attackBonus)}</Explain></span>
                  </div>
                  {entry.cantrips.length ? <div className="cl-spell-level"><h4>소마법 {entry.cantripsMax ? `(${entry.cantrips.length}/${entry.cantripsMax})` : ""}</h4><div className="cl-small">{entry.cantrips.map(spellName).join(", ")}</div></div> : null}
                  {entry.alwaysPrepared.length ? <div className="cl-spell-level"><h4>항상 준비</h4>{byLevel(entry.alwaysPrepared).map(([level, names]) => <div className="cl-small" key={level}><span className="cl-quiet">{level}레벨</span> {names.join(", ")}</div>)}</div> : null}
                  {entry.preparedMax ? <div className="cl-spell-level"><h4>준비 주문 ({entry.prepared.length}/{entry.preparedMax})</h4>{byLevel(entry.prepared).map(([level, names]) => <div className="cl-small" key={level}><span className="cl-quiet">{level}레벨</span> {names.join(", ")}</div>)}</div> : null}
                  {entry.spellbook ? <div className="cl-spell-level"><h4>주문서 ({entry.spellbook.length})</h4>{byLevel(entry.spellbook).map(([level, names]) => <div className="cl-small" key={level}><span className="cl-quiet">{level}레벨</span> {names.join(", ")}</div>)}</div> : null}
                </div>
              ))}
            </section>
          ) : null}

          {SOURCE_ORDER.map((source) => {
            const features = derived.features.filter((feature) => feature.source === source);
            if (!features.length) return null;
            return (
              <section className="cl-section" key={source}>
                <h2>{SOURCE_KO[source]} <Pill>{features.length}</Pill></h2>
                <div className="cl-list" style={{ gap: 4 }}>
                  {features.map((feature) => {
                    const key = `${feature.sourceLabel}|${feature.id}`;
                    const open = compact ? false : (openFeatures[key] ?? true);
                    return (
                      <div className="cl-feature" key={key}>
                        <div className="cl-head" onClick={() => setOpenFeatures((state) => ({ ...state, [key]: !open }))} style={{ cursor: compact ? "default" : "pointer" }}>
                          <span className="cl-name">{feature.name}</span>
                          {feature.nameEn && feature.nameEn !== feature.name ? <span className="cl-quiet cl-small">{feature.nameEn}</span> : null}
                          {feature.level ? <Pill>{feature.level}레벨</Pill> : null}
                          <span className="cl-src">{feature.sourceLabel}</span>
                        </div>
                        {open && feature.description ? <div className="cl-desc">{feature.description}</div> : null}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Usage pips: filled = available, empty = used. Click a filled pip to use, an empty one to restore. */
export function Pips({ max, used, onUse, onRestore }: { max: number; used: number; onUse: () => void; onRestore: () => void }) {
  return (
    <span className="cl-pips" role="group" aria-label={`${max - used}/${max}`}>
      {Array.from({ length: max }, (_, index) => {
        const isUsed = index >= max - used;
        return <button type="button" key={index} className={`cl-pip${isUsed ? " used" : ""}`} title={isUsed ? "회복" : "사용"} aria-label={isUsed ? "회복" : "사용"} onClick={isUsed ? onRestore : onUse} />;
      })}
    </span>
  );
}

function Stat({ label, value, sub, action }: { label: string; value: React.ReactNode; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="cl-stat">
      <span className="cl-k">{label}{action ? <span style={{ float: "right" }}>{action}</span> : null}</span>
      <span className="cl-v">{value}</span>
      {sub ? <span className="cl-s">{sub}</span> : null}
    </div>
  );
}

export function RollButton({ onClick, label = "굴림" }: { onClick: () => void; label?: string }) {
  return <button type="button" className="cl-roll" onClick={onClick} title="주사위 굴림">{label}</button>;
}

export function ValidationList({ derived }: { derived: DerivedCharacter }) {
  return (
    <div className="cl-validation">
      {derived.validation.blocking.length === 0 ? <div className="cl-notice good">막힘 없음 — 저장할 수 있습니다.</div> : null}
      {derived.validation.blocking.map((line, index) => <div className="bad" key={`b${index}`}>✕ {line}</div>)}
      {derived.validation.warnings.map((line, index) => <div className="warn" key={`w${index}`}>△ {line}</div>)}
    </div>
  );
}
