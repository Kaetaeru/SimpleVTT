#!/usr/bin/env python3
"""Validate SimpleVTT JSON Schemas and current contract fixtures."""
from __future__ import annotations

import json
import sys
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker
from referencing import Registry, Resource

ROOT = Path(__file__).resolve().parents[1]
SCHEMA_DIR = ROOT / "schemas"


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def build_registry() -> tuple[dict[str, dict], Registry]:
    schemas: dict[str, dict] = {}
    registry = Registry()
    for path in sorted(SCHEMA_DIR.glob("*.schema.json")):
        schema = load_json(path)
        Draft202012Validator.check_schema(schema)
        schema_id = schema.get("$id")
        if schema_id:
            schemas[schema_id] = schema
            registry = registry.with_resource(schema_id, Resource.from_contents(schema))
        print(f"schema ok: {path.relative_to(ROOT)}")
    return schemas, registry


def validate(instance_path: Path, schema: dict, registry: Registry) -> None:
    instance = load_json(instance_path)
    validator = Draft202012Validator(schema, registry=registry, format_checker=FormatChecker())
    errors = sorted(validator.iter_errors(instance), key=lambda e: list(e.absolute_path))
    if errors:
        print(f"invalid: {instance_path.relative_to(ROOT)}", file=sys.stderr)
        for error in errors:
            location = "/".join(str(part) for part in error.absolute_path) or "<root>"
            print(f"  {location}: {error.message}", file=sys.stderr)
        raise SystemExit(1)
    print(f"instance ok: {instance_path.relative_to(ROOT)}")


def schema_by_id(schemas: dict[str, dict], schema_id: str) -> dict:
    try:
        return schemas[schema_id]
    except KeyError as exc:
        raise SystemExit(f"missing schema id: {schema_id}") from exc


def main() -> None:
    schemas, registry = build_registry()

    validate(
        ROOT / "rules/profiles/dnd.srd-5.2.1.profile.json",
        schema_by_id(schemas, "https://simplevtt.local/schemas/rules-profile.schema.json"),
        registry,
    )

    module_schema = schema_by_id(schemas, "https://simplevtt.local/schemas/rule-module.schema.json")
    module_paths = sorted((ROOT / "content/modules").glob("*/module.json"))
    if not module_paths:
        raise SystemExit("no builtin RuleModule manifests found")
    for path in module_paths:
        validate(path, module_schema, registry)

    golden_schema = schema_by_id(schemas, "https://simplevtt.local/schemas/golden-scenario.schema.json")
    for path in sorted((ROOT / "tests/fixtures/rules").glob("*.json")):
        validate(path, golden_schema, registry)

    content_entry_schema = schema_by_id(schemas, "https://simplevtt.local/schemas/content-entry.schema.json")
    for path in sorted((ROOT / "tests/fixtures/content").glob("*.json")):
        validate(path, content_entry_schema, registry)

    combatant_schema = schema_by_id(schemas, "https://simplevtt.local/schemas/combatant.schema.json")
    validate(ROOT / "examples/combatant.example.json", combatant_schema, registry)
    validate(ROOT / "templates/combatant.template.json", combatant_schema, registry)

    print("all contract validations passed")


if __name__ == "__main__":
    main()
