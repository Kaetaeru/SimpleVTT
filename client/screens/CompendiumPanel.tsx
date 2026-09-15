/**
 * The Compendium tab (ROLL20_TABLE_SPEC.md §9): SRD monsters, spells and items (plus installed modules) with search
 * and filters. A monster dragged (or "캔버스에 놓기") becomes an NPC journal entry with its own stat block and an
 * unlinked-bar token on the current page (D78); spells and items open their text.
 */
import { useMemo, useState } from "react";
import { useCampaigns } from "../app/campaigns";
import { useClient } from "../app/context";
import { newJournalNpc } from "../campaign/journal";
import { tokenForNpc } from "../campaign/page";
import type { MonsterView } from "../compendium/monsters";
import { CR_VALUES, CREATURE_TYPES, searchMonsters } from "../compendium/monsters";
import { Pill } from "../ui/components";
import { npcSummary, StatBlock } from "./NpcSheet";
import { COMPENDIUM_DRAG_TYPE, placeToken } from "./PageCanvas";

export function CompendiumTab({ onOpenEntry }: { onOpenEntry: (id: string) => void }) {
  const c = useCampaigns();
  const { catalog } = useClient();
  const snapshot = c.table.snapshot!;
  const isGm = snapshot.players.find((player) => player.userId === c.userId)?.role === "gm";
  const [section, setSection] = useState<"monsters" | "spells" | "items">("monsters");
  const [query, setQuery] = useState("");
  const [cr, setCr] = useState("");
  const [type, setType] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const monsters = useMemo(() => (section === "monsters" ? searchMonsters(query, { cr: cr || undefined, type: type || undefined, limit: 80 }) : []), [section, query, cr, type]);
  const needle = query.trim().toLowerCase();
  const spells = useMemo(() => (section === "spells" ? catalog.spells.filter((spell) => !needle || spell.name.toLowerCase().includes(needle) || spell.nameEn.toLowerCase().includes(needle)).slice(0, 80) : []), [section, needle, catalog]);
  const items = useMemo(() => (section === "items" ? catalog.items.filter((item) => !needle || item.name.toLowerCase().includes(needle) || item.nameEn.toLowerCase().includes(needle)).slice(0, 80) : []), [section, needle, catalog]);
  /** NPC + token: the GM's copy of the stat block goes to the journal (folder 괴물), the token to the page centre. */
  const place = (monster: MonsterView) => {
    const count = snapshot.journal.filter((entry) => entry.kind === "npc" && entry.monsterId === monster.id).length;
    const npc = newJournalNpc(snapshot.campaignId, c.userId, monster, { name: count ? `${monster.name} ${count + 1}` : monster.name });
    c.putJournal(npc);
    if (!placeToken(tokenForNpc(npc))) alert("열린 페이지가 없습니다. 저널에는 NPC가 만들어졌습니다.");
  };
  return (
    <div className="cl-compendium">
      <div className="cl-sidebar-tabs" role="tablist" style={{ borderTop: 0 }}>
        {(["monsters", "spells", "items"] as const).map((item) => <button type="button" key={item} role="tab" aria-selected={section === item} className={section === item ? "active" : ""} onClick={() => { setSection(item); setOpen(null); }}>{item === "monsters" ? "괴물" : item === "spells" ? "주문" : "아이템"}</button>)}
      </div>
      <div className="cl-compendium-head">
        <input className="cl-input" placeholder="이름으로 찾기 (한글·영문)" aria-label="컴펜디움 검색" value={query} onChange={(event) => setQuery(event.target.value)} />
        {section === "monsters" ? <div className="cl-row" style={{ gap: 4 }}>
          <select className="cl-select" aria-label="CR" value={cr} onChange={(event) => setCr(event.target.value)} style={{ height: 28 }}><option value="">모든 CR</option>{CR_VALUES.map((value) => <option key={value} value={value}>CR {value}</option>)}</select>
          <select className="cl-select" aria-label="유형" value={type} onChange={(event) => setType(event.target.value)} style={{ height: 28 }}><option value="">모든 유형</option>{CREATURE_TYPES.map((value) => <option key={value} value={value}>{value}</option>)}</select>
        </div> : null}
      </div>
      <div className="cl-compendium-list">
        {section === "monsters" ? monsters.map((monster) => (
          <div key={monster.id} className={`cl-compendium-row${open === monster.id ? " open" : ""}`}>
            <div className="cl-row" style={{ gap: 6 }} draggable={isGm} onDragStart={(event) => { event.dataTransfer.setData(COMPENDIUM_DRAG_TYPE, monster.id); event.dataTransfer.effectAllowed = "copy"; }}>
              <button type="button" className="cl-compendium-name" onClick={() => setOpen(open === monster.id ? null : monster.id)}>{monster.name} <span className="cl-quiet cl-small">{monster.nameEn}</span></button>
              <Pill>CR {monster.crText}</Pill>
              {isGm ? <button type="button" className="cl-btn small" title="저널에 NPC를 만들고 지금 보는 페이지에 토큰을 놓습니다" aria-label={`${monster.name} 캔버스에 놓기`} onClick={() => place(monster)}>놓기</button> : null}
            </div>
            {open === monster.id ? <div className="cl-compendium-detail"><p className="cl-quiet cl-small">{npcSummary(monster)}</p><StatBlock block={monster} compact /></div> : null}
          </div>
        )) : null}
        {section === "spells" ? spells.map((spell) => (
          <div key={spell.id} className={`cl-compendium-row${open === spell.id ? " open" : ""}`}>
            <div className="cl-row" style={{ gap: 6 }}>
              <button type="button" className="cl-compendium-name" onClick={() => setOpen(open === spell.id ? null : spell.id)}>{spell.name} <span className="cl-quiet cl-small">{spell.nameEn}</span></button>
              <Pill>{spell.level === 0 ? "소마법" : `${spell.level}레벨`}</Pill>
            </div>
            {open === spell.id ? <div className="cl-compendium-detail cl-small"><p className="cl-quiet">{spell.school} · {spell.castingTime} · {spell.range} · {spell.components} · {spell.duration}{spell.ritual ? " · 의식" : ""}</p><p style={{ whiteSpace: "pre-wrap" }}>{spell.description ?? spell.summary ?? ""}</p><p className="cl-quiet">{spell.classes.map((id) => catalog.name(id)).join(", ")}</p></div> : null}
          </div>
        )) : null}
        {section === "items" ? items.map((item) => (
          <div key={item.id} className={`cl-compendium-row${open === item.id ? " open" : ""}`}>
            <div className="cl-row" style={{ gap: 6 }}>
              <button type="button" className="cl-compendium-name" onClick={() => setOpen(open === item.id ? null : item.id)}>{item.name} <span className="cl-quiet cl-small">{item.nameEn}</span></button>
              <Pill>{item.kind}</Pill>
            </div>
            {open === item.id ? <div className="cl-compendium-detail cl-small"><p>{item.weapon ? `${item.weapon.training} ${item.weapon.mode} · ${item.weapon.damage} ${item.weapon.damageType} · ${item.weapon.properties.join(", ")}${item.weapon.mastery ? ` · 통달 ${item.weapon.mastery}` : ""}` : item.armor ? `${item.armor.training} · AC ${item.armor.base}${item.armor.dexFull ? " + 민첩" : item.armor.dexMax !== undefined ? ` + 민첩(최대 ${item.armor.dexMax})` : ""}${item.armor.stealthDisadvantage ? " · 은신 불리" : ""}` : item.shieldBonus ? `방패 +${item.shieldBonus}` : ""}{item.priceGp !== undefined ? ` · ${item.priceGp} GP` : ""}{item.weightLb !== undefined ? ` · ${item.weightLb} lb` : ""}</p><p className="cl-quiet">캐릭터 시트의 "아이템 추가"에서 목록으로 넣습니다.</p></div> : null}
          </div>
        )) : null}
        {(section === "monsters" ? monsters : section === "spells" ? spells : items).length === 0 ? <p className="cl-quiet cl-small" style={{ padding: 10 }}>찾는 항목이 없습니다.</p> : null}
      </div>
      {snapshot.journal.some((entry) => entry.kind === "npc") ? <div className="cl-compendium-foot cl-small"><span className="cl-quiet">놓은 NPC:</span> {snapshot.journal.filter((entry) => entry.kind === "npc").slice(-6).map((entry) => <button type="button" key={entry.id} className="cl-journal-link" onClick={() => onOpenEntry(entry.id)}>{entry.name}</button>)}</div> : null}
    </div>
  );
}
