# V1.4 · UI 재설계 (UI overhaul)

Owner mandate (2026-09-06): "UI도 전면적인 공사를 진행해줘. 지금 있는 거 싹 다 뜯어 고치자. UX와 UI를 맞춰서. 세션
내에서의 하단 액션바의 형태는 남기고 나머지는 다 수정해줘."

## Direction

The V1.3 program made play correct; this program makes the surfaces read as one product. Every screen moves to
one visual language and one shell, and the session becomes a workspace instead of a stage:

- **Language** — dark-first "tabletop workspace": flat surfaces on a two-step elevation scale, a single warm
  accent reserved for the primary action and the current turn, semantic colours for HP (green → amber → red),
  sides (ally blue / enemy red) and conditions (violet). One sans-serif stack for everything
  (Pretendard Variable → Apple SD Gothic Neo → Noto Sans KR → system-ui); the serif display face goes. Spacing on
  a 4 px grid, radii 6/10/14, no glows or gradients behind content. Light theme keeps working through the same
  tokens.
- **Shell** — the single nav bar stays (홈 · 캐릭터 · 캠페인 · 세션 · 콘텐츠 · 규칙 · 설정; its structure is pinned by the
  shell suite and reads fine on a wide table), the breadcrumb band goes, and each screen carries its own page head
  (title + primary actions).
- **Home** — a "continue" dashboard: last character, last campaign, host/join, install content — no hero copy.
- **Session** — three columns over the kept action dock: left an initiative rail (order, HP bars, conditions,
  current marker; the theater-of-mind boards fold into it), centre the stage (current-turn focus, the result card,
  the withdraw prompt, the last few activity entries), right a docked utility sidebar with tabs (인카운터 · 기록 ·
  시트 · 아이템 · 파티 · 규칙 · 라이브러리) instead of overlays. The bottom action dock keeps its shape.
- **Character** — the list becomes a table-like grid with one primary action per row; the creation wizard keeps
  its stepper/form/summary structure and takes the new tokens; both sheet styles keep their layouts and take the
  tokens.

## Gates

| ID | Gate | Kind | Done when |
| --- | --- | --- | --- |
| `U1-01` | Design tokens and shell: one token sheet (colour, spacing, radius, type scale, elevation) replaces the ad-hoc values; the sans stack lands; the product shell becomes rail + page header; every existing screen still renders on the new tokens | UI | screenshots of home, 캐릭터, 캠페인, 콘텐츠, 규칙, 설정, creation, session DM/player at 1440×900 in the evidence; structure suites green |
| `U1-02` | Home and product screens: continue dashboard; 캐릭터 list grid; 캠페인, 콘텐츠, 규칙, 설정 on the page-header pattern with consistent empty states | UI | screenshots; structure suites green |
| `U1-03` | Session workspace: three-column layout with the initiative rail, stage and docked utility sidebar; theater-of-mind boards fold into the rail; result card and activity restyled; the action dock unchanged in form | UI | DM and player screenshots in initiative and 자유 진행; the T1/C1 UI suites green |
| `U1-02` | _pending merge_ | PR #377. Product screens on the page-head pattern: the home dashboard (U1-01), 캐릭터 list (flat cards, portrait tile, actions row), 캠페인 (empty state, new-campaign editor, recent list), 콘텐츠, 규칙 (three-pane catalog), 설정 and the session start screen share one head (kicker, title, muted description, rule) and the token surfaces. Screenshots: `docs/design/ui-ux/v1_4/u1-02/{characters,campaign-empty,campaign-new,rules,settings,session-start}.png`. |
| `U1-04` | _pending merge_ | PR #377. Creation wizard (stepper / form / summary), level-up (class grid, before → after summary) and the SimpleVTT sheet render flat on the tokens with sans numerals; the official paper sheet keeps its serif and paper look by design. Screenshots: `docs/design/ui-ux/v1_4/u1-04/{create,levelup,sheet}.png`. |
| `U1-05` | _pending merge_ | PR #377. 1024: the session chrome scrolls sideways instead of wrapping and the rail narrows to 224 px; 768: the rail collapses to horizontal rows above and below the stage; 375: the home stacks to one column and the player session keeps the dock usable. The first-run choice sits on the tokens. Screenshots: `docs/design/ui-ux/v1_4/u1-05/{home-1024,dm-1024,player-768,home-375,player-375,first-run}.png`. |
| `U1-06` | _pending merge_ | PR #377. Walkthrough (headless screenshots of every screen on the product and play paths at 1440×900 plus the widths above) after U1-01/U1-03 merged. Fixed on the way: the home kicker the Windows e2e harness waits for is kept; rail labels read 상대/아군; the connection badge and chrome tabs never wrap; the creation preview portrait block is flat. Left as is, with the reason: the official paper sheet keeps its serif (deliberate style); the reference preview fighter is named "Second Wind" and its activity carries a duplicate "이니셔티브 시작" entry (pinned mock data, not a production surface). Full UI suite on the U1-03 head: 1527 pass, 0 fail. |
| `U1-04` | Character creation, level-up and both sheet styles on the tokens; forms, steppers and summaries consistent | UI | screenshots; structure suites green |
| `U1-05` | Responsive and connected states: 1024/768/mobile widths, connection banners, the first-run choice, dialogs and prompts on the tokens | UI | screenshots at three widths; `responsive` suites green |
| `U1-06` | Walkthrough: every screen reviewed against this direction, wording and empty states fixed, stale structure assertions reconciled | UI | walkthrough notes; the full UI suite green |

## Conventions

Same as V1.3: one `agent/*` branch per gate from the live `work/v1-composite` HEAD, tests before product changes,
exact merge SHA in the evidence table. Screenshots are taken headless with `C:\Temp\svtt\tools\shot\shot.mjs`
against the dev build and reviewed before a gate closes; the in-app browser pane is too narrow to judge layout.
`check-ui-rule-boundary` still forbids rule arithmetic in React; the overhaul touches presentation only.

## Evidence

| Gate | SHA | Evidence |
| --- | --- | --- |
| `U1-01` | `9dd73ff0201a953980dfe5a2b180e908ddabb6f1` | PR #375. `src/theme-tokens.css` is the one token sheet (type scale, 4 px rhythm, radii, two-step elevation, semantic colours for HP/sides/conditions, legacy aliases kept); `styles.css` moves every heading and control to the sans stack and flat buttons (`primary` is filled accent); the shell keeps its pinned single nav bar but drops the title band and the hero gradient; the home is a continue dashboard (`V1HomeScreen`); the gradient overrides in `appearance-settings.css` and the creation shell are gone. Screenshots at 1440×900: `docs/design/ui-ux/v1_4/u1-01/{home,char,campaign,content,rules,settings,create,dm,player}.png` (the session shots already include the U1-03 workspace sheet). |
| `U1-03` | `6e18316e145245b619f74209e95dfe655751281c` | PR #376. `src/session-workspace.css` loads after the reference-play sheet: the play core is a grid with the two actor boards stacked as lists in a 272 px left rail (side stripe, name, HP/AC, HP bar, condition chips, 턴 marker; folded groups keep their card), the stage in the centre with the current-turn focus and a `SessionStageFeed` of the last three results, and the utility host docked on the right (372 px, tokens). Chrome buttons, the result layer and the pane heads take the tokens and the sans stack. Single actor cards gained a visible name and HP/AC line. Screenshots: `docs/design/ui-ux/v1_4/u1-03/{dm-initiative,player-initiative,dm-freeform,dm-encounter,dm-activity}.png`. Rides along: U1-02 first pass (product page heads share the home head; screen padding aligned), U1-04 first pass (the SimpleVTT sheet, spell UI, inventory and play surfaces lose their glows and serif numerals; the official paper sheet keeps its serif by design; the creation preview column is flat), U1-05 first pass (session chrome never wraps and scrolls sideways at 1024; the rail collapses to a row under 860 px). |
