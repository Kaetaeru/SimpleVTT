/**
 * V0.9 D349: a character sheet to print.
 *
 * One pure function from a derived character to the two pages a player keeps on the table: the usual arrangement of
 * a fifth-edition sheet — who they are across the top, the six abilities down the side with the saves and skills
 * that hang off each, the numbers a fight asks for in the middle, then attacks, features, training and languages;
 * the second page is spellcasting and gear. The information and its order follow the familiar layout; the look is
 * this app's own.
 *
 * It returns a string so it can be tested without a browser, and it reads only what the engine derived — nothing
 * here knows a class, a spell or an item by name.
 */
import type { ContentCatalog } from "../catalog/catalog";
import type { AbilityKey } from "../catalog/types";
import type { CharacterRuntime } from "../character/runtime";
import type { DerivedCharacter } from "../character/types";
import { PROPERTY_KO } from "../character/featRules";

const ABILITIES: Array<{ key: AbilityKey; ko: string; en: string }> = [
  { key: "str", ko: "근력", en: "STR" }, { key: "dex", ko: "민첩", en: "DEX" }, { key: "con", ko: "건강", en: "CON" },
  { key: "int", ko: "지능", en: "INT" }, { key: "wis", ko: "지혜", en: "WIS" }, { key: "cha", ko: "매력", en: "CHA" },
];

const escape = (text: unknown) => String(text ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
const signed = (value: number) => (value >= 0 ? `+${value}` : `−${Math.abs(value)}`);
const dot = (on: boolean) => `<span class="dot${on ? " on" : ""}" aria-label="${on ? "숙련" : "비숙련"}"></span>`;
const boxes = (count: number) => Array.from({ length: Math.max(0, Math.min(count, 20)) }, () => '<span class="box"></span>').join("");
const field = (label: string, value: unknown, extra = "") => `<div class="field ${extra}"><div class="value">${escape(value)}</div><div class="label">${escape(label)}</div></div>`;

export interface SheetInput {
  derived: DerivedCharacter;
  runtime?: CharacterRuntime;
  catalog: ContentCatalog;
  /** Free text the source carries (appearance, personality, backstory). */
  notes?: { appearance?: string; personality?: string; backstory?: string };
}

function abilityBlock(derived: DerivedCharacter) {
  return ABILITIES.map(({ key, ko, en }) => {
    const ability = derived.abilities[key];
    const save = derived.saves[key];
    const skills = derived.skills.filter((skill) => skill.ability === key);
    return `<section class="ability">
      <header><span class="ab-name">${ko} <small>${en}</small></span><span class="ab-mod">${signed(ability.modifier)}</span><span class="ab-score">${ability.score}</span></header>
      <ul>
        <li class="save">${dot(save.proficient)}<span class="bonus">${signed(save.bonus)}</span><span>내성 굴림</span></li>
        ${skills.map((skill) => `<li>${dot(skill.proficient)}${skill.expertise ? '<span class="dot on"></span>' : ""}<span class="bonus">${signed(skill.bonus)}</span><span>${escape(skill.name)}</span></li>`).join("")}
      </ul>
    </section>`;
  }).join("");
}

function spellsOf(derived: DerivedCharacter, catalog: ContentCatalog) {
  const seen = new Set<string>();
  const rows: Array<{ id: string; name: string; level: number; source: string; always: boolean }> = [];
  for (const casting of derived.spellcasting) {
    const add = (id: string, always: boolean) => {
      if (seen.has(id)) return;
      seen.add(id);
      const spell = catalog.spellById(id);
      rows.push({ id, name: spell?.name ?? id, level: spell?.level ?? 0, source: casting.className, always });
    };
    for (const id of casting.cantrips) add(id, false);
    for (const id of casting.alwaysPrepared) add(id, true);
    for (const id of casting.prepared) add(id, false);
  }
  return rows.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, "ko"));
}

export function sheetHtml({ derived, runtime, catalog, notes }: SheetInput): string {
  const hp = runtime?.hp;
  const classLine = derived.classes.map((cls) => `${cls.name}${cls.subclassName ? ` (${cls.subclassName})` : ""} ${cls.level}`).join(" / ");
  const hitDice = derived.classes.map((cls) => `${cls.level}d${cls.hitDie}`).join(" + ");
  const attacks = derived.attacks.slice(0, 10);
  const features = derived.features.filter((feature) => !feature.id.includes("#"));
  const spells = spellsOf(derived, catalog);
  const slots = Object.entries(derived.spellSlots).filter(([, count]) => count > 0).map(([level, count]) => ({ level: Number(level), count }));
  const speeds = [`보행 ${derived.speed.walk}`, derived.speed.climb ? `등반 ${derived.speed.climb}` : "", derived.speed.swim ? `수영 ${derived.speed.swim}` : "", derived.speed.fly ? `비행 ${derived.speed.fly}` : ""].filter(Boolean).join(" · ");
  const senses = [derived.senses.darkvision ? `암시야 ${derived.senses.darkvision}ft` : "", derived.senses.blindsight ? `맹안시야 ${derived.senses.blindsight}ft` : "", derived.senses.truesight ? `진시야 ${derived.senses.truesight}ft` : ""].filter(Boolean).join(" · ");
  const defenses = [
    derived.defenses.resistances.length ? `저항 ${derived.defenses.resistances.join(", ")}` : "",
    derived.defenses.immunities.length ? `면역 ${derived.defenses.immunities.join(", ")}` : "",
    derived.defenses.vulnerabilities.length ? `취약 ${derived.defenses.vulnerabilities.join(", ")}` : "",
    derived.defenses.conditionImmunities.length ? `상태 면역 ${derived.defenses.conditionImmunities.join(", ")}` : "",
  ].filter(Boolean);

  const page1 = `<section class="page">
    <header class="top">
      <div class="identity">
        ${field("캐릭터 이름", derived.name, "name")}
        <div class="row">${field("배경", derived.background?.name ?? "—")}${field("종족", derived.species?.name ?? "—")}${field("직업 · 레벨", classLine || "—", "wide")}</div>
      </div>
      <div class="vitals">
        <div class="armor">${field("방어도", derived.ac.value, "big")}</div>
        <div class="hp">
          <div class="row">${field("최대 HP", derived.hp.max)}${field("현재 HP", hp ? hp.current : "")}${field("임시 HP", hp?.temp ? hp.temp : "")}</div>
          <div class="row">${field("히트 다이스", hitDice)}<div class="field"><div class="value death">성공 ${boxes(3)}<br>실패 ${boxes(3)}</div><div class="label">죽음 내성</div></div></div>
        </div>
      </div>
    </header>
    <div class="grid">
      <aside class="left">
        <div class="row">${field("숙련 보너스", signed(derived.proficiencyBonus))}<div class="field"><div class="value">${boxes(1)}</div><div class="label">영웅적 영감</div></div></div>
        ${abilityBlock(derived)}
        ${field("수동 지각", derived.passivePerception)}
      </aside>
      <main class="right">
        <div class="row">${field("우선권", signed(derived.initiative))}${field("속도 (ft)", speeds)}${field("크기", derived.size)}${field("감각", senses || "—", "wide")}</div>
        <section class="panel">
          <h3>무기 공격과 소마법</h3>
          <table><thead><tr><th>이름</th><th>명중 / DC</th><th>피해와 유형</th><th>비고</th></tr></thead>
          <tbody>${attacks.map((attack) => `<tr><td>${escape(attack.name)}</td><td>${signed(attack.attackBonus)}</td><td>${escape(attack.damage)}${attack.damageBonus ? ` ${signed(attack.damageBonus)}` : ""} ${escape(attack.damageType)}</td><td>${escape([attack.mastery ? `통달: ${attack.mastery}` : "", ...attack.properties.map((property) => PROPERTY_KO[property] ?? property), attack.range ? `사거리 ${attack.range}` : ""].filter(Boolean).join(", "))}</td></tr>`).join("") || '<tr><td colspan="4" class="empty">—</td></tr>'}</tbody></table>
        </section>
        <section class="panel features">
          <h3>특성</h3>
          ${features.map((feature) => `<div class="feature"><strong>${escape(feature.name)}</strong> <small>${escape(feature.sourceLabel)}${feature.level ? ` · ${feature.level}레벨` : ""}</small></div>`).join("") || '<p class="empty">—</p>'}
        </section>
        <div class="two">
          <section class="panel"><h3>장비 훈련과 숙련</h3>
            <p><b>방어구</b> ${escape(derived.proficiencies.armor.join(", ") || "—")}</p>
            <p><b>무기</b> ${escape(derived.proficiencies.weapons.join(", ") || "—")}</p>
            <p><b>도구</b> ${escape(derived.proficiencies.tools.join(", ") || "—")}</p>
            ${derived.weaponMasteries.length ? `<p><b>무기 통달</b> ${escape(derived.weaponMasteries.join(", "))}</p>` : ""}
          </section>
          <section class="panel"><h3>언어 · 방어</h3>
            <p>${escape(derived.proficiencies.languages.join(", ") || "—")}</p>
            ${defenses.map((line) => `<p>${escape(line)}</p>`).join("")}
          </section>
        </div>
      </main>
    </div>
  </section>`;

  const castingRows = derived.spellcasting.map((casting) => `<div class="row">${field("주문 시전", `${casting.className} · ${ABILITIES.find((item) => item.key === casting.ability)?.ko ?? casting.ability}`, "wide")}${field("주문 내성 DC", casting.saveDc)}${field("주문 명중", signed(casting.attackBonus))}</div>`).join("");
  const resources = derived.resources.filter((resource) => resource.max > 0 && !resource.atWill);
  const inventory = derived.inventory.filter((item) => item.quantity > 0);

  const page2 = `<section class="page">
    <header class="top slim">${field("캐릭터 이름", derived.name, "name")}${field("레벨", derived.level)}</header>
    <section class="panel">
      <h3>주문 시전</h3>
      ${castingRows || '<p class="empty">주문 시전 없음</p>'}
      ${slots.length || derived.pactMagic ? `<div class="slots">${slots.map((slot) => `<div class="slot"><span>${slot.level}레벨</span>${boxes(slot.count)}</div>`).join("")}${derived.pactMagic ? `<div class="slot"><span>계약 ${derived.pactMagic.level}레벨</span>${boxes(derived.pactMagic.count)}</div>` : ""}</div>` : ""}
      ${spells.length ? `<table class="spells"><thead><tr><th>레벨</th><th>주문</th><th>출처</th><th>항상 준비</th></tr></thead><tbody>${spells.map((spell) => `<tr><td>${spell.level === 0 ? "소마법" : spell.level}</td><td>${escape(spell.name)}</td><td>${escape(spell.source)}</td><td>${spell.always ? "●" : ""}</td></tr>`).join("")}</tbody></table>` : ""}
    </section>
    <div class="two">
      <section class="panel"><h3>자원</h3>
        ${resources.map((resource) => `<div class="resource"><span class="res-label">${escape(resource.label)} <small>${escape(resource.recovery)}</small></span>${boxes(resource.max)}${resource.max > 20 ? ` <small>(${resource.max})</small>` : ""}</div>`).join("") || '<p class="empty">—</p>'}
      </section>
      <section class="panel"><h3>장비</h3>
        <ul class="gear">${inventory.map((item) => `<li>${escape(item.name)}${item.quantity > 1 ? ` ×${item.quantity}` : ""}${item.equipped ? " <small>(착용)</small>" : ""}</li>`).join("") || '<li class="empty">—</li>'}</ul>
        <p><b>금화</b> ${runtime?.gold ?? derived.gold} GP</p>
      </section>
    </div>
    ${notes && (notes.appearance || notes.personality || notes.backstory) ? `<section class="panel"><h3>외모 · 성격 · 배경 이야기</h3>${notes.appearance ? `<p>${escape(notes.appearance)}</p>` : ""}${notes.personality ? `<p>${escape(notes.personality)}</p>` : ""}${notes.backstory ? `<p>${escape(notes.backstory)}</p>` : ""}</section>` : ""}
  </section>`;

  return `${page1}${page2}`;
}

/** The print stylesheet the pages expect; A4, two pages, readable on paper in black and white. */
export const SHEET_CSS = `
@page { size: A4; margin: 10mm; }
.sheet { font-family: "Noto Sans KR", "Malgun Gothic", "Apple SD Gothic Neo", system-ui, sans-serif; color: #111; font-size: 9pt; line-height: 1.3; }
.sheet .page { width: 190mm; min-height: 277mm; margin: 0 auto 8mm; padding: 4mm; box-sizing: border-box; background: #fff; border: 1px solid #bbb; display: flex; flex-direction: column; gap: 3mm; }
.sheet .row { display: flex; gap: 2mm; }
.sheet .two { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; }
.sheet .field { flex: 1; border: 1.2px solid #222; border-radius: 2mm; padding: 1.2mm 2mm 1mm; min-width: 0; }
.sheet .field.wide { flex: 2.4; }
.sheet .field .value { font-size: 11pt; font-weight: 600; min-height: 5mm; overflow-wrap: anywhere; }
.sheet .field.big .value { font-size: 22pt; text-align: center; }
.sheet .field.name .value { font-size: 15pt; }
.sheet .field .label { font-size: 6.5pt; text-transform: uppercase; letter-spacing: .06em; color: #555; border-top: 1px solid #ccc; margin-top: .8mm; padding-top: .5mm; }
.sheet .top { display: grid; grid-template-columns: 1.4fr 1fr; gap: 3mm; }
.sheet .top.slim { grid-template-columns: 3fr 1fr; }
.sheet .identity { display: flex; flex-direction: column; gap: 2mm; }
.sheet .vitals { display: grid; grid-template-columns: 26mm 1fr; gap: 2mm; }
.sheet .vitals .hp { display: flex; flex-direction: column; gap: 2mm; }
.sheet .armor .field { height: 100%; display: flex; flex-direction: column; justify-content: center; clip-path: polygon(0 0, 100% 0, 100% 70%, 50% 100%, 0 70%); }
.sheet .grid { display: grid; grid-template-columns: 58mm 1fr; gap: 3mm; flex: 1; }
.sheet .left { display: flex; flex-direction: column; gap: 2mm; }
.sheet .right { display: flex; flex-direction: column; gap: 3mm; }
.sheet .ability { border: 1.2px solid #222; border-radius: 2mm; padding: 1.2mm 2mm; }
.sheet .ability header { display: grid; grid-template-columns: 1fr auto auto; gap: 2mm; align-items: baseline; border-bottom: 1px solid #ccc; padding-bottom: .8mm; margin-bottom: .8mm; }
.sheet .ab-name { font-weight: 700; } .sheet .ab-name small { color: #666; font-weight: 400; }
.sheet .ab-mod { font-size: 14pt; font-weight: 700; } .sheet .ab-score { border: 1px solid #222; border-radius: 1.5mm; padding: 0 1.5mm; font-size: 8pt; }
.sheet .ability ul { list-style: none; margin: 0; padding: 0; }
.sheet .ability li { display: flex; gap: 1.5mm; align-items: center; font-size: 8pt; }
.sheet .ability li.save { font-weight: 600; }
.sheet .bonus { width: 7mm; text-align: right; font-variant-numeric: tabular-nums; }
.sheet .dot { width: 2.4mm; height: 2.4mm; border-radius: 50%; border: 1px solid #222; display: inline-block; flex: none; }
.sheet .dot.on { background: #222; }
.sheet .box { flex: none; width: 2.8mm; height: 2.8mm; border: 1px solid #222; display: inline-block; margin: 0 .4mm; vertical-align: middle; }
.sheet .death { font-size: 7.5pt; font-weight: 400; white-space: nowrap; }
.sheet .death .box { width: 2.4mm; height: 2.4mm; margin: 0 .2mm; }
.sheet .panel { border: 1.2px solid #222; border-radius: 2mm; padding: 1.5mm 2mm; }
.sheet .panel h3 { font-size: 7.5pt; text-transform: uppercase; letter-spacing: .08em; margin: 0 0 1mm; color: #333; }
.sheet .panel p { margin: .5mm 0; }
.sheet table { width: 100%; border-collapse: collapse; font-size: 8pt; }
.sheet th { text-align: left; font-size: 6.5pt; color: #555; border-bottom: 1px solid #999; }
.sheet td { border-bottom: 1px solid #ddd; padding: .6mm .8mm; vertical-align: top; }
.sheet .features { flex: 1; columns: 2; column-gap: 4mm; }
.sheet .features h3 { column-span: all; }
.sheet .feature { break-inside: avoid; margin-bottom: .6mm; }
.sheet .feature small, .sheet small { color: #666; }
.sheet .slots { display: flex; flex-wrap: wrap; gap: 1.5mm 4mm; margin: 1.5mm 0; }
.sheet .slot span { font-weight: 600; margin-right: 1mm; }
.sheet .resource { display: flex; flex-wrap: wrap; align-items: center; gap: 1mm; margin-bottom: .8mm; }
.sheet .resource > .res-label { flex: 1 1 100%; }
.sheet .gear { columns: 2; margin: 0; padding-left: 4mm; }
.sheet .empty { color: #999; }
@media print {
  body { background: #fff !important; }
  .no-print { display: none !important; }
  .sheet .page { border: none; margin: 0; padding: 0; width: auto; min-height: auto; break-after: page; }
  .sheet .page:last-child { break-after: auto; }
}
`;
