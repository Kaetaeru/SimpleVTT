# V1.2 — Theater-of-mind play and the DM's half (roadmap)

Owner decision (2026-09-05): the product plays without positions. Design: `docs/design/theater-of-mind-play.md`.
Product review that motivated this (same day): no monsters ship, the play surface has no theater-of-mind
controls, two play screens coexist, and several presentation defects leak internals to the table.

## Gates

| ID | Gate | Kind | Done when |
| --- | --- | --- | --- |
| `T1-01` | SRD monster catalog: the 329 SRD 5.2.1 stat blocks (CC-BY, Korean presentation from the pinned translation) ship as builtin `combatant` entries with parsed stats, attacks (melee/ranged, damage components), multiattack, saving-throw actions, resistances/immunities, senses, CR/XP, traits, legendary actions and spellcasting as presented text | data + engine | generator + parser tests; every stat block parses; the Rules screen lists monsters; the encounter panel adds any monster by name/CR/type |
| `T1-02` | NPC runtime: catalog monsters instantiate with initiative, saves from abilities, multiattack as attacks-per-action, save actions with fail/success damage, recharge/legendary as per-round counters | engine | unit tests on ogre (multiattack), goblin boss (save + reaction), adult red dragon (breath save, legendary counter); DM runs them from the encounter panel |
| `T1-03` | Engagement inference: relations from resolved melee actions; ranged-in-melee disadvantage from engagement; engagement ends on 물러남/이탈/death/idle round | engine | domain tests; adapter test shows the auto disadvantage and its toggle |
| `T1-04` | Groups and group initiative: DM groups identical monsters at encounter add; opposing board folds by group; area targeting picks a group | engine + UI | tests; encounter add "×N 한 무리" |
| `T1-05` | Movement declarations and opportunity attacks: 접근/물러남/그대로 replace feet; 물러남 from an engaged creature prompts the engaged enemies' opportunity attack; the per-card button goes away | UI + engine | tests; prompt appears only with an engagement |
| `T1-06` | One-tap resolution: auto-advance by default with a folded detail, post-hoc DM toggles (닿지 않음, 엄폐, 이점/불리점, 피해 절반) that recalculate that resolution | UI + engine | tests on the toggles; the staged click-through is gone from the live session |
| `T1-07` | Scene conditions and badges: 어둠/안개 per scene, 숨음/투명/엄폐 per creature, narrative HP/condition chips; the collapsed distance tool and the unmounted movement dialog are deleted | UI + engine | tests; the removed files are gone; sight-dependent rules read the badges |
| `T1-08` | Presentation defects: activity log without raw state diffs or internal ids, consistent dice summary, unarmed strike formula, creation card summaries, step-tab accessibility, developer copy removed from user paths, controlled actor follows the current turn for the DM | UI | tests where the defect was observable; the review list is closed |
| `T1-09` | One play surface: the product-shell `scene` route and orphaned session components are removed; the live session is the only play screen | UI | dead routes and unmounted files deleted; suites green |

## Conventions

Same as V1/V1.1: one `agent/*` branch per gate from the live `work/v1-composite` HEAD, tests before product
changes, exact merge SHA in the evidence table.

## Evidence

| Gate | SHA | Evidence |
| --- | --- | --- |
| `T1-01` | `1230d4fd8001482fe678cb00be9809705f7b4cd1` (PR #358) | 329 SRD 5.2.1 stat blocks parsed into `src/generated/monsterCatalog.generated.json` (409 attacks, 129 save actions, 180 multiattack, 49 spellcasters, 30 legendary; 12 residual parser warnings listed in the file); builtin catalog emits 329 `combatant` entries; `tests/ui/srdMonsterCatalog.test.ts` (all parse, search, ogre/goblin boss/adult red dragon projections, instantiate with rolled initiative, dragon breath resolving through the real save adapter); Rules pane renders stat blocks; Encounter pane adds monsters by name/type/CR with a count. Known: several translated numbers differ from the English SRD (goblin warrior `+1`, adult red dragon rend `+12`); corrections belong upstream. |
| `T1-02` | `c1b4f2b428403e365e5f3386b9145331a35975e7` (PR #359) | Parser `timing` semantics (recharge 5–6 / 6, per-day, once-per-round, legendary cost; legendary uses 3 and resistance 3/4/5 following the SRD 5.2.1 English text since the translation dropped the annotations); `srdMonsterTimingRuntimeAdapter` counters inside the scene with turn-start refresh (logged d6), consumption on resolve, restore on undo, DM `useLegendaryResistance`/`resetMonsterTiming`; actor-card badges and Encounter pane controls; `tests/ui/srdMonsterTiming.test.ts`. Not executable yet: monster spellcasting (presented text). |
| `T1-03` | `bc017dda0b3526daeee2fbf9a98ee3e411b71455` (PR #360) | `src/domain/engagement.ts` + `engagementRuntimeAdapter`: melee attacks engage, ranged attacks while engaged roll with disadvantage through the new attack roll-state contributor registry, Disengage/undo/death/idle round end it, DM `setEngagement` toggle; card chips and Encounter pane 해제; `tests/domain/engagement.test.ts`, `tests/ui/engagementRuntime.test.ts`. |
