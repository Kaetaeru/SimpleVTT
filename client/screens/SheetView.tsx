/**
 * The character sheet rendered from a DerivedCharacter (read view; every number carries its breakdown as a title).
 * `compact` is the wizard's live preview: same data, one column, fewer descriptions.
 */
import { useState } from "react";
import type { ContentCatalog } from "../catalog/catalog";
import { ABILITY_KEYS, ABILITY_KO } from "../catalog/types";
import type { CharacterRuntime } from "../character/runtime";
import type { DerivedCharacter, DerivedFeature } from "../character/types";
import { Pill, signed } from "../ui/components";

const SOURCE_ORDER: DerivedFeature["source"][] = ["species", "background", "class", "subclass", "feat", "invocation", "metamagic"];
const SOURCE_KO: Record<DerivedFeature["source"], string> = { species: "종족 특성", background: "배경", class: "직업 특성", subclass: "서브클래스 특성", feat: "재주", invocation: "섬뜩한 기원술", metamagic: "메타매직" };

export function SheetView({ derived, catalog, runtime, compact = false }: { derived: DerivedCharacter; catalog: ContentCatalog; runtime?: CharacterRuntime; compact?: boolean }) {
  const [openFeatures, setOpenFeatures] = useState<Record<string, boolean>>({});
  const classLine = derived.classes.map((cls) => `${cls.name}${cls.subclassName ? ` (${cls.subclassName})` : ""} ${cls.level}`).join(" / ") || "직업 없음";
  const spellName = (id: string) => catalog.spellById(id)?.name ?? catalog.name(id);
  const spellLevel = (id: string) => catalog.spellById(id)?.level ?? 0;
  const byLevel = (ids: string[]) => {
    const groups = new Map<number, string[]>();
    for (const id of ids) { const level = spellLevel(id); groups.set(level, [...(groups.get(level) ?? []), spellName(id)]); }
    return [...groups.entries()].sort((a, b) => a[0] - b[0]);
  };
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
        </div>
      </div>

      <div className="cl-stat-row">
        <Stat label="최대 HP" value={String(derived.hp.max)} sub={runtime ? `현재 ${runtime.hp.current}${runtime.hp.temp ? ` (+${runtime.hp.temp} 임시)` : ""}` : `히트 다이스 ${Object.entries(derived.hitDice).map(([die, count]) => `${count}${die}`).join(" ")}`} title={derived.hp.breakdown.join("\n")} />
        <Stat label="AC" value={String(derived.ac.value)} sub={derived.ac.source} title={derived.ac.breakdown.join("\n")} />
        <Stat label="이니셔티브" value={signed(derived.initiative)} />
        <Stat label="이동 속도" value={`${derived.speed.walk}ft`} sub={[derived.speed.fly ? `비행 ${derived.speed.fly}` : "", derived.speed.swim ? `수영 ${derived.speed.swim}` : "", derived.speed.climb ? `등반 ${derived.speed.climb}` : ""].filter(Boolean).join(" · ") || undefined} />
        <Stat label="패시브 지각" value={String(derived.passivePerception)} />
        <Stat label="감각" value={derived.senses.darkvision ? `암시야 ${derived.senses.darkvision}` : "—"} sub={[derived.senses.blindsight ? `맹안시야 ${derived.senses.blindsight}` : "", derived.senses.truesight ? `진실시야 ${derived.senses.truesight}` : ""].filter(Boolean).join(" · ") || undefined} />
      </div>

      <div className="cl-ability-grid">
        {ABILITY_KEYS.map((key) => {
          const ability = derived.abilities[key];
          const title = [`기본 ${ability.base}`, ...ability.bonuses.map((bonus) => `${bonus.source} ${signed(bonus.value)}`)].join("\n");
          return (
            <div className="cl-ability" key={key} title={title}>
              <div className="cl-key">{ABILITY_KO[key]}</div>
              <div className="cl-score">{ability.score}</div>
              <div className="cl-mod">{signed(ability.modifier)}</div>
              <div className="cl-small cl-quiet">내성 {signed(derived.saves[key].bonus)}{derived.saves[key].proficient ? " ●" : ""}</div>
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
                  <span className="cl-bonus">{signed(skill.bonus)}</span>
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
              <h2>자원</h2>
              <table className="cl-table">
                <tbody>
                  {derived.resources.map((resource) => (
                    <tr key={resource.id}><td>{resource.label}</td><td className="num">{runtime ? `${resource.max - (runtime.resourcesUsed[resource.id] ?? 0)}/` : ""}{resource.max}</td><td className="cl-quiet cl-small">{resource.recovery}</td></tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}
          <section className="cl-section">
            <h2>장비 <Pill>{derived.gold} GP</Pill></h2>
            {derived.inventory.length === 0 ? <p className="cl-quiet">장비 없음</p> : (
              <ul className="cl-list" style={{ gap: 2 }}>
                {derived.inventory.map((item) => <li key={item.instanceId} className="cl-small">{item.equipped ? "● " : "○ "}{item.name}{item.quantity > 1 ? ` ×${item.quantity}` : ""}</li>)}
              </ul>
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
                    <td className="num">{signed(attack.attackBonus)}</td>
                    <td>{attack.damage} {signed(attack.damageBonus)} {attack.damageType}</td>
                    <td className="cl-quiet cl-small">{[...attack.properties, attack.range ? `사거리 ${attack.range}` : ""].filter(Boolean).join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {derived.spellcasting.length || Object.keys(derived.spellSlots).length || derived.pactMagic ? (
            <section className="cl-section">
              <h2>주문</h2>
              {Object.keys(derived.spellSlots).length || derived.pactMagic ? (
                <div className="cl-slots">
                  {Object.entries(derived.spellSlots).map(([level, count]) => <div className="cl-slot" key={level}><span className="cl-k">{level}레벨</span><span className="cl-v">{runtime ? `${count - (runtime.slotsUsed[Number(level)] ?? 0)}/` : ""}{count}</span></div>)}
                  {derived.pactMagic ? <div className="cl-slot"><span className="cl-k">계약 {derived.pactMagic.level}레벨</span><span className="cl-v">{runtime ? `${derived.pactMagic.count - runtime.pactSlotsUsed}/` : ""}{derived.pactMagic.count}</span></div> : null}
                </div>
              ) : null}
              {derived.spellcasting.map((entry) => (
                <div className="cl-feature" key={entry.key}>
                  <div className="cl-head"><span className="cl-name">{entry.className}</span><span className="cl-quiet cl-small">{ABILITY_KO[entry.ability]} · DC {entry.saveDc} · 명중 {signed(entry.attackBonus)}</span></div>
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

function Stat({ label, value, sub, title }: { label: string; value: string; sub?: string; title?: string }) {
  return (
    <div className="cl-stat" title={title}>
      <span className="cl-k">{label}</span>
      <span className="cl-v">{value}</span>
      {sub ? <span className="cl-s">{sub}</span> : null}
    </div>
  );
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
