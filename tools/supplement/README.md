# Supplement compiler (X1-07)

Turns a translation checkout laid out like the owner's private `D-D-2024-` repository into an external RuleModule
package that the Contents screen imports. SimpleVTT ships **only the tool and a synthetic fixture**; the compiled
supplement and its semantic maps live in the private repository that owns the text.

## Input layout

```
<source>/
  feats/*.md          front matter (name, original_name, feat_category …), "*일반 재주 — 선행 조건: …*", "- **능력치 증가:** …"
  backgrounds/*.md    "## 배경 특성" table (능력치 / 기원 재주 / 기술 숙련 / 도구 숙련), "장비 A/B"
  species/*.md        "**크기:**", "**이동 속도:**", "## 암시야", one "## …" section per trait
  subclasses/<class>-<name>.md   "## <N>레벨: <feature>" sections → progression contributions on the class track
  spells/items/*.md   "*<N>레벨 <school>*" (or "*소마법 …*"), "- **시전 시간/사거리/구성요소/지속시간:**" bullets
```

`README.md` files are skipped. Entry ids are `<prefix>.<category>.<slug(original_name)>`; subclass features are
`<subclass id>.feature.<level>-<n>` (category `option`).

## Semantic maps (optional, `--semantics <dir>`)

| File | Key | Fields |
| --- | --- | --- |
| `feats.json` | feat slug | `definition` (merged into `feat-definition`), `commonPlay` (executable mechanics; sets `execution.status` to `common-play`) |
| `spells.json` | spell slug | `definition` (e.g. `classes: ["wizard"]`), `mechanic` (a `SpellMechanicDefinition`), `commonPlay` |
| `species.json` | species slug | `definition` (merged into `species-definition`, e.g. `semantics.baseCantrips`) |
| `backgrounds.json` | background slug | `definition` (merged into `background-definition`, e.g. an explicit `tool` id) |
| `subclasses.json` | subclass slug | `features`: `{ "<level>-<n>" \| "<feature slug>": { commonPlay } }` |

Everything the Markdown does not state and the map does not supply stays declarative: the entry is presented,
selectable, and granted, but not executed.

## Usage

```bash
npx tsx scripts/compile-supplement.ts --source <checkout>/10-RULEBOOKS/phb-2024 --semantics <private>/simplevtt/semantics --out <private>/simplevtt/phb-2024-supplement.module.json --module-id phb-2024-supplement --id-prefix phb2024 --document "Player's Handbook 2024"
```

The output is validated with `parseRuleModulePackage` (the Contents screen parser). A lock file
(`<out>.lock.json`) records the checkout revision, file count, entry counts, sha256, and warnings; the V1.1 roadmap
evidence cites that sha256 rather than the private content.

## Fixture

`tests/fixtures/supplement/` is a synthetic checkout (invented content) used by `tests/ui/supplementCompiler.test.ts`
to prove the pipeline end to end: compile → import → create a Character with the installed species, background,
origin feat, and spell → level a Fighter into the installed subclass.
