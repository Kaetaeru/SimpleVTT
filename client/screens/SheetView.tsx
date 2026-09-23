/**
 * The character sheet rendered from a DerivedCharacter. Every number carries its provenance (hover shows the
 * addends). With `actions` the sheet is live: slots, resources, gold and the bag can be changed in place — the
 * offline session feel. `compact` is the wizard's live preview: one column, read-only.
 */
import { useState, type ReactNode } from "react";
import type { ContentCatalog, SpellView } from "../catalog/catalog";
import { ABILITY_KEYS, ABILITY_KO } from "../catalog/types";
import type { CastMethod } from "../character/play";
import type { CharacterRuntime } from "../character/runtime";
import type { DerivedAttack, DerivedCharacter, DerivedFeature, Term } from "../character/types";
import { effectKeyForFeature, effectKeyForSpell, featureActivation, parseDuration } from "../rules/activation";
import { characterScope } from "../rules/contract";
import { contractDurations } from "../rules/contractActivation";
import { attunementProblem, RARITY_KO } from "../character/customItem";
import { spellExec, sustainOf } from "../compendium/spells";
import { Pill, signed } from "../ui/components";
import { Explain } from "../ui/Explain";

const PROPERTY_KO: Record<string, string> = { light: "경량", heavy: "중량", finesse: "교묘", thrown: "투척", versatile: "다용도", "two-handed": "양손", reach: "간격", ammunition: "탄약", loading: "장전", special: "특수", nick: "닉", "숙련 없음": "숙련 없음" };
const propertyKo = (property: string) => PROPERTY_KO[property] ?? property;

const SOURCE_ORDER: DerivedFeature["source"][] = ["species", "background", "class", "subclass", "feat", "invocation", "metamagic", "item"];
/**
 * R33 (D168): what the engine actually does with a feat. R32 kept this as a hand-written table keyed on the feat's
 * name; it is the derivation's own answer now, written from the feat catalog's config, so the sheet cannot claim a
 * rule the engine does not run — nor stay silent about one it does.
 */
const featRule = (feature: DerivedFeature): string | null => (feature.rules?.length ? feature.rules.join(" · ") : null);

const SOURCE_KO: Record<DerivedFeature["source"], string> = { species: "종족 특성", background: "배경", class: "직업 특성", subclass: "서브클래스 특성", feat: "재주", invocation: "섬뜩한 기원술", metamagic: "메타매직", spell: "주문", item: "마법 아이템" };

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
  /** R75 (D210): attune to a pasted magic item or end it. */
  toggleAttune?: (instanceId: string) => void;
  /** D360: lift a cursed item's curse (the DM's call). */
  liftCurse?: (instanceId: string) => void;
  /** D364: identify an unidentified item. */
  identify?: (instanceId: string) => void;
  /** Roll dice with the overlay: label, formula ("1d20+5"), note. */
  roll: (label: string, formula: string, note?: string, kind?: "check" | "attack" | "damage" | "save" | "initiative" | "custom") => void;
  /** "사용" on a feature: spend its pool, heal/temp HP rolls, start its effect. */
  useFeature: (feature: DerivedFeature) => void;
  /** "종료" on an effect (feature or spell) by its key. */
  endEffect: (key: string) => void;
  /** "시전": spend the chosen slot/pool and start the spell's effect when it lasts. */
  castSpell: (spell: SpellView, method: CastMethod) => void;
  /** At the table: "⚔" on an attack row picks targets and resolves (§12.2). Absent offline. */
  attack?: (attack: DerivedAttack) => void;
}

/** d20 + bonus, plus any dice the terms carry ("+1d4" from Bless). */
const d20 = (bonus: number, terms: Term[] = []) => `1d20${bonus >= 0 ? "+" : "-"}${Math.abs(bonus)}${diceOf(terms)}`;
const diceOf = (terms: Term[]) => terms.filter((term) => term.dice).map((term) => `+${term.dice}`).join("");

export function SheetView({ derived, catalog, runtime, compact = false, actions, playPanel }: { derived: DerivedCharacter; catalog: ContentCatalog; runtime?: CharacterRuntime; compact?: boolean; actions?: SheetActions; /** R67 (D202): what the play sheet puts between the stat strip and the abilities. */ playPanel?: ReactNode }) {
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
  const [casting, setCasting] = useState<string | null>(null);
  const isActive = (key: string) => Boolean(runtime?.effects?.some((effect) => effect.key === key));
  const itemSpellPools = derived.resources.filter((resource) => resource.itemInstanceId && resource.freeCastSpellIds?.length);
  const spellRows = (ids: string[]) => <SpellRows ids={ids} catalog={catalog} derived={derived} runtime={runtime} actions={actions} casting={casting} setCasting={setCasting} />;
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
        <Stat label="이니셔티브" value={<Explain terms={derived.initiativeTerms} total={derived.initiative} label="이니셔티브">{signed(derived.initiative)}</Explain>} sub={live ? undefined : undefined} action={live ? <RollButton onClick={() => actions!.roll("이니셔티브", d20(derived.initiative, derived.initiativeTerms), undefined, "initiative")} /> : null} />
        <Stat label="이동 속도" value={<Explain terms={derived.speed.terms} total={derived.speed.walk} label="이동 속도 (피트)">{derived.speed.walk}ft</Explain>} sub={[derived.speed.fly ? `비행 ${derived.speed.fly}` : "", derived.speed.swim ? `수영 ${derived.speed.swim}` : "", derived.speed.climb ? `등반 ${derived.speed.climb}` : ""].filter(Boolean).join(" · ") || undefined} />
        <Stat label="패시브 지각" value={<Explain terms={derived.passivePerceptionTerms} total={derived.passivePerception} label="패시브 지각">{derived.passivePerception}</Explain>} />
        <Stat label="감각" value={derived.senses.darkvision ? `암시야 ${derived.senses.darkvision}` : "—"} sub={[derived.senses.blindsight ? `맹안시야 ${derived.senses.blindsight}` : "", derived.senses.truesight ? `진실시야 ${derived.senses.truesight}` : ""].filter(Boolean).join(" · ") || undefined} />
      </div>

      {playPanel}

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
              {live ? <div className="cl-row" style={{ gap: 3 }}><RollButton label="판정" onClick={() => actions!.roll(`${ABILITY_KO[key]} 판정`, d20(ability.modifier, derived.checkTerms.filter((term) => !term.abilities || term.abilities.includes(key))), undefined, "check")} /><RollButton label="내성" onClick={() => actions!.roll(`${ABILITY_KO[key]} 내성`, d20(derived.saves[key].bonus), undefined, "save")} /></div> : null}
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
                    {live ? <RollButton onClick={() => actions!.roll(`${skill.name} 판정`, d20(skill.bonus, skill.terms), undefined, "check")} /> : null}
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
                      <span title={item.magic ? [item.magic.description, ...(item.magic.notes ?? [])].filter(Boolean).join("\n") : undefined}>{item.name}{item.custom ? <span className="cl-quiet cl-small"> (직접 입력)</span> : null}{item.magic ? <span className="cl-quiet cl-small"> ✦ {item.magic.rarity ? RARITY_KO[item.magic.rarity] ?? item.magic.rarity : "마법"}</span> : null}{item.magic?.attunement ? (live && actions!.toggleAttune ? <button type="button" className={`cl-btn small quiet${item.attuned ? " active" : ""}`} style={{ marginLeft: 4 }} aria-pressed={item.attuned} disabled={!item.attuned && Boolean(attunementProblem(item.magic, derived))} title={item.attuned ? (item.magic.curse?.cannotUnattune && !item.curseLifted ? "저주 — 조율을 풀 수 없음" : "조율 해제") : attunementProblem(item.magic, derived) ?? (item.magic.attunementRequires?.note ? `조율 (최대 3개) — ${item.magic.attunementRequires.note}` : "조율 (최대 3개)")} onClick={() => actions!.toggleAttune!(item.instanceId)}>{item.attuned ? "조율됨" : "조율"}</button> : <span className="cl-quiet cl-small"> {item.attuned ? "조율됨" : "조율 안 함"}</span>) : null}{item.equipped && item.wieldSlot === "off-hand" ? <span className="cl-quiet cl-small"> 보조손</span> : null}{item.unidentified && live && actions!.identify ? <button type="button" className="cl-btn small quiet" style={{ marginLeft: 4 }} title="DM 판정: 식별 주문, 짧은 휴식 동안 살펴보기, 또는 조율" onClick={() => actions!.identify!(item.instanceId)}>식별</button> : null}{item.magic?.curse && !item.curseLifted && (item.attuned || !item.magic.attunement) ? <span className="cl-small" title={item.magic.curse.note ?? "저주"}> ☠ 저주{live && actions!.liftCurse ? <button type="button" className="cl-btn small quiet" style={{ marginLeft: 4 }} title="DM 판정: 저주 해제(해주 주문 등)" onClick={() => actions!.liftCurse!(item.instanceId)}>저주 풀기</button> : null}</span> : null}</span>
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
                    <td className="num"><Explain terms={attack.attackTerms} total={attack.attackBonus} label={`${attack.name} 명중`}>{signed(attack.attackBonus)}</Explain>{live && actions!.attack ? <button type="button" className="cl-roll" title="대상을 클릭하면 판정" onClick={() => actions!.attack!(attack)}>⚔ 공격</button> : null}{live ? <RollButton onClick={() => actions!.roll(`${attack.name} 명중`, d20(attack.attackBonus, attack.attackTerms), undefined, "attack")} /> : null}</td>
                    <td>{attack.damage} <Explain terms={attack.damageTerms} total={attack.damageBonus} label={`${attack.name} 피해 보너스`}>{signed(attack.damageBonus)}</Explain> {attack.damageType}{live ? <RollButton label="피해" onClick={() => actions!.roll(`${attack.name} 피해`, `${attack.damage.split(" ")[0]}${attack.damageBonus ? `${attack.damageBonus > 0 ? "+" : "-"}${Math.abs(attack.damageBonus)}` : ""}${diceOf(attack.damageTerms)}`, attack.damageType, "damage")} /> : null}</td>
                    <td className="cl-quiet cl-small">{[...attack.properties.map(propertyKo), attack.range ? `사거리 ${attack.range}` : ""].filter(Boolean).join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {derived.spellcasting.length || Object.keys(derived.spellSlots).length || derived.pactMagic || itemSpellPools.length ? (
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
              {/* D351: the spells a working magic item casts from its own charges. */}
              {itemSpellPools.map((pool) => (
                <div className="cl-feature" key={pool.id}>
                  <div className="cl-head"><span className="cl-name">{pool.source}</span><span className="cl-quiet cl-small">충전 {pool.max - (runtime?.resourcesUsed[pool.id] ?? 0)}/{pool.max}</span></div>
                  {live ? spellRows(pool.freeCastSpellIds ?? []) : <div className="cl-small">{(pool.freeCastSpellIds ?? []).map((id) => `${catalog.spellById(id)?.name ?? id} (충전 ${pool.spellCosts?.[id] ?? 1})`).join(", ")}</div>}
                </div>
              ))}
              {derived.spellcasting.map((entry) => (
                <div className="cl-feature" key={entry.key}>
                  <div className="cl-head">
                    <span className="cl-name">{entry.className}</span>
                    <span className="cl-quiet cl-small">{ABILITY_KO[entry.ability]} · DC <Explain terms={entry.saveDcTerms} total={entry.saveDc} label={`${entry.className} 내성 DC`}>{entry.saveDc}</Explain> · 명중 <Explain terms={entry.attackTerms} total={entry.attackBonus} label={`${entry.className} 주문 명중`}>{signed(entry.attackBonus)}</Explain></span>
                  </div>
                  {entry.cantrips.length ? <div className="cl-spell-level"><h4>소마법 {entry.cantripsMax ? `(${entry.cantrips.length}/${entry.cantripsMax})` : ""}</h4>{live ? spellRows(entry.cantrips) : <div className="cl-small">{entry.cantrips.map(spellName).join(", ")}</div>}</div> : null}
                  {entry.alwaysPrepared.length ? <div className="cl-spell-level"><h4>항상 준비</h4>{live ? spellRows(entry.alwaysPrepared) : byLevel(entry.alwaysPrepared).map(([level, names]) => <div className="cl-small" key={level}><span className="cl-quiet">{level}레벨</span> {names.join(", ")}</div>)}</div> : null}
                  {entry.preparedMax ? <div className="cl-spell-level"><h4>준비 주문 ({entry.prepared.length}/{entry.preparedMax})</h4>{live ? spellRows(entry.prepared) : byLevel(entry.prepared).map(([level, names]) => <div className="cl-small" key={level}><span className="cl-quiet">{level}레벨</span> {names.join(", ")}</div>)}</div> : null}
                  {entry.ritualFromSpellbook && live && entry.spellbook ? (() => { const rituals = entry.spellbook.filter((id) => catalog.spellById(id)?.ritual && !entry.prepared.includes(id) && !entry.alwaysPrepared.includes(id)); return rituals.length ? <div className="cl-spell-level"><h4>의식 (주문서에서, 준비 없이)</h4><SpellRows ids={rituals} catalog={catalog} derived={derived} runtime={runtime} actions={actions} casting={casting} setCasting={setCasting} ritualOnly /></div> : null; })() : null}
                  {entry.spellbook ? <div className="cl-spell-level"><h4>주문서 ({entry.spellbook.length}) <span className="cl-quiet">— 준비한 주문만 시전</span></h4>{byLevel(entry.spellbook).map(([level, names]) => <div className="cl-small" key={level}><span className="cl-quiet">{level}레벨</span> {names.join(", ")}</div>)}</div> : null}
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
                    const activation = live ? featureActivation(feature, derived, contractDurations(catalog, characterScope(derived))) : undefined;
                    const pool = activation?.resourceId ? derived.resources.find((resource) => resource.id === activation.resourceId) : undefined;
                    const left = pool ? pool.max - (runtime?.resourcesUsed[pool.id] ?? 0) : undefined;
                    const active = isActive(effectKeyForFeature(feature.id));
                    return (
                      <div className={`cl-feature${active ? " active" : ""}`} key={key}>
                        <div className="cl-head" onClick={() => setOpenFeatures((state) => ({ ...state, [key]: !open }))} style={{ cursor: compact ? "default" : "pointer" }}>
                          <span className="cl-name">{feature.name}</span>
                          {feature.nameEn && feature.nameEn !== feature.name ? <span className="cl-quiet cl-small">{feature.nameEn}</span> : null}
                          {feature.level ? <Pill>{feature.level}레벨</Pill> : null}
                          {active ? <Pill tone="accent">진행 중</Pill> : null}
                          {/* R32 (D167): the sheet says which feats and features the app really runs and which the
                              table does. "궁술 +2" and "대형 무기 전투" change a number; "밤의 영혼의 은총" does not. */}
                          {/* R50 (D185): every feature says what the app does with it, not only the feats. */}
                          {feature.execution ? (feature.execution && feature.execution !== "descriptive" ? <span title={featRule(feature) ?? "앱이 이 재주를 적용합니다"}><Pill tone="good">규칙 적용</Pill></span> : <span title={[featRule(feature), "나머지는 표에서 판단합니다 — 앱은 숫자를 바꾸지 않습니다"].filter(Boolean).join(" · ")}><Pill tone="accent">표에서 판단</Pill></span>) : null}
                          <span className="cl-src">{feature.sourceLabel}</span>
                          {activation ? (
                            <span className="cl-row cl-use" style={{ gap: 4 }} onClick={(event) => event.stopPropagation()}>
                              {pool ? <span className="cl-quiet cl-small">{left}/{pool.max}</span> : null}
                              {activation.note ? <span className="cl-quiet cl-small cl-use-note">{activation.note}</span> : null}
                              {active ? <button type="button" className="cl-btn small danger" onClick={() => actions!.endEffect(effectKeyForFeature(feature.id))}>종료</button> : null}
                              <button type="button" className="cl-btn small primary" disabled={left !== undefined && left <= 0} title={left !== undefined && left <= 0 ? "남은 횟수가 없습니다" : undefined} onClick={() => actions!.useFeature(feature)}>{active ? "다시 사용" : "사용"}</button>
                            </span>
                          ) : null}
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

/** Ways to pay for a spell right now: slots at or above its level with uses left, the pact slot, a free-cast pool, ritual. */
export function castOptions(spell: SpellView, derived: DerivedCharacter, runtime: CharacterRuntime | undefined, ritualOnly = false): Array<{ label: string; method: CastMethod }> {
  if (spell.level === 0) return [{ label: "소마법", method: { kind: "cantrip" } }];
  // V3g (D261): a spellbook ritual that is not prepared is cast only as a ritual (의식 숙련).
  if (ritualOnly) return spell.ritual ? [{ label: "의식 (슬롯 없이, +10분)", method: { kind: "ritual" } }] : [];
  const options: Array<{ label: string; method: CastMethod }> = [];
  for (const [level, count] of Object.entries(derived.spellSlots).map(([key, value]) => [Number(key), value] as const).sort((a, b) => a[0] - b[0])) {
    const left = count - (runtime?.slotsUsed[level] ?? 0);
    if (level >= spell.level && left > 0) options.push({ label: `${level}레벨 슬롯 (${left})`, method: { kind: "slot", level } });
  }
  if (derived.pactMagic && derived.pactMagic.level >= spell.level && derived.pactMagic.count - (runtime?.pactSlotsUsed ?? 0) > 0) options.push({ label: `계약 슬롯 ${derived.pactMagic.level}레벨 (${derived.pactMagic.count - (runtime?.pactSlotsUsed ?? 0)})`, method: { kind: "pact" } });
  for (const resource of derived.resources) {
    const left = resource.max - (runtime?.resourcesUsed[resource.id] ?? 0);
    if ((left > 0 || resource.atWill) && resource.freeCastSpellId === spell.id) options.push({ label: `${resource.label} (${resource.atWill ? "무제한" : left})`, method: { kind: "resource", id: resource.id } });
    // V4n (D276): a pool that pays for any spell up to a level (주문 회상의 은총: 1~4레벨).
    else if (left > 0 && resource.freeCastMaxLevel !== undefined && spell.level > 0 && spell.level <= resource.freeCastMaxLevel) options.push({ label: `${resource.label} (${left})`, method: { kind: "resource", id: resource.id } });
    // V4q (D279): a pool that pays for any one of the spells it names (자연 회복: 회합 주문).
    else if (resource.freeCastSpellIds?.includes(spell.id) && (left >= (resource.spellCosts?.[spell.id] ?? 1) || resource.spellCosts?.[spell.id] === 0)) {
      options.push({ label: `${resource.label}${resource.spellCosts?.[spell.id] !== undefined ? ` ${resource.spellCosts[spell.id]}회` : ""} (${left})`, method: { kind: "resource", id: resource.id } });
      // D356: the same pool at each higher level it can pay for.
      const stats = resource.castStats?.[spell.id];
      const base = stats?.level ?? spell.level;
      if (stats?.perLevel) for (let level = base + 1; level <= (stats.maxLevel ?? 9); level += 1) {
        const cost = (resource.spellCosts?.[spell.id] ?? 1) + (level - base) * stats.perLevel;
        if (cost <= left) options.push({ label: `${resource.label} ${level}레벨 · ${cost}회 (${left})`, method: { kind: "resource", id: resource.id, level } });
      }
    }
  }
  if (spell.ritual) options.push({ label: "의식 (슬롯 없이, +10분)", method: { kind: "ritual" } });
  return options;
}

/** Spell rows grouped by level with a "시전" button (or a picker when several ways to pay exist) and "종료" while the spell is in effect. */
function SpellRows({ ids, catalog, derived, runtime, actions, casting, setCasting, ritualOnly = false }: { ids: string[]; catalog: ContentCatalog; derived: DerivedCharacter; runtime?: CharacterRuntime; actions?: SheetActions; casting: string | null; ritualOnly?: boolean; setCasting: (id: string | null) => void }) {
  const live = Boolean(actions && runtime);
  const spellLevel = (id: string) => catalog.spellById(id)?.level ?? 0;
  const groups = new Map<number, string[]>();
  for (const id of ids) { const level = spellLevel(id); groups.set(level, [...(groups.get(level) ?? []), id]); }
  const isActive = (key: string) => Boolean(runtime?.effects?.some((effect) => effect.key === key));
  return (
    <>
      {[...groups.entries()].sort((a, b) => a[0] - b[0]).map(([level, group]) => (
        <div className="cl-spell-group" key={level}>
          <span className="cl-quiet cl-small">{level === 0 ? "소마법" : `${level}레벨`}</span>
          {group.map((id) => {
            const spell = catalog.spellById(id);
            const name = spell?.name ?? catalog.name(id);
            const duration = parseDuration(spell?.duration);
            const active = isActive(effectKeyForSpell(id));
            const options = spell && live ? castOptions(spell, derived, runtime, ritualOnly) : [];
            return (
              <div className={`cl-spell-row${active ? " active" : ""}`} key={id}>
                <span className="cl-spell-name">{name}{spell?.ritual ? <span className="cl-quiet cl-small"> 의식</span> : null}{duration.concentration ? <Pill tone="accent">집중</Pill> : null}</span>
                {spell ? <span className="cl-quiet cl-small cl-spell-meta">{spell.castingTime.split(/[—,]/)[0]} · {spell.duration}</span> : null}
                {live && spell ? (
                  active ? <>{(() => { const exec = spellExec(id); const sustain = exec ? sustainOf(exec) : null; return sustain ? <>
                    <button type="button" className="cl-btn small primary" title={`${sustain.note ?? "지속 중인 주문을 다시"} · 슬롯 없음${sustain.target === "bound" ? " · 처음 겨눈 대상에게만" : ""}`} onClick={() => actions!.castSpell(spell, { kind: "sustain" })}>↻ 다시</button>
                    {/* D302: what ends the spell that the app cannot see (out of range, total cover) — a button, not a sentence. */}
                    {sustain.endWhen ? <button type="button" className="cl-btn small danger" title={sustain.endWhen} onClick={() => actions!.endEffect(effectKeyForSpell(id))}>⛔ {sustain.endWhen}</button> : null}
                  </> : null; })()}<button type="button" className="cl-btn small danger" onClick={() => actions!.endEffect(effectKeyForSpell(id))}>종료</button></>
                  : options.length === 1 ? <button type="button" className="cl-btn small primary" onClick={() => actions!.castSpell(spell, options[0].method)}>시전</button>
                  : <button type="button" className="cl-btn small primary" disabled={options.length === 0} title={options.length === 0 ? "쓸 수 있는 슬롯이 없습니다" : undefined} onClick={() => setCasting(casting === id ? null : id)}>시전{options.length > 1 ? " ▾" : ""}</button>
                ) : null}
                {casting === id && options.length > 1 ? (
                  <div className="cl-cast-picker" role="group" aria-label={`${name} 시전 방법`}>
                    {options.map((option) => <button type="button" key={option.label} className="cl-btn small" onClick={() => { actions!.castSpell(spell!, option.method); setCasting(null); }}>{option.label}</button>)}
                    <button type="button" className="cl-btn small quiet" onClick={() => setCasting(null)}>취소</button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ))}
    </>
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
