# V2 · Table Rewrite (세션 플레이 층 재작성 + DM Workspace)

Owner decisions (2026-09-07):

- "지금 파악안된 오류가 너무 많을게 뻔해서 전면 재작성을 해보자고 했던거야." → rewrite the session/play layer.
- Accepted: Host single authority · keep domain and UI · core-first switch-over · same repo, branch `work/v2-table`.
- "FVTT와 Roll20의 호스트와 비슷한 형태의 DM UI … 전부 한번에 편하게 등록 가능하고 사용 가능하면 좋겠어. UX를 꼼꼼하게
  고려해줘." → DM Workspace redesign.

Design: `docs/design/v2/TABLE_RUNTIME.md`, `docs/design/v2/DM_WORKSPACE.md`. V1.7 "DM 재량과 자유도" is absorbed
into this program (T2-01 ruling commands, T2-05 player freedom, T2-07 scenario 3); it is not built on the old chain.

Branching: gate branches `agent/t2-xx-*` → PR into `work/v2-table`. Switch-over (T2-07) → PR into `work/v1-composite`.
The old app keeps running on `work/v1-composite` until then.

## Gates

| ID | Gate | Done when |
| --- | --- | --- |
| `T2-00` | Design: runtime architecture, DM workspace UX, this roadmap | merged |
| `T2-01` | Table kernel, offline: `TableState`, `dispatch`, events + `applyEvent`, `project()` to `AppSnapshot`; actors (SRD monsters, characters), modes/initiative/turns, weapon/unarmed attacks, checks/saves, damage/heal, the 14 canonical 2024 conditions with mechanics and durations, engagement, the DM ruling palette (damage/heal/temp/max HP, conditions, adv/dis, 영감, prone/stand, life state, resources, badges), post-hoc corrections, undo. Old play screens render the new snapshot in the reference preview | `tests/table` green (handlers, replay property, availability truth); preview screenshots of a fight played end-to-end on the new runtime |
| `T2-02` | Spells, reactions, questions, standard actions: spell cast via the domain kernel (slots, components incl. hands, concentration, upcast), reaction windows as questions (opportunity attack, shield, counterspell), ready, dodge/disengage/help/hide/search, death saves/stabilize, short/long rest, item use | `tests/table` green; the fixture cleric and fighter play scenario 1's beats offline |
| `T2-03` | Connected: wire (hello/command/event-batch/snapshot/question), `TableHost`/`TableClient`, reconnect by cursor, owner write-back, parity by construction | play matrix M1–M9 green on Windows H+P1+P2 against the new runtime (runner header re-targeted); C1-MP green |
| `T2-04` | DM Workspace UI: sidebar tabs (기록·전투·액터·아이템·자료·규칙·세션), token cards + HUD, ruling bar, Ctrl+K unified search, 준비실 on the campaign screen, host-owned library, bulk registration, 장면 묶음; player skeleton | screenshots of the eight prototype scenes in `DM_WORKSPACE.md` §8; structure tests; owner review |
| `T2-05` | Player freedom: hands (stow/draw/don/doff with the 2024 free-interaction and action costs), prone/stand, object interaction, improvised action → DM DC question, Korean component refusals with guidance; DM read-only PC sheet with true level/HP/resources | `tests/table` green; TOM1 + TOM2 green on the new runtime |
| `T2-06` | Feature families port: rage, wild shape, monk (focus/open hand), paladin (lay on hands, abjure, auras), rogue, cleric (spark, turn undead), bard, warlock pact, druid land, summons, zones/artifacts, weapon mastery, monster multiattack/timing/legendary | each family's existing domain tests plus a table handler test; TOM1/TOM2/C1-MP still green |
| `T2-07` | Switch-over: `main.tsx` on the table facade, old session adapters deleted, legacy boundary updated, scenario 3 "DM 재량" (nat-1 rulings, improvised actions, hands, mass conditions, undo) green on Windows H+P1+P2; PR into `work/v1-composite`; release artifact | all runners green on the merge head; roadmap evidence rows |

## Evidence

| Gate | SHA | Evidence |
| --- | --- | --- |
