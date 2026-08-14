#!/usr/bin/env python3
"""Validate SimpleVTT JSON Schemas, builtin catalog references, and fixtures."""
from __future__ import annotations

import json
import sys
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker
from referencing import Registry, Resource

ROOT = Path(__file__).resolve().parents[1]
SCHEMA_DIR = ROOT / "schemas"
MODULE_DIR = ROOT / "content/modules"
ALIASES_PATH = ROOT / "content/catalog-reference-aliases.json"
REFERENCE_KEYS = {"originFeat", "featId", "itemId", "spellId", "contentId"}
REFERENCE_LIST_KEYS = {"itemIds", "spellIds", "contentIds"}
SPELL_SOURCE_REVISION = "d3d574725e0ecdfd05cb69fa32cf66196e3a8ee4"
SPELL_SUPPORT_STATUSES = {"reviewed", "partial", "presentation-only"}


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


def iter_config_references(value, path="config"):
    if isinstance(value, dict):
        for key, child in value.items():
            child_path = f"{path}.{key}"
            if key in REFERENCE_KEYS and isinstance(child, str) and child.startswith("dnd.srd521."):
                yield child_path, child
            elif key in REFERENCE_LIST_KEYS and isinstance(child, list):
                for index, item in enumerate(child):
                    if isinstance(item, str) and item.startswith("dnd.srd521."):
                        yield f"{child_path}[{index}]", item
            yield from iter_config_references(child, child_path)
    elif isinstance(value, list):
        for index, child in enumerate(value):
            yield from iter_config_references(child, f"{path}[{index}]")


def validate_catalog_references(module_paths: list[Path]) -> None:
    modules = [(path, load_json(path)) for path in module_paths]
    module_ids: dict[str, Path] = {}
    content_ids: dict[str, Path] = {}

    for path, module in modules:
        module_id = module["moduleId"]
        if module_id in module_ids:
            raise SystemExit(f"duplicate moduleId: {module_id}")
        module_ids[module_id] = path
        for entry in module.get("content", []):
            content_id = entry["id"]
            if content_id in content_ids:
                raise SystemExit(f"duplicate content id: {content_id}")
            content_ids[content_id] = path

    aliases = load_json(ALIASES_PATH) if ALIASES_PATH.exists() else {}
    for alias, definition in aliases.items():
        target = definition.get("target")
        if alias in content_ids:
            raise SystemExit(f"catalog alias shadows real content id: {alias}")
        if target not in content_ids:
            raise SystemExit(f"catalog alias target missing: {alias} -> {target}")

    known_content = set(content_ids) | set(aliases)
    errors: list[str] = []
    for path, module in modules:
        for dependency in module.get("dependencies", []):
            target = dependency["moduleId"]
            if target not in module_ids:
                errors.append(f"{path.relative_to(ROOT)} dependency missing: {target}")

        for entry in module.get("content", []):
            for relationship in entry.get("relationships", []):
                target = relationship["target"]
                if target.startswith("dnd.srd521.") and target not in known_content:
                    errors.append(f"{entry['id']} relationship target missing: {target}")
            for mechanic in entry.get("mechanics", []):
                for location, target in iter_config_references(mechanic.get("config", {})):
                    if target not in known_content:
                        errors.append(f"{entry['id']} {location} missing: {target}")

    if errors:
        print("catalog reference validation failed", file=sys.stderr)
        for error in errors:
            print(f"  {error}", file=sys.stderr)
        raise SystemExit(1)
    print(f"catalog references ok: {len(module_ids)} modules, {len(content_ids)} entries, {len(aliases)} aliases")


def validate_spell_catalog(module_paths: list[Path]) -> None:
    spells = []
    for path in module_paths:
        for entry in load_json(path).get("content", []):
            if entry.get("category") == "spell":
                spells.append(entry)

    ids = [entry["id"] for entry in spells]
    if len(set(ids)) != len(ids):
        raise SystemExit("duplicate spell IDs in materialized catalog")

    errors: list[str] = []
    incomplete: list[str] = []
    for entry in spells:
        presentation = entry.get("presentation", {})
        ko = presentation.get("locales", {}).get("ko-KR", {})
        source = presentation.get("translationSource", {})
        definitions = [m for m in entry.get("mechanics", []) if m.get("kind") == "spell-definition"]
        if not ko.get("name"):
            errors.append(f"{entry['id']}: missing ko-KR name")
        if len(definitions) != 1:
            errors.append(f"{entry['id']}: expected one spell-definition")
            continue

        support = definitions[0].get("config", {}).get("supportStatus")
        if support not in SPELL_SUPPORT_STATUSES:
            errors.append(f"{entry['id']}: invalid supportStatus")
            continue

        source_pinned = source.get("repository") == "Kaetaeru/D-D-2024-" and source.get("revision") == SPELL_SOURCE_REVISION
        if support == "reviewed":
            if not ko.get("description"):
                errors.append(f"{entry['id']}: reviewed spell missing ko-KR description")
            if not source_pinned:
                errors.append(f"{entry['id']}: reviewed spell translation source pin mismatch")
        else:
            missing = []
            if not ko.get("description"):
                missing.append("description")
            if not source_pinned:
                missing.append("pinned-source")
            if missing:
                incomplete.append(f"{entry['id']} ({support}: {', '.join(missing)})")

    if errors:
        for error in errors[:50]:
            print(error, file=sys.stderr)
        raise SystemExit(f"spell integrity failures: {len(errors)}")

    if len(spells) < 339:
        print(
            f"spell catalog coverage pending: {len(spells)}/339 materialized; "
            "external source materialization is a separate explicit build task"
        )
    else:
        print("spell catalog coverage complete: 339/339")
    if incomplete:
        print(f"spell catalog partial/presentation metadata pending: {len(incomplete)} entries")
        for item in incomplete[:10]:
            print(f"  pending: {item}")
    print(
        f"spell catalog integrity ok: {len(spells)} unique materialized entries, "
        "reviewed entries enforce pinned ko-KR source"
    )


def main() -> None:
    schemas, registry = build_registry()

    validate(
        ROOT / "rules/profiles/dnd.srd-5.2.1.profile.json",
        schema_by_id(schemas, "https://simplevtt.local/schemas/rules-profile.schema.json"),
        registry,
    )

    module_schema = schema_by_id(schemas, "https://simplevtt.local/schemas/rule-module.schema.json")
    module_paths = sorted(MODULE_DIR.glob("*/module.json"))
    if not module_paths:
        raise SystemExit("no builtin RuleModule manifests found")
    for path in module_paths:
        validate(path, module_schema, registry)
    validate_catalog_references(module_paths)
    validate_spell_catalog(module_paths)

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
