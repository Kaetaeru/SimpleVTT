# V1.1 — Executable content roadmap (post-V1)

V1 closed on exact SHA `7429e2c77ee969aec1c3fe28c252a8ad07e4cd06` (`docs/roadmap/evidence/W9-04.md`). V1 fixed the
cast/selection lifecycle of every SRD spell and feat; it did not simulate every spell's world effect or any feat's
in-combat effect. This roadmap makes that content executable **by data first**: the Common Play Contract already
executes JSON (`docs/rules/common-play-contract-v0.2.md`); the gaps are (1) content that never received JSON and
(2) three narrow engine seams the JSON needs.

Owner decision (2026-09-05): widen the prose parser only for regular patterns; author per-item JSON as the primary
path; then build the Player's Handbook 2024 supplement as an external add-on from the owner's private translation
repository and test it end to end.

## Measured starting point (7429e2c7)

| Area | State |
| --- | --- |
| SRD spells | 339 catalogued; 117 `combat-executable` (9 reviewed + 108 prose-derived), 222 `tracked-executable` (cast lifecycle only) |
| SRD feats | 17/17 catalogued as `feat-definition`; selection/prerequisites/ability increases execute; in-combat effects do not (`grants` keys are not read by any runtime file) |
| Engine | 51 Common Play operation kinds, artifact kinds incl. `actor`/`form`/`zone`/`stored invocation`, interceptors with predicates and fact queries; interceptors require a blocking `interaction` (no automatic passives); chosen feats are stored as labels, not as grants |

Rough triage of the 222 tracked spells (keyword pass, to be reviewed per spell): ~63 damage/healing the parser missed,
~52 buff/sense/condition, ~38 need no mechanics, ~14 zone/environment, ~26 movement/planar, ~22 summon/create, ~7 shapechange.

## Gates

| ID | Gate | Kind | Done when |
| --- | --- | --- | --- |
| `X1-01` | Chosen feats are grants: origin feat (creation, background), ASI-mode feat, fighting style feat, Epic Boon land in the Character's content identities; builtin and installed feat entries' `common-play` mechanics are discovered exactly like subclass features | engine | unit tests on creation/level-up/projection; a builtin feat with a manual `common-play` entry point appears in the action bar |
| `X1-02` | Automatic interceptors: an interceptor without `interaction` applies its `roll.modify`/`property.modify` operations when its `when` predicate holds, at `d20.roll` (attack/check/save families), `primary.damage`, and for derived AC/initiative; attack facts `attack.weapon.ranged` / `attack.weapon.melee` / `attack.weapon.two-handed` are queryable | engine | unit tests; Windows: a Fighter with Archery shows +2 on a ranged attack roll on H/P1/P2 |
| `X1-03` | SRD feat JSON: every SRD feat whose effect is expressible gets `common-play` mechanics (Archery, Defense, Great Weapon Fighting, Two-Weapon Fighting, Alert, Savage Attacker, Grappler, Magic Initiate free cast, Epic Boons where expressible); the feat rule catalog records which feats remain descriptive and why | data | `tests/domain/featRuleCatalog.test.ts` extended; each executable feat has a runtime test |
| `X1-04` | Spell mechanics from data: a `spell-mechanic` content mechanic (the reviewed `SpellMechanicDefinition` shape as JSON) is loaded for builtin and installed spell entries and takes precedence over prose derivation; coverage flips a spell to `combat-executable` only when its definition is reviewed or authored | engine | coverage test counts by tier; an installed add-on spell with a `spell-mechanic` casts through the production spell runtime |
| `X1-05` | Parser widening (small): delayed damage riders, repeated saves, healing over time | engine | derived count rises; no reviewed definition changes |
| `X1-06` | SRD spell JSON, wave 1: the ~63 parser-missed damage/healing spells and the buff/condition spells expressible with existing operations | data | per-spell review notes in `content/`; coverage test asserts the new counts |
| `X1-07` | Supplement compiler: a generic tool turns a translation checkout (front matter + section layout of the owner's `D-D-2024-` repository) plus semantic maps into an external RuleModule; SimpleVTT ships only the tool and a synthetic fixture | tool | unit tests on the synthetic fixture; the tool never embeds non-SRD text in this repository |
| `X1-08` | PHB 2024 supplement add-on (private): 36 subclasses, 12 backgrounds, Aasimar, 58 feats, 52 spells compiled in the owner's private repository; installed through the Contents screen; character creation, level-up, and casting exercised on Windows H/P1/P2 | data + verification | evidence recorded here with the private module's sha256 and the SimpleVTT SHA; no PHB text enters this repository |

Engine work is limited to the three seams (X1-01, X1-02, X1-04) plus X1-05. Summons, shapechange, planar travel,
map-bound zones, and vision simulation are explicitly out of V1.1 scope; they need monster stat content or new
engine capabilities and get their own gates later.

## Conventions

Same as V1: one scoped `agent/*` branch per gate from the live `work/v1-composite` HEAD, tests before product
changes, evidence with exact SHA in this file's evidence table. `main` remains the historical landing branch.

## Evidence

| Gate | SHA | Evidence |
| --- | --- | --- |
