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
| `X1-05` | Parser widening (small): delayed damage riders, repeated saves, healing over time | engine | derived count rises; no reviewed definition changes — deferred, see evidence |
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
| `X1-01` | `d0122f09f2153503a29e49d024719c700d459647` | PR #351 merged 2026-09-05. `tests/ui/featGrantsRuntime.test.ts` (3): Criminal background records Alert by id and the projection pins a `feat` identity; Fighter 4 records Grappler by stable id; a builtin feat with a manual `common-play` entry point is an owned action and executes. |
| `X1-02` | `a5eafe895933e61854a2fa051bdb2676ee3cfaaf` | PR #352 merged 2026-09-05. `tests/domain/commonPlayAutomaticInterceptorRuntime.test.ts` (7) and `tests/ui/commonPlayAutomaticInterceptorProduction.test.ts` (4): automatic d20/attack.outcome/damage interceptors, attack and equipment facts. Contract doc §10.1. |
| `X1-03` | `0275f832749ae4d298b592196203d14a825d8417` | PR #353 merged 2026-09-05. Feat execution records 1 common-play (Archery) / 1 derived (Defense) / 3 selection / 12 descriptive with reasons. Windows H/P1/P2 Archery run PASS (workflow `x1-03-archery-windows.yml` on head `7f0890b5`: P1 Fighter with Archery + loadout B, longbow d20 10 → +2 applied once, no interrupt, acting Client shows the same total; melee attack carries no bonus). Fixed on the way: creation records the fighting style as a grant; created weapon items own their attack ids. |
| `X1-04` | `c75b8b34e70681c06e358209f305e876aa356a1f` | PR #354 merged 2026-09-05. `parseSpellMechanicDefinition`; authored builtin JSON (`content/spell-mechanics`) outranks prose; installed `spell-definition` + `spell-mechanic` entries present, list for their classes, and cast through production authority (`tests/ui/installedSpellMechanicProduction.test.ts`, `tests/domain/spellMechanicDefinitionRuntime.test.ts`). |
| `X1-05` | — | Deferred: the parser-missed spells were authored as JSON instead (X1-06), which supersedes widening the prose parser for them; delayed-damage riders, repeated saves, and healing over time remain unsupported runtime shapes (recorded per spell in `executionScope`). |
| `X1-06` | `08ae848c29d5c644e46d4a9eee77fa672aebfe0f` | PR #356: wave 1 authored — Chain Lightning, Produce Flame, Flame Blade, Call Lightning, Invisibility, Greater Invisibility, Blur, Faerie Fire, Slow, Mass Heal (10 spells now combat-executable from JSON; Heroism reviewed and left to prose). `tests/domain/spellAuthoredWave.test.ts` casts every authored definition. Remaining bucket (delayed/repeated damage, riders, zones, summons) is out of the current kinds. |
| `X1-07` | `4151521373e55c1b7eebeae7ae95594af894eba0` | PR #355 merged 2026-09-05. `tools/supplement/compileSupplement.ts` + `scripts/compile-supplement.ts` + `scripts/verify-supplement.ts`; synthetic fixture `tests/fixtures/supplement/`; `tests/ui/supplementCompiler.test.ts` (compile → import → creation with installed species/background/origin feat/spell → level into the installed subclass). Installed `species-definition` and `feat-definition` kinds. |
| `X1-08` | `4151521373e55c1b7eebeae7ae95594af894eba0` | PHB 2024 add-on compiled in the private repository `Kaetaeru/D-D-2024-` (branch `simplevtt/phb-2024-supplement`, `90-WORKBENCH/simplevtt/phb-2024-supplement.module.json`, source revision `d3d57472`): 337 entries — 36 subclasses / 178 level features, 12 backgrounds, Aasimar, 58 feats, 52 spells (18 with `spell-mechanic`); module sha256 `b92c97ded0a7f68e4452bf6a9ea3056854a5b43aa100b70690e9ebe6297539c8`. Offline verification through the production adapters (`scripts/verify-supplement.ts`): import OK, species 1/1, backgrounds 12/12 (origin feats granted), subclasses 36/36 (chosen at their first level, features granted by stable id), spells 52/52 (18 cast through production authority). Windows H/P1/P2 with the private module is not reproducible in CI (private content) and no local Rust toolchain exists on the owner's machine; the same import path is exercised on Windows by the synthetic supplement only through unit tests. No PHB text entered this repository. |
