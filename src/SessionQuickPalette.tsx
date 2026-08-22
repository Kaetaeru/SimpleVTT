import { useMemo, useState } from "react";
import "./session-quick-palette.css";

export type SessionQuickDestination = "quick-sheet" | "actor" | "inventory" | "rules" | "encounter" | "participants" | "handout" | "activity" | "session" | "player-session";

type QuickEntry = {
  destination: SessionQuickDestination;
  glyph: string;
  label: string;
  description: string;
  keywords: string;
};

const DM_ENTRIES: QuickEntry[] = [
  { destination:"inventory",glyph:"템",label:"아이템 · 재화",description:"선택한 플레이어에게 빠르게 지급하거나 회수합니다.",keywords:"item inventory gold give take 지급 회수 재화" },
  { destination:"actor",glyph:"액",label:"액터 전환",description:"조작할 세션 액터를 선택합니다.",keywords:"actor 캐릭터 조작" },
  { destination:"encounter",glyph:"인",label:"인카운터",description:"전투원과 이니셔티브를 관리합니다.",keywords:"encounter 전투원 이니셔티브" },
  { destination:"participants",glyph:"참",label:"참가자",description:"플레이어 연결 상태를 확인합니다.",keywords:"participants player 연결" },
  { destination:"handout",glyph:"핸",label:"핸드아웃",description:"이미지를 비공개로 확인하거나 공개합니다.",keywords:"handout image 이미지 공개" },
  { destination:"activity",glyph:"기",label:"활동 기록",description:"최근 판정과 세션 기록을 확인합니다.",keywords:"activity log 기록 판정" },
  { destination:"rules",glyph:"규",label:"규칙 찾기",description:"활성 규칙과 콘텐츠를 검색합니다.",keywords:"rules search 규칙 검색" },
  { destination:"session",glyph:"세",label:"세션 공유·설정",description:"접속 주소와 세션 상태를 관리합니다.",keywords:"session share settings 주소 종료" },
];

const PLAYER_ENTRIES: QuickEntry[] = [
  { destination:"inventory",glyph:"템",label:"내 인벤토리",description:"현재 캐릭터의 아이템과 재화를 확인합니다.",keywords:"item inventory gold 아이템 재화" },
  { destination:"quick-sheet",glyph:"시",label:"빠른 시트",description:"현재 캐릭터의 핵심 수치를 확인합니다.",keywords:"sheet character 캐릭터" },
  { destination:"activity",glyph:"기",label:"활동 기록",description:"공개된 판정과 세션 기록을 확인합니다.",keywords:"activity log 기록 판정" },
  { destination:"rules",glyph:"규",label:"규칙 찾기",description:"활성 규칙과 콘텐츠를 검색합니다.",keywords:"rules search 규칙 검색" },
  { destination:"player-session",glyph:"세",label:"세션 상태",description:"연결 상태와 세션 정보를 확인합니다.",keywords:"session connection 연결" },
];

export function SessionQuickPalette({role,onClose,onChoose}:{role:"dm"|"player";onClose():void;onChoose(destination:SessionQuickDestination):void}) {
  const [query,setQuery]=useState("");
  const entries=role==="dm"?DM_ENTRIES:PLAYER_ENTRIES;
  const normalized=query.trim().toLocaleLowerCase("ko-KR");
  const filtered=useMemo(()=>normalized
    ? entries.filter((entry)=>`${entry.label} ${entry.description} ${entry.keywords}`.toLocaleLowerCase("ko-KR").includes(normalized))
    : entries,[entries,normalized]);

  return <section className="session-quick-panel" role="complementary" aria-label="세션 빠른 메뉴">
      <header className="session-quick-search-row">
        <span className="session-quick-search-glyph" aria-hidden="true">⌕</span>
        <input autoFocus value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="세션 도구 찾기" aria-label="세션 도구 검색" />
        <kbd>Ctrl K</kbd>
        <button type="button" onClick={onClose} aria-label="빠른 메뉴 닫기">×</button>
      </header>
      <div className="session-quick-hint"><span>기존 세션 도구를 현재 장면 옆에서 바로 엽니다.</span><span>Esc 닫기</span></div>
      <div className="session-quick-results" role="list">
        {filtered.map((entry)=><div role="listitem" aria-label={entry.label} key={entry.destination}><button type="button" onClick={()=>onChoose(entry.destination)}>
            <span className="session-quick-result-glyph" aria-hidden="true">{entry.glyph}</span>
            <span><strong>{entry.label}</strong><small>{entry.description}</small></span>
            <span className="session-quick-open" aria-hidden="true">열기</span>
          </button></div>)}
        {filtered.length===0&&<p className="session-quick-empty">일치하는 세션 도구가 없습니다.</p>}
      </div>
  </section>;
}
