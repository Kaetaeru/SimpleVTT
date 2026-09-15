# 새 클라이언트 M1 증거 (자동 캡처)

생성: 2026-09-14T14:33:02.698Z · `node --import tsx scripts/capture-client-m1.mjs`

Chromium이 Vite 개발 서버(포트 1430)에서 마법사를 처음부터 끝까지 진행하고, 보충 모듈(합성 픽스처)을 설치한 뒤 설치 콘텐츠로 캐릭터를 만든다.

- `01-library-empty.png`
- `02-wizard-basics.png`
- `03-wizard-species.png`
- `04-wizard-background.png`
- `05-wizard-abilities.png`
- `06-wizard-classes.png`
- `07-wizard-review.png`
- `08-sheet-fighter.png`
- `09-sheet-fighter-level5.png`
- `10-sheet-export-json.png`
- `11-contents-preview.png`
- `12-contents-installed.png`
- `13-sheet-installed-content.png`
- `14-library-two-characters.png`
- `15-library-light-theme.png`
- `16-sheet-play-ac-provenance.png` — 시트 운용: HP 입력 `-9`·`++4`(슬라이더 위 한 칸)·중독·아이템 추가/장비·금화 뒤, AC에 마우스를 올려 출처(사슬 셔츠 13 · 민첩 +2 · 방패 +2)
- `17-sheet-attack-provenance.png` — 명중 굴림 출처(근력 수정치 · 숙련 보너스)
- `18-sheet-short-rest.png` — 짧은 휴식 대화상자(히트 다이스 선택)
- `19-sheet-after-rest-log.png` — 휴식 뒤 HP·히트 다이스·기록 (`node scripts/capture-client-play.mjs`)
- `20-wizard-hp-roll-dice.png` — 마법사에서 2레벨 HP를 d8로 굴림(주사위 오버레이, 결과 릴)
- `21-sheet-skill-roll.png` — 시트에서 곡예 판정 d20 굴림
- `22-levelup-screen.png` — 별도 레벨 업 화면: 직업·레벨 수, 레벨별 HP 고정/굴림, 새로 열린 선택만 표시, 바뀌는 것 요약
- `23-sheet-after-levelup.png` — 적용 뒤 시트 (`node scripts/capture-client-levelup.mjs`)
- `24-sheet-rage-rounds.png` — 바바리안 격노 "사용": 횟수 차감, 진행 중인 효과 카드에 10분(100라운드) 효과, "다음 라운드" 세 번 뒤 3/100, 종료 버튼
- `25-sheet-cast-picker.png` — 클레릭 주문 목록의 행별 "시전": 축복에서 1레벨/2레벨 슬롯 선택지(남은 수), 의식·집중 표시
- `26-sheet-effects-after-cast.png` — 축복 시전 뒤 주문 행이 진행 중(종료 버튼)으로 바뀜 (`node scripts/capture-client-use.mjs`)
- `27-sheet-rage-damage-provenance.png` — 격노 중 공격 표의 피해 보너스에 마우스: 근력 수정치 + 격노 +2, 진행 중인 효과 카드에 적용 내용(피해 +2 근력 근접 공격 · 저항 타격·관통·참격 · 유리 메모)
