from pathlib import Path
import json

ledger_path = Path("docs/rules/v1-mechanism-coverage-ledger.json")
ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
row = next(entry for entry in ledger["rows"] if entry["family"] == "N")

row["currentState"] = (
    "Installed arbitrary-ID persistent effects execute through the shared Common Play/Resolver authority. "
    "Portable duration materialization, boundary expiry, automatic consume/retaliation, suppression/unsuppression "
    "with elapsed pause-resume, maintained source/dependent cleanup, connected replay/reconnect, persistence, and "
    "event-native Undo are production-proven under unknown and renamed external identities. Maintained effects use "
    "the generic concentration/effect lifecycle, so source incapacitation ends the source and its dependent effects "
    "in the same authoritative resolution. Named aura/form/mark adapters remain legacy content/projection migration "
    "debt recorded by the legacy inventory and are not supported portable execution fallbacks."
)
row["disposition"] = "IMPLEMENTED"

implementation = (
    "resolutionEffectOps.ts and concentration.ts compose generic maintained-effect source cleanup through typed "
    "concentration/effect StateChanges without content identity dispatch"
)
production = (
    "c9FamilyNEffectDurationProduction.test.ts proves unknown installed Common Play source incapacitation ends "
    "maintained concentration and removes its dependent effect in the same production resolution; event-native Undo restores both"
)
identity = (
    "c9FamilyNEffectDurationProduction.test.ts repeats maintained source/dependent cleanup after complete external "
    "module/content/mechanic identity rename with identical outcome"
)
for field, evidence in [
    ("implementationEvidence", implementation),
    ("productionEvidence", production),
    ("identityInvarianceEvidence", identity),
]:
    if evidence not in row[field]:
        row[field].append(evidence)

row["remainingNamedSeams"] = []
ledger_path.write_text(json.dumps(ledger, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
