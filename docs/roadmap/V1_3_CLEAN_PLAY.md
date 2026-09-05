# V1.3 — Clean play (roadmap)

Owner decision (2026-09-06): V1 means a table can sit down and play without friction — every SRD monster,
every SRD spell, and every table action working the same for the DM and for connected players. The V1.2
theater-of-mind gates landed the DM side in one process; this program closes what a real table hits.

Reported first: when the DM hosts, the DM's most recently edited character joins the scene. A DM has no
character in play unless the DM adds one on purpose.

## Gates

| ID | Gate | Kind | Done when |
| --- | --- | --- | --- |
| `C1-01` | The Host has no character in play: hosting never projects the DM's saved character into the scene, the session workspace stops naming it, and a DM who wants a PC adds it from the campaign library like any other actor | engine + UI | tests on host/join paths; the DM preview and the host workspace show no DM character |
| `C1-02` | Multiplayer parity for theater-of-mind play: scene topology carries groups, engagements, scene conditions, movement declarations and the 물러남 prompt; a player's 접근/물러남/그대로 is routed to the Host like an action; the waiting notice reaches players | engine | two-peer in-process tests (host + client adapters) for each field and for the routed declaration |
| `C1-03` | Spells, wave 2: every SRD spell with an in-combat effect resolves through an authored `spell-mechanic` (damage, save, condition, AC/roll modifiers, temp HP, healing, movement, summons as text); narrative-only spells stay tracked with duration and description and are labelled as such in the HUD | data | coverage test: `combat-executable` covers every spell the classifier marks combat-relevant; the remaining tracked list is reviewed and listed in the evidence |
| `C1-04` | Monsters, complete: stat-block spellcasting resolves through the spell mechanics with the stat block's DC and per-day uses; Legendary Resistance flips a failed save on the result card; multiattack routines with mixed attacks (X bites + Y claws) resolve as one action | engine | tests on a caster (mage), a legendary (adult red dragon), a mixed multiattack (owlbear) |
| `C1-05` | Table walkthrough as DM and as player: every screen on the play path reviewed against the design; UX defects fixed (naming, empty states, dead buttons, focus order, wording); known stale tests fixed or removed | UI | walkthrough notes in the evidence; structure suites green; the two pre-existing stale assertions resolved |

## Conventions

Same as V1.1/V1.2: one `agent/*` branch per gate from the live `work/v1-composite` HEAD, tests before product
changes, exact merge SHA in the evidence table. New adapters register in `offlineRuntimeAdapters.ts` and in
`.agents/LEGACY_EXECUTION_BASELINE.json`; connected routing lives beside the existing `connected*Adapter.ts`.

## Evidence

| Gate | SHA | Evidence |
| --- | --- | --- |
