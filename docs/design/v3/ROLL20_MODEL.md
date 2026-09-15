# Roll20 역기획 — 게임(캠페인)·세션·저널·페이지 모델을 그대로 가져온다

- 상태: **기획 (2026-09-15)**. 소유자 지시: "캠페인과 세션을 기획상 구체화하자. Roll20의 그것을 그대로 가져와버리자. 역기획해봐."
- 이 문서가 M4의 기준이다. 요소별 상세(페이지·토큰·저널·채팅 명령·트래커·도구·컬렉션·안개)와 **반자동 판정**(공격 버튼 → 대상 클릭 → 규칙대로 굴리고 DM이 확정)은 `ROLL20_TABLE_SPEC.md`에 있다. `CAMPAIGN_RESOURCES.md`의 자산(§3)·전송(§6)·저장(§7)은 그대로 쓰고, 문서 모델·권한·세션 개념은 이 문서가 대체한다. 결정 번호는 D70부터.
- 출처: Roll20 웹앱과 도움말의 구조를 기억에 의존해 정리했다(이 환경에서 roll20 사이트 접근이 막혀 원문 대조는 못 했다). 이름은 Roll20 원어를 병기한다.

## 0. Roll20이 세션을 다루는 방식 — 핵심 한 줄

Roll20에는 "세션"이라는 객체가 없다. **게임(Game)** 하나가 곧 캠페인이고, GM이 "Launch Game"을 누르면 그 게임의 테이블이 열리며, 플레이어는 게임마다 하나뿐인 **참가 링크(Join Link)**로 언제든 들어온다. 모든 것(페이지·토큰·저널·채팅)은 게임 안에 계속 저장되고, "지난 세션"은 채팅 보관함(Chat Archive)을 넘겨 보는 것이다. 우리가 지난번에 만든 "세션 열기 → 초대 코드가 매번 새로 생김 → 세션 기록이 별도 객체"는 이것과 달랐다. 그대로 가져온다:

- D70 세션 객체를 두지 않는다. 게임(캠페인)이 유일한 단위이고, "게임 시작(Launch)"은 호스트가 그 게임의 테이블을 여는 행위다.
- D71 참가 코드는 게임마다 하나이며 바뀌지 않는다(GM이 "링크 다시 만들기"를 누르기 전까지). 플레이어는 같은 코드로 다시 들어온다.
- D72 기록은 채팅 보관함 하나다. 굴림·시트 조작·귓속말·시스템 알림이 전부 채팅 메시지이고, 게임에 영구 저장된다.

## 1. 계정 수준 — 내 게임(My Games)

| Roll20 | 내용 | 우리 |
| --- | --- | --- |
| My Games | 두 목록: **Games I've Created**(내가 GM), **Games I'm Playing**(참가 중). 카드에 이름·썸네일·마지막 플레이·플레이어 수 | "캠페인" 화면: 내가 여는 캠페인 / 참가한 캠페인(참가 코드·호스트 이름·마지막 접속 기억) |
| Create New Game | 이름, 캐릭터 시트 선택(게임 시스템), 애드온 모듈, 기존 게임 설정 복사 | 이름, 규칙(SRD 5.2.1 고정 + 설치 모듈 선택), "이 캠페인에서 복사" |
| Character Vault | 게임 밖에 두는 내 캐릭터 보관함. 게임으로 **가져오기(Import)**, 게임에서 **내보내기(Export)** (GM이 허용해야) | 지금의 캐릭터 라이브러리가 곧 Vault다. 게임에 가져오면 게임이 **사본**을 갖고, 내보내기로 라이브러리에 되돌린다(D73, 아래 §5) |

## 2. 게임 상세(Game Details) — 캠페인 홈

Roll20의 게임 상세 페이지를 그대로 옮긴다.

| 구역 | Roll20 | 우리 |
| --- | --- | --- |
| 헤더 | 게임 이름, 썸네일, **Launch Game** | 캠페인 이름, 이미지, **게임 시작**(호스트 테이블 열기). 이미 열려 있으면 "테이블로" |
| Invite Players | 참가 링크 `app.roll20.net/join/<gameId>/<code>` 복사, 이메일 초대, **링크 다시 만들기** | 참가 코드 `<IP>:41230-<code>`(exe, LAN·하마치) 또는 `tab:<gameId>-<code>`(같은 PC). 코드는 게임에 저장돼 바뀌지 않음; "코드 다시 만들기" |
| Players | 참가자 목록: 아바타·이름·역할(GM 왕관), **Promote to GM / Demote**, **Kick**, GM이 아닌 참가자의 캐릭터 | 참가자 목록: 이름·역할·마지막 접속·소유 캐릭터, 공동 GM 승격/강등, 내보내기(kick) |
| Settings ▾ | **Game Settings**(이름·시트·"플레이어가 Vault로 내보내기 허용"·채팅 아바타·"플레이어가 자기 캐릭터 만들기 허용"), **Chat Archive**, **Copy / Extend Game**, **Transmogrifier**(게임 간 자산 옮기기), **Delete Game** | 설정(이름·규칙·모듈·플레이어 권한 기본값·내보내기 허용), 채팅 보관함, 캠페인 복사, 캠페인 간 자료 옮기기(나중), 삭제 |
| Description / Forum | 게임 소개, 게임 포럼 | 소개 메모(마크다운) — 포럼은 생략(D74) |
| Last Played | 마지막 플레이 시각 | 마지막 "게임 시작" 시각과 참가자별 마지막 접속 |

## 3. 테이블(Tabletop) — 게임 안 화면

### 3.1 큰 틀
- 가운데: 현재 **페이지**(지도 캔버스). 위: 도구 막대. 오른쪽: **사이드바** 탭. 아래: 참가자 아바타 줄(음성·영상은 우리 범위 밖, D75).
- 페이지 도구막대(Page Toolbar): 오른쪽 위에서 펼치는 페이지 썸네일 줄. **플레이어 리본(Player Ribbon)**을 끌어다 놓은 페이지를 플레이어가 본다. GM은 다른 페이지를 마음대로 볼 수 있다. 페이지 추가·복제·설정·보관(archive).

### 3.2 도구 막대(Toolbar)
| 도구 | 내용 |
| --- | --- |
| 선택/이동(Select & Pan) | 토큰·그림 선택·이동, 캔버스 끌기 |
| 레이어(Layers) | **Map & Background** / **Objects & Tokens** / **GM Info Overlay** / **Dynamic Lighting**. GM만 바꿈. 지도 레이어의 것은 플레이어가 못 움직임 |
| 그리기(Drawing) | 자유 그리기·도형·텍스트, 색·굵기 |
| 안개(Fog of War) | 페이지의 안개 켜기, 사각/다각형으로 걷기·되덮기 |
| 자(Ruler) | 격자 단위(기본 5ft/칸) 거리 |
| 확대(Zoom) | 슬라이더, 맞춤 |

### 3.3 사이드바 탭(Sidebar)
| 탭 | 내용 | 우리 1차 범위 |
| --- | --- | --- |
| **Chat** | 채팅·굴림 로그. 명령: `/roll 1d20+5`, `/gmroll`(GM만 봄), `/w <이름> 텍스트`(귓속말), `/em`(행동 묘사), `/desc`(GM 서술), `/talktomyself`; 인라인 굴림 `[[1d8+3]]`; 롤 템플릿(시트 굴림이 카드로 뜸); 메시지에 보낸 사람 아바타 | 전부. 시트의 굴림·특성 사용·피해가 롤 템플릿 카드로 채팅에 뜬다(지금의 "기록"이 채팅으로 합쳐짐) |
| **Art Library** | 내 업로드(이미지·오디오), 폴더·태그, 검색(마켓·외부), 끌어다 지도(배경)나 토큰으로 | 내 업로드(이미지)·폴더·검색·끌어 놓기. 오디오와 마켓은 생략 |
| **Journal** | **핸드아웃(Handout)**과 **캐릭터(Character)**를 폴더로 정리. 항목마다 **In Player's Journals**(누가 보나: All Players 또는 개별)·**Can Be Edited By**(누가 고치나) | 전부 (§4) |
| **Compendium** | 규칙 참조(괴물·주문·아이템). 괴물을 테이블에 끌면 NPC 캐릭터+토큰이 생김 | 우리 카탈로그가 곧 Compendium. 괴물 끌기 → NPC 캐릭터+토큰 |
| **Jukebox** | 음악 재생목록 | 생략(D75) |
| **Collections** | **매크로(Macros)**, **굴림표(Rollable Tables)**, **카드 덱(Decks)** | 굴림표만 1차. 매크로·덱은 나중 |
| **My Settings** | 표시 이름·아바타, 영상/음성, 주사위 설정(3D 주사위), 단축키, 안개 품질 | 표시 이름·아바타·주사위 설정 |

### 3.4 턴 트래커(Turn Tracker)
- 창 하나에 이니셔티브 목록: 토큰 이름·값, 위/아래 정렬, "라운드" 표시(Round counter는 커스텀 항목), 다음 턴(▶). 시트에서 이니셔티브를 굴리면 "트래커에 추가". GM이 열면 플레이어에게도 보인다(GM이 닫으면 사라짐).
- 우리: 그대로. 우리는 규칙 엔진이 있으니 "다음 턴"에 그 토큰의 캐릭터 효과(격노·축복 라운드)를 진행시킨다(D76). 라운드 카운터는 기본 항목.

## 4. 저널(Journal) — 핸드아웃과 캐릭터

### 4.1 공통
- 폴더 트리, 이름 검색, 끌어서 정렬.
- 권한 두 필드(D77): **볼 수 있는 사람(In Player's Journals)**: 없음 / 모든 플레이어 / 개별 선택. **고칠 수 있는 사람(Can Be Edited By)**: 같은 선택지. GM은 항상 전부.
- 항목을 **플레이어에게 보여주기(Show to Players)** — 보이는 사람의 화면에 팝업으로 뜬다.

### 4.2 핸드아웃(Handout)
| 필드 | 내용 |
| --- | --- |
| Name, Avatar | 이름, 대표 이미지(라이브러리에서 끌어 놓기) |
| Notes | 플레이어에게 보이는 본문(서식 텍스트, 이미지 삽입) |
| GM Notes | GM만 보는 본문 |
| In Player's Journals / Can Be Edited By | 권한 |
| Archive | 보관(목록에서 숨김) |

### 4.3 캐릭터(Character) — 탭 셋
| 탭 | Roll20 | 우리 |
| --- | --- | --- |
| **Bio & Info** | Avatar, Name, **In Player's Journals**, **Can Be Edited By**(= 조종하는 사람, Controlled By), Bio & Info(본문), GM Notes, **Default Token**(현재 선택한 토큰을 기본 토큰으로 저장), Tags, Archive | 같은 필드. Controlled By가 우리의 "소유자" |
| **Character Sheet** | 게임 시스템의 시트(D&D 5e by Roll20 등). 굴림 버튼이 채팅에 롤 템플릿으로 | 우리의 시트(생성 마법사·운용 시트·효과·주사위)가 그대로 이 탭 |
| **Attributes & Abilities** | 속성(name / current / max) 목록 — 토큰 바가 여기에 연결. 능력(Abilities) = 매크로, "토큰 액션으로 표시" | 속성은 파생값(HP·AC·이동 등)이 자동 제공 — 토큰 바 연결 대상. 능력/매크로는 나중 |
| NPC | Compendium에서 끌어온 괴물은 NPC 시트(스탯 블록) | 괴물 스탯 블록 시트(V2 커널의 것 이식) |

### 4.4 캐릭터의 출처 — Vault ↔ 게임 (D73)
- 플레이어가 게임에 들어오면 Journal에서 **새 캐릭터**를 만들거나, **Vault(내 라이브러리)에서 가져오기**로 사본을 만든다. 그 순간부터 **게임의 사본이 원본**이다(Roll20과 동일). 플레이어가 시트를 고치면 게임에 저장된다.
- **Vault로 내보내기**: 게임 설정에서 GM이 허용하면 플레이어가 언제든 자기 캐릭터를 라이브러리로 복사해 간다(덮어쓰기 확인).
- 지난번의 "참조 + 자동 되돌려 쓰기"는 버린다. 어느 쪽이 원본인지 항상 분명하다.

## 5. 페이지(Page)와 토큰(Token)

### 5.1 페이지 설정(Page Settings)
| 필드 | 내용 |
| --- | --- |
| Name | 페이지 이름 |
| Size | 가로×세로(단위 칸 수), **Scale**(1칸 = 5ft, 단위 선택) |
| Grid | 켜기/끄기, 종류(정사각/육각), 크기, 색·불투명도, 라벨 |
| Background | 배경색; 배경 이미지는 지도 레이어에 이미지를 놓는 것 |
| Fog of War | 켜기/끄기 |
| Dynamic Lighting | 켜기/끄기, 낮 모드, 시야 제한 | 
| 페이지 동작 | 복제, 보관(Archive), 삭제; 플레이어 리본 |

### 5.2 토큰 설정(Token Settings) — 기본 탭
| 필드 | 내용 |
| --- | --- |
| Name, 이름 표시(Show nameplate) | 플레이어에게 이름 보임/편집 가능 |
| **Represents Character** | 연결된 저널 캐릭터(없으면 순수 그림) |
| **Controlled By** | 조종자(캐릭터에서 상속 또는 토큰별) |
| **Bar 1/2/3** | value / max; **속성에 연결(Link to attribute)** — 연결하면 같은 캐릭터의 모든 연결된 토큰이 값을 공유, 연결하지 않으면 토큰마다 따로(몹). 바마다 "플레이어에게 보임 / 편집 가능" |
| Aura 1/2 | 반지름·색, 플레이어에게 보임 |
| Tint | 색 입히기 |
| Status Markers | 상태 아이콘(여러 개, 숫자 뱃지) |
| GM Notes | 토큰 메모 |
| 고급 탭 | Size(가로·세로 칸, 비율 고정), Vision(시야 켜기·거리), Emits Light(밝은·약한 빛), Is Drawing, Advanced Fog |
| **Default Token** | 캐릭터의 Bio 탭에서 "선택한 토큰을 기본 토큰으로" — 저널에서 끌어 놓을 때 이 설정으로 생성 |
| Token Actions | 캐릭터 능력 중 "토큰 액션"으로 표시한 것이 토큰 선택 시 위에 버튼으로 |

- D78 몹 규칙(Roll20 그대로): 같은 캐릭터를 대표하는 토큰이 여럿일 때 바가 속성에 **연결돼 있지 않으면** 토큰별 HP. PC는 HP를 속성에 연결(시트와 동기).

### 5.3 레이어 규칙
- 지도 레이어의 이미지는 플레이어가 못 잡음. 토큰 레이어의 자기 토큰만 움직임(Controlled By). GM 정보 레이어는 GM만 봄. 동적 조명 레이어는 벽·문.

## 6. 참가와 역할

| Roll20 | 우리 |
| --- | --- |
| 참가 링크 열기 → "Join as Player" → 표시 이름 → 테이블 입장. 이후 My Games의 "Games I'm Playing"에 뜸 | 참가 코드 → 표시 이름 → 입장. 캠페인 화면 "참가한 캠페인"에 남아 다음엔 클릭으로 재입장(호스트가 켜져 있어야 함) |
| 역할: GM(만든 사람), 승격된 GM(co-GM), Player | 같음. 공동 GM은 호스트 PC가 아니어도 GM 권한(D79: 권한은 역할로, 권위는 호스트 프로세스로) |
| GM이 "Kick" | 참가자 목록에서 내보내기 → 그 사람의 코드가 무효(코드 다시 만들기 안내) |
| 플레이어가 "Leave Game"(My Games에서) | "참가한 캠페인"에서 나가기 |
| Rejoin | 같은 코드·같은 사용자 id로 다시 들어오면 같은 참가자 |

## 7. 우리 데이터 모델 (Roll20 객체 그대로)

```
Game (캠페인)                  { id, name, avatar, ruleset, moduleIds, joinCode, settings, description, createdAt, lastLaunchedAt }
 ├─ Player[]                    { userId, displayName, avatar, role: "gm" | "player", lastSeenAt, color }
 ├─ Page[]                      { id, name, width, height, scale, grid{...}, background, fogEnabled, lightingEnabled, archived, order,
 │    ├─ Graphic[]                 layer: "map" | "objects" | "gminfo"; { id, imageId | drawing, x, y, w, h, rotation, z,
 │    │                            represents?: characterId, controlledBy, name, showName, bar1..3{value,max,link,visible,editable}, aura1..2, tint, statusMarkers[], light{...}, vision{...}, gmNotes }
 │    ├─ Path[] (그림)           { layer, points, stroke, fill }
 │    └─ Fog                     { revealed: polygon[] }
 ├─ Character[]                 { id, name, avatar, folder, inPlayersJournals: "none"|"all"|userId[], controlledBy: same, bio, gmNotes, defaultToken, archived,
 │                                sheet: { source: CharacterSource, runtime: CharacterRuntime } | { statBlock (NPC) } }
 ├─ Handout[]                   { id, name, avatar, folder, inPlayersJournals, editableBy, notes, gmNotes, archived }
 ├─ Folder[]                    { id, name, parent, kind: "journal" | "art" }
 ├─ Asset[]                     { id, hash, mime, bytes, width, height, name, folder, tags }   (Art Library)
 ├─ RollableTable[]             { id, name, rows[{weight, text|imageId}], playerVisible }
 ├─ ChatMessage[] (Archive)     { id, at, type: "general"|"whisper"|"emote"|"desc"|"rollresult"|"system", who, playerId, target?, content, roll?: {...}, template? }
 ├─ TurnOrder                   { entries[{ tokenId|custom, name, value }], current, round }
 └─ PlayerPageMap               { ribbonPageId, perPlayerPageId? }   (플레이어 리본 / 파티 나누기)
```

- 게임 하나가 파일 트리 하나(`campaigns/<gameId>/…`, CAMPAIGN_RESOURCES.md §7). 채팅 보관함은 `chat/<yyyy-mm>.jsonl`.
- 권한은 저널 항목·토큰의 필드로 산다(FVTT식 4단계 문서 권한 대신, D77).

## 8. 동기화 — Roll20의 방식과 우리 대응

- Roll20: 서버(Firebase)가 권위. 클라이언트가 객체를 바꾸면 서버가 저장하고 모두에게 밀어 준다. 클라이언트는 낙관적으로 먼저 그린다.
- 우리: 호스트 exe가 서버(CAMPAIGN_RESOURCES.md §5 유지). 객체 단위 패치(`page/<id>/graphic/<id>`) + 시트 조작은 순수 op. 토큰 이동처럼 잦은 것은 낙관적으로 먼저 그리고 호스트 확인으로 맞춘다(D80: 토큰 이동·그리기만 낙관적, 규칙 결과는 호스트 확정).
- 입장 시 스냅샷 = 게임 전체를 그 사람의 권한으로 투영(저널 항목의 두 필드, 토큰의 바 가시성, GM 레이어 제외). 이미지는 필요할 때 해시로 스트리밍.

## 9. 화면 목록 (그대로)

1. **캠페인(내 게임)**: 두 목록(내가 GM / 참가 중), 새 캠페인, 카드(이름·이미지·마지막 플레이·참가자 수).
2. **캠페인 상세**: 게임 시작, 참가 코드(복사·다시 만들기), 참가자(역할·승격·내보내기), 설정 ▾(설정·채팅 보관함·복사·삭제), 소개.
3. **테이블**: 페이지 캔버스 + 도구막대 + 페이지 줄(리본) + 사이드바(채팅·아트 라이브러리·저널·컴펜디움·컬렉션·내 설정) + 턴 트래커 창 + 참가자 줄.
4. **저널 항목 창**: 핸드아웃(노트·GM 노트·권한) / 캐릭터(Bio·시트·속성).
5. **토큰 설정 창**: 기본·고급 탭.
6. **페이지 설정 창**.
7. **캐릭터 라이브러리(Vault)**: 지금 화면 + "캠페인으로 가져오기 / 캠페인에서 내보내기".

## 10. 구현 순서 — 화면이 보이는 순서로

| 단계 | 내용 | 검증 |
| --- | --- | --- |
| R1 게임 홈 | 캠페인 목록(GM/참가), 새 캠페인, 상세(게임 시작·참가 코드·참가자·설정·삭제), 참가 코드로 입장, 참가자 역할·내보내기 | 두 탭: 만들기 → 코드 → 입장 → 참가자 목록·재입장 |
| R2 채팅 | 사이드바 채팅 + 보관함 영구 저장, `/roll` `/w` `/gmroll` `/em` `/desc`, 인라인 굴림, 시트 굴림이 롤 템플릿 카드로 | 두 탭: 굴림·귓속말(상대만)·GM 굴림(GM만)·보관함 재입장 시 복원 |
| R3 저널 | 핸드아웃·캐릭터·폴더, 두 권한 필드, 플레이어에게 보여주기, Vault 가져오기/내보내기, GM의 캐릭터 생성·조종자 지정 | 두 탭: 권한별 가시성, 보여주기 팝업, 가져오기 사본·내보내기 |
| R4 아트 라이브러리 | 이미지 업로드(해시)·폴더·검색, 핸드아웃/아바타/기본 토큰에 사용, 청크 전송·캐시 | 두 탭: 업로드 → 상대 화면에 도착·캐시 |
| R5 페이지·토큰 | 페이지(설정·복제·보관·리본), 레이어, 토큰(설정 기본 탭·바·상태·이름), 캐릭터에서 끌어 토큰, 기본 토큰, 이동 권한, 자 | 두 탭: 리본 이동, 토큰 이동 권한, 바 공유/미공유(몹) |
| R6 턴 트래커·컴펜디움 | 트래커(추가·정렬·다음·라운드), 시트 이니셔티브 → 트래커, 괴물 끌기 → NPC 시트+토큰, 굴림표 | 두 탭: 트래커 표시 동기, 라운드 진행 시 효과 진행 |
| R7 안개·그리기·GM 레이어 | 안개 걷기, 그리기 도구, GM 정보 레이어 | 두 탭: 플레이어에겐 안 보임 |
| 이후 | 동적 조명(V2 커널 이식), 매크로·덱, 캠페인 복사·자료 옮기기 | |

각 단계는 지난 방식대로 커밋·게이트·두 탭 E2E·증거를 남기고, 시나리오는 `SESSION_SCENARIOS.md`를 이 문서 기준으로 다시 쓴다.

## 11. 결정 요약과 확인 요청

- D70 세션 객체 없음, 게임(캠페인)이 단위. D71 참가 코드는 게임당 하나·고정. D72 기록은 채팅 보관함. D73 게임의 캐릭터 사본이 원본, Vault는 가져오기/내보내기. D74 포럼 생략. D75 음성·영상·주크박스·마켓 생략. D76 턴 트래커의 "다음 턴"이 효과 라운드를 진행. D77 권한은 저널 항목의 두 필드(볼 수 있는 사람 / 고칠 수 있는 사람). D78 토큰 바 연결 여부로 몹 HP 분리. D79 공동 GM. D80 토큰 이동·그리기만 낙관적.
- 확인 부탁: (1) 이름을 Roll20처럼 "게임"으로 부를지, 지금처럼 "캠페인"으로 둘지. (2) R1 다음에 R2 채팅으로 갈지, R5 페이지·토큰(지도)으로 먼저 갈지. (3) 플레이어가 게임 안에서 새 캐릭터를 만들 수 있게 할지(Roll20 기본 허용), 아니면 라이브러리에서 가져오기만 할지.
