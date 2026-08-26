# SimpleVTT V1 Current Handoff

Status: **CURRENT CANONICAL HANDOFF**
Updated: **2026-08-27 Asia/Seoul**
Repository: **`Kaetaeru/SimpleVTT`**
Canonical target branch: **`work/v1-composite`**

이 문서는 다음 작업자가 V1 남은 일만 이어가기 위한 현재 실행 포인터다. 전체 요구사항/출시 Gate는 `V1_RELEASE_EXECUTION_CHECKLIST.md`, 상세 구현 원장은 `CURRENT_WORK.md`와 Git history, 제품 계약은 `docs/design/`을 따른다. Resume만을 이유로 아래 검증 완료 범위를 반복하지 않는다.

## 1. Canonical baseline

- canonical branch: `work/v1-composite`
- validated integration baseline: `4a4cdb195ff4544adbb3bfd49487042238b112c1`
- R1 source/execution matrix: **DONE**. 이는 V1-21 release DONE/Windows acceptance를 뜻하지 않는다.
- R1 exact checkpoints relevant to remaining R2 order:
  - Open Hand Quivering Palm: `126cd848b1b7896eaa09f8775e60dcd9638fdf72`
  - Devotion Smite of Protection: `ec89fa251d969a250c20e11f0abe6d7a4f13d58e`
  - Fiend Dark One's Own Luck: `95042b2ef3c65aef3619334c0bec1ad243d165f2`
  - Lore Peerless Skill: `88bb72dc3d725af049025728003ab6e6b8db1eb0`
  - Lore Cutting Words: `90514e44a21840070bb77ea17561036a86b2e5ca`
- R2 validated remote-owner slices, closed and not to be repeated without direct regression evidence:
  - Rage `dec4f22178b1256597c140170481025bb26f39e3`
  - Wild Shape proof `a65cbd2926032d70f47495873996653c7622cb1e`
  - Cunning Action Dash `ea96509ee0c01922d0f23926445b5a7271a45ae1`
  - Cunning Action Disengage `134e6a8d7def8711d84bb5be56186f353a4ddeb2`
  - Cunning Action Hide `7f8e9459e433164b916ee8ef12fdf3042492d9d7`
  - Uncanny Dodge `a1edf6bc869984aaabf5cf5f564f4f11c21399ad`
  - Berserker Intimidating Presence `3d3c9866fd24c15d233e8d8730e70052597e8fec`
  - Open Hand Wholeness of Body `d03adbe11c10aa394628c025c36bea9d5c27f9c5`
  - Open Hand Fleet Step `df37d8a1ec21459578d79bc076b53b58f142f39c`
  - Devotion Holy Nimbus `5ff7d00e54135bcacfc306d68467671a3a76298e`
  - Open Hand Quivering Palm `37d002862a9ac253b8b7e6b0b138369c588be17d`
  - Devotion Smite of Protection `799fcaebd967b31c74e5520671050e81a5eb09dd`
  - Fiend Dark One's Own Luck `15681838b499e76f8558de2a52265015249e3cc0`

Historical detailed evidence remains in `CURRENT_WORK.md`, previous revisions of this handoff, and GitHub Actions. This handoff intentionally carries only the current execution pointer and exact closure facts.

## 2. Green — R2 Fiend Dark One's Own Luck

Dark One's Own Luck R2 is closed at exact green product/test head `15681838b499e76f8558de2a52265015249e3cc0`.

- Existing R1 semantics were reused: level 6+ Fiend Warlock, failed ability check/save opens the owner interrupt, accepting adds one authoritative d10 and spends one canonical use exactly once.
- The focused Host-unknown proof covers owner-only prompt routing, authoritative d10 delta, one resource spend, one Host commit, Host permanent Character-library isolation, owning Client exactly-once apply/persistence, duplicate request/event safety, reconnect/rebind, and compensating Undo/inverse owner convergence.
- First direct connected red proved a real content-authority gap rather than a fixture-only problem: `dnd.srd521.subclass.warlock.fiend-patron` was absent from canonical builtin subclass content. `83146b8ef94fa3ccc1352e544e58653096ae0cef` adds only that canonical Fiend Patron content identity; no protocol/schema change.
- The next red was test-only: the failed projected check already carried its canonical check bonus, so the proof was corrected to assert the authoritative `+10` d10 delta instead of hard-coding final total 14, and to assert a genuine failed precondition before the owner accepts.
- Exact evidence at `15681838`:
  - UI run `32983451534` / frontend job `98225539840`: **success**, including Typecheck/build.
  - Phase 12 run `32983451596` / connected-protocol job `98225541222`: **success**, including focused connected authority proof, Phase 11 walkthrough, production frontend gate.
  - Windows/Tauri child job is R3, not an R2 closure gate.

Conclusion: **Fiend Dark One's Own Luck remote-owner gap is CLOSED.**

## 3. R2 remaining scope

R2 remains **PARTIAL** until the remaining R1 feature matrix is covered. Actual Windows two-instance/restart proof remains R3.

Next remaining R1-backed slices, in current source/execution order:

1. Lore Peerless Skill
2. Lore Cutting Words

For every slice, reuse current SessionProjection/ActionRequest/ResolutionEvent/owner write-back/reconnect/Undo primitives. Do not add protocol/schema or fake action-bar commands unless a direct product requirement proves they are necessary.

## 4. Active — Lore Peerless Skill remote-owner verification

R1 exact checkpoint `88bb72dc3d725af049025728003ab6e6b8db1eb0` remains local/source execution-green and was not reimplemented.

Current production semantics preserved:

- level 14+ College of Lore Bard only;
- after the Bard fails an ability check or attack roll, the existing owner interrupt offers Peerless Skill;
- at level 14 the existing Bardic Inspiration progression supplies a d10; the authoritative die is added to the failed total;
- Bardic Inspiration is spent only if the added die changes the result to success; if failure remains, the resource is preserved;
- attack success continues through the existing attack resolution and Activity/history path;
- existing ResolutionEvent history, Character owner write-back and generic Undo remain authoritative;
- no standalone fake action is added.

Current focused R2 implementation/proof:

- `8c9f29c3434e10db7254af46dfb6f526bd77c2a2` adds only `tests/ui/connectedProjectedCharacterPeerlessSkillResolution.test.ts`, covering the Host-unknown level-14 Lore Bard ability-check branch: genuine failure -> owner-only interrupt -> authoritative d10 success -> success-only Bardic Inspiration spend -> one Host event -> owning Client exactly-once persistence -> duplicate safety -> reconnect/rebind -> compensating Undo/inverse convergence.
- `0713b637bfd7b542e0b3e8f27d2c95541057e1a3` wires only that proof into the existing Phase12 connected authority gate.
- `aae3f10a466afb25b75d4358a2b410e3e5aa38ab` strengthens the proof with an exact failed-target assertion; no product runtime change.
- Direct canonical-content inspection exposed a real SessionProjection gap: College of Lore identity was missing from `content/modules/dnd-srd-5.2.1.subclasses/module.json` even though Host reconstruction requires canonical subclass identity.
- `919124900ea741b8e45d93a5dd975bf5e3c2ed65` adds only `dnd.srd521.subclass.bard.college-of-lore` with parent Bard. No runtime refactor, protocol or schema change.
- R1 runtime proof `tests/ui/bardCollegeLorePeerlessSkillRuntime.test.ts` explicitly confirms that an accepted Peerless die which still leaves the check failed preserves Bardic Inspiration. The first connected proof covered only the success/spend branch, so the remote no-spend authority branch remained unproven.
- `bfc459ba35d089171d654fd27abb881309bef1fb` adds one test-only connected case in the same focused file: Host-unknown Lore Bard accepts the owner interrupt, authoritative d10 is insufficient, the Host still commits the authoritative resolution but emits no Bardic Inspiration resource StateChange, and the owning Client remains at the original Inspiration count. Product runtime is unchanged.

Current exact verification candidate is `bfc459ba35d089171d654fd27abb881309bef1fb`. Peerless is **not closed** yet.

GitHub Actions remains an external verification blocker rather than an observed product failure:

- older product/proof head `919124900ea741b8e45d93a5dd975bf5e3c2ed65` has UI `32984089140` queued with zero jobs and duplicate UI `32984184587` `startup_failure` with zero jobs; exact Phase12 never registered;
- the new exact candidate `bfc459ba35d089171d654fd27abb881309bef1fb` has no workflow runs or check suites registered as of `2026-08-27T00:32:26+09:00`;
- GitHub's public status page reports Actions operational, so there is no current service-wide incident evidence explaining the repository-specific behavior;
- the available container cannot resolve `github.com`, so a shallow exact-head clone for local focused execution failed before tests with `Could not resolve host: github.com`; no local test result exists;
- do not mutate product, add protocol/schema, or create no-op commits merely to force CI.

Next exact action:

```text
reconcile live branch
-> inspect only exact-head bfc459ba35d089171d654fd27abb881309bef1fb UI/Phase12 registration and jobs
-> if jobs execute and the first Peerless-specific red appears, fix only that cause
-> if UI frontend/Typecheck build and Phase12 connected-protocol + Phase11 + production frontend are green, close Peerless canonically
-> then advance to Lore Cutting Words
-> if Actions remains absent/queued/startup-failed with zero jobs, preserve code; this is an external verification blocker, not evidence for a product refactor
```

Do not add a separate remote attack proof unless direct connected evidence shows a distinct authority gap; R1 already covers the attack branch.

## 5. Hard boundaries

- R3: Cargo/Tauri durability, actual Windows two-instance/restart acceptance.
- R4: rendered UX/error/accessibility.
- R5: exact-SHA release regression/packaging/main/tag.
- Source-complete != release DONE.
- Missing spatial facts are not invented.
- Character owner durable write-back and Host Campaign durable write-back remain separate.
- Session transient state is not a second durable source.
- Connected retry/reconnect remains exactly-once/idempotent.

## 6. Focused verification

Use only the gate needed by the active slice plus its existing connected production gate. Do not rerun the historical full matrix for resume alone.

Peerless Skill closure requires GitHub Actions evidence from the exact verification candidate: UI frontend/Typecheck build plus Phase12 focused connected authority proof, Phase11 walkthrough and production frontend gate. Rust/Tauri/Windows evidence stays separate until R3.
