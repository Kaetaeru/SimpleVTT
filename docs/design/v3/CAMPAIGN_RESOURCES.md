# 캠페인·리소스 관리 설계 (V3 새 클라이언트, M4 멀티세션 전제)

- 상태: **구상 (2026-09-15)**. 소유자 지시: "LAN으로 할 거야. 하마치로도 구동이 가능하게. 캠페인의 큰 틀을 먼저 깔끔하게 — VTT의 리소스 관리. Roll20·FVTT를 착안해 이미지·NPC·PC·아이템을 어떻게 넣고 어떻게 동기화할지."
- 범위: 데이터 모델(무엇을 어떤 단위로 저장하나), 자산(이미지) 처리, 권한과 투영, 동기화 규약, LAN/하마치 전송, 저장·이식, 화면 청사진, 구현 순서. 전투 커널(지도·토큰 규칙)은 `V2` 문서를 그대로 쓰고 여기서는 "장면 문서"의 자리만 잡는다.
- 이 문서의 결정은 D60부터 번호를 붙인다(NEW_CLIENT.md는 D52까지 썼다).
- **2026-09-15 갱신**: 소유자 결정으로 문서 모델·권한·세션 개념은 `ROLL20_MODEL.md`(Roll20 역기획)가 대체한다. 이 문서의 §3 자산, §6 전송(LAN·하마치), §7 저장은 계속 유효. §1·§2·§4·§5·§9의 세션 객체·4단계 권한·되돌려 쓰기(D60·D62·D67)는 폐기.

## 0. 참고한 두 VTT에서 가져올 것과 버릴 것

| | Roll20 | Foundry VTT | 우리가 취하는 것 |
| --- | --- | --- | --- |
| 단위 | 게임(캠페인) 안에 Journal(핸드아웃·캐릭터), 페이지(맵), 컴펜디움(읽기 전용 규칙) | World(캠페인) 안에 Document(Actor·Item·Scene·JournalEntry·RollTable…) + Compendium pack(보관함) | **카탈로그(규칙, 읽기 전용) → 라이브러리(DM의 재사용 보관함) → 캠페인(살아 있는 인스턴스) → 세션(테이블 런타임)** 네 층 |
| 포함 관계 | 캐릭터 시트가 아이템을 텍스트로 가짐 | Actor가 Item·ActiveEffect를 **내장 문서**로 가짐, Scene이 Token을 내장 | 내장 문서 채택: PC/NPC는 아이템·효과를 안에 갖고, 장면은 토큰을 안에 갖는다. 토큰은 액터를 **참조**한다 |
| 원형 토큰 | 없음(토큰 설정을 매번) | Prototype Token | 액터마다 원형 토큰(이미지·크기·시야). 장면에 놓을 때 복사, 이후 장면 토큰만 바뀜 |
| 권한 | "플레이어에게 공개" 토글 + 캐릭터 편집/열람 지정 | 문서마다 None/Limited/Observer/Owner, 기본값 + 사용자별 | FVTT 4단계 채택 + 필드 단위 숨김(NPC HP·GM 메모) |
| 자산 | Roll20 라이브러리 업로드, 페이지에 배치 | 서버 데이터 폴더의 파일 경로 참조, 클라이언트가 HTTP로 받음 | 파일은 **내용 해시**로 저장·참조. 호스트가 갖고 클라이언트에 스트리밍·캐시 |
| 동기화 | 서버 권위, 실시간 반영 | 서버 권위, 클라이언트가 update 요청 → 서버가 diff 브로드캐스트 | 호스트 권위. **명령 → 이벤트 → 브로드캐스트**, 문서는 버전 붙은 패치 |
| 규칙 데이터 | 컴펜디움(유료) | 시스템 패키지 + 컴펜디움 | 이미 있는 카탈로그(`client/catalog`, SRD 모듈 JSON 설치)를 그대로 |
| 버릴 것 | 페이지 단위 밖의 전역 상태, 매크로 언어 | 모듈 생태계·서버 프로세스·월드 마이그레이션 부담 | 한 프로세스(호스트 exe)가 서버. 브라우저 클라이언트는 나중에 게이트웨이로 |

## 1. 네 층: 카탈로그 → 라이브러리 → 캠페인 → 세션

```
카탈로그 (읽기 전용)        SRD 5.2.1 + 설치 모듈: 종족·직업·주문·아이템·괴물 스탯 블록. id로만 참조. 이미 있음.
   ↓ 참조
라이브러리 (DM의 보관함)     캠페인과 무관하게 재사용: NPC 프리셋, 사용자 아이템, 이미지·자료, 핸드아웃 템플릿, 굴림표, 장면 템플릿.
   ↓ 복사(인스턴스화)
캠페인 (하나의 이야기)       PC(플레이어 캐릭터 참조), NPC 인스턴스(HP·위치·메모가 붙은 사본), 장면, 저널, 파티 창고, 캠페인 시계, 세션 기록.
   ↓ 열기
세션 (테이블 런타임)         참가자, 현재 장면, 이니셔티브, 진행 중 효과, 이벤트 로그. 끝나면 캠페인에 반영되고 로그만 남는다.
```

- 라이브러리→캠페인은 **복사**다(FVTT의 컴펜디움→월드 가져오기). 라이브러리를 고쳐도 이미 캠페인에 들어간 NPC는 안 바뀐다. 대신 "원본에서 갱신" 버튼으로 명시적으로 다시 받는다.
- PC는 예외로 **참조**다. 플레이어의 캐릭터 라이브러리 레코드(`CharacterRecord`, 원본+런타임)가 원본이고, 캠페인은 `characterId`와 마지막으로 본 사본(스냅샷)만 갖는다. 세션 중에는 호스트 사본이 권위이고, 세션이 끝나면(또는 주기적으로) 플레이어 쪽 라이브러리에 되돌려 쓴다(옛 클라이언트의 write-back과 같은 원칙, D60).

## 2. 문서 모델

모든 것이 같은 껍데기를 쓴다. 저장·전송·권한·패치가 이 껍데기 하나만 알면 되도록.

```ts
interface Document<K extends DocumentKind, T> {
  id: string;            // `doc_<ulid>` — 캠페인·세션·라이브러리 어디서나 유일
  kind: K;               // "character" | "npc" | "item" | "asset" | "handout" | "scene" | "rolltable" | "folder" | "party-stash" | "campaign"
  name: string;
  folder?: string;       // 폴더 문서 id (Roll20·FVTT 모두 폴더 트리)
  version: number;       // 바뀔 때마다 +1. 패치의 if-version 기준
  updatedAt: string;
  ownership: Ownership;  // 아래 §4
  tags?: string[];
  data: T;               // kind별 본문
}
```

kind별 본문(요지):

| kind | data | 내장 문서 | 카탈로그 참조 |
| --- | --- | --- | --- |
| `character` (PC) | `{ characterId, source: CharacterSource, runtime: CharacterRuntime, prototypeToken }` | 아이템·효과는 `runtime.inventory`·`runtime.effects`에 이미 있음 | 종족·직업·주문·아이템 id |
| `npc` | `{ statBlock: MonsterStatBlock \| { catalogId, overrides }, runtime: NpcRuntime(hp, conditions, effects, resources), prototypeToken, gmNotes, loot: EmbeddedItem[] }` | 아이템, 효과 | 괴물 스탯 블록 id, 아이템 id |
| `item` | `{ base?: catalogItemId, name, kind, weapon?, armor?, description, charges?, attunement?, priceGp, image?: assetId }` | — | 기본 아이템 id(있으면 그 위에 덮어씀) |
| `asset` | `{ hash, mime, bytes, width, height, thumbHash?, sourceName }` | — | — |
| `handout` | `{ blocks: (text \| image(assetId))[], playerText?, gmText? }` | — | — |
| `scene` | `{ background: assetId, grid: { size, offset, type }, dimensions, tokens: Token[], drawings?, walls?, lights?, initiative?: InitiativeState, notes }` | `Token { id, actorRef: {kind:"character"\|"npc", id}, x, y, size, image?: assetId, hidden, elevation, statusIcons, overrides? }` | — |
| `rolltable` | `{ formula, rows: { range, text \| docRef }[] }` | — | — |
| `party-stash` | `{ gold, items: EmbeddedItem[], log }` | 아이템 | 아이템 id |
| `campaign` | `{ title, ruleset, moduleIds, clock, sessions: SessionRecord[], settings }` | — | 설치 모듈 id·해시 |

- **NPC 인스턴스**는 라이브러리 프리셋의 사본이다. `statBlock`이 카탈로그 괴물이면 `{ catalogId, overrides }`로 가볍게, 직접 만든 스탯 블록이면 통째로 갖는다. 같은 고블린 다섯은 문서 다섯이 아니라 장면 토큰 다섯이 같은 NPC 문서를 참조하고, 토큰별 HP만 `Token.overrides.hp`로 갈라진다(FVTT의 "연결 안 된 토큰" 개념. D61: 기본은 토큰별 HP 분리, "연결된 토큰"은 옵션).
- **아이템**은 세 곳에 산다: 카탈로그(규칙, 불변), 라이브러리 `item` 문서(DM이 만든 마법 아이템), 캐릭터/NPC/창고 안의 내장 아이템(`{ instanceId, itemId? | docId?, name, quantity, equipped, attuned, charges }`). 캐릭터의 가방(`InventoryPatch.extra`)은 이미 `itemId?`와 `name`을 갖고 있으니 `docId?`(라이브러리 아이템 참조)만 더한다. DM이 플레이어에게 아이템을 주는 것은 "내장 아이템 하나를 NPC/창고에서 PC로 옮기는 이벤트"다.
- **핸드아웃**은 Roll20의 Journal handout처럼 플레이어용 본문과 GM 메모가 나뉜다. 공개는 문서 권한(§4)으로 한다.
- **장면**은 지금은 배경 이미지 + 격자 + 토큰까지만 잡는다. 벽·조명·시야는 V2 커널 이식 때 같은 문서에 필드를 더한다.

## 3. 자산(이미지) 처리

- **저장**: 파일 본문은 내용 해시(sha-256)로 저장한다. Tauri(exe)에서는 앱 데이터 폴더 `assets/<hash>.<ext>`, 브라우저 전용 실행에서는 IndexedDB blob 저장소 `assets`에. 같은 이미지를 두 번 넣어도 한 번만 저장되고, 문서는 `assetId`(= `asset` 문서 id)로만 가리키며 `asset.data.hash`가 파일을 가리킨다.
- **넣는 길**: 드래그 앤 드롭(라이브러리·장면·핸드아웃·토큰 위), 파일 선택, 클립보드 붙여넣기. 넣을 때 크기 제한(기본 20MB)·썸네일(256px, webp)·치수 기록. 큰 배경은 옵션으로 webp 재인코딩 제안.
- **전송**: 클라이언트는 문서를 받으면 `assetId`만 안다. 필요할 때 `asset.request(hash)`를 보내고 호스트가 64KB 청크로 스트리밍한다(§6의 바이너리 프레임). 우선순위: 현재 장면 배경 → 화면에 보이는 토큰 → 공개 핸드아웃 → 나머지 미리 받기. 받은 것은 해시로 캐시하니 다음 세션에서 다시 받지 않는다. 진행률은 "자료 받는 중 3/12"로 표시.
- **권한**: 자산 자체엔 권한이 없다. 자산을 참조하는 문서가 그 클라이언트에 투영될 때만 해시가 노출되고, 호스트는 "그 클라이언트에 투영된 적 있는 해시"만 내준다(숨긴 장면의 배경을 먼저 받아 갈 수 없다).
- **GC**: 어떤 문서도 참조하지 않는 자산은 라이브러리 정리 화면에서 목록·용량과 함께 삭제 제안.

## 4. 권한과 투영

- 문서 권한(FVTT 4단계, D62): `ownership: { default: "none"|"limited"|"observer"|"owner", users: Record<userId, level> }`.
  - none: 존재도 모름 · limited: 이름·이미지만(핸드아웃의 플레이어 본문, NPC의 겉모습) · observer: 전부 읽기(파티원의 시트) · owner: 조작.
  - PC 문서는 그 플레이어가 owner, 나머지 파티원은 기본 observer(D63: 파티 시트는 서로 보인다, 설정으로 limited로 낮출 수 있다). NPC는 기본 none, 토큰이 장면에 보이면 limited로 자동 승격. 핸드아웃은 "플레이어에게 공개" 토글이 default를 none↔observer로 바꾼다(Roll20 방식의 단순한 스위치를 그대로 둔다).
- **필드 단위 숨김**: 투영기(projection)가 kind별로 정한다. NPC: limited면 스탯 블록 전부 숨기고 HP는 "멀쩡함/다침/위독" 세 단계만(D64). 핸드아웃: gmText는 owner에게만. 장면: `hidden` 토큰과 GM 메모는 owner에게만. 캐릭터: observer는 원본·런타임 전부(파티 시트), limited는 이름·초상·HP 단계.
- 투영은 **호스트에서** 한 번 계산해 각 클라이언트에 그 사람 몫만 보낸다. 클라이언트는 자기가 못 보는 것을 애초에 받지 않는다(옛 클라이언트의 per-viewer projection 원칙 유지).
- 사용자 식별: 세션 참가 시 `userId`(클라이언트가 처음 만들어 로컬에 보관하는 ulid)와 표시 이름. 호스트는 캠페인의 `players[]`에 userId를 기억해 다음 세션에 같은 권한을 준다. 하마치·LAN에서는 별도 인증이 없으므로 세션 토큰(초대 코드에 포함)이 입장 열쇠다.

## 5. 동기화 규약 — 호스트 권위, 명령 → 이벤트

```
클라이언트                         호스트(DM exe)                          모든 클라이언트
  Command{seq, userId, ...}  →   검증(권한·규칙) → 적용 → Event{n, ...}  →  Event 브로드캐스트(투영 후)
                                       │
                                       └ 문서 변경은 DocPatch{docId, fromVersion, toVersion, ops(JSON Patch)}
```

- **명령**은 의도다: `sheet.op`(play.ts의 함수 이름과 인자: applyDamage, useFeature, castSpell, advanceRound…), `token.move`, `item.give`, `dice.roll`, `handout.open`, `chat.say`. 호스트가 같은 순수 함수를 돌려 결과를 만든다. 시트 조작은 `client/character/play.ts`가 이미 순수 함수라 그대로 명령이 된다(D65: 새 규칙 함수는 늘 `(state, args) → state` 형태로 쓴다).
- **이벤트**는 사실이다: 단조 증가하는 `n`, 원인 명령의 `seq`, 결과 패치 목록, 로그 한 줄. 클라이언트는 이벤트만 적용한다(낙관적 적용 없음 — LAN 지연은 10ms대라 필요 없다, D66).
- **문서 패치**는 버전을 갖는다. 클라이언트가 문서를 직접 편집하는 경우(핸드아웃 본문, 장면 편집)는 `doc.update{docId, ifVersion, ops}` 명령이고, 버전이 다르면 호스트가 거절하고 현재 문서를 되돌려 준다. 호스트가 이긴다.
- **초기 동기화**: 입장하면 `snapshot{campaign, documents(투영), lastEventN}` 한 덩어리. 그 뒤로는 이벤트 스트림. 자산은 §3대로 필요할 때.
- **재접속**: 클라이언트가 `resume{lastEventN}`을 보내면 호스트는 그 이후 이벤트가 버퍼(최근 5,000개)에 있으면 리플레이, 없으면 새 스냅샷.
- **PC 되돌려 쓰기**: 세션 중 PC 문서의 런타임은 호스트가 권위. `sheet.op` 이벤트마다 플레이어 클라이언트는 자기 라이브러리 레코드에 즉시 되돌려 쓴다(옛 클라이언트와 같음). 호스트가 꺼져도 플레이어는 마지막 상태를 갖는다. 다음 세션에 같은 캐릭터로 들어오면 `character.join{characterId, snapshot}`으로 플레이어 사본이 다시 호스트로 올라간다(플레이어가 오프라인에서 레벨 업·장비 정리한 것이 반영된다). 호스트가 가진 옛 사본과 다르면 플레이어 사본이 이긴다 — 단 캠페인 설정 "DM 승인 후 반영"이 켜져 있으면 차이를 DM에게 보여 주고 고르게 한다(D67).
- **DM의 개입**: DM은 어느 문서든 owner다. 플레이어 시트에 피해·회복·상태·아이템 지급을 하면 그것도 같은 `sheet.op` 이벤트로 흘러 플레이어 로그에 "DM: 피해 7"로 남는다.

## 6. 전송 — LAN과 하마치

- 하마치는 가상 LAN이다. 호스트는 `0.0.0.0:<port>`에 바인드하고 플레이어는 호스트의 하마치 IPv4(25.x.x.x) 또는 LAN IP로 연결하면 끝이다. NAT 통과·중계 서버가 필요 없다. 필요한 것은 (1) 호스트 방화벽 인바운드 허용(첫 실행 때 Windows가 묻는다 — 안내 문구를 넣는다), (2) 호스트 화면에 **자기 IP 후보를 전부** 보여 주기(하마치 어댑터 25.x 포함), (3) IPv4 우선(하마치 IPv6은 끄는 사람이 많다). (D68: 첫 목표는 LAN·하마치. 인터넷 원격은 나중에 WebSocket 게이트웨이를 같은 규약 위에 얹는다.)
- **초대 코드**: `host:port` + 세션 토큰을 하나의 문자열로 — 예 `25.12.34.56:41230-K7QX3M`. 붙여넣기 한 번으로 입장. LAN에서는 mDNS 광고로 목록에 뜨게 하는 것은 나중(하마치는 mDNS가 안 넘어간다).
- **기존 Rust TCP 재사용**: `src-tauri/src/session_transport.rs`의 `start_host(bind)`, `connect_client(addr)`, `send`, `send_to(peer)`, 수신 이벤트가 이미 있고 검증돼 있다. 줄 단위(개행 구분) 텍스트 프레임 위에 우리 규약(JSON 봉투 한 줄)을 얹고, 자산 청크는 base64 봉투로 시작해 트래픽이 문제가 되면 바이너리 프레임을 추가한다. Tauri가 아닌 브라우저 실행(아티팩트·dev)에서는 메모리 전송(같은 탭 안 두 참가자)으로 개발·테스트한다.
- **핸드셰이크**: `hello{protocolVersion, userId, displayName, token, moduleHashes}` → 호스트가 프로토콜 버전·토큰·설치 모듈 해시를 검사한다. 모듈이 다르면 "호스트에 있는 모듈 X를 설치하세요"와 함께 호스트가 모듈 JSON을 바로 보내 준다(카탈로그 설치는 이미 JSON 한 개다).
- **연결 유지**: 15초 핑, 45초 무응답이면 끊김 처리. 플레이어가 끊겨도 토큰·시트는 남고 재접속은 §5 `resume`.

## 7. 저장과 이식

```
<데이터 폴더>/
  library/                  DM 라이브러리 (문서 JSON 하나씩: npc/*.json, items/*.json, handouts/*.json, scenes/*.json)
  campaigns/<campaignId>/
    campaign.json           kind: "campaign"
    documents/<docId>.json  캠페인 문서 전부
    sessions/<n>.events.jsonl  세션 이벤트 로그 (리플레이·복구용)
  assets/<hash>.<ext>       공유 자산 (라이브러리·캠페인이 같이 씀)
  characters/               플레이어 캐릭터 라이브러리 (이미 IndexedDB; Tauri에서는 파일로도 내보내기)
```

- 문서 하나 = 파일 하나(JSON)라 git·백업·수동 편집이 쉽다. 브라우저 실행에서는 같은 구조를 IndexedDB 두 저장소(`documents`, `assets`)로.
- **내보내기**: 캠페인 zip = `campaign.json + documents/ + 참조하는 assets/` (FVTT world export와 같은 발상). 라이브러리 항목도 개별 zip. 캐릭터 JSON(`simplevtt.character` v2)은 그대로 문서 안에 들어간다.
- **버전**: 문서 껍데기에 `schema: 1`. 이후 마이그레이션은 로드 시 한 방향으로만.

## 8. 화면 청사진

- **라이브러리(DM)**: 탭 = NPC · 아이템 · 자료(이미지) · 핸드아웃 · 장면 · 굴림표. 폴더 트리, 검색, 드래그로 캠페인에 넣기. NPC 편집은 카탈로그 괴물에서 시작해 덮어쓰기.
- **캠페인(DM)**: 파티(PC 카드 + 되돌려 쓰기 상태), NPC 인스턴스, 장면 목록(활성 장면 표시), 저널(핸드아웃 공개 토글), 파티 창고, 세션 기록, 설정(권한 기본값, DM 승인, 모듈).
- **세션(DM)**: 장면(토큰) + 파티 패널(모두의 시트, 피해·회복·상태·아이템 지급) + 이니셔티브 + 공용 기록/주사위 + 핸드아웃 보여 주기(전체 또는 한 명).
- **세션(플레이어)**: 내 시트(지금의 오프라인 시트 그대로, 조작이 명령으로 나감) + 파티 카드(observer 뷰) + 장면 + 공용 기록. 오프라인 시트와 화면이 같아서 배울 게 없다.
- **입장**: 호스트 = "세션 열기" → 캠페인 선택 → IP 후보와 초대 코드 표시. 플레이어 = 초대 코드 붙여넣기 → 캐릭터 선택 → 입장.

## 9. 구현 순서 (슬라이스마다 커밋·검사·증거)

| 슬라이스 | 내용 | 검사 |
| --- | --- | --- |
| S1 문서 모델 | `client/campaign/`: Document 껍데기, kind별 타입, 저장소(IndexedDB/파일), 폴더, 권한과 투영기 | 투영 단위 테스트(kind × 권한 단계) |
| S2 세션 코어 | `client/session/`: 명령·이벤트·패치, 호스트 상태 기계, 스냅샷·리플레이, 메모리 전송, PC 되돌려 쓰기 | 호스트 1 + 클라이언트 2 시뮬레이션 테스트(시트 조작이 양쪽에 같은 결과) |
| S3 LAN 전송 | Rust TCP 어댑터, 초대 코드, 핸드셰이크(버전·토큰·모듈 해시), 재접속, IP 후보 표시 | 두 exe(또는 dev 두 탭 + 메모리) E2E, 하마치 수동 검증 체크리스트 |
| S4 파티 플레이 | 입장 화면, 파티 패널, DM 개입, 공용 주사위·기록, 라운드 진행 세션화 | 브라우저 두 컨텍스트 E2E + 증거 |
| S5 자산·핸드아웃 | 자산 저장·청크 전송·캐시, 핸드아웃 편집·공개, 이미지 드롭 | 전송 테스트(청크·우선순위·권한) |
| S6 장면·토큰·NPC | 장면 문서, 배경·격자, 토큰 배치·이동·숨김, NPC 프리셋→인스턴스, 이니셔티브 | 시나리오 테스트 |
| S7 캠페인 저장·이식 | 폴더 구조, zip 내보내기/가져오기, 세션 이벤트 로그, 라이브러리 정리 | 왕복 테스트 |

M3(V2 전투 커널 이식)은 S6 뒤에 장면 문서 위로 옮긴다.

## 10. 결정(가정)과 열린 질문

- D60 PC는 참조·되돌려 쓰기, NPC·아이템·핸드아웃은 복사(인스턴스).
- D61 같은 NPC의 토큰 여럿은 토큰별 HP(연결 안 됨)가 기본.
- D62 권한 4단계(none/limited/observer/owner) + 필드 단위 숨김은 투영기가 kind별로.
- D63 파티원 시트는 서로 observer(설정으로 낮춤).
- D64 NPC HP는 limited에 세 단계(멀쩡/다침/위독)만.
- D65 규칙 함수는 순수 `(state, args) → state`라 그대로 명령이 된다.
- D66 낙관적 적용 없음(호스트 이벤트만 적용).
- D67 재입장 시 플레이어 사본이 이기되 "DM 승인" 옵션.
- D68 전송은 LAN·하마치 TCP 먼저, 인터넷은 나중에 WebSocket 게이트웨이.
- 열린 질문(소유자): (1) 세션 토큰 없이 같은 캠페인 플레이어 목록에 있는 userId는 자동 입장을 허용할까? (2) 자산 최대 크기 20MB와 webp 재인코딩 기본값 (3) 세션 이벤트 로그를 캠페인에 영구 보관할지(용량) (4) 플레이어가 라이브러리에서 직접 아이템을 만드는 것을 허용할지(기본: DM만).
