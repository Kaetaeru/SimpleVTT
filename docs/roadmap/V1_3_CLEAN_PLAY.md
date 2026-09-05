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
| `C1-01` | `f63b5467a6799b70b775aa577dd4bafc7b016683` | PR #368. `productionPlayRuntimeAdapter` reconcile drops every local character from a hosted scene (the DM's saved character never projects); the host workspace no longer names a character; `tests/ui/hostHasNoCharacter.test.ts` covers hosting with a saved character and a player projection still joining. |
| `C1-02` | `1bf3c7fc357ffd5d84a5165e43cf2589a946f4cf` | PR #369. `ConnectedSceneTopology` carries groups, engagements, scene conditions, movement declarations and the 물러남 prompt; `connectedTheaterOfMindRoutingAdapter` republishes after every host-side theater mutation and routes a player's `movement-request` to the Host (`connectedMovementRequestPort`); `tests/ui/connectedTheaterOfMindParity.test.ts` runs host + client adapters over the in-process transport. |
| `C1-03` | `5679c59dea20da88d09bfac678bb5d23e836827c` | PR #370. Spell coverage moves from 10 authored / 216 tracked to **66 authored / 162 tracked** (`SPELL_EXECUTION_COVERAGE`). See "C1-03 spell waves" below for the waves, the engine additions and the reviewed list of what stays tracked. |
| `C1-04` | `a4f59adb5e54a1360cf3344fcae2609e4f1a7946` | PR #371. Stat-block spellcasting: the monster generator resolves each spell list entry to a catalog spell id (253/255 resolved; Korean/English names plus an alias table for the translation variants) and `srdMonsterSpellProjection` turns combat-executable mechanics into runtime attack/save actions with the block's DC, spell attack bonus (DC − 8 when the block has none), upcast dice and per-day counters — mage Fireball (level 4) is a DEX DC 14 save for 9d6, 2/일; the adult red dragon's Scorching Ray is three +12 attacks. Legendary Resistance re-judges: `useLegendaryResistance` undoes the last card when it holds that creature's failed save, re-resolves the same cast with `forcedSaveSuccessIds` (the save is judged against target 0 with a `legendary-resistance:auto-success` source), spends the counter and annotates the card. Multiattack routines: the generator parses "물기 한 번과 발톱 두 번" into named attacks (135/180 lines), `resolveMultiattackRoutine` resolves them against one target as one DM action with a single activity summary, and the DM tools show a 다중공격 button with a target row. Tests: `srdMonsterSpellcasting`, `srdMonsterLegendaryResistance`, `srdMonsterMultiattack`. |
| `C1-05` | _pending merge_ | Walkthrough (DM preview and player preview, initiative mode, dev build after C1-04) — see "C1-05 walkthrough" below. Stale suites resolved: `campaignDmLibraryPcPresetRuntime` (materialization guard accepts the null-checked map) and `productionOfficialActions` (a spellbook ritual is offered as a ritual cast beside the prepared spells). |

### C1-05 walkthrough

Screens on the play path were driven from the browser against the dev build (the first-run choice, the session
workspace, 인카운터 panel, initiative strip, DM turn focus, hotbar, 기록 feed, player preview). Findings and what
changed:

- **Monster spell labels** used the stat block's translation ("파이어볼", "원뿔 of 냉기") while the players' hotbars
  use the catalog names — the projection now labels spells with the catalog's Korean name ("화염구 (주문 · 4레벨)",
  "냉기 분사 (주문)").
- **다중공격 off-turn**: the button ran the routine while another creature had the turn, and every attack was
  refused by the turn runtime, leaving an entry "Aelar HP 31 → 31". In initiative the button is disabled until the
  creature's turn and its title says so; on the creature's turn the routine resolves ("아케인 버스트 3회 · Aelar HP
  31 → 0", one entry per attack in 기록).
- Verified as designed: the first-run overlay is centered at 1280 px and stores the choice; the 인카운터 search adds
  an SRD monster with its stat-block actions (아케인 버스트 3회, the two projected spells, the bonus-action text
  entry); the DM hotbar follows the current turn (T1-07); the player preview shows the movement declaration row,
  the hotbar groups with empty-state text, and the resource strip.
- Left as is: the reference preview's fighter action is named "Second Wind" while production projections say
  "세컨드 윈드" — the reference mock is pinned by 25 suites and is not a production surface.

### C1-03 spell waves

Authored files live in `content/spell-mechanics/dnd-srd-5.2.1/`; every definition's `executionScope` starts with
"Authored (C1-03)" and states what the runtime enforces and what the DM narrates.

| Wave | File | Spells |
| --- | --- | --- |
| 2a damage | `wave2-damage.json` | Sorcerous Burst, Chromatic Orb, Acid Arrow, Spiritual Weapon, Moonbeam, Spirit Guardians, Wind Wall, Cloudkill, Insect Plague, Blade Barrier, Wall of Fire, Wall of Thorns, Wall of Ice, Disintegrate, Tsunami, Incendiary Cloud, Black Tentacles |
| 2a control | `wave2-control.json` | Web, Entangle, Grease, Stinking Cloud, Sleet Storm, Suggestion, Mass Suggestion |
| 2a buffs | `wave2-buffs.json` | Enhance Ability, Foresight, Protection from Evil and Good, Protection from Poison, Lesser Restoration, Greater Restoration, Holy Aura, Goodberry |
| 2b engine | `wave2-engine.json` | Shield, Shield of Faith, Barkskin, Warding Bond, Stoneskin, Protection from Energy, Bless, Bane, Guidance, Resistance, Heroism, Hunter's Mark, Hex, Divine Favor, Magic Weapon, Heat Metal, Haste |
| 2c summons | `wave2-summons.json` | Guardian of Faith, Arcane Sword, Conjure Animals, Conjure Celestial, Conjure Minor Elementals, Conjure Elemental, Fire Shield |

Engine additions (all in the rules domain, exercised by `tests/domain/spellAuthoredWave2Engine.test.ts`):

- Tracked effects may carry `armorClass {bonus, floor}`; the d20 executor raises the target AC an attack roll is
  judged against and records it in provenance.
- Tracked effects may carry `damageDefenses`; the effect is tagged `damage-resistance:<type>` and the existing
  health ops halve the damage.
- `modifier.bonus {flat, dice, sign}` and `modifier.ability`: Bless/Bane d4s are rolled by the runtime with a
  deterministic face seeded by resolution, operation and effect id (`src/domain/seededFace.ts`), so replays and
  peers agree; `consumeOnUse` still removes Guidance/Resistance after one roll.
- `attackDamage {dice, flat, sourceKinds, againstTargetOnly}`: `effectAttackDamageRiders` turns effects into
  attack riders in the production attack transaction (Hunter's Mark and Hex only against the marked creature).
- Spell formulas may be a bare spellcasting modifier (Heroism); authored durations accept `rounds` anchored to
  `$source`/`$target` (Shield ends at the caster's next turn).

Reviewed and left tracked (162), with the reason:

- **Needs engine work the runtime does not have yet** — True Strike, Shillelagh (weapon die/ability change);
  Divine Smite, Shining Smite (post-hit bonus action; Divine Smite has its own adapter path); Mage Armor
  (AC = 13 + DEX); Aid (HP maximum); Death Ward, Revivify, Raise Dead, Resurrection, True Resurrection,
  Reincarnate (0-HP / dead targets); Dispel Magic, Antimagic Field, Globe of Invulnerability (ending or blocking
  other effects); Darkness, Fog Cloud, Silence, Mirror Image, Blink (senses and miss chances); Misty Step,
  Dimension Door, Fly, Expeditious Retreat, Spider Climb, Freedom of Movement, Gaseous Form (movement in
  theater of mind); Spike Growth (damage per distance moved); Wall of Force, Wall of Stone, Forcecage,
  Antilife Shell; Telekinesis (contested check); Animate Objects,
  Animate Dead, Create Undead, Summon Dragon, Planar Ally (summoned stat blocks);
  Earthquake, Time Stop, Maze, Prismatic Wall, Aura of Life, Magic Circle, Glyph of Warding, Symbol,
  Contingency.
- **Narrative or utility** (tracked with duration and description) — the cantrips Dancing Lights, Druidcraft,
  Elementalism, Light, Mage Hand, Mending, Message, Minor Illusion, Prestidigitation, Spare the Dying,
  Thaumaturgy; and Alarm, Comprehend Languages, Create or Destroy Water, Detect Evil and Good, Detect Magic,
  Detect Poison and Disease, Disguise Self, Feather Fall, Find Familiar, Floating Disk, Identify, Illusory
  Script, Jump, Longstrider, Purify Food and Drink, Silent Image, Speak with Animals, Unseen Servant, Alter
  Self, Arcane Lock, Arcanist's Magic Aura, Augury, Continual Flame, Darkvision, Detect Thoughts, Find Steed,
  Find Traps, Gentle Repose, Knock, Locate Animals or Plants, Locate Object, Magic Mouth, Pass without Trace,
  Rope Trick, See Invisibility, Clairvoyance, Create Food and Water, Daylight, Major Image, Meld into Stone,
  Nondetection, Phantom Steed, Plant Growth, Remove Curse, Sending, Speak with Dead, Speak with Plants, Tiny
  Hut, Tongues, Water Breathing, Water Walk, Arcane Eye, Control Water, Divination, Fabricate, Faithful Hound,
  Giant Insect, Hallucinatory Terrain, Locate Creature, Private Sanctum, Secret Chest, Stone Shape, Arcane
  Hand, Awaken, Commune, Commune with Nature, Creation, Dispel Evil and Good, Dream, Hallow, Legend Lore,
  Passwall, Telepathic Bond, Teleportation Circle, Tree Stride, Find the Path, Forbiddance, Guards and Wards,
  Heroes' Feast, Instant Summons, Magic Jar, Move Earth, Programmed Illusion, Transport via Plants, True
  Seeing, Wind Walk, Word of Recall, Etherealness, Magnificent Mansion, Mirage Arcane, Plane Shift, Project
  Image, Simulacrum, Teleport, Animal Shapes, Clone, Control Weather, Demiplane, Glibness, Mind Blank, Astral
  Projection, Gate, Shapechange, Wish.

The list above is the output of `spellMechanicById(id).runtimeSupport === "tracked-executable"` over the 339
catalog spells minus the authored tier; the HUD labels these as tracked effects with their duration.
