# Item and Currency Transfer Foundation

Date: 2026-08-22
Status: OWNER-DIRECTED FOUNDATION / RUNTIME NOT YET IMPLEMENTED
Scope: connected and local Session exchange, Party Stash, durable Character write-back

## 1. Outcome

SimpleVTT will treat giving an item or currency as an authoritative transfer transaction, not as two unrelated inventory edits.

```text
intent or offer
-> authority + ownership + balance validation
-> one atomic commit
-> source debit + destination credit
-> durable/session write-back
-> public/private-safe activity record
```

The same application service must back local play, connected play, direct DM grants, Player offers, and Party Stash movement. UI surfaces only submit intent and display projected state.

## 2. Identities that must remain separate

```text
User / participant identity
Character durable ownership
Session Actor control
Inventory or wallet endpoint
Transfer policy authority
```

Controlling an Actor does not grant ownership of its durable Character inventory. Assigning additional Actor control does not make that Actor a legal transfer source. The service resolves the initiating participant to explicit endpoint capabilities before accepting a request.

## 3. Endpoint model

The first contract should expose stable endpoint references rather than passing whole Character objects:

```ts
type AssetEndpointRef =
  | { kind: "character"; characterId: string }
  | { kind: "party-stash"; stashId: string }
  | { kind: "session-loot"; poolId: string }
  | { kind: "dm-grant-source"; sourceId: string };
```

- `character` is durable player-owned inventory/wallet state.
- `party-stash` is shared party/session inventory with a separate policy descriptor.
- `session-loot` is already revealed/acquired session-owned loot; it is not a hiding place for unrevealed DM preparation.
- `dm-grant-source` can instantiate a known ItemDefinition but is never delivered to Players as a browsable private catalog.

Unrevealed loot candidates remain in private DM preparation until an explicit reveal/acquire transition creates a transferable endpoint asset.

## 4. Transfer request

One request may carry item and currency lines so a trade can commit as one unit:

```ts
interface AssetTransferRequest {
  requestId: string;              // idempotency key
  sessionId: string;
  initiatedByParticipantId: string;
  mode: "direct" | "offer" | "stash" | "dm-grant";
  from: AssetEndpointRef;
  to: AssetEndpointRef;
  lines: TransferLine[];
  expectedSourceRevision: number;
  expectedDestinationRevision: number;
  note?: string;
}

type TransferLine =
  | { kind: "item"; itemInstanceId: string; quantity: number }
  | { kind: "currency"; currencyId: string; amount: number };
```

Quantities and currency amounts are non-negative integers. The initial runtime may expose only `gp`, but the contract uses `currencyId` so CP/SP/EP/PP do not require a new transfer grammar.

The existing `goldGp?: number` remains a compatibility projection until a wallet record is materialized. It must not be independently decremented by UI code.

## 5. Item-instance rules

### Unique instances

Equipment, configured items, charged items, and other unique state preserve ItemInstance identity and their canonical state when moved.

### Stack transfer

A partial stack transfer splits inside the transaction. The destination may merge only when a domain-provided stack compatibility key matches. Display name equality is never sufficient.

### Active state

The MVP rejects transfer of an equipped, wielded, or attuned item with an explicit reason. This avoids silently changing AC, granted Actions, attunement limits, or hand state. A later compound workflow may explicitly preview and commit `stow/unequip/unattune + transfer` as one transaction.

### Granted capabilities

After commit, source and destination Action/resource projections are rebuilt from their new inventories. The transfer service does not copy Hotbar slots directly.

## 6. Currency model

Currency is a wallet balance, not an ItemInstance and not a negative-capable free-form number.

```ts
interface WalletVm {
  endpoint: AssetEndpointRef;
  balances: Record<string, number>;
  revision: number;
}
```

The initial supported balance is integer GP. Multi-denomination exchange, conversion, encumbrance, and coin weight are separate profile rules and must not be inferred in presentation.

## 7. Policy and approval

Storage state and permission policy are separate.

Party Stash presets remain:

- `shared`: authorized party members deposit and withdraw directly;
- `dm-approval`: a Player withdrawal becomes a pending request and the DM accepts or rejects;
- `dm-managed`: only the DM moves assets; Players inspect the public stash.

Player-to-Player transfer uses an offer by default:

```text
Sender builds offer
-> source assets reserved, not yet moved
-> recipient accepts/rejects
-> acceptance revalidates revisions and balances
-> atomic commit or explicit stale failure
```

A DM direct grant can commit immediately only when the Session capability policy grants that authority and the destination supports the selected lifetime/write-back.

## 8. Lifetime and persistence

Every endpoint and transfer record declares one lifetime:

```text
durable-character
session
encounter
```

- Durable Character-to-Character exchange writes both Character revisions atomically.
- Session-only assets remain in Session authority and disappear according to the declared lifetime.
- A session asset never becomes permanent merely because it entered a Character-shaped Actor projection.
- Moving a session asset into a durable Character requires an explicit durable-grant/write-back capability.
- Failure to write either durable side rejects the whole transaction; no one-sided save is allowed.

## 9. State machine

```text
draft
-> pending-acceptance | pending-dm-approval | validating
-> committed | rejected | cancelled | expired
```

Offers may reserve source quantity/balance. Reservation prevents double-spend but remains visible and reversible. Expiry is server/session policy, never a hidden UI timer.

`requestId` makes retries idempotent. `expectedSourceRevision` and `expectedDestinationRevision` detect stale inventory. A repeated committed request returns the existing result rather than applying twice.

## 10. Atomic event result

```ts
interface AssetTransferCommitted {
  transferId: string;
  requestId: string;
  from: AssetEndpointRef;
  to: AssetEndpointRef;
  itemChanges: Array<{
    sourceItemInstanceId: string;
    destinationItemInstanceId: string;
    quantity: number;
  }>;
  currencyChanges: Array<{ currencyId: string; amount: number }>;
  sourceRevision: number;
  destinationRevision: number;
  lifetime: "durable-character" | "session" | "encounter";
  provenance: string[];
}
```

The event batch updates inventory/wallet projections, recalculates granted capabilities, and appends Activity history together. Undo, if supported later, is a compensating transaction with fresh validation; history is not deleted.

## 11. Network and privacy boundary

Connected Clients send transfer intent to Session authority. The Host/server validates and emits an authoritative event batch.

Clients receive only:

- endpoints and assets they are authorized to inspect;
- public offer/transaction summaries;
- private rejection detail addressed to the initiating participant;
- final projections relevant to their controlled/owned Characters.

Private DM Library entries and unrevealed loot metadata are not embedded in public Party Stash or autocomplete payloads.

## 12. UI placement

### Character Inventory

Expanded Item detail gains `주기` only after the transfer service exists. It selects recipient, quantity, and shows active-state/lifetime blockers.

### Session right pane

A future `거래 · 보관함` utility owns:

- Party Stash;
- incoming/outgoing offers;
- DM approval queue;
- transfer history and rejection recovery.

It uses the same right utility-pane slot as Quick, Participants, and Session tools. It is not a modal and does not replace Play.

### Quick Search

An authorized ItemDefinition result may offer `지급` or `파티 보관함` only after `dm-grant-source` and destination capabilities materialize. Search never performs a hidden immediate mutation merely by selecting a result.

## 13. First implementation slice

Recommended sequence:

1. Add pure transfer contracts, endpoint capability projection, and validation result types.
2. Materialize Party Stash state with one `shared` policy fixture and GP-only wallet.
3. Implement local atomic Character ↔ Party Stash item/currency transfer service with idempotency and revision tests.
4. Project the `거래 · 보관함` right pane and Character Inventory `주기` workflow.
5. Add Player offer/accept and `dm-approval` state machine.
6. Route the same requests/event batches over connected Session transport and test reconnect replay.
7. Add explicit durable DM grant/write-back from authorized catalog sources.

## 14. Required acceptance scenarios

- transfer part of a Potion stack and preserve total quantity;
- transfer a unique charged item without losing charges/provenance;
- reject equipped/wielded/attuned transfer with an authoritative reason;
- reject insufficient item quantity or GP without partial mutation;
- retry the same request without double application;
- reject stale revisions and refresh both endpoint projections;
- accept/reject/cancel a Player offer and release reservation;
- enforce all three Party Stash policy presets;
- reconnect after commit and receive exactly one transaction;
- fail durable destination write-back and leave both sides unchanged;
- prove that private/unrevealed DM loot never reaches Player payloads.

## 15. Explicit non-goals for the first slice

- barter valuation or automatic fair-price calculation;
- shops, merchants, buy/sell pricing, or taxes;
- coin weight and encumbrance;
- map-ground item coordinates;
- stealing, pickpocketing, contested rolls, or hidden transfers;
- cross-session marketplace or account trading;
- UI-local mutation of ItemInstance quantity or `goldGp`.
