# WO-UI-008 — Character Inventory management

Date: 2026-08-22
Status: IMPLEMENTED / OWNER QA PENDING
Authority: Owner direction to begin implementing the reviewed Core Systems plan

## Objective

Introduce Inventory as a durable Character Sheet management section while keeping live Item execution in the Session Command Center.

## Placement

- Inventory is a Character Sheet section shared by the SimpleVTT and official-style Sheet hosts.
- The same section is available inside the live Session Full Sheet without replacing or pausing the Play root.
- Inventory is not a global product route and is not copied into the central Play scene.

## Canonical inputs

The view reads the active Character's `ItemInstanceVm` collection and existing Action projection. It presents only facts already represented by current contracts:

- identity and definition reference;
- quantity;
- equipped/wielded state and explicit hand slot;
- attunement requirement/current state;
- charges;
- passive summary and provenance;
- granted Action IDs and current Action availability;
- Character GP.

## Groups

The initial presentation groups by current canonical metadata:

1. equipped/active;
2. consumable;
3. stored/other.

These are presentation groups, not new item mechanics or durable taxonomy. Item names are never used to choose mechanics.

## Operations

- Equip/Unequip uses the existing canonical ItemInstance mutation and Character write-back path.
- Attune/Unattune uses the existing canonical ItemInstance mutation and Character write-back path.
- Item Action availability is projected from the existing Action VM.
- Inventory does not call the legacy UI-only `useItem` decrement path. Quantity/charge consumption and effect resolution remain one atomic Session Item action.

## Explicit gaps

The view labels but does not fabricate:

- weight/carry capacity;
- containers and item location;
- stack split/merge;
- Character-to-Character transfer;
- Party Stash ownership/policy;
- durable DM grant.

These require the domain/architecture contracts already recorded in the Core Systems plan and contract manifest.

## Follow-up sequence

1. Spellbook and Features management projections;
2. status/concentration detail;
3. rest preview/choice/commit contract and workflow;
4. Party Stash ownership, policy, and transfer transaction;
5. Quick Search Item/Condition providers after source/privacy contracts.
