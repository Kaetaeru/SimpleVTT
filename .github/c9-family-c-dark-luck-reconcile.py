from __future__ import annotations

import json
from pathlib import Path

LEDGER = Path("docs/rules/v1-mechanism-coverage-ledger.json")
STATE = Path(".chatgpt-rerun/STATE.md")
CONTROL = Path(".chatgpt-rerun/control.json")
PRODUCT_COMMIT = "9f694348844e70f1afdc3f7ee2c8dc96f3c88817"
RUN_ID = "33290763482"


def append_unique(values: list[str], entry: str) -> None:
    if entry not in values:
        values.append(entry)


def patch_ledger() -> None:
    data = json.loads(LEDGER.read_text(encoding="utf-8"))
    row = next((candidate for candidate in data["rows"] if candidate.get("family") == "C"), None)
    if row is None:
        raise SystemExit("Family C ledger row not found")
    if row.get("disposition") != "INCOMPLETE":
        raise SystemExit(f"Family C disposition changed unexpectedly: {row.get('disposition')}")

    row["currentState"] = (
        "The generic d20 Resolver has portable structural family/outcome selectors for ability checks, saving throws, and attack rolls, "
        "and production now opens the same post-roll Common Play window immediately after authoritative check/save/attack outcome creation. "
        "Cutting Words and Dark One's Own Luck are builtin portable Common Play definitions rather than named production follow-up executors. "
        "Dark One's Own Luck is discovered from already-owned Fiend subclass content, is gated by the canonical level-owned resource payment, "
        "and has local plus connected spend/reconnect/duplicate/Undo/persistence evidence with presentation rename invariance. Family C remains "
        "INCOMPLETE because productionPlayRuntimeAdapter.ts still injects Tactical Mind, Indomitable, and Peerless Skill runtimeD20FollowUps: "
        "Tactical Mind and Peerless Skill require generic conditional pay-on-success, while Indomitable requires a generic authoritative actor/progression "
        "numeric value for its fighter-level reroll bonus; the current portable post-roll modifier contract is literal/resource-die only."
    )

    append_unique(row["implementationEvidence"], f"{PRODUCT_COMMIT} migrates Dark One's Own Luck to owned Fiend portable Common Play and removes its named runtimeD20FollowUps injection")
    append_unique(row["implementationEvidence"], "commonPlayInterceptorProductionRuntimeAdapter.ts generic subclass ownership fallback plus post-authoritative-advance d20 timing")
    append_unique(row["productionEvidence"], f"{PRODUCT_COMMIT} Dark One's Own Luck portable production migration")
    append_unique(row["productionEvidence"], f"C9 Family C Dark Luck Portable Migration run {RUN_ID}: 25/25 focused tests, tsc --noEmit, vite build")
    append_unique(row["identityInvarianceEvidence"], "warlockFiendDarkOnesOwnLuckRuntime.test.ts feature presentation rename leaves portable mechanics unchanged")
    append_unique(row["connectedEvidenceIfRelevant"], f"{PRODUCT_COMMIT} connected Dark One's Own Luck owner prompt, exactly-once Host event, duplicate replay, reconnect, and event-native Undo")
    append_unique(row["persistenceEvidenceIfRelevant"], f"{PRODUCT_COMMIT} connected owning Client persists Dark One's Own Luck spend and compensating Undo before cursor advancement")

    row["remainingNamedSeams"] = [
        "productionPlayRuntimeAdapter.ts still injects Tactical Mind, Indomitable, and Peerless Skill runtimeD20FollowUps; Dark One's Own Luck named injection is removed",
        "Tactical Mind and Peerless Skill require a generic conditional pay-on-success contract before their named projection can be removed",
        "Indomitable requires a generic authoritative actor/progression numeric value for its fighter-level reroll bonus; do not encode Fighter identity or a literal class bonus in the portable d20 path"
    ]

    counts = {"IMPLEMENTED": 0, "INCOMPLETE": 0, "PROVEN_UNNEEDED": 0}
    for candidate in data["rows"]:
        disposition = candidate.get("disposition")
        if disposition in counts:
            counts[disposition] += 1
    if counts != {"IMPLEMENTED": 4, "INCOMPLETE": 32, "PROVEN_UNNEEDED": 0}:
        raise SystemExit(f"unexpected coverage totals: {counts}")
    if data.get("gateNBlockingNamedFallbacks") != []:
        raise SystemExit(f"gateNBlockingNamedFallbacks changed unexpectedly: {data.get('gateNBlockingNamedFallbacks')}")

    LEDGER.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def patch_state() -> None:
    text = STATE.read_text(encoding="utf-8")
    start = text.index("## Family C reconciliation — structural outcome timing and connected dice proven")
    next_start = text.index("## Next Exact Action", start)
    replacement = f'''## Family C reconciliation — Dark One's Own Luck portable, remaining generic gaps explicit

Family C (`d20-test-lifecycle`) remains `INCOMPLETE`, but another named representative has moved onto the generic Common Play path:

- `{PRODUCT_COMMIT}` removes Dark One's Own Luck from `productionPlayRuntimeAdapter.ts` named `runtimeD20FollowUps` authoring and attaches its post-roll d10 mechanic to already-owned Fiend subclass content as portable Common Play. Availability is structural: the normal resource owner grants `resource:warlock.fiend.dark-ones-own-luck` at the canonical level, and generic payment availability gates the interaction.
- The Common Play production adapter now has a generic canonical `subclassIds` ownership fallback for legacy/reference sheets that cannot build a full SessionProjection. No subclass ID selects mechanics; the ID only resolves the already-owned catalog entry, whose mechanics are lowered generically.
- Generic post-roll timing now rechecks after an authoritative `advanceResolution`, so a newly-created `save-result`/attack-result can open the portable d20 interaction immediately rather than requiring an extra advance. Existing failed-save selector acceptance was updated to the immediate timing contract.
- Run `{RUN_ID}` passed 25/25 focused Family C tests, `tsc --noEmit`, and `vite build`. It includes failed/successful Dark One's Own Luck checks, failed-save recovery, below-level non-availability, feature-presentation rename invariance, connected owner prompt, exactly-once event transport, duplicate replay, reconnect, Client persistence, and event-native Undo; Cutting Words and unknown portable interceptor regressions also stayed green.
- Indomitable was deliberately not migrated. Its SRD behavior rerolls a failed save and adds Fighter level; the current generic `roll.modify` contract can express the reroll but not an authoritative actor/progression numeric value. Hardcoding Fighter identity or a literal level bonus would violate the architecture charter.
- Tactical Mind and Peerless Skill remain named because their resource payment is conditional on the modified roll succeeding, which the current generic payment contract does not express.
- Coverage totals remain `IMPLEMENTED=4`, `INCOMPLETE=32`, `PROVEN_UNNEEDED=0`; `gateNBlockingNamedFallbacks` remains empty and overall verdict remains `V1 INCOMPLETE`.

'''
    next_action = '''## Next Exact Action

Continue Family C at the generic post-roll payment boundary: define and implement the smallest repository-native conditional pay-on-success contract that can reuse the Resolver's committed d20 outcome, then migrate Tactical Mind and Peerless Skill without content identity dispatch. Keep Indomitable on its existing named path until the portable post-roll modifier contract has an authoritative generic actor/progression numeric source for the Fighter-level bonus; do not invent a Fighter-specific branch or literal level adapter.'''
    STATE.write_text(text[:start] + replacement + next_action + "\n", encoding="utf-8")


def patch_control() -> None:
    data = json.loads(CONTROL.read_text(encoding="utf-8"))
    expected = {
        "run_id": "b7f27a61-29d8-4ba2-9f93-8e66722d5f41",
        "sequence": 10,
        "task_id": "v1-common-play-c8-rerun",
    }
    for key, value in expected.items():
        if data.get(key) != value:
            raise SystemExit(f"control {key} changed unexpectedly: {data.get(key)!r}")
    data["status"] = "continue"
    data["reason"] = (
        "C9 remains active at IMPLEMENTED=4, INCOMPLETE=32, PROVEN_UNNEEDED=0. Dark One's Own Luck is now portable Common Play with named runtimeD20FollowUps removed; "
        f"run {RUN_ID} passed 25/25 focused tests, typecheck, build, presentation rename invariance, connected exactly-once/reconnect/persistence/Undo. "
        "Family C remains INCOMPLETE: Tactical Mind and Peerless Skill need generic conditional pay-on-success, and Indomitable needs a generic authoritative actor/progression numeric source for its Fighter-level reroll bonus."
    )
    data["updated_at"] = "2026-08-30"
    CONTROL.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    import sys
    if len(sys.argv) != 2 or sys.argv[1] not in {"ledger", "state", "control"}:
        raise SystemExit("usage: c9-family-c-dark-luck-reconcile.py ledger|state|control")
    {"ledger": patch_ledger, "state": patch_state, "control": patch_control}[sys.argv[1]]()
