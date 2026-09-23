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
import { creatureTypes, crValues, searchMonsters } from "../compendium/monsters";
import { Pill } from "../ui/components";
import { npcSummary, StatBlock } from "./NpcSheet";
import { COMPENDIUM_DRAG_TYPE, placeToken } from "./PageCanvas";
import { addItem } from "../character/play";
import { spellExec } from "../compendium/spells";
import { scrollItemId, scrollName, scrollRarity } from "../rules/scrolls";
import { parseCustomItem } from "../character/customItem";
import type { CampaignItem } from "../campaign/model";

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
  /**
   * R19 (D113): the DM picks a spell and a character, and a scroll holding it lands in that character's bag. Since
   * D361 it is the catalog's own spell-holding item of that level (the SRD's 주문 두루마리), with its numbers.
   */
  const characters = snapshot.journal.filter((entry): entry is Extract<typeof entry, { kind: "character" }> => entry.kind === "character" && !entry.archived);
  const giveScroll = (spell: { id: string; name: string; level: number }, entryId: string) => {
    const entry = characters.find((item) => item.id === entryId);
    if (!entry) return;
    // D361: the catalog's item that holds a spell of this level (the SRD's 주문 두루마리) when there is one — its
    // numbers and rules are the content's; otherwise the R19 scroll.
    const holder = catalog.items.find((item) => {
      const choice = item.magic?.spellChoice as { level?: number; minLevel?: number; maxLevel?: number } | undefined;
      const reads = (item.magic?.use as { castChosen?: unknown } | undefined)?.castChosen;
      return reads && choice && (choice.level === undefined || choice.level === spell.level) && (choice.minLevel ?? 0) <= spell.level && spell.level <= (choice.maxLevel ?? 9);
    });
    const runtime = holder ? addItem(entry.runtime, { itemId: holder.id, name: `${holder.name} (${spell.name})`, spell: spell.id }) : addItem(entry.runtime, { itemId: scrollItemId(spell.id), name: scrollName(spell.name, spell.level) });
    c.putJournal({ ...entry, runtime, updatedAt: new Date().toISOString() });
    c.say(`/em ${entry.name}이(가) ${scrollName(spell.name, spell.level)}을(를) 받았습니다 (${scrollRarity(spell.level)})`);
  };
  return (
    <div className="cl-compendium">
      <div className="cl-sidebar-tabs" role="tablist" style={{ borderTop: 0 }}>
        {(["monsters", "spells", "items"] as const).map((item) => <button type="button" key={item} role="tab" aria-selected={section === item} className={section === item ? "active" : ""} onClick={() => { setSection(item); setOpen(null); }}>{item === "monsters" ? "괴물" : item === "spells" ? "주문" : "아이템"}</button>)}
      </div>
      <div className="cl-compendium-head">
        <input className="cl-input" placeholder="이름으로 찾기 (한글·영문)" aria-label="컴펜디움 검색" value={query} onChange={(event) => setQuery(event.target.value)} />
        {section === "monsters" ? <div className="cl-row" style={{ gap: 4 }}>
          <select className="cl-select" aria-label="CR" value={cr} onChange={(event) => setCr(event.target.value)} style={{ height: 28 }}><option value="">모든 CR</option>{crValues().map((value) => <option key={value} value={value}>CR {value}</option>)}</select>
          <select className="cl-select" aria-label="유형" value={type} onChange={(event) => setType(event.target.value)} style={{ height: 28 }}><option value="">모든 유형</option>{creatureTypes().map((value) => <option key={value} value={value}>{value}</option>)}</select>
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
              {isGm && characters.length && spellExec(spell.id) ? (
                <select className="cl-select" style={{ height: 26, maxWidth: 150 }} aria-label={`${spell.name} 두루마리로 주기`} value="" onChange={(event) => { if (event.target.value) giveScroll(spell, event.target.value); event.target.value = ""; }}>
                  <option value="">📜 두루마리로 주기…</option>
                  {characters.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
                </select>
              ) : null}
            </div>
            {open === spell.id ? <div className="cl-compendium-detail cl-small"><p className="cl-quiet">{spell.school} · {spell.castingTime} · {spell.range} · {spell.components} · {spell.duration}{spell.ritual ? " · 의식" : ""}</p><p style={{ whiteSpace: "pre-wrap" }}>{spell.description ?? spell.summary ?? ""}</p><p className="cl-quiet">{spell.classes.map((id) => catalog.name(id)).join(", ")}</p></div> : null}
          </div>
        )) : null}
        {section === "items" && isGm ? <CampaignItems items={snapshot.items ?? []} characters={characters} onSave={c.saveItems} onGive={(itemId, name, entryId, unidentified, boon) => {
          const entry = characters.find((item) => item.id === entryId);
          if (!entry) return;
          c.putJournal({ ...entry, runtime: addItem(entry.runtime, { itemId, name, ...(unidentified ? { unidentified: true } : {}), ...(boon ? { boon: true } : {}) }), updatedAt: new Date().toISOString() });
          c.say(`/em ${entry.name}이(가) ${unidentified ? "알 수 없는 물건" : name}을(를) 받았습니다`);
        }} /> : null}
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

/**
 * D363: the campaign's magic item library, the GM's. An item is pasted as item JSON (docs/guides/CUSTOM_ITEM_JSON.md),
 * checked by the same parser a sheet uses, and saved to the campaign; a character given it holds only its id, so an
 * edit here reaches every bag that holds it.
 */
function CampaignItems({ items, characters, onSave, onGive }: { items: CampaignItem[]; characters: Array<{ id: string; name: string }>; onSave: (items: CampaignItem[]) => void; onGive: (itemId: string, name: string, entryId: string, unidentified: boolean, boon: boolean) => void }) {
  const { catalog } = useClient();
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [giveTo, setGiveTo] = useState<Record<string, string>>({});
  // D364: give it unidentified — the character sees an unknown thing until it is identified.
  const [hidden, setHidden] = useState(false);
  // D365: give it as a boon — a feature of the character, not a thing in the bag.
  const [asBoon, setAsBoon] = useState(false);
  const read = text.trim() ? parseCustomItem(text, catalog) : undefined;
  const save = () => {
    if (!read || "error" in read) return;
    const definition = JSON.parse(text) as Record<string, unknown>;
    const id = editing ?? `campaign.item.${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    onSave(editing ? items.map((item) => (item.id === editing ? { id, definition } : item)) : [...items, { id, definition }]);
    setText("");
    setEditing(null);
  };
  return (
    <div className="cl-compendium-row" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <strong className="cl-small">캠페인 아이템 (DM) <Pill>{items.length}</Pill></strong>
      <label className="cl-small"><input type="checkbox" checked={hidden} onChange={(event) => setHidden(event.target.checked)} /> 미식별로 주기</label>
      <label className="cl-small"><input type="checkbox" checked={asBoon} onChange={(event) => setAsBoon(event.target.checked)} /> 은혜(특성)로 주기</label>
      {items.map((item) => (
        <div key={item.id} className="cl-row" style={{ gap: 4, flexWrap: "wrap" }}>
          <span className="cl-small" style={{ flex: 1 }}>{String(item.definition.name)}</span>
          <select className="cl-input" aria-label={`${String(item.definition.name)} 받을 캐릭터`} value={giveTo[item.id] ?? ""} onChange={(event) => setGiveTo({ ...giveTo, [item.id]: event.target.value })}>
            <option value="">캐릭터…</option>
            {characters.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
          </select>
          <button type="button" className="cl-btn small" disabled={!giveTo[item.id]} onClick={() => onGive(item.id, String(item.definition.name), giveTo[item.id], hidden && !asBoon, asBoon)}>주기</button>
          <button type="button" className="cl-btn small quiet" onClick={() => { setEditing(item.id); setText(JSON.stringify(item.definition, null, 2)); }}>고치기</button>
          <button type="button" className="cl-btn small quiet" title="가진 캐릭터에게는 이름만 남는다" onClick={() => onSave(items.filter((other) => other.id !== item.id))}>삭제</button>
        </div>
      ))}
      <textarea className="cl-input" aria-label="캠페인 아이템 JSON" rows={6} style={{ width: "100%", fontFamily: "monospace", fontSize: 12 }} placeholder='{ "name": "…", "type": "ring", "bonus": { "ac": 1 } }' value={text} onChange={(event) => setText(event.target.value)} />
      {read ? ("error" in read ? <p className="cl-small" style={{ color: "var(--bad)" }}>{read.error}</p> : read.warnings.length ? <ul className="cl-small">{read.warnings.map((line) => <li key={line}>{line}</li>)}</ul> : <p className="cl-small cl-quiet">형식 확인됨.</p>) : null}
      <div className="cl-row" style={{ gap: 4 }}>
        <button type="button" className="cl-btn small primary" disabled={!read || "error" in read} onClick={save}>{editing ? "고친 것 저장 (가진 캐릭터 모두에게 반영)" : "캠페인에 저장"}</button>
        {editing ? <button type="button" className="cl-btn small quiet" onClick={() => { setEditing(null); setText(""); }}>취소</button> : null}
      </div>
    </div>
  );
}
