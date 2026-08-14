import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useSimpleVtt } from "./app/AppProvider";
import type { AbilityKey, ItemInstanceVm } from "./app/contracts";
import type { CharacterSheetSpellVm, CharacterSheetTraitVm } from "./app/creationContracts";
import { projectOfficialSheet, SHEET_ABILITY_LABELS, signed } from "./app/characterSheetV10Projection";
import { classIdFromName } from "./app/characterCreationV10Data";

type Props = { onScene(): void; onLevelUp(): void; onEdit(): void };
type FloatingPos = { top:number; left:number; width:number };
const ABILITIES: AbilityKey[] = ["str","dex","con","int","wis","cha"];
const mod = (score:number) => Math.floor((score - 10) / 2);

function floatingPosition(rect: DOMRect): FloatingPos {
  const width = Math.min(390, Math.max(300, window.innerWidth * .29));
  const right = rect.right + 10;
  const left = right + width <= window.innerWidth - 12 ? right : Math.max(12, rect.left - width - 10);
  const top = Math.max(12, Math.min(rect.top, window.innerHeight - 380));
  return { top, left, width };
}

function HoverRule({ title, subtitle, description, lines = [], children }: { title:string; subtitle?:string; description?:string; lines?:string[]; children:ReactNode }) {
  const host = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<FloatingPos | null>(null);
  useEffect(() => {
    if (!open || !host.current) return;
    const update = () => host.current && setPos(floatingPosition(host.current.getBoundingClientRect()));
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => { window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); };
  }, [open]);
  return <>
    <div ref={host} className="sheet-hover-host" tabIndex={0} onPointerEnter={() => setOpen(true)} onPointerLeave={() => setOpen(false)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}>{children}</div>
    {open && pos && createPortal(<div className="sheet-rule-tooltip" style={{ top:pos.top, left:pos.left, width:pos.width }}><strong>{title}</strong>{subtitle && <small>{subtitle}</small>}<p>{description || "이 항목의 상세 설명 데이터는 presentation catalog와 연결되는 중입니다."}</p>{lines.length > 0 && <div>{lines.map((line) => <span key={line}>{line}</span>)}</div>}</div>, document.body)}
  </>;
}

function TraitRow({ trait }: { trait:CharacterSheetTraitVm }) {
  return <HoverRule title={trait.name} subtitle={trait.sourceLabel} description={trait.description} lines={trait.detailLines}><div className="sheet-trait-row"><strong>{trait.name}</strong><small>{trait.sourceLabel}</small></div></HoverRule>;
}

function SpellRow({ spell }: { spell:CharacterSheetSpellVm }) {
  const status = spell.level === 0 ? "소마법" : spell.alwaysPrepared ? "항상 준비" : spell.prepared ? "준비" : "주문서";
  return <HoverRule title={spell.name} subtitle={spell.nameEn} description={spell.description} lines={spell.detailLines}><div className="sheet-spell-row"><span>{spell.level === 0 ? "C" : spell.level}</span><strong>{spell.name}</strong><small>{status}</small></div></HoverRule>;
}

function Box({ title, className = "", children }: { title:string; className?:string; children:ReactNode }) {
  return <section className={`official-box ${className}`}><h3>{title}</h3><div className="official-box-body">{children}</div></section>;
}

function spellcastingAbility(classId:string): AbilityKey | undefined {
  if (["dnd.srd521.class.bard","dnd.srd521.class.paladin","dnd.srd521.class.sorcerer","dnd.srd521.class.warlock"].includes(classId)) return "cha";
  if (["dnd.srd521.class.cleric","dnd.srd521.class.druid","dnd.srd521.class.ranger"].includes(classId)) return "wis";
  if (classId === "dnd.srd521.class.wizard") return "int";
  return undefined;
}

export function CharacterSheetV10({ onScene, onLevelUp, onEdit }: Props) {
  const { snapshot, startLevelUp, editCharacterDraft, toggleItemEquipped, toggleItemAttunement, useItem } = useSimpleVtt();
  if (!snapshot) return null;
  const c = snapshot.activeCharacter;
  const view = useMemo(() => projectOfficialSheet(c), [c]);
  const classId = classIdFromName(c.className);
  const casting = spellcastingAbility(classId);
  const castingMod = casting ? mod(c.abilities[casting]) : 0;
  const cantrips = view.spells.filter((spell) => spell.level === 0);
  const leveledSpells = view.spells.filter((spell) => spell.level > 0);
  const trainingLines = [
    ...(c.masteryWeapons?.length ? [`무기 통달 · ${c.masteryWeapons.join(", ")}`] : []),
    ...(c.toolProficiencies?.length ? [`도구 · ${c.toolProficiencies.join(", ")}`] : []),
  ];

  const edit = async () => { await editCharacterDraft(c.id); onEdit(); };
  const levelUp = async () => { await startLevelUp(c.id); onLevelUp(); };

  return <div className="screen official-sheet-screen">
    <div className="official-sheet-toolbar">
      <div><span>CHARACTER SHEET · SRD 5.2.1</span><strong>{c.name}</strong></div>
      <div><button onClick={edit}>편집</button><button onClick={onScene}>현재 장면</button><button className="primary" onClick={levelUp}>레벨 업</button></div>
    </div>

    <article className="official-sheet-page official-sheet-page-one">
      <header className="official-identity-strip">
        <div className="official-name-block"><small>캐릭터 이름</small><strong>{c.name}</strong><div><span>배경 <b>{c.background}</b></span><span>직업 <b>{c.className}</b></span><span>종족 <b>{c.species}</b></span><span>서브클래스 <b>{c.subclassName || "—"}</b></span></div></div>
        <div className="official-level"><small>레벨</small><strong>{c.level}</strong><span>XP —</span></div>
        <div className="official-shield"><small>방어도</small><strong>{c.ac}</strong><span>AC</span></div>
        <div className="official-hp"><small>히트 포인트</small><div><span>현재 <b>{c.hp}</b></span><span>최대 <b>{c.maxHp}</b></span><span>임시 <b>{c.tempHp}</b></span></div></div>
        <div className="official-hitdice"><small>히트 다이스</small><strong>d{view.hitDie}</strong><span>최대 {c.level} · 사용 0</span></div>
        <div className="official-death"><small>죽음 내성</small><span>성공 ◇◇◇</span><span>실패 ◇◇◇</span></div>
      </header>

      <div className="official-main-layout">
        <aside className="official-stats-column">
          <div className="official-prof"><span>숙련 보너스</span><strong>+{c.proficiencyBonus}</strong></div>
          <div className="official-abilities-grid">
            {ABILITIES.map((ability) => {
              const score = c.abilities[ability];
              const saveProf = view.saveProficiencies.has(ability);
              const save = mod(score) + (saveProf ? c.proficiencyBonus : 0);
              return <section className={`official-ability ability-${ability}`} key={ability}>
                <header><span>{SHEET_ABILITY_LABELS[ability]}</span><strong>{signed(mod(score))}</strong><b>{score}</b></header>
                <div className="official-skill-line save"><i>{saveProf ? "●" : "○"}</i><span>내성 굴림</span><b>{signed(save)}</b></div>
                {view.skillsByAbility[ability].map((skill) => <div className="official-skill-line" key={skill}><i>{view.skillExpertise(skill) ? "◆" : view.skillProficient(skill) ? "●" : "○"}</i><span>{skill}</span><b>{signed(view.skillBonus(skill, ability))}</b></div>)}
              </section>;
            })}
          </div>
          <div className="official-inspiration"><span>영웅적 고양</span><b>◇</b></div>
          <Box title="장비 훈련 & 숙련" className="official-training">{trainingLines.length ? trainingLines.map((line) => <p key={line}>{line}</p>) : <p>현재 시트에 기록된 추가 훈련 없음</p>}</Box>
        </aside>

        <main className="official-play-column">
          <div className="official-quick-metrics"><div><span>우선권</span><strong>{signed(mod(c.abilities.dex))}</strong></div><div><span>이동</span><strong>{c.speed}</strong><small>ft</small></div><div><span>크기</span><strong>{c.size || "—"}</strong></div><div><span>수동 지각</span><strong>{view.passivePerception}</strong></div></div>

          <Box title="무기 & 피해 · 소마법" className="official-attacks">
            <div className="official-table-head"><span>이름</span><span>명중 / DC</span><span>피해 & 유형</span><span>메모</span></div>
            {c.attacks.map((attack) => <div className="official-attack-row" key={attack.id}><strong>{attack.name}</strong><span>+{attack.bonus}</span><span>{attack.damage}</span><span>무기 공격</span></div>)}
            {cantrips.map((spell) => <HoverRule key={spell.id} title={spell.name} subtitle={spell.nameEn} description={spell.description} lines={spell.detailLines}><div className="official-attack-row spell"><strong>{spell.name}</strong><span>{casting ? `DC ${8 + c.proficiencyBonus + castingMod}` : "—"}</span><span>소마법</span><span>hover로 상세</span></div></HoverRule>)}
            {c.attacks.length === 0 && cantrips.length === 0 && <div className="official-empty-line">등록된 공격 또는 소마법 없음</div>}
          </Box>

          <Box title="직업 특성" className="official-class-features"><div className="sheet-trait-grid">{view.classFeatures.length ? view.classFeatures.map((trait) => <TraitRow key={trait.id} trait={trait}/>) : <span className="official-empty-line">직업 특성 없음</span>}</div></Box>

          <div className="official-bottom-traits">
            <Box title="종족 특성"><div className="sheet-trait-grid one">{view.speciesTraits.length ? view.speciesTraits.map((trait) => <TraitRow key={trait.id} trait={trait}/>) : <span className="official-empty-line">종족 특성 없음</span>}</div></Box>
            <Box title="재주"><div className="sheet-trait-grid one">{view.feats.length ? view.feats.map((trait) => <TraitRow key={trait.id} trait={trait}/>) : <span className="official-empty-line">재주 없음</span>}</div></Box>
            <Box title="기타 특성"><div className="sheet-trait-grid one">{view.otherTraits.length ? view.otherTraits.map((trait) => <TraitRow key={trait.id} trait={trait}/>) : <span className="official-empty-line">기타 특성 없음</span>}</div></Box>
          </div>
        </main>
      </div>
    </article>

    <article className="official-sheet-page official-sheet-page-two">
      <div className="official-spell-page-main">
        <div className="official-spell-summary">
          <Box title="주문 시전 능력"><div className="spellcasting-summary">{casting ? <><strong>{SHEET_ABILITY_LABELS[casting]}</strong><span>수정치 <b>{signed(castingMod)}</b></span><span>주문 내성 DC <b>{8 + c.proficiencyBonus + castingMod}</b></span><span>주문 공격 <b>{signed(c.proficiencyBonus + castingMod)}</b></span></> : <span>주문 시전 없음</span>}</div></Box>
          <Box title="주문 슬롯"><div className="spell-slot-grid">{view.spellSlots.map((slot) => <div key={slot.level}><span>{slot.level}레벨</span><strong>{slot.total ?? "—"}</strong><small>{slot.total ? `◇`.repeat(slot.total) : ""}</small></div>)}</div></Box>
        </div>
        <Box title="소마법 & 준비 주문" className="official-spell-list"><div className="spell-list-head"><span>레벨</span><span>이름</span><span>상태</span></div>{view.spells.length ? view.spells.map((spell) => <SpellRow key={spell.id} spell={spell}/>) : <div className="official-empty-line">주문 없음</div>}</Box>
      </div>

      <aside className="official-detail-column">
        <Box title="외형"><div className="sheet-writing-area compact">캐릭터 편집의 외형 필드를 연결할 공간</div></Box>
        <Box title="배경 이야기 & 성격"><div className="sheet-writing-area">{c.notes || `${c.background} 배경 · 서술 메모 없음`}</div></Box>
        <Box title="언어"><div className="sheet-chip-list">{(c.languages ?? []).map((language) => <span key={language}>{language}</span>)}</div></Box>
        <Box title="장비"><div className="official-equipment-list">{c.items.map((item) => <EquipmentRow key={item.id} item={item} onEquip={() => toggleItemEquipped(item.id)} onAttune={() => toggleItemAttunement(item.id)} onUse={() => useItem(item.id)}/>)}</div></Box>
        <Box title="화폐"><div className="official-coins"><span>CP —</span><span>SP —</span><span>EP —</span><span>GP <b>{c.goldGp ?? 0}</b></span><span>PP —</span></div></Box>
      </aside>
    </article>
  </div>;
}

function EquipmentRow({ item, onEquip, onAttune, onUse }: { item:ItemInstanceVm; onEquip():void; onAttune():void; onUse():void }) {
  const usable = item.kind === "consumable" ? item.quantity > 0 : Boolean(item.charges && item.charges.current > 0);
  return <HoverRule title={item.name} subtitle={item.nameEn} description={item.passiveEffects.join(" · ") || undefined} lines={item.provenance}><div className="official-equipment-row"><div><strong>{item.name}</strong><small>{item.quantity > 1 ? `×${item.quantity}` : item.equipped ? "장착" : "보관"}</small></div><div>{item.kind !== "consumable" && <button onClick={onEquip}>{item.equipped ? "해제" : "장착"}</button>}{item.attunementRequired && <button onClick={onAttune}>{item.attuned ? "조율 해제" : "조율"}</button>}{(item.kind === "consumable" || item.charges) && <button disabled={!usable} onClick={onUse}>사용</button>}</div></div></HoverRule>;
}
