/**
 * The launched table's authority (the DM's app). Validates the campaign's fixed join code, refuses kicked players,
 * keeps presence, turns chat commands into archive messages, applies GM-only player management, holds the journal
 * with its two permission fields, and numbers every event for the mirrors. Every event is projected per viewer
 * when sent (chat visibility, journal permissions and GM notes), also on a reconnect replay. Persistence happens
 * through callbacks: the campaign (players), the chat archive and journal entries.
 */
import type { ArtAsset } from "../campaign/art";
import { ART_CHUNK, ART_LIMIT, ART_MIMES, artVisible, canManageArt, ChunkAssembler, chunkText } from "../campaign/art";
import type { JournalCharacter, JournalEntry, JournalNpc } from "../campaign/journal";
import { canEdit, canView, mergePlayerEdit, newJournalNpc, projectEntry } from "../campaign/journal";
import type { Page, Token } from "../campaign/page";
import { controlsToken, mergeControllerTokenEdit, playerPageId, projectPage, projectToken, tokenForNpc } from "../campaign/page";
import type { Tracker } from "../campaign/tracker";
import { advanceTurn, emptyTracker, newTurn, withoutToken, withTurn } from "../campaign/tracker";
import { advanceRound, ageEffects, endEffect, noteLog, recordDeathSave, wakeUp } from "../character/play";
import type { CharacterRuntime } from "../character/runtime";
import type { ActiveEffect } from "../character/types";
import { npcAttackSpec, npcCombatant, npcSaveExec } from "../rules/attackSpec";
import { diceParts, traitRule, type TraitRule } from "../compendium/monsterTraits";
import type { AttackOverrides, AttackResolution, AttackSpec, Combatant, DamagePart } from "../rules/resolve";
import { carryDice, damageTypeKey, describeResolution, diceFrom, resolveAttack } from "../rules/resolve";
import type { ActorRef, AttackRef, AttackRiders } from "./protocol";
import { isConditionMarker } from "../campaign/page";
import type { ActResult } from "../rules/actions";
import { ACTIONS, advantageFor, cannotAct, describeAct, npcStats, resolveAction, TURN_MARKS, type ActorStats } from "../rules/actions";
import { bearerRolls, monsterAuras, splitHitOffers, versusParts, withHitChoices } from "../rules/attackSpec";
import { describeSpell, resolveSpell, type CasterStats, type SpellCastSpec, type SpellResolution, type SpellTargetResult } from "../rules/spellcast";
import { onHitOf, spellExec, sustainedExec, sustainOf, type SpellExec } from "../compendium/spells";
import { summonMonster } from "../compendium/summonTemplate";
import { startEffect } from "../character/play";
import type { CastMethod } from "../character/play";
import type { TrackerTurn } from "../campaign/tracker";
import type { Campaign, CampaignClock, ChatMessage, HitOffer, PlayerRole, TriggerOffer } from "../campaign/model";
import { advanceClock, clockText, emptyClock, newMessageId, withPlayer, withPlayerKicked, withPlayerRole } from "../campaign/model";
import { parseFormula, rollFormula } from "../character/dice";
import { triggerPolicyKey } from "../character/rest";
import { ABILITY_KO, type AbilityKey } from "../catalog/types";
import { parseChatInput, renderInline, visibleTo } from "./chat";
import type { ClientCommand, HostMessage, Presence, RollPayload, TableEvent, TableSnapshot } from "./protocol";
import { contentHash, PROTOCOL_VERSION, isClientCommand } from "./protocol";
import type { RuleModuleJson } from "../catalog/types";
import { economyBucketOf, planRollModify, type ContractPayment } from "../rules/contract";
import type { AttackAftermath, AttackOutcomeKind } from "../rules/attackAftermath";
import { guardHint, rollGuard, type GuardOffer, type ReactionTrigger } from "../rules/contractReactions";
import type { RescueOffer, RollFamily } from "../rules/contractUse";
import type { Transport } from "./transport";
import { summonRule } from "../rules/summons";
import { reactionSpellIds } from "../compendium/spells";
import { monsterById } from "../compendium/monsters";

/** R18: "10분" / "1시간 30분" / "8시간" for the chat line. */
const describeMinutes = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours ? `${hours}시간` : ""}${hours && rest ? " " : ""}${rest || !hours ? `${rest}분` : ""}`;
};

/** R16: the 2024 Counterspell — a reaction that makes the other caster roll a Constitution save. */
/** R28 (D151): the effect key a barbarian's 격노 runs under. */
const RAGE_KEY = "feature:barbarian.rage";

const EVENT_BUFFER = 5000;
const SNAPSHOT_CHAT = 300;
/** R24: the host's own log is bounded too (it used to grow for the whole session and was scanned on every prompt). */
const CHAT_BUFFER = 5000;
/** R25 (D129): nothing a peer sends is unbounded any more. */
const LIMITS = { text: 4000, name: 120, targets: 12, dice: 200, markers: 24, playerTokens: 24, playerEntries: 24 };

/**
 * R25 (D130): `/roll` is rolled by the host, but `chat.roll` carries the result of the roll the sender's own dice
 * tray animated — so it was taken on trust and a fabricated total was indistinguishable from a real one. The tray
 * stays where it is; the host now checks the payload against its own formula parser instead.
 */
function checkRoll(roll: RollPayload): string | null {
  if (!roll || typeof roll.formula !== "string" || !Array.isArray(roll.dice) || typeof roll.total !== "number" || typeof roll.modifier !== "number") return "굴림 형식이 아닙니다";
  if (roll.dice.length > LIMITS.dice) return "주사위가 너무 많습니다";
  if (!Number.isFinite(roll.total) || !Number.isInteger(roll.modifier)) return "굴림 값이 숫자가 아닙니다";
  const parsed = parseFormula(roll.formula);
  if (!parsed) return `"${roll.formula.slice(0, 40)}"은(는) 읽을 수 있는 주사위 식이 아닙니다`;
  if (roll.modifier !== parsed.modifier) return "보정값이 주사위 식과 다릅니다";
  const sides = new Set(parsed.dice.map((group) => group.sides));
  let kept = 0;
  let successes = 0;
  for (const die of roll.dice) {
    if (!Number.isInteger(die.sides) || !Number.isInteger(die.value) || !sides.has(die.sides) || die.value < 1 || die.value > die.sides) return "주사위 눈이 주사위 식과 맞지 않습니다";
    if (!die.dropped) kept += die.value;
    if (die.success) successes += 1;
  }
  if (roll.successes !== undefined) return roll.successes === successes && roll.total === successes ? null : "성공 개수가 주사위와 맞지 않습니다";
  // A term with a negative count (`-2d6`) subtracts, so only the bounds can be checked there.
  if (parsed.dice.some((group) => group.count < 0)) return Math.abs(roll.total) <= kept + Math.abs(roll.modifier) ? null : "합계가 주사위로 나올 수 있는 값이 아닙니다";
  return roll.total === kept + roll.modifier ? null : "합계가 주사위와 맞지 않습니다";
}
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;
type Viewer = { userId: string; role: PlayerRole };

export interface TableHostOptions {
  campaign: Campaign;
  hostUserId: string;
  hostSecret?: string;
  archive?: ChatMessage[];
  journal?: JournalEntry[];
  art?: ArtAsset[];
  /** Where the host keeps image bytes by hash (its store); uploads are put here, fetches read from here. */
  artData?: { get(hash: string): Promise<string | undefined>; put(hash: string, dataUrl: string): Promise<void> | void };
  onCampaign?: (campaign: Campaign) => void;
  onChat?: (message: ChatMessage) => void;
  /** An entry was created or changed (persist it), or removed (`{ removed: id }`). */
  onJournal?: (change: { entry: JournalEntry } | { removed: string }) => void;
  onArt?: (change: { asset: ArtAsset } | { removed: string }) => void;
  pages?: Page[];
  onPage?: (change: { page: Page } | { removed: string }) => void;
  /** Linked bars (D78): the host app derives a character's attribute values with its catalog; hp is at least current/max. */
  attributeOf?: (entry: JournalCharacter, link: string) => { value?: number; max?: number } | undefined;
  /** Attack resolution (§12.2) needs the PC sheet derived with the host app's catalog. */
  pcCombatant?: (entry: JournalCharacter) => Combatant;
  pcConcentrationKey?: (entry: JournalCharacter) => string | undefined;
  pcAttackSpec?: (entry: JournalCharacter, attackId: string, riders: AttackRiders) => { spec: AttackSpec; spend: (runtime: CharacterRuntime) => CharacterRuntime } | null;
  /** R53 (D188): what the attacker's own contracts do once the swing has landed — marks, turn economy, table calls. */
  pcAftermath?: (entry: JournalCharacter, attackId: string, outcomes: AttackOutcomeKind[]) => AttackAftermath;
  /** R54 (D189): the reactions this character's contracts open a window for at this moment. */
  pcGuards?: (entry: JournalCharacter, trigger: ReactionTrigger) => GuardOffer[];
  /** R63 (D198): what this character may still add to a swing that just landed (암습, 신성한 강타, on-hit contracts). */
  pcHitOffers?: (entry: JournalCharacter, attackId: string, riders: AttackRiders) => HitOffer[];
  /** R72 (D207): how many attacks this sheet's Attack action makes. */
  pcAttackActionAttacks?: (entry: JournalCharacter) => number;
  /** R58 (D193): the display name of a content id the host has no catalog to look up. */
  contentName?: (contentId: string) => string | undefined;
  /** The official actions (D97) need a PC's ability modifiers, saves and skills from the derived sheet. */
  pcStats?: (entry: JournalCharacter) => ActorStats;
  /** Spells (D102): the spec and caster stats for a spell the PC can cast, and how its cost is paid (null when it cannot). */
  pcSpell?: (entry: JournalCharacter, spellId: string, method?: CastMethod) => { spec: SpellCastSpec; casterStats: CasterStats; spend: (runtime: CharacterRuntime) => CharacterRuntime | null } | null;
  /** R11: whether the character can cast this reaction spell right now (knows it, has a slot) — the cast method to use, or null. */
  pcReactionSpell?: (entry: JournalCharacter, spellId: string) => CastMethod | null;
  /** V3c (D257): the healing the sheet's turn-start contracts give now, with the maximum it stops at. */
  pcTurnStart?: (entry: JournalCharacter) => Array<{ label: string; amount: number; max: number }>;
  /**
   * R35 (D174): the contract rescues this sheet could pay for a d20 of this family that came out this way, and what
   * paying one costs it. The host owns no catalog, so both arrive as functions like every other sheet question.
   */
  pcRescues?: (entry: JournalCharacter, family: RollFamily, outcome: "success" | "failure") => RescueOffer[];
  pcPayContract?: (entry: JournalCharacter, payments: ContractPayment[], outcome: "success" | "failure") => CharacterRuntime | null;
  /**
   * R42 (D182): what a feature's contract asks the *table* for — conditions on a target, creatures spawned or
   * dismissed, movement, and the questions the DM settles. The host owns no catalog, so this arrives as a function.
   */
  pcContractOutcome?: (entry: JournalCharacter, ruleKey: string) => { label: string; conditionsApplied: string[]; conditionsRemoved: string[]; selfMarks?: string[]; deathSave: boolean; notes: string[]; artifacts: Array<{ kind: string; monsterId?: string; count?: number }>; /** R58 (D193): what the use does to the people it was aimed at. */ party: { tempHp?: string; heal?: string; grants: string[]; max?: number } } | null;
  /** R18: run a short or long rest on one sheet (the catalog lives outside the host). */
  pcRest?: (entry: JournalCharacter, kind: "short" | "long") => CharacterRuntime | null;
  /** R83 (D217): the content modules this table is played with (the host's installed ones), offered to players. */
  contentModules?: () => readonly RuleModuleJson[];
  /** R79 (D216), R81 (D215): what this character's features offer at a moment, and using one of them (dice rolled by `roll`). */
  pcTriggers?: (entry: JournalCharacter, event: "short-rest" | "initiative" | "kill") => TriggerOffer[];
  pcTriggerApply?: (entry: JournalCharacter, event: "short-rest" | "initiative" | "kill", choice: { featureId: string; slots?: number[] }, roll: (formula: string) => number) => CharacterRuntime | null;
  /** R10: an item in the character's bag as a table use (healing formula, consumed) and how to take it out of the bag. */
  pcItem?: (entry: JournalCharacter, instanceId: string) => { name: string; heal?: string; text: string; consumes: boolean; consume: (runtime: CharacterRuntime) => CharacterRuntime } | null;
  now?: () => string;
  random?: () => number;
  /** R87 (D222): schedule a callback (tests pass their own clock); defaults to an unref'd setTimeout. */
  setTimer?: (ms: number, run: () => void) => void;
}

/** H1 (D238): the mark a suppressed regeneration leaves until the creature's next turn start. */
const REGEN_SUPPRESSED = "trait:regeneration-suppressed";

export class TableHost {
  private campaign: Campaign;
  private chat: ChatMessage[];
  private journalEntries: Map<string, JournalEntry>;
  private artAssets: Map<string, ArtAsset>;
  private pages: Map<string, Page>;
  /** Uploads in flight: metadata waiting for its chunks. */
  private readonly uploads = new Map<string, { asset: ArtAsset; by: string; got?: number }>();
  private readonly assembler = new ChunkAssembler();
  /** Applied action cards, newest last: inputs to re-resolve and a restore closure for undo. */
  /** Spell cards that can still be undone (or, D90, applied). */
  private readonly spells = new Map<string, { resolution: SpellResolution; restore: () => void; apply?: () => void; /** R12: per-target undo and what was cast, for Legendary Resistance re-application. */ rows?: Array<(() => void) | null>; restoreCaster?: () => void; context?: { spec: SpellCastSpec; casterStats: CasterStats; who: string; playerId?: string } }>();
  /** R16: casts held while a would-be counterspeller decides (prompt id → the command to re-run, and who was asked). */
  private readonly heldCasts = new Map<string, { command: Extract<ClientCommand, { type: "act.cast" }>; userId: string; peerId: string; asked: string[]; name: string; economy: "action" | "bonus" }>();
  /** Set for the length of one resumed cast so the same would-be counterspellers are not asked twice. */
  private counterAsked: string[] | null = null;
  /** R11: attacks held while the target decides on Shield (prompt id → everything needed to finish the attack). */
  /** R86 (D221): the card being applied right now, so an automatic consequence knows which card it belongs to. */
  private causeCard: string | null = null;
  /** R89 (D224): per area and creature, the tracker turn ("round:index") the area last hurt it — kept through leaving and coming back. ponytail: in memory, a host restart forgets this turn's hits. */
  private readonly zoneHits = new Map<string, string>();
  /** R91 (D226): per creature, the once-per-turn offers it took and the tracker turn ("round:index") it took them in. */
  /** R99 (D234): per attacker with 연구된 공격, the creature its last miss was against. ponytail: in memory, and it waits for the next attack rather than ending with the next turn. */
  private readonly studied = new Map<string, string>();
  private readonly turnUses = new Map<string, { mark: string; keys: string[] }>();
  /** R86 (D221): per card, how to take back what happened automatically because of it (effects shed, a smite save card). */
  private readonly childUndos = new Map<string, Array<() => void>>();
  private readonly held = new Map<string, { inputs: { attacker: ActorRef; targets: ActorRef[]; attack: AttackRef; riders?: AttackRiders; by: string; targetIndex: number }; attacker: { entry: JournalEntry; token?: Token; page?: Page }; target: { entry: JournalEntry; token?: Token; page?: Page }; spec: AttackSpec; overrides?: AttackOverrides; resolution: AttackResolution; supersedes?: string; /** R63 (D198): whose answer holds it — the target's reaction, or the attacker's on-hit choice. */ stage?: "reaction" | "on-hit"; /** R63 (D198): the result waits for the DM once it is let go (D90). */ waits?: boolean }>();
  private readonly actions = new Map<string, { inputs: { attacker: ActorRef; targets: ActorRef[]; attack: AttackRef; riders?: AttackRiders; by: string; targetIndex: number }; resolution: AttackResolution; restore: () => void }>();
  /**
   * R37 (D177): official-action cards that can be redone — the command that made them, who rolled, and the marks the
   * result applied, so a rescue can take them off before resolving the action again.
   */
  private readonly acts = new Map<string, { command: Extract<ClientCommand, { type: "act.action" }>; result: ActResult; by: string; who: string }>();
  private readonly connected = new Set<string>();
  private readonly peerUsers = new Map<string, string>();
  private readonly peerTransports = new Map<string, Transport>();
  private readonly transports: Transport[] = [];
  private readonly unsubscribe: Array<() => void> = [];
  /** Buffered unprojected; projected per viewer when sent or replayed. */
  private events: TableEvent[] = [];
  private n = 0;
  /** R24 (D122): this run of the host. Event numbers only mean anything within one session id. */
  private readonly sessionId: string;
  /** R24: tokens carry the host's write counter so a stale full replace cannot wipe newer controller fields (D123). */
  private tokenRev = 0;
  private readonly listeners = new Set<(event: TableEvent) => void>();
  private readonly now: () => string;

  constructor(transport: Transport | Transport[], private readonly options: TableHostOptions) {
    this.campaign = options.campaign;
    this.chat = [...(options.archive ?? [])];
    this.journalEntries = new Map((options.journal ?? []).map((entry) => [entry.id, entry]));
    this.artAssets = new Map((options.art ?? []).map((asset) => [asset.id, asset]));
    this.pages = new Map((options.pages ?? []).map((page) => [page.id, page]));
    this.now = options.now ?? (() => new Date().toISOString());
    // Not the injected `random` — that one belongs to the dice, and a test's stream must not shift because a host was made.
    this.sessionId = `s_${this.now()}_${Math.floor(Math.random() * 0xffffffff).toString(36)}`;
    for (const page of this.pages.values()) for (const token of page.tokens) this.tokenRev = Math.max(this.tokenRev, token.rev ?? 0);
    this.connected.add(options.hostUserId);
    for (const carrier of Array.isArray(transport) ? transport : [transport]) this.attach(carrier);
  }

  get state() { return this.campaign; }
  get archive() { return this.chat; }
  get journal() { return [...this.journalEntries.values()]; }
  get art() { return [...this.artAssets.values()]; }
  get pageList() { return [...this.pages.values()].sort((a, b) => a.order - b.order); }
  get tracker(): Tracker { return this.campaign.tracker ?? emptyTracker(); }
  /** R18: the in-world clock (D115). */
  get clock(): CampaignClock { return this.campaign.clock ?? emptyClock(); }

  attach(carrier: Transport) {
    if (this.transports.includes(carrier)) return;
    this.transports.push(carrier);
    this.unsubscribe.push(carrier.onMessage((from, message) => { if (isClientCommand(message)) { this.peerTransports.set(from, carrier); this.handle(from, message); } }));
    this.unsubscribe.push(carrier.onPeer((peerId, state) => { if (state === "disconnected") this.peerLeft(peerId); }));
  }

  onEvent(listener: (event: TableEvent) => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }

  /** The campaign document changed outside (GM edited settings or the code): take it, re-check kicked players. */
  updateCampaign(campaign: Campaign) {
    const before = this.campaign;
    this.campaign = campaign;
    for (const [peerId, userId] of [...this.peerUsers]) {
      if (campaign.players.find((player) => player.userId === userId)?.kicked) { this.reply(peerId, { type: "refused", reason: "GM이 내보냈습니다", commandType: "kicked" }); this.peerLeft(peerId); }
    }
    for (const player of campaign.players) this.emit({ type: "presence", player: this.presence(player.userId) });
    if (JSON.stringify(before.settings) !== JSON.stringify(campaign.settings)) this.emit({ type: "settings", settings: campaign.settings });
    if (before.playerPageId !== campaign.playerPageId || JSON.stringify(before.pageBookmarks ?? {}) !== JSON.stringify(campaign.pageBookmarks ?? {})) this.emitRibbon();
    // R24 (D122): the tracker, the clock, macros, tables and the name all live on the campaign document too. Before,
    // an outside edit (a renamed campaign, a new join code) rolled them back on the host and told no mirror, so the
    // table silently played two different rounds. Every campaign-level field now emits when it changes.
    if (before.name !== campaign.name) this.emit({ type: "campaign", name: campaign.name });
    if (JSON.stringify(before.tracker ?? emptyTracker()) !== JSON.stringify(this.tracker)) this.emit({ type: "tracker", tracker: this.tracker });
    if (JSON.stringify(before.clock ?? emptyClock()) !== JSON.stringify(this.clock)) this.emit({ type: "clock", clock: this.clock });
    if (JSON.stringify(before.macros ?? []) !== JSON.stringify(campaign.macros ?? [])) this.emit({ type: "macros", macros: campaign.macros ?? [] });
    if (JSON.stringify(before.tables ?? []) !== JSON.stringify(campaign.tables ?? [])) this.emit({ type: "tables", tables: campaign.tables ?? [] });
    // A role change alters what each viewer may see: resend the journal so mirrors converge.
    if (before.players.some((player) => player.role !== campaign.players.find((item) => item.userId === player.userId)?.role)) for (const entry of this.journalEntries.values()) this.emit({ type: "journal", entry });
  }

  /** The GM's own app edits an entry directly (same rules as a GM command). */
  putJournal(entry: JournalEntry) { this.storeEntry({ ...entry, campaignId: this.campaign.id, updatedAt: this.now() }); }
  removeJournal(id: string) { this.dropEntry(id); }

  snapshot(viewer: Viewer): TableSnapshot {
    return {
      campaignId: this.campaign.id,
      name: this.campaign.name,
      settings: this.campaign.settings,
      players: this.campaign.players.filter((player) => !player.kicked).map((player) => this.presence(player.userId)),
      chat: this.chat.filter((message) => visibleTo(message, viewer)).slice(-SNAPSHOT_CHAT),
      journal: [...this.journalEntries.values()].map((entry) => projectEntry(entry, viewer)).filter((entry): entry is JournalEntry => entry !== null),
      art: [...this.artAssets.values()].filter((asset) => artVisible(asset, viewer, this.journal)),
      pages: this.pageList.map((page) => projectPage(page, viewer, this.campaign)).filter((page): page is Page => page !== null),
      playerPageId: this.campaign.playerPageId,
      pageBookmarks: this.campaign.pageBookmarks ?? {},
      tracker: this.tracker,
      clock: this.clock,
      // R17: a player sees only shared macros, and a table's name without its rows (the host draws).
      macros: (this.campaign.macros ?? []).filter((macro) => viewer.role === "gm" || macro.shared),
      tables: (this.campaign.tables ?? []).filter((table) => viewer.role === "gm" || table.shared).map((table) => (viewer.role === "gm" ? table : { ...table, rows: [] })),
      lastEventN: this.n,
      sessionId: this.sessionId,
      // R83 (D217): what the table is played with, so a player's app can bring the same rules.
      ...(this.options.contentModules ? { modules: this.options.contentModules().map((module) => ({ moduleId: module.moduleId, moduleVersion: module.moduleVersion ?? "", hash: contentHash(module) })) } : {}),
    };
  }

  close() {
    this.emit({ type: "closed" });
    for (const off of this.unsubscribe) off();
    for (const carrier of this.transports) carrier.close();
  }

  private presence(userId: string): Presence {
    // R25: this used to be a non-null assertion, so a GM command naming an id nobody holds threw out of the
    // transport callback — and `handle()` had no guard around it (D127).
    const player = this.campaign.players.find((item) => item.userId === userId);
    return { userId, displayName: player?.displayName ?? "?", role: player?.role ?? "player", color: player?.color ?? "#999999", connected: this.connected.has(userId) };
  }

  private roleOf(userId: string): PlayerRole { return this.campaign.players.find((item) => item.userId === userId)?.role ?? "player"; }
  private viewer(userId: string): Viewer { return { userId, role: this.roleOf(userId) }; }

  private setCampaign(campaign: Campaign) { this.campaign = campaign; this.options.onCampaign?.(campaign); }

  /** R25 (D127): nothing a peer sends may take the table down; a command that throws refuses and the host lives on. */
  private handle(peerId: string, command: ClientCommand) {
    try { this.dispatch(peerId, command); }
    catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.reply(peerId, { type: "refused", reason: `그 명령을 처리하다 문제가 생겼습니다 (${detail})`, commandType: command.type });
    }
  }

  private dispatch(peerId: string, command: ClientCommand) {
    if (command.type === "hello") {
      if (command.protocol !== PROTOCOL_VERSION) return this.reply(peerId, { type: "refused", reason: `버전이 다릅니다 (호스트 ${PROTOCOL_VERSION}, 참가자 ${command.protocol}). 같은 빌드를 쓰세요.`, commandType: "hello" });
      // R70 (D205): a player who came by address alone brings no code; a code that is brought still has to match.
      if (command.joinCode && command.joinCode.toUpperCase() !== this.campaign.joinCode) return this.reply(peerId, { type: "refused", reason: "참가 코드가 맞지 않습니다", commandType: "hello" });
      const isHostUser = command.userId === this.options.hostUserId;
      if (isHostUser && (!this.options.hostSecret || command.hostSecret !== this.options.hostSecret)) return this.reply(peerId, { type: "refused", reason: "호스트와 같은 사용자 id입니다", commandType: "hello" });
      const existing = this.campaign.players.find((player) => player.userId === command.userId);
      if (existing?.kicked) return this.reply(peerId, { type: "refused", reason: "GM이 이 캠페인에서 내보낸 참가자입니다", commandType: "hello" });
      // R25 (D126): every participant is handed everyone else's user id in their snapshot, so an id alone proves
      // nothing. The seat that first used an id mints a secret; from then on only that seat may be that person.
      if (!isHostUser && existing?.seat && command.seat !== existing.seat) return this.reply(peerId, { type: "refused", reason: `"${existing.displayName}" 자리는 이미 다른 기기가 쓰고 있습니다 (처음 들어온 기기에서만 이어집니다)`, commandType: "hello" });
      const isNew = !existing;
      this.setCampaign(withPlayer(this.campaign, { userId: command.userId, displayName: command.displayName.trim().slice(0, 40) || "플레이어", seat: isHostUser ? undefined : command.seat }, this.now()));
      // R21: whoever launched this table is its DM, always. The campaign remembers the user id of the tab that made
      // it, and a browser tab mints a new id every time, so the host would otherwise sit at its own table as a plain
      // player. The host secret is minted per launch and only the launching app has it, so this cannot be borrowed.
      if (isHostUser && this.roleOf(command.userId) !== "gm") this.setCampaign(withPlayerRole(this.campaign, command.userId, "gm"));
      // A GM record left behind by an earlier tab that never actually sat at a table is a leftover of making the
      // campaign, not a person: it would show as an offline DM for ever, one more on every launch.
      if (isHostUser) {
        const ghosts = this.campaign.players.filter((item) => item.role === "gm" && item.userId !== command.userId && !this.connected.has(item.userId) && item.lastSeenAt === item.joinedAt);
        if (ghosts.length) this.setCampaign({ ...this.campaign, players: this.campaign.players.filter((item) => !ghosts.includes(item)), updatedAt: this.now() });
      }
      this.peerUsers.set(peerId, command.userId);
      this.connected.add(command.userId);
      const viewer = this.viewer(command.userId);
      // R24 (D122): only replay when the mirror's numbering belongs to *this* run of the host. A relaunched host
      // starts at n = 0, so an old lastEventN used to splice a foreign stream into the mirror, permanently.
      const since = command.sessionId === this.sessionId ? command.lastEventN : undefined;
      if (since !== undefined && since < this.n && this.events.length && this.events[0].n <= since + 1) this.reply(peerId, { type: "events", events: this.events.filter((event) => event.n > since).map((event) => this.project(event, viewer)).filter((event): event is TableEvent => event !== null) });
      else this.reply(peerId, { type: "welcome", snapshot: this.snapshot(viewer) });
      this.emit({ type: "presence", player: this.presence(command.userId) });
      if (!isHostUser) this.say({ type: "system", who: "", content: `${this.presence(command.userId).displayName} 입장${isNew ? " (처음)" : ""}` });
      return;
    }
    const userId = this.peerUsers.get(peerId);
    if (!userId) return this.reply(peerId, { type: "refused", reason: "먼저 입장하세요", commandType: command.type });
    if (command.type === "bye") { this.peerLeft(peerId); return; }
    // R24 (D122): the mirror saw a gap in the numbering and asks for the whole state again.
    if (command.type === "resync") { this.reply(peerId, { type: "welcome", snapshot: this.snapshot(this.viewer(userId)) }); return; }
    this.apply(userId, command, peerId);
  }

  private apply(userId: string, command: ClientCommand, peerId: string) {
    const player = this.campaign.players.find((item) => item.userId === userId);
    if (!player) return;
    const isGm = player.role === "gm";
    const refuse = (reason: string) => this.reply(peerId, { type: "refused", reason, commandType: command.type });
    switch (command.type) {
      case "chat.say": {
        if (typeof command.text !== "string") return refuse("글 형식이 아닙니다");
        if (command.text.length > LIMITS.text) return refuse(`한 번에 ${LIMITS.text}자까지 보낼 수 있습니다`);
        const input = parseChatInput(command.text);
        switch (input.kind) {
          case "empty": return;
          case "say": {
            const rolls = input.inline.map((formula) => rollFormula({ label: "", formula }, this.options.random));
            this.say({ type: "general", who: player.displayName, playerId: userId, content: rolls.length ? renderInline(input.text, rolls.map((roll) => roll.total)) : input.text });
            return;
          }
          case "whisper": {
            const target = input.target.toLowerCase() === "gm" ? "gm" : this.campaign.players.find((item) => item.displayName.toLowerCase() === input.target.toLowerCase())?.userId;
            if (!target) return refuse(`"${input.target}"라는 참가자가 없습니다 (/w gm 도 됩니다)`);
            this.say({ type: "whisper", who: player.displayName, playerId: userId, target, content: input.text });
            return;
          }
          case "emote": this.say({ type: "emote", who: player.displayName, playerId: userId, content: input.text }); return;
          case "desc": if (!isGm) return refuse("/desc 는 GM만 씁니다"); this.say({ type: "desc", who: player.displayName, playerId: userId, content: input.text }); return;
          case "roll": {
            const roll = rollFormula({ label: input.label ?? "", formula: input.formula }, this.options.random);
            this.say({ type: input.mode === "gm" ? "gmroll" : "rollresult", who: player.displayName, playerId: userId, target: input.mode === "self" ? userId : undefined, content: input.label ?? "", roll: { formula: input.formula, total: roll.total, dice: roll.dice.map((die) => ({ sides: die.sides, value: die.value })), modifier: roll.modifier, label: input.label } });
            return;
          }
        }
        return;
      }
      case "chat.roll": {
        const roll = command.roll;
        const wrong = checkRoll(roll);
        if (wrong) return refuse(`${wrong} (굴림은 표에 그대로 올라가므로 호스트가 확인합니다)`);
        this.say({ type: command.mode === "gm" ? "gmroll" : "rollresult", who: player.displayName, playerId: userId, target: command.mode === "self" ? userId : undefined, content: (roll.label ?? "").slice(0, LIMITS.name), roll: { ...roll, label: roll.label?.slice(0, LIMITS.name) } });
        return;
      }
      case "player.role": {
        if (!isGm) return refuse("GM만 역할을 바꿉니다");
        if (!this.campaign.players.some((item) => item.userId === command.userId)) return refuse("그런 참가자가 없습니다");
        if (command.userId === this.options.hostUserId && command.role !== "gm") return refuse("호스트는 GM에서 내릴 수 없습니다");
        this.setCampaign(withPlayerRole(this.campaign, command.userId, command.role));
        this.emit({ type: "presence", player: this.presence(command.userId) });
        this.say({ type: "system", who: "", content: `${this.presence(command.userId).displayName} → ${command.role === "gm" ? "GM" : "플레이어"}` });
        for (const entry of this.journalEntries.values()) this.emit({ type: "journal", entry });
        return;
      }
      case "player.kick": {
        if (!isGm) return refuse("GM만 내보냅니다");
        if (!this.campaign.players.some((item) => item.userId === command.userId)) return refuse("그런 참가자가 없습니다");
        if (command.userId === this.options.hostUserId) return refuse("호스트는 내보낼 수 없습니다");
        const name = this.presence(command.userId).displayName;
        this.setCampaign(withPlayerKicked(this.campaign, command.userId, true));
        for (const [otherPeer, otherUser] of [...this.peerUsers]) if (otherUser === command.userId) { this.reply(otherPeer, { type: "refused", reason: "GM이 내보냈습니다", commandType: "kicked" }); this.peerLeft(otherPeer); }
        this.emit({ type: "kicked", userId: command.userId });
        this.say({ type: "system", who: "", content: `${name} 내보냄` });
        return;
      }
      case "journal.put": {
        const incoming = command.entry;
        if (!incoming || typeof incoming.id !== "string" || (incoming.kind !== "handout" && incoming.kind !== "character" && incoming.kind !== "npc")) return refuse("저널 항목 형식이 아닙니다");
        const stored = this.journalEntries.get(incoming.id);
        const now = this.now();
        // R24 (D125): whoever wrote last used to win outright, so a sheet saved against an older runtime erased the
        // damage the table had just applied. A write whose runtime is stale keeps the stored runtime and says so.
        const staleRuntime = (): boolean => {
          if (!stored || stored.kind === "handout" || incoming.kind === "handout" || stored.kind !== incoming.kind) return false;
          return Boolean(stored.runtime.updatedAt && incoming.runtime.updatedAt && incoming.runtime.updatedAt < stored.runtime.updatedAt);
        };
        if (isGm) {
          const stale = staleRuntime();
          const entry = stale && stored && stored.kind !== "handout" ? { ...incoming, runtime: stored.runtime } as JournalEntry : incoming;
          this.storeEntry({ ...entry, campaignId: this.campaign.id, updatedAt: now, createdAt: stored?.createdAt ?? incoming.createdAt ?? now });
          if (stale) refuse(`${incoming.name}의 상태가 그 사이 바뀌어 HP·상태는 그대로 두었습니다 (시트를 다시 여세요)`);
          return;
        }
        if (!stored) {
          if (incoming.kind !== "character") return refuse("핸드아웃과 NPC는 GM만 만듭니다");
          if (!this.campaign.settings.playersCanCreateCharacters) return refuse("이 캠페인에서는 플레이어가 캐릭터를 만들 수 없습니다 (캠페인 설정)");
          // R25 (D129): one player used to be able to fill the journal with as many entries as they liked.
          if ([...this.journalEntries.values()].filter((item) => item.createdBy === userId).length >= LIMITS.playerEntries) return refuse(`캐릭터는 한 사람당 ${LIMITS.playerEntries}개까지 만들 수 있습니다`);
          // A player's new character is theirs: in their journal, controlled by them, in the root folder.
          this.storeEntry({ ...incoming, name: String(incoming.name ?? "").slice(0, LIMITS.name), campaignId: this.campaign.id, folder: "", canView: [userId], canEdit: [userId], gmNotes: "", archived: false, macros: [], vaultId: undefined, createdBy: userId, createdAt: now, updatedAt: now });
          this.say({ type: "system", who: "", content: `${player.displayName}이(가) 캐릭터 "${incoming.name}"을(를) 만들었습니다` });
          return;
        }
        if (!canEdit(stored, this.viewer(userId))) return refuse("이 항목을 고칠 권한이 없습니다");
        if (staleRuntime() && stored.kind !== "handout" && incoming.kind === stored.kind) {
          this.storeEntry(mergePlayerEdit(stored, { ...incoming, runtime: stored.runtime } as JournalEntry, now));
          return refuse(`${stored.name}의 상태가 그 사이 바뀌었습니다 — HP·상태는 그대로 두었습니다 (다시 시도하세요)`);
        }
        this.storeEntry(mergePlayerEdit(stored, incoming, now));
        return;
      }
      case "journal.grant": {
        // R27 (D146): control is derived from `canEdit`, whose editor was GM-only — so a player could not hand their
        // character to anyone when they had to leave, and there was no command for it in the protocol at all.
        const entry = this.journalEntries.get(command.id);
        if (!entry) return refuse("그 항목이 없습니다");
        const target = this.campaign.players.find((item) => item.userId === command.userId && !item.kicked);
        if (!target) return refuse("그런 참가자가 없습니다");
        if (!isGm) {
          if (entry.kind !== "character") return refuse("자기 캐릭터만 남에게 맡길 수 있습니다");
          if (!canEdit(entry, this.viewer(userId))) return refuse("자기 캐릭터만 남에게 맡길 수 있습니다");
          if (command.userId === userId) return refuse("자기 자신에게는 맡길 수 없습니다");
        }
        const add = (audience: JournalEntry["canEdit"]) => (audience === "all" ? "all" : [...new Set([...audience, command.userId])]);
        const drop = (audience: JournalEntry["canEdit"]) => (audience === "all" ? "all" : audience.filter((id) => id !== command.userId));
        const next = command.control
          ? { ...entry, canEdit: add(entry.canEdit), canView: add(entry.canView) }
          : { ...entry, canEdit: drop(entry.canEdit) };
        this.storeEntry({ ...next, updatedAt: this.now() } as JournalEntry);
        this.say({ type: "system", who: "", content: command.control ? `${entry.name}을(를) ${target.displayName}이(가) 맡습니다` : `${target.displayName}이(가) ${entry.name}을(를) 더는 맡지 않습니다` });
        return;
      }
      case "journal.remove": {
        if (!isGm) return refuse("GM만 저널 항목을 지웁니다");
        this.dropEntry(command.id);
        return;
      }
      case "journal.show": {
        if (!isGm) return refuse("GM만 플레이어에게 보여줍니다");
        if (!this.journalEntries.has(command.id)) return refuse("그 항목이 없습니다");
        this.emit({ type: "journal.show", id: command.id, by: userId });
        return;
      }
      case "art.upload": {
        const asset = command.asset;
        if (!asset || typeof asset.id !== "string" || typeof asset.hash !== "string") return refuse("아트 형식이 아닙니다");
        // R25 (D132): `bytes` is the sender's own word, so the 20 MB limit was decorative — the real bytes arrive
        // in `art.chunk` and were never measured. Both are checked now, and the type has to be an image we serve.
        if (!Number.isFinite(asset.bytes) || asset.bytes > ART_LIMIT) return refuse("이미지가 너무 큽니다 (20MB까지)");
        if (!ART_MIMES.includes(asset.mime)) return refuse(`${asset.mime || "알 수 없는"} 형식은 올릴 수 없습니다 (PNG·JPEG·GIF·WebP)`);
        if (typeof asset.thumb === "string" && asset.thumb.length > 256 * 1024) return refuse("미리보기가 너무 큽니다");
        if (!Number.isInteger(command.total) || command.total < 0 || command.total > Math.ceil(ART_LIMIT / ART_CHUNK) + 2) return refuse("아트 조각 수가 올바르지 않습니다");
        if (this.artAssets.has(asset.id)) return refuse("이미 있는 아트 id입니다");
        if ([...this.uploads.values()].filter((item) => item.by === userId).length >= 4) return refuse("올리는 중인 이미지가 너무 많습니다");
        this.uploads.set(asset.id, { asset: { ...asset, campaignId: this.campaign.id, ownerId: userId, createdAt: this.now(), updatedAt: this.now() }, by: userId });
        if (command.total === 0) void this.finishUpload(asset.id, "");
        return;
      }
      case "art.chunk": {
        const upload = this.uploads.get(command.id);
        if (!upload || upload.by !== userId) return refuse("업로드 중인 아트가 아닙니다");
        // The assembler allocates from `total`, so an unchecked one froze the host on a single command.
        if (!Number.isInteger(command.total) || command.total < 1 || command.total > Math.ceil(ART_LIMIT / ART_CHUNK) + 2) return refuse("아트 조각 수가 올바르지 않습니다");
        if (typeof command.data !== "string" || command.data.length > ART_CHUNK * 2) return refuse("아트 조각이 너무 큽니다");
        upload.got = (upload.got ?? 0) + command.data.length;
        if (upload.got > ART_LIMIT) { this.uploads.delete(command.id); this.assembler.drop(command.id); return refuse("이미지가 너무 큽니다 (20MB까지)"); }
        const whole = this.assembler.add(command.id, command.index, command.total, command.data);
        if (whole !== null) void this.finishUpload(command.id, whole);
        return;
      }
      case "art.update": {
        const asset = this.artAssets.get(command.id);
        if (!asset) return refuse("그 아트가 없습니다");
        if (!canManageArt(asset, this.viewer(userId))) return refuse("이 아트를 고칠 권한이 없습니다");
        const next: ArtAsset = { ...asset, name: command.name?.trim() || asset.name, folder: command.folder ?? asset.folder, tags: command.tags ?? asset.tags, updatedAt: this.now() };
        this.artAssets.set(next.id, next);
        this.options.onArt?.({ asset: next });
        this.emit({ type: "art", asset: next });
        return;
      }
      case "art.remove": {
        const asset = this.artAssets.get(command.id);
        if (!asset) return refuse("그 아트가 없습니다");
        if (!canManageArt(asset, this.viewer(userId))) return refuse("이 아트를 지울 권한이 없습니다");
        this.artAssets.delete(command.id);
        this.options.onArt?.({ removed: command.id });
        this.emit({ type: "art.removed", id: command.id });
        return;
      }
      case "content.fetch": {
        const module = this.options.contentModules?.().find((item) => item.moduleId === command.moduleId);
        if (!module) return this.reply(peerId, { type: "refused", reason: "호스트에 그 모듈이 없습니다", commandType: command.type, id: String(command.moduleId) });
        const hash = contentHash(module);
        const chunks = chunkText(JSON.stringify(module));
        chunks.forEach((data, index) => this.reply(peerId, { type: "content.data", moduleId: module.moduleId, hash, index, total: chunks.length, data }));
        return;
      }
      case "art.fetch": {
        const asset = this.artAssets.get(command.id);
        if (!asset || !artVisible(asset, this.viewer(userId), this.journal)) return this.reply(peerId, { type: "refused", reason: "볼 수 없는 아트입니다", commandType: command.type, id: command.id });
        void this.sendArt(peerId, asset);
        return;
      }
      case "page.put": {
        if (!isGm) return refuse("GM만 페이지를 만들고 고칩니다");
        const incoming = command.page;
        if (!incoming || typeof incoming.id !== "string" || !Array.isArray(incoming.tokens)) return refuse("페이지 형식이 아닙니다");
        const stored = this.pages.get(incoming.id);
        const page: Page = { ...incoming, kind: "page", campaignId: this.campaign.id, tokens: stored ? stored.tokens : (incoming.tokens ?? []), createdAt: stored?.createdAt ?? incoming.createdAt ?? this.now(), updatedAt: this.now() };
        this.storePage(page);
        return;
      }
      case "page.remove": {
        if (!isGm) return refuse("GM만 페이지를 지웁니다");
        if (!this.pages.delete(command.id)) return refuse("그 페이지가 없습니다");
        this.options.onPage?.({ removed: command.id });
        this.emit({ type: "page.removed", id: command.id });
        // R24: a split-the-party bookmark pointing at the deleted scene used to survive it, and `playerPageId()`
        // prefers the bookmark — so that player kept resolving a dead id and saw an empty board forever (D124).
        const bookmarks = Object.fromEntries(Object.entries(this.campaign.pageBookmarks ?? {}).filter(([, pageId]) => pageId !== command.id));
        const dropped = Object.keys(this.campaign.pageBookmarks ?? {}).length !== Object.keys(bookmarks).length;
        if (this.campaign.playerPageId === command.id || dropped) { this.setCampaign({ ...this.campaign, playerPageId: this.campaign.playerPageId === command.id ? undefined : this.campaign.playerPageId, pageBookmarks: bookmarks, updatedAt: this.now() }); this.emitRibbon(); }
        return;
      }
      case "page.ribbon": {
        if (!isGm) return refuse("GM만 플레이어 리본을 옮깁니다");
        if (!this.pages.has(command.pageId)) return refuse("그 페이지가 없습니다");
        this.setCampaign({ ...this.campaign, playerPageId: command.pageId, updatedAt: this.now() });
        this.emitRibbon();
        return;
      }
      case "page.bookmark": {
        if (!isGm) return refuse("GM만 파티를 나눕니다");
        if (command.pageId && !this.pages.has(command.pageId)) return refuse("그 페이지가 없습니다");
        const bookmarks = { ...(this.campaign.pageBookmarks ?? {}) };
        if (command.pageId) bookmarks[command.userId] = command.pageId; else delete bookmarks[command.userId];
        this.setCampaign({ ...this.campaign, pageBookmarks: bookmarks, updatedAt: this.now() });
        this.emitRibbon();
        return;
      }
      case "token.put": {
        const page = this.pages.get(command.pageId);
        if (!page) return refuse("그 페이지가 없습니다");
        const incoming = command.token;
        if (!incoming || typeof incoming.id !== "string" || !Array.isArray(incoming.bars) || incoming.bars.length !== 3) return refuse("토큰 형식이 아닙니다");
        // R25 (D129): the arrays and the stage order arrive from the wire; none of it used to be checked at all.
        if (!Array.isArray(incoming.markers) || incoming.markers.length > LIMITS.markers) return refuse(`마커는 ${LIMITS.markers}개까지 붙일 수 있습니다`);
        if (!Number.isFinite(incoming.z)) return refuse("토큰 형식이 아닙니다");
        if (incoming.bars.some((bar) => bar.value !== undefined && !Number.isFinite(bar.value))) return refuse("바 값이 숫자가 아닙니다");
        const stored = page.tokens.find((token) => token.id === incoming.id);
        const viewer = this.viewer(userId);
        let next: Token;
        // R24 (D123): a GM edit is a whole-token replace. When it was written against an older rev — the player set a
        // marker in the same breath — keep the fields a controller owns rather than silently wiping their work.
        if (isGm) next = this.withLinkedBars(stored && incoming.rev !== stored.rev ? { ...incoming, markers: stored.markers, z: stored.z, bars: stored.bars.map((bar, at) => ({ ...incoming.bars[at], value: bar.value, max: bar.max })) as Token["bars"] } : incoming);
        else if (!stored) {
          // A player may put their own character on the page they are on.
          const entry = incoming.represents ? this.journalEntries.get(incoming.represents) : undefined;
          if (page.id !== playerPageId(this.campaign, viewer)) return refuse("지금 보는 페이지에만 토큰을 놓을 수 있습니다");
          if (!entry || !canEdit(entry, viewer)) return refuse("자기 캐릭터의 토큰만 놓을 수 있습니다");
          if (page.tokens.filter((item) => item.represents && canEdit(this.journalEntries.get(item.represents) ?? entry, viewer)).length >= LIMITS.playerTokens) return refuse(`한 장면에 놓을 수 있는 토큰 수를 넘었습니다 (${LIMITS.playerTokens}개)`);
          next = this.withLinkedBars({ ...incoming, layer: "objects", controlledBy: "inherit", gmNotes: "", locked: false });
        } else {
          if (!controlsToken(stored, viewer, this.journal)) return refuse("이 토큰을 움직일 권한이 없습니다");
          if (stored.locked) return refuse("잠긴 토큰입니다");
          next = mergeControllerTokenEdit(stored, incoming);
          this.applyBarEditsToCharacter(stored, next, userId);
          next = this.withLinkedBars(next);
        }
        this.storeToken(page, next);
        return;
      }
      case "token.remove": {
        const page = this.pages.get(command.pageId);
        const stored = page?.tokens.find((token) => token.id === command.id);
        if (!page || !stored) return refuse("그 토큰이 없습니다");
        if (!controlsToken(stored, this.viewer(userId), this.journal)) return refuse("이 토큰을 지울 권한이 없습니다");
        // R25: only `token.put` used to check this, so a token you could not nudge you could still delete (D131).
        if (!isGm && stored.locked) return refuse("잠긴 토큰입니다");
        const next = { ...page, tokens: page.tokens.filter((token) => token.id !== command.id), updatedAt: this.now() };
        this.pages.set(page.id, next);
        this.options.onPage?.({ page: next });
        this.emit({ type: "token.removed", pageId: page.id, id: command.id });
        const tracker = withoutToken(this.tracker, page.id, command.id);
        if (tracker !== this.tracker && tracker.turns.length !== this.tracker.turns.length) this.setTracker(tracker);
        return;
      }
      case "table.clock": {
        if (!isGm) return refuse("시간은 DM이 옮깁니다");
        const minutes = Math.max(0, Math.min(60 * 24 * 30, Math.floor(command.minutes) || 0));
        if (!minutes) return refuse("옮길 시간이 없습니다");
        this.passTime(minutes);
        this.say({ type: "system", who: "", content: `${describeMinutes(minutes)}이(가) 지납니다 — ${clockText(this.clock)}` });
        return;
      }
      case "table.rest": {
        if (!isGm) return refuse("휴식은 DM이 시작합니다 (플레이어는 제안할 수 있습니다)");
        const long = command.kind === "long";
        const rested: string[] = [];
        for (const entry of [...this.journalEntries.values()]) {
          if (entry.kind !== "character" || entry.archived) continue;
          const runtime = this.options.pcRest?.(entry, command.kind);
          if (!runtime) continue;
          this.storeEntry({ ...entry, runtime: { ...runtime, updatedAt: this.now() }, updatedAt: this.now() });
          rested.push(entry.name);
          // R79 (D216): the end of the party's short rest is the moment 비전 회복 and 마력 회복 wait for.
          const after = this.journalEntries.get(entry.id);
          if (!long && after?.kind === "character") this.offerTriggers(after, "short-rest");
        }
        // R18: a long rest also gives the monsters their day back — per-day spells and traits, legendary resistance, recharges.
        if (long) for (const entry of [...this.journalEntries.values()]) {
          if (entry.kind !== "npc") continue;
          this.storeEntry({ ...entry, runtime: { ...entry.runtime, uses: {}, spent: {}, legendaryUsed: 0, legendaryResistanceUsed: 0, endSaves: [], updatedAt: this.now() }, updatedAt: this.now() });
        }
        this.passTime(long ? 8 * 60 : 60);
        this.say({ type: "system", who: "", content: `${long ? "긴 휴식" : "짧은 휴식"} — ${rested.length ? rested.join(", ") : "쉰 캐릭터 없음"}${long ? " · NPC의 하루 횟수도 돌아왔습니다" : ""} · ${clockText(this.clock)}` });
        return;
      }
      case "act.rest": {
        // A player asks; the DM runs it. Everyone sees the ask, so nobody rests behind the table's back.
        this.say({ type: "system", who: "", content: `${player.displayName}이(가) ${command.kind === "long" ? "긴 휴식" : "짧은 휴식"}을 제안합니다 — DM이 시작할 수 있습니다` });
        return;
      }
      case "table.macros": {
        if (!isGm) return refuse("매크로는 GM이 캠페인에 저장합니다 (자기 매크로는 시트에)");
        if (!Array.isArray(command.macros) || command.macros.length > 100) return refuse("매크로 형식이 아닙니다");
        const macros = command.macros.map((macro) => ({ id: String(macro.id), name: String(macro.name).slice(0, 40), text: String(macro.text).slice(0, 2000), ...(macro.shared ? { shared: true as const } : {}) })).filter((macro) => macro.name && macro.text);
        this.setCampaign({ ...this.campaign, macros, updatedAt: this.now() });
        this.emit({ type: "macros", macros });
        return;
      }
      case "table.tables": {
        if (!isGm) return refuse("굴림표는 GM이 만듭니다");
        if (!Array.isArray(command.tables) || command.tables.length > 100) return refuse("굴림표 형식이 아닙니다");
        const tables = command.tables.map((table) => ({ id: String(table.id), name: String(table.name).slice(0, 40), shared: Boolean(table.shared), rows: (table.rows ?? []).slice(0, 200).map((row) => ({ text: String(row.text).slice(0, 300), weight: Math.max(1, Math.min(999, Math.floor(row.weight) || 1)) })) })).filter((table) => table.name);
        this.setCampaign({ ...this.campaign, tables, updatedAt: this.now() });
        this.emit({ type: "tables", tables });
        return;
      }
      case "chat.table": {
        // R17: the host draws, because a player never holds the rows.
        const table = (this.campaign.tables ?? []).find((item) => item.name === command.name);
        // R25 (D134): the rows are deliberately stripped from a player's snapshot, but the draw itself was open to
        // anyone who knew the name and printed the row into public chat — a secret table could be enumerated.
        if (!table || (!isGm && !table.shared)) return refuse(`"${command.name}" 굴림표가 없습니다`);
        const rows = table.rows.filter((row) => row.text.trim());
        if (!rows.length) return refuse(`"${table.name}"에 항목이 없습니다`);
        const count = Math.max(1, Math.min(20, Math.floor(command.count) || 1));
        const random = this.options.random ?? Math.random;
        const total = rows.reduce((sum, row) => sum + row.weight, 0);
        const drawn: string[] = [];
        for (let at = 0; at < count; at += 1) {
          let ticket = Math.floor(random() * total);
          let picked = rows[rows.length - 1];
          for (const row of rows) { if (ticket < row.weight) { picked = row; break; } ticket -= row.weight; }
          drawn.push(picked.text);
        }
        const label = `굴림표 ${table.name}${count > 1 ? ` ×${count}` : ""}`;
        const type = command.mode === "gm" ? "gmroll" as const : "rollresult" as const;
        this.say({ type, who: player.displayName, playerId: userId, content: `${label}: ${drawn.join(" · ")}`, roll: { formula: `${count}t[${table.name}]`, total: drawn.length, dice: [], modifier: 0, label, drawn } });
        return;
      }
      case "tracker.set": {
        if (!isGm) return refuse("GM만 턴 트래커를 고칩니다");
        const incoming = command.tracker;
        if (!incoming || !Array.isArray(incoming.turns)) return refuse("트래커 형식이 아닙니다");
        this.setTracker({ ...incoming, current: Math.min(incoming.current, incoming.turns.length - 1) });
        return;
      }
      case "tracker.add": {
        const turn = command.turn;
        if (!turn || typeof turn.name !== "string") return refuse("턴 형식이 아닙니다");
        let trusted = turn;
        if (!isGm) {
          const page = turn.pageId ? this.pages.get(turn.pageId) : undefined;
          const token = page?.tokens.find((item) => item.id === turn.tokenId);
          if (!token || !controlsToken(token, this.viewer(userId), this.journal)) return refuse("자기 토큰만 트래커에 넣을 수 있습니다");
          // R25 (D133): only the control of the *token* was checked, and then the whole wire row was stored — so a
          // player could point their own row at another character's sheet, and the DM's 다음 턴 then rolled that
          // character's death saves. A player's row is built from the token the host can see, not from the wire.
          trusted = { ...turn, entryId: token.represents, name: token.name, custom: false, formula: undefined };
        }
        const turnName = String(trusted.name ?? "").slice(0, LIMITS.name);
        let initiative = trusted.initiative ?? 0;
        if (!Number.isFinite(initiative)) return refuse("이니셔티브가 숫자가 아닙니다");
        if (command.rollBonus !== undefined) {
          // R96 (D231): 야성 본능 and its kin — advantage on the initiative roll, from the sheet.
          const initiativeActor = trusted.entryId ? this.journalEntries.get(trusted.entryId) : undefined;
          const initiativeStats = initiativeActor ? this.statsOf({ entry: initiativeActor }) : null;
          const advantaged = initiativeStats ? advantageFor(initiativeStats, "ability-check", { skill: "initiative" }) : undefined;
          const first = 1 + Math.floor((this.options.random ?? Math.random)() * 20);
          const die = advantaged ? Math.max(first, 1 + Math.floor((this.options.random ?? Math.random)() * 20)) : first;
          initiative = die + command.rollBonus;
          this.say({ type: "rollresult", who: player.displayName, playerId: userId, content: `${turnName} · 이니셔티브`, roll: { formula: `1d20${command.rollBonus >= 0 ? "+" : "-"}${Math.abs(command.rollBonus)}`, total: initiative, dice: [{ sides: 20, value: die }], modifier: command.rollBonus, label: `${turnName} · 이니셔티브` } });
        }
        this.setTracker(withTurn(this.tracker, newTurn({ ...trusted, name: turnName, initiative })));
        // R81 (D215): a rolled initiative is the moment 경이로운 신진대사 waits for.
        const rolling = command.rollBonus !== undefined && trusted.entryId ? this.journalEntries.get(trusted.entryId) : undefined;
        if (rolling?.kind === "character") this.offerTriggers(rolling, "initiative", { pageId: trusted.pageId, tokenId: trusted.tokenId });
        return;
      }
      case "tracker.swap": {
        const { turns, current } = this.tracker;
        if (!turns.length || current < 0) return refuse("전투 중이 아닙니다");
        const targetIndex = turns.findIndex((turn) => turn.id === command.turnId);
        if (targetIndex < 0) return refuse("그 차례를 찾을 수 없습니다");
        if (targetIndex === current) return refuse("이미 지금 차례입니다");
        const now = turns[current];
        const later = turns[targetIndex];
        const refOf = (turn: TrackerTurn): ActorRef => ({ entryId: turn.entryId, pageId: turn.pageId, tokenId: turn.tokenId });
        const nowActor = this.actorOfTurn(now);
        const laterActor = this.actorOfTurn(later);
        if (!isGm && !(nowActor && this.mayAct(userId, refOf(now), nowActor.entry)) && !(laterActor && this.mayAct(userId, refOf(later), laterActor.entry))) return refuse("자기 차례나 자기 인물의 차례만 바꿀 수 있습니다");
        // Only within one linked party group: every row from now to the later one (in play order) is a party member.
        const span: number[] = [];
        for (let at = current; span.length <= turns.length; at = (at + 1) % turns.length) { span.push(at); if (at === targetIndex) break; }
        if (span[span.length - 1] !== targetIndex || !span.every((at) => !turns[at].custom && this.actorOfTurn(turns[at])?.entry.kind === "character")) return refuse("이어진 일행 차례끼리만 순서를 바꿉니다 (지금 차례 뒤의 같은 묶음)");
        const swapped = [...turns];
        swapped[current] = { ...later, actionUsed: false, bonusUsed: false, attacksMade: 0 };
        swapped[targetIndex] = { ...now, actionUsed: false, bonusUsed: false, attacksMade: 0 };
        this.setTracker({ ...this.tracker, turns: swapped });
        this.say({ type: "system", who: "", content: `${later.name}이(가) ${now.name}보다 먼저 행동합니다 (순서 교대)` });
        return;
      }
      case "tracker.next": {
        // "턴 마침": the current turn's controller may pass their own turn (D97).
        const current = this.tracker.turns[this.tracker.current];
        const currentPage = current?.pageId ? this.pages.get(current.pageId) : undefined;
        const currentToken = currentPage?.tokens.find((token) => token.id === current?.tokenId);
        if (!isGm && !(currentToken && controlsToken(currentToken, this.viewer(userId), this.journal))) return refuse("GM이나 현재 턴의 조종자만 턴을 넘깁니다");
        this.nextTurn();
        return;
      }
      case "act.attack": {
        const attackerEntry = this.resolveActor(command.attacker);
        if (!attackerEntry) return refuse("공격자를 찾을 수 없습니다");
        if (!isGm && !this.mayAct(userId, command.attacker, attackerEntry.entry)) return refuse("자기 캐릭터로만 공격할 수 있습니다");
        // R15: 마비·무의식·충격 … bar every action and reaction, so they bar attacks too (the cast and act paths already check).
        const cannotAttack = cannotAct(this.conditionsOf(attackerEntry));
        if (cannotAttack) return refuse(`${cannotAttack} 상태라 공격할 수 없습니다`);
        if (!command.targets?.length) return refuse("대상이 없습니다");
        if (command.targets.length > LIMITS.targets) return refuse(`한 번에 ${LIMITS.targets}명까지 겨냥할 수 있습니다`);
        // In combat a player attacks on their turn; out of turn only as a reaction (an opportunity prompt or a readied action).
        if (!isGm && !command.reaction && !command.readied && this.tracker.turns.length && this.turnOf(command.attacker)?.id !== this.tracker.turns[this.tracker.current]?.id) return refuse("자기 턴에만 공격할 수 있습니다 (남의 턴에는 기회 공격·준비한 행동만)");
        let prepared = this.prepareAttack(attackerEntry, command.attack, command.riders ?? {});
        if (!prepared) return refuse("그 공격을 찾을 수 없습니다");
        // D95: players may declare advantage/disadvantage; cover and forced outcomes are the DM's (pre-roll or palette).
        const overrides = isGm ? command.overrides : command.overrides?.advantage ? { advantage: command.overrides.advantage } : undefined;
        // D96: answering an opportunity prompt — the attack is the reactor's reaction against the mover.
        let promptMessage: ChatMessage | undefined;
        if (command.reaction) {
          promptMessage = this.chat.find((message) => message.id === command.reaction && message.type === "prompt");
          const prompt = promptMessage?.prompt;
          if (!prompt || this.promptAnswered(command.reaction)) return refuse("그 기회 공격은 더 이상 열려 있지 않습니다");
          if (!sameActor(prompt.reactor, command.attacker)) return refuse("그 프롬프트의 반응자만 기회 공격을 할 수 있습니다");
          if (command.targets.length !== 1 || !sameActor(prompt.mover, command.targets[0])) return refuse("기회 공격의 대상은 벗어나는 쪽입니다");
          if (this.reactionUsed(command.attacker)) return refuse("이번 라운드의 반응을 이미 썼습니다");
          if (prepared.spec.mode !== "melee") return refuse("기회 공격은 근접 공격으로만 합니다");
          prepared = { ...prepared, spec: { ...prepared.spec, name: `${prepared.spec.name} · 기회 공격` } };
        }
        // R9: a readied action goes off out of turn as the reaction; the 준비 mark is the ticket.
        if (command.readied) {
          if (!this.conditionsOf(attackerEntry).includes("준비")) return refuse("준비한 행동이 없습니다");
          if (this.reactionUsed(command.attacker)) return refuse("이번 라운드의 반응을 이미 썼습니다");
          prepared = { ...prepared, spec: { ...prepared.spec, name: `${prepared.spec.name} · 준비한 행동` } };
        }
        let firstCardId: string | undefined;
        command.targets.forEach((ref, index) => {
          const targetEntry = this.resolveActor(ref);
          if (!targetEntry) { this.reply(peerId, { type: "refused", reason: "대상을 찾을 수 없습니다", commandType: command.type }); return; }
          const id = this.runAttack({ attacker: command.attacker, targets: command.targets, attack: command.attack, riders: command.riders, by: userId, targetIndex: index }, attackerEntry, targetEntry, prepared!, overrides, undefined, undefined, index === 0 ? prepared!.spend : undefined);
          if (index === 0) firstCardId = id;
        });
        if (promptMessage && firstCardId) {
          this.say({ ...promptMessage, prompt: { ...promptMessage.prompt!, outcome: { attacked: firstCardId } }, supersedes: promptMessage.id, content: `${promptMessage.content} → 기회 공격` });
          this.markReactionUsed(command.attacker);
        } else if (command.readied && firstCardId) { this.markReactionUsed(command.attacker); this.mark(attackerEntry, ["준비"], false); }
        // R72 (D207): a sheet whose Attack action makes several attacks spends the action on the last of them, not the first.
        else if (firstCardId) this.countAttack(command.attacker, attackerEntry.entry.kind === "character" && command.attack.source === "weapon" ? this.options.pcAttackActionAttacks?.(attackerEntry.entry) ?? 1 : 1);
        // Attacking spends 도움 and ends 은신 (D97); R12: it also spends 약화 (Sap) on the attacker and 교란 (Vex) the attacker had on the target.
        if (firstCardId) this.mark(attackerEntry, [...TURN_MARKS.onAttack, "약화"], false);
        // R37 (D177): a miss is a d20 that came out a failure, and 탁월한 기술 says so in its own `families`.
        if (firstCardId) {
          const missed = this.actions.get(firstCardId);
          // A natural 1 misses whatever is added to the roll (2024), so there is nothing to rescue there.
          if (missed && missed.resolution.outcome === "miss") {
            this.offerRescue(firstCardId, attackerEntry, "attack-roll", `${missed.resolution.attackTotal} vs AC ${missed.resolution.targetAc}`, `${prepared!.spec.name} 명중 굴림`);
          }
        }
        return;
      }
      case "act.cast": {
        const caster = this.resolveActor(command.caster);
        if (!caster) return refuse("시전자를 찾을 수 없습니다");
        if (!isGm && !this.mayAct(userId, command.caster, caster.entry)) return refuse("자기 캐릭터로만 시전할 수 있습니다");
        const blocked = cannotAct(this.conditionsOf(caster));
        if (blocked) return refuse(`${blocked} 상태라 시전할 수 없습니다`);
        const prepared = this.prepareSpell(caster, command.spellId, command.method);
        if (!prepared) return refuse("그 주문을 시전할 수 없습니다 (모르는 주문이거나 슬롯이 없습니다)");
        const exec = prepared.spec.exec;
        if (!isGm && !command.readied && exec.castingEconomy !== "reaction" && exec.repeat?.economy !== "none" && this.tracker.turns.length && this.turnOf(command.caster)?.id !== this.tracker.turns[this.tracker.current]?.id) return refuse("자기 턴에만 시전할 수 있습니다 (남의 턴에는 반응 주문·준비한 행동만)");
        // R11: answering a shield prompt — the reaction spell against the held attack.
        // R16: answering a counterspell prompt — Counterspell against the held cast.
        let heldPrompt: ChatMessage | undefined;
        let counterPrompt: ChatMessage | undefined;
        if (command.reaction) {
          const answered = this.chat.find((message) => message.id === command.reaction && message.type === "prompt");
          if (answered?.prompt?.kind === "counterspell") {
            if (this.promptAnswered(command.reaction) || !this.heldCasts.has(command.reaction)) return refuse("그 주문 차단은 더 이상 열려 있지 않습니다");
            if (!sameActor(answered.prompt.reactor, command.caster)) return refuse("그 프롬프트의 반응자만 주문 차단을 할 수 있습니다");
            if (!reactionSpellIds("spell.cast-seen").includes(prepared.spec.spellId)) return refuse("주문을 차단하는 반응 주문으로만 답합니다");
            if (this.reactionUsed(command.caster)) return refuse("이번 라운드의 반응을 이미 썼습니다");
            counterPrompt = answered;
          } else {
            heldPrompt = answered;
            if (!heldPrompt?.prompt || heldPrompt.prompt.kind !== "shield" || this.promptAnswered(command.reaction) || !this.held.has(command.reaction)) return refuse("그 방패 반응은 더 이상 열려 있지 않습니다");
            if (!sameActor(heldPrompt.prompt.reactor, command.caster)) return refuse("그 프롬프트의 반응자만 방패를 시전할 수 있습니다");
            if (exec.castingEconomy !== "reaction") return refuse("반응 주문만 답이 됩니다");
            if (this.reactionUsed(command.caster)) return refuse("이번 라운드의 반응을 이미 썼습니다");
          }
        }
        const targetRefs = command.targets.length ? command.targets : exec.targeting.allowedRelations?.every((relation) => relation === "self") ? [command.caster] : [];
        if (targetRefs.length < Math.min(1, exec.targeting.minTargets)) return refuse("대상이 없습니다");
        if (targetRefs.length > Math.max(exec.targeting.maxTargets, command.method?.kind === "sustain" ? 1 : 0)) return refuse(`대상은 최대 ${exec.targeting.maxTargets}명입니다`);
        const targets = targetRefs.map((ref) => this.resolveActor(ref)).filter((item): item is NonNullable<typeof item> => Boolean(item));
        if (targets.length !== targetRefs.length) return refuse("대상을 찾을 수 없습니다");
        const casterCombatant = this.combatantOf(caster);
        if (!casterCombatant) return refuse("시전자의 능력치를 알 수 없습니다");
        const rows = targets.map((target) => ({ target, combatant: this.combatantOf(target), stats: this.statsOf(target) }));
        if (rows.some((row) => !row.combatant || !row.stats)) return refuse("대상의 능력치를 알 수 없습니다");
        const overrides = isGm ? command.overrides : command.overrides?.advantage ? { advantage: command.overrides.advantage } : undefined;
        // R16 (D111): a spell that takes an action or a bonus action can be countered. Ask the first creature that
        // still has its reaction and can cast 주문 차단; the cast is held, so nothing is paid until it goes off.
        const alreadyAsked = this.counterAsked ?? [];
        this.counterAsked = null;
        const economy = exec.castingEconomy === "bonus-action" ? "bonus" : "action";
        // R77 (D212): a repeat of a spell already in effect is not a casting, so there is nothing to counter.
        if (!command.reaction && exec.castingEconomy !== "reaction" && !exec.repeat) {
          const counterer = this.findCounterspeller(command.caster, caster, alreadyAsked);
          if (counterer) {
            const promptId = newMessageId();
            const casterName = caster.token?.name ?? caster.entry.name;
            this.heldCasts.set(promptId, { command, userId, peerId, asked: [...alreadyAsked, counterer.key], name: prepared.spec.name, economy });
            this.sayWithId(promptId, { type: "prompt", who: player.displayName, playerId: userId, content: `${casterName}이(가) ${prepared.spec.name}을(를) 시전합니다 — ${counterer.name}의 ${counterer.spellName}?`, prompt: { kind: "counterspell", mover: { name: casterName, ...command.caster }, reactor: { name: counterer.name, ...counterer.ref }, spell: { name: prepared.spec.name, level: prepared.spec.level }, spellId: counterer.spellId } });
            return;
          }
        }
        const waits = Boolean(this.campaign.settings.dmConfirmsResults) && !isGm;
        const resolution = resolveSpell({ caster: casterCombatant, casterStats: prepared.casterStats, spec: prepared.spec, targets: rows.map((row) => ({ combatant: row.combatant!, stats: row.stats! })), dice: diceFrom(this.options.random ?? Math.random), overrides, apply: !waits });
        // The cost is paid on casting (a slot, concentration on the caster) even when the DM still has to confirm the result.
        const casterBefore = caster.entry;
        let spent: CharacterRuntime | null = null;
        if (casterBefore.kind === "character") { const next = prepared.spend(casterBefore.runtime); if (!next) return refuse("슬롯이나 횟수가 없습니다"); spent = next; this.storeEntry({ ...casterBefore, runtime: { ...next, updatedAt: this.now() }, updatedAt: this.now() }); }
        else if (resolution.concentration && !exec.repeat) { this.mark(caster, ["집중"], true); this.startNpcConcentration(caster.entry.id, prepared.spec.spellId, prepared.spec.name, prepared.spec.level); }
        const restoreNpcUse = casterBefore.kind === "npc" && prepared.npcSpend ? prepared.npcSpend() : undefined;
        // R26 (D136): undoing an old cast used to write the caster's whole pre-cast ledger back, refunding every
        // slot and charge they had spent in between. It now refunds exactly what this cast took.
        const restoreCaster = () => { restoreNpcUse?.(); if (casterBefore.kind === "character" && spent) this.undoOnCaster(casterBefore.id, casterBefore.runtime, spent); else if (casterBefore.kind === "npc" && resolution.concentration && !exec.repeat) { this.mark(caster, ["집중"], false); this.dropNpcConcentration({ entry: casterBefore }); } };
        if (command.readied) { this.markReactionUsed(command.caster); this.mark(caster, ["준비"], false); }
        else if (exec.repeat?.economy === "none") { /* R77 (D212): an area spell's roll when somebody walks in costs the caster nothing */ }
        else if (exec.castingEconomy === "reaction") this.markReactionUsed(command.caster); else this.markUsed(command.caster, exec.castingEconomy === "bonus-action" ? "bonus" : "action");
        this.postSpell(resolution, rows.map((row) => row.target), restoreCaster, waits, player.displayName, userId, { spec: prepared.spec, casterStats: prepared.casterStats });
        if (heldPrompt) { this.say({ ...heldPrompt, prompt: { ...heldPrompt.prompt!, outcome: { shielded: true } }, supersedes: heldPrompt.id, content: `${heldPrompt.content} → ${prepared.spec.name} 시전` }); this.releaseHeld(heldPrompt.id, true, { reduce: 0, label: `${prepared.spec.name} 반응` }); }
        if (counterPrompt) {
          // 2024: the caster of the held spell makes a Constitution save against the counterspeller's save DC.
          const saved = resolution.targets[0]?.save?.success ?? true;
          this.say({ ...counterPrompt, prompt: { ...counterPrompt.prompt!, outcome: { countered: !saved } }, supersedes: counterPrompt.id, content: `${counterPrompt.content} → ${saved ? "차단 실패" : "주문 차단"}` });
          this.releaseCast(counterPrompt.id, !saved);
        }
        return;
      }
      case "act.npcSave": {
        const actor = this.resolveActor(command.actor);
        if (!actor) return refuse("행동하는 쪽을 찾을 수 없습니다");
        if (!isGm && !this.mayAct(userId, command.actor, actor.entry)) return refuse("자기 캐릭터로만 행동할 수 있습니다");
        if (!command.targets?.length) return refuse("대상이 없습니다");
        if (command.targets.length > LIMITS.targets) return refuse(`한 번에 ${LIMITS.targets}명까지 겨냥할 수 있습니다`);
        this.runNpcSave(actor, command.actionName, command.targets, { by: userId, isGm, displayName: player.displayName, refuse });
        return;
      }
      case "act.legendary": {
        const actor = this.resolveActor(command.actor);
        if (!actor) return refuse("행동하는 쪽을 찾을 수 없습니다");
        if (!isGm && !this.mayAct(userId, command.actor, actor.entry)) return refuse("자기 캐릭터로만 행동할 수 있습니다");
        if (actor.entry.kind !== "npc") return refuse("전설 행동은 스탯 블록이 있는 NPC의 것입니다");
        const block = actor.entry.statBlock;
        const action = block.legendaryActions.find((item) => item.name === command.name);
        if (!action) return refuse("그 전설 행동을 찾을 수 없습니다");
        const per = block.legendaryActionsPerRound ?? 0;
        const cost = action.legendaryCost ?? 1;
        const used = actor.entry.runtime.legendaryUsed;
        if (used + cost > per) return refuse(`이번 라운드의 전설 행동이 부족합니다 (${Math.max(0, per - used)}/${per} 남음, ${cost} 필요)`);
        const blocked = cannotAct(this.conditionsOf(actor));
        if (blocked) return refuse(`${blocked} 상태라 행동할 수 없습니다`);
        const spendPool = () => { const current = this.journalEntries.get(actor.entry.id); if (current?.kind === "npc") this.storeEntry({ ...current, runtime: { ...current.runtime, legendaryUsed: current.runtime.legendaryUsed + cost, updatedAt: this.now() }, updatedAt: this.now() }); };
        if (action.kind === "save" && action.save) {
          if (!command.targets?.length) return refuse("대상이 없습니다");
        if (command.targets.length > LIMITS.targets) return refuse(`한 번에 ${LIMITS.targets}명까지 겨냥할 수 있습니다`);
          const posted = this.runNpcSave(actor, action.name, command.targets, { by: userId, isGm, displayName: player.displayName, refuse, legendary: `${used + cost}/${per}` });
          if (posted) spendPool();
          return;
        }
        spendPool();
        const name = actor.token?.name ?? actor.entry.name;
        const result = { kind: "legendary" as const, name: `전설 행동 · ${action.name}`, actor: { name }, text: `${action.text} (전설 행동 ${used + cost}/${per})`, actorMarks: [], targetMarks: [], actorUnmarks: [] };
        this.say({ type: "act", who: player.displayName, playerId: userId, content: describeAct(result), act: result });
        return;
      }
      case "act.spend": {
        // R23 (D121): features are used on the sheet, so the sheet has to say what the turn spent — otherwise the
        // 추가 행동 chip stayed lit all turn after 재기의 바람 or 교활한 행동.
        const actor = this.resolveActor(command.actor);
        if (!actor) return refuse("그 인물을 찾을 수 없습니다");
        if (!isGm && !this.mayAct(userId, command.actor, actor.entry)) return refuse("자기 캐릭터의 행동만 씁니다");
        // R34 (D171): 행동 폭증's contract says `economy.modify action.extra.non-magic +1`. Until now that was a
        // sentence of prose next to the button and the turn's 행동 chip stayed spent.
        if (command.grant) {
          this.markUnused(command.actor, command.which === "bonus" ? "bonus" : "action");
          this.say({ type: "system", who: "", content: `${actor.entry.name}: ${command.source ?? "특성"} — 이번 턴에 ${command.which === "bonus" ? "추가 행동" : "행동"} 하나를 더 씁니다` });
          return;
        }
        this.markUsed(command.actor, command.which === "bonus" ? "bonus" : "action");
        return;
      }
      case "act.trait": {
        const actor = this.resolveActor(command.actor);
        if (!actor) return refuse("그 크리처를 찾을 수 없습니다");
        if (!isGm && !this.mayAct(userId, command.actor, actor.entry)) return refuse("자기 크리처의 특성만 쓸 수 있습니다");
        if (actor.entry.kind !== "npc") return refuse("특성은 스탯 블록이 있는 NPC의 것입니다");
        const trait = actor.entry.statBlock.traits.find((item) => item.name === command.name);
        if (!trait) return refuse("그 특성을 찾을 수 없습니다");
        const name = actor.token?.name ?? actor.entry.name;
        // R19: SRD traits carry no uses, so only the ones the DM gave a per-day count are counted.
        const most = actor.entry.runtime.traitUses?.[trait.name];
        if (most === undefined) { this.say({ type: "emote", who: player.displayName, playerId: userId, content: `${name}: ${trait.name}` }); return; }
        const key = `trait:${trait.name}`;
        const used = actor.entry.runtime.uses?.[key] ?? 0;
        if (used >= most) return refuse(`${trait.name}의 오늘 횟수를 다 썼습니다 (${most}회)`);
        const live = this.journalEntries.get(actor.entry.id);
        if (live?.kind === "npc") this.storeEntry({ ...live, runtime: { ...live.runtime, uses: { ...(live.runtime.uses ?? {}), [key]: used + 1 }, updatedAt: this.now() }, updatedAt: this.now() });
        this.say({ type: "emote", who: player.displayName, playerId: userId, content: `${name}: ${trait.name} (${most - used - 1}/${most} 남음)` });
        return;
      }
      case "act.contract": {
        // R42 (D182): the table-level half of a contract. The sheet applies its own half when the feature is used;
        // this puts on the conditions, spawns what it spawns, and writes down what the DM has to settle.
        const actor = this.resolveActor(command.actor);
        if (!actor) return refuse("그 인물을 찾을 수 없습니다");
        if (!isGm && !this.mayAct(userId, command.actor, actor.entry)) return refuse("자기 캐릭터의 특성만 쓸 수 있습니다");
        if (actor.entry.kind !== "character") return refuse("시트가 있는 캐릭터의 계약입니다");
        const outcome = this.options.pcContractOutcome?.(actor.entry, String(command.ruleKey).slice(0, LIMITS.name));
        if (!outcome) return refuse("그 특성에는 표에서 할 일이 없습니다");
        const who = actor.token?.name ?? actor.entry.name;
        const targets = (command.targets ?? []).slice(0, LIMITS.targets).map((ref) => this.resolveActor(ref)).filter((found): found is NonNullable<typeof found> => Boolean(found));
        for (const target of targets) {
          this.mark(target, outcome.conditionsApplied, true, actor.token?.id);
          this.mark(target, outcome.conditionsRemoved, false);
        }
        const lines: string[] = [];
        // V3d (D258): the turn marks a use puts on its user.
        if (outcome.selfMarks?.length) { this.mark(actor, outcome.selfMarks, true); lines.push(`${who}: ${outcome.selfMarks.join("·")}`); }
        if (outcome.conditionsApplied.length && targets.length) lines.push(`${targets.map((target) => target.token?.name ?? target.entry.name).join(", ")}: ${outcome.conditionsApplied.join("·")}`);
        for (const artifact of outcome.artifacts) {
          if (artifact.kind === "artifact.spawn" && artifact.monsterId) {
            const spawned = this.summonInto(actor, artifact.monsterId, Math.max(1, Math.min(8, artifact.count ?? 1)), outcome.label);
            if (spawned.length) lines.push(`소환: ${spawned.join(", ")}`);
            else lines.push(`소환할 수 없었습니다 (${artifact.monsterId})`);
          } else if (artifact.kind === "artifact.remove") {
            const gone = this.dismissSummonsOf(actor.entry.id);
            if (gone.length) lines.push(`돌려보냄: ${gone.join(", ")}`);
          } else lines.push(`${artifact.kind} — 표에서 처리`);
        }
        // R58 (D193): the half aimed at other people. Temporary hit points, healing and an item in the bag all need
        // a target, which is why none of them could be settled on the user's own sheet.
        const party = outcome.party;
        if (targets.length && (party.tempHp || party.heal || party.grants.length)) {
          const dice = this.options.random ?? Math.random;
          const capped = party.max ? targets.slice(0, party.max) : targets;
          for (const target of capped) {
            const given: string[] = [];
            if (party.tempHp) { const amount = rollGuard(party.tempHp, dice); this.grantTempHp(target, amount); given.push(`임시 HP ${amount}`); }
            if (party.heal) { const amount = rollGuard(party.heal, dice); this.healActor(target, amount); given.push(`회복 ${amount}`); }
            for (const contentId of party.grants) { const name = this.grantContent(target, contentId, outcome.label); given.push(name); }
            if (given.length) lines.push(`${target.token?.name ?? target.entry.name}: ${given.join(", ")}`);
          }
          if (party.max && targets.length > party.max) lines.push(`${party.max}명까지만 적용했습니다`);
        } else if (party.tempHp || party.heal || party.grants.length) lines.push("대상을 고르지 않았습니다");
        if (outcome.deathSave) { this.rollDeathSave(actor.entry.id, player.displayName); lines.push("죽음 내성"); }
        lines.push(...outcome.notes);
        this.say({ type: "act", who: player.displayName, playerId: userId, content: `${who}: ${outcome.label}${lines.length ? ` — ${lines.join(" · ")}` : ""}`, act: {
          kind: "legendary", name: outcome.label, actor: { name: who }, text: lines.join(" · ") || outcome.label, actorMarks: [], targetMarks: outcome.conditionsApplied, actorUnmarks: [],
        } });
        return;
      }
      case "act.summon": {
        const summoner = this.resolveActor(command.summoner);
        if (!summoner) return refuse("소환하는 쪽을 찾을 수 없습니다");
        if (!isGm && !this.mayAct(userId, command.summoner, summoner.entry)) return refuse("자기 캐릭터로만 소환할 수 있습니다");
        const page = summoner.page ?? (command.summoner.pageId ? this.pages.get(command.summoner.pageId) : undefined);
        if (!page) return refuse("소환할 장면이 없습니다");
        // R84 (D219): a summon spell with its own creature fills in its template at the level the spell was cast.
        const template = command.spellId ? spellExec(command.spellId)?.summon : undefined;
        let monster = template ? undefined : monsterById(command.monsterId);
        if (template) {
          const form = template.forms[Math.max(0, Math.min(template.forms.length - 1, Math.floor(Number(command.form) || 0)))];
          if (summoner.entry.kind !== "character" || !form) return refuse("이 소환은 캐릭터의 주문으로만 합니다");
          const going = (summoner.entry.runtime.effects ?? []).find((effect) => effect.key === `spell:${command.spellId}`);
          const level = going?.level ?? spellExec(command.spellId!)!.baseLevel;
          const cast = this.options.pcSpell?.(summoner.entry, command.spellId!, { kind: "slot", level });
          if (!cast) return refuse("시전자가 이 주문을 쓸 수 없습니다");
          const made = summonMonster(form, { level, attack: cast.casterStats.attackBonus, dc: cast.casterStats.saveDc, mod: cast.casterStats.modifier });
          if ("error" in made) return refuse(`소환물을 만들 수 없습니다: ${made.error}`);
          monster = made.monster;
        }
        if (!monster) return refuse("그 괴물을 컴펜디움에서 찾을 수 없습니다");
        const rule = command.spellId && !template ? summonRule(command.spellId) : undefined;
        const most = template ? 1 : rule?.count ?? 8;
        const count = Math.max(1, Math.min(most, command.count ?? 1));
        if (rule && rule.choices.length && !rule.choices.includes(command.monsterId)) return refuse(`${rule.spellId.split(".").pop()}은(는) 그 크리처를 소환하지 않습니다`);
        const summonerName = summoner.token?.name ?? summoner.entry.name;
        // The summoner's controller drives the creature; an NPC summoner leaves it to the GM.
        const controller = summoner.entry.kind === "character" ? summoner.entry.canEdit : [];
        const placed: string[] = [];
        for (let at = 0; at < count; at += 1) {
          const name = count > 1 ? `${monster!.name} ${at + 1}` : monster!.name;
          const entry: JournalNpc = { ...newJournalNpc(this.campaign.id, userId, monster!, { name, now: this.now() }), folder: "소환", canView: controller, canEdit: controller, summonedBy: { entryId: summoner.entry.id, spellId: command.spellId, name: summonerName } };
          this.storeEntry(entry);
          const token = { ...tokenForNpc(entry), controlledBy: controller.length ? controller : ("inherit" as const), z: page.tokens.length + at };
          this.storeToken(this.pages.get(page.id) ?? page, token);
          placed.push(name);
        }
        this.say({ type: "system", who: "", content: `${summonerName}이(가) ${placed.join(", ")}을(를) 소환했습니다${command.spellId ? ` (${rule ? rule.spellId.split(".").pop() : command.spellId})` : ""}` });
        return;
      }
      case "act.dismiss": {
        const summoner = this.resolveActor(command.summoner);
        if (!summoner) return refuse("소환한 쪽을 찾을 수 없습니다");
        if (!isGm && !this.mayAct(userId, command.summoner, summoner.entry)) return refuse("자기 소환물만 돌려보낼 수 있습니다");
        const gone: string[] = [];
        for (const entry of [...this.journalEntries.values()]) {
          if (entry.kind !== "npc" || entry.summonedBy?.entryId !== summoner.entry.id) continue;
          if (command.spellId && entry.summonedBy.spellId !== command.spellId) continue;
          for (const page of [...this.pages.values()]) for (const token of [...page.tokens]) if (token.represents === entry.id) this.dropToken(page.id, token.id);
          this.dropEntry(entry.id);
          gone.push(entry.name);
        }
        if (!gone.length) return refuse("돌려보낼 소환물이 없습니다");
        this.say({ type: "system", who: "", content: `${summoner.token?.name ?? summoner.entry.name}의 소환물이 사라집니다: ${gone.join(", ")}` });
        return;
      }
      case "act.resist": {
        if (!isGm) return refuse("전설 저항은 DM이 결정합니다");
        const record = this.spells.get(command.messageId);
        if (!record || !record.resolution.applied || !record.rows || !record.context) return refuse("적용된 주문 카드가 아닙니다");
        // R15: two tokens may share one stat block, so the token decides which row the DM meant.
        const index = record.resolution.targets.findIndex((row) => (command.tokenId ? row.target.tokenId === command.tokenId : row.target.id === command.targetId));
        const row = index >= 0 ? record.resolution.targets[index] : undefined;
        if (!row || !row.save || row.save.success) return refuse("실패한 내성이 있는 대상이 아닙니다");
        const page = row.target.tokenId ? [...this.pages.values()].find((item) => item.tokens.some((token) => token.id === row.target.tokenId)) : undefined;
        const target = this.resolveActor({ entryId: row.target.id, pageId: page?.id, tokenId: row.target.tokenId });
        if (!target || target.entry.kind !== "npc") return refuse("전설 저항은 스탯 블록이 있는 NPC의 것입니다");
        const block = target.entry.statBlock;
        const used = target.entry.runtime.legendaryResistanceUsed ?? 0;
        if (!block.legendaryResistance || used >= block.legendaryResistance) return refuse("전설 저항이 남지 않았습니다");
        const casterActor = this.resolveActor({ entryId: record.resolution.caster.id });
        const casterCombatant = casterActor ? this.combatantOf(casterActor) : null;
        if (!casterCombatant) return refuse("시전자를 찾을 수 없습니다");
        record.rows[index]?.();
        const live = this.resolveActor({ entryId: row.target.id, pageId: page?.id, tokenId: row.target.tokenId }) ?? target;
        const combatant = this.combatantOf(live);
        const stats = this.statsOf(live);
        if (!combatant || !stats) return refuse("대상의 능력치를 알 수 없습니다");
        const again = resolveSpell({ caster: casterCombatant, casterStats: record.context.casterStats, spec: record.context.spec, targets: [{ combatant, stats }], dice: diceFrom(this.options.random ?? Math.random), fixedDamage: row.damage?.damage.map((part) => part.dice), forceSaveSuccess: true, apply: true });
        const newRow = { ...again.targets[0], save: { ...again.targets[0].save!, d20: row.save.d20, bonus: row.save.bonus, total: row.save.total, legendary: true } };
        const targetName = live.token?.name ?? live.entry.name;
        const resolution: SpellResolution = { ...record.resolution, targets: record.resolution.targets.map((item, at) => (at === index ? newRow : item)), note: [record.resolution.note, `${targetName}: 전설 저항 (${used + 1}/${block.legendaryResistance})`].filter(Boolean).join(" · ") };
        record.rows[index] = this.applySpellRow(newRow, live, resolution);
        const rows = record.rows;
        const restoreCaster = record.restoreCaster ?? (() => undefined);
        this.spells.set(command.messageId, { ...record, resolution, restore: () => { for (const restore of [...rows].reverse()) restore?.(); restoreCaster(); } });
        const current = this.journalEntries.get(live.entry.id);
        if (current?.kind === "npc") this.storeEntry({ ...current, runtime: { ...current.runtime, legendaryResistanceUsed: used + 1, updatedAt: this.now() }, updatedAt: this.now() });
        this.sayWithId(command.messageId, { type: "spell", who: record.context.who, playerId: record.context.playerId, content: describeSpell(resolution), spell: resolution });
        this.say({ type: "system", who: "", content: `${targetName}: 전설 저항으로 ${resolution.name}의 내성에 성공 (${block.legendaryResistance - used - 1}/${block.legendaryResistance} 남음)` });
        return;
      }
      case "act.item": {
        const actor = this.resolveActor(command.actor);
        if (!actor) return refuse("쓰는 쪽을 찾을 수 없습니다");
        if (!isGm && !this.mayAct(userId, command.actor, actor.entry)) return refuse("자기 캐릭터의 물건만 쓸 수 있습니다");
        if (actor.entry.kind !== "character") return refuse("가방이 있는 캐릭터만 물건을 씁니다");
        const blocked = cannotAct(this.conditionsOf(actor));
        if (blocked) return refuse(`${blocked} 상태라 쓸 수 없습니다`);
        const item = this.options.pcItem?.(actor.entry, command.instanceId);
        if (!item) return refuse("그 물건이 가방에 없습니다");
        const target = command.target ? this.resolveActor(command.target) : actor;
        if (!target) return refuse("대상을 찾을 수 없습니다");
        const actorName = actor.token?.name ?? actor.entry.name;
        const targetName = target.token?.name ?? target.entry.name;
        const self = target.entry.id === actor.entry.id && (!target.token || target.token.id === actor.token?.id);
        const now = this.now();
        let text = item.text;
        let healed: number | undefined;
        if (item.heal) {
          const roll = rollFormula({ label: item.name, formula: item.heal, kind: "custom" }, this.options.random ?? Math.random);
          healed = roll.total;
          const dice = roll.dice.map((die) => die.value).join("+");
          if (target.entry.kind === "character") {
            const before = target.entry.runtime;
            const after = Math.min(before.hp.maxSeen, before.hp.current + healed);
            const current = this.journalEntries.get(target.entry.id);
            if (current?.kind === "character") this.storeEntry({ ...current, runtime: noteLog({ ...current.runtime, hp: { ...current.runtime.hp, current: after }, updatedAt: now }, `${actorName}의 ${item.name}: 회복 ${healed}`), updatedAt: now });
            text = `${item.name} (${dice}${roll.modifier ? ` +${roll.modifier}` : ""} = ${healed} 회복) · HP ${before.hp.current} → ${after}`;
          } else if (target.entry.kind === "npc") {
            const before = target.entry.runtime;
            const bar = target.token?.bars[0];
            const page = target.page ? this.pages.get(target.page.id) : undefined;
            const live = page?.tokens.find((candidate) => candidate.id === target.token?.id);
            if (live && bar && !bar.link && page) { const value = Math.min(bar.max ?? before.hp.max, (bar.value ?? 0) + healed); this.storeToken(page, { ...live, bars: [{ ...bar, value }, live.bars[1], live.bars[2]] }); text = `${item.name} (${dice} = ${healed} 회복) · HP ${bar.value ?? 0} → ${value}`; }
            else { const after = Math.min(before.hp.max, before.hp.current + healed); const current = this.journalEntries.get(target.entry.id); if (current?.kind === "npc") this.storeEntry({ ...current, runtime: { ...current.runtime, hp: { ...current.runtime.hp, current: after }, updatedAt: now }, updatedAt: now }); text = `${item.name} (${dice} = ${healed} 회복) · HP ${before.hp.current} → ${after}`; }
          }
        }
        const owner = this.journalEntries.get(actor.entry.id);
        if (owner?.kind === "character") this.storeEntry({ ...owner, runtime: noteLog({ ...item.consume(owner.runtime), updatedAt: now }, `${item.text}${self ? "" : ` → ${targetName}`}`), updatedAt: now });
        this.markUsed(command.actor, "action");
        const result = { kind: "item" as const, name: item.name, actor: { name: actorName }, target: self ? undefined : { name: targetName }, text, actorMarks: [], targetMarks: [], actorUnmarks: [] };
        this.say({ type: "act", who: player.displayName, playerId: userId, content: describeAct(result), act: result });
        return;
      }
      case "act.action": {
        const actor = this.resolveActor(command.actor);
        if (!actor) return refuse("행동하는 쪽을 찾을 수 없습니다");
        if (!isGm && !this.mayAct(userId, command.actor, actor.entry)) return refuse("자기 캐릭터로만 행동할 수 있습니다");
        const current = this.tracker.turns[this.tracker.current];
        if (!isGm && this.tracker.turns.length && (!current || this.turnOf(command.actor)?.id !== current.id)) return refuse("자기 턴에만 행동할 수 있습니다");
        const def = ACTIONS.find((item) => item.kind === command.kind);
        if (!def) return refuse("모르는 행동입니다");
        const blocked = cannotAct(this.conditionsOf(actor));
        if (blocked) return refuse(`${blocked} 상태라 행동할 수 없습니다`);
        const target = command.target ? this.resolveActor(command.target) : null;
        if (def.target && !target) return refuse("대상을 찾을 수 없습니다");
        const stats = this.statsOf(actor);
        if (!stats) return refuse("이 인물의 능력치를 알 수 없습니다");
        const targetStats = target ? this.statsOf(target) : null;
        if (target && !targetStats) return refuse("대상의 능력치를 알 수 없습니다");
        const result = resolveAction({
          kind: command.kind, skill: command.skill, dc: isGm ? command.dc : undefined, note: command.note, choice: command.choice, bonus: command.bonus, random: this.options.random ?? Math.random,
          actor: { name: actor.token?.name ?? actor.entry.name, stats, conditions: this.conditionsOf(actor) },
          target: target && targetStats ? { name: target.token?.name ?? target.entry.name, stats: targetStats, conditions: this.conditionsOf(target) } : undefined,
        });
        this.mark(actor, result.actorMarks, true);
        this.mark(actor, result.actorUnmarks, false);
        if (target) this.mark(target, result.targetMarks, true, actor.token?.id);
        this.markUsed(command.actor, command.bonus ? "bonus" : "action");
        const actId = newMessageId();
        this.acts.set(actId, { command, result, by: userId, who: player.displayName });
        if (this.acts.size > 100) this.acts.delete(this.acts.keys().next().value as string);
        this.sayWithId(actId, { type: "act", who: player.displayName, playerId: userId, content: describeAct(result), act: result });
        // R37 (D177): 붙잡기·밀치기's roll is the *target's* saving throw, so the question goes to them; every other
        // official action rolls the actor's own ability check.
        const rolledBy = command.kind === "grapple" || command.kind === "shove" ? target : actor;
        const family: RollFamily = command.kind === "grapple" || command.kind === "shove" ? "saving-throw" : "ability-check";
        if (result.check && result.check.success === false && rolledBy) this.offerRescue(actId, rolledBy, family, `${result.check.label} ${result.check.d20}${result.check.bonus >= 0 ? "+" : "-"}${Math.abs(result.check.bonus)} = ${result.check.total}${result.check.dc === undefined ? "" : ` vs DC ${result.check.dc}`}`, result.name);
        return;
      }
      case "act.provoke": {
        const mover = this.resolveActor(command.mover);
        const from = this.resolveActor(command.from);
        if (!mover || !from) return refuse("벗어나는 쪽이나 상대를 찾을 수 없습니다");
        if (!isGm && !this.mayAct(userId, command.mover, mover.entry)) return refuse("자기 캐릭터로만 벗어날 수 있습니다");
        if (mover.entry.id === from.entry.id && mover.token?.id === from.token?.id) return refuse("자기 자신에게서 벗어날 수는 없습니다");
        const moverName = mover.token?.name ?? mover.entry.name;
        const fromName = from.token?.name ?? from.entry.name;
        if (this.conditionsOf(mover).includes("이탈")) { this.say({ type: "system", who: "", content: `${moverName}이(가) 이탈 중이라 ${fromName}에게서 기회 공격 없이 벗어납니다` }); return; }
        // R27 (D144): the reactor was never checked, so a prompt opened at creatures that cannot answer it — an
        // unconscious bandit, a caster with no melee weapon — and the only button was 안 함 while the card sat over
        // everyone's board. A creature that cannot act, has spent its reaction, or has no melee attack simply does
        // not get the chance, and the table is told why in one line.
        const stopped = cannotAct(this.conditionsOf(from));
        const hasMelee = from.entry.kind === "npc"
          ? from.entry.statBlock.actions.some((action) => action.kind === "attack" && action.attack && action.attack.mode !== "ranged")
          : true;
        if (stopped || !hasMelee || this.reactionUsed(command.from)) {
          this.say({ type: "system", who: "", content: `${moverName}이(가) ${fromName}에게서 벗어납니다 — ${stopped ? `${fromName}은(는) ${stopped} 상태` : !hasMelee ? `${fromName}에게 근접 공격이 없어` : `${fromName}은(는) 이번 라운드 반응을 이미 써서`} 기회 공격이 없습니다` });
          return;
        }
        this.say({ type: "prompt", who: player.displayName, playerId: userId, content: `${moverName}이(가) ${fromName}에게서 벗어납니다 — ${fromName}의 기회 공격?`, prompt: { kind: "opportunity", mover: { name: moverName, ...command.mover }, reactor: { name: fromName, ...command.from } } });
        return;
      }
      case "act.deathSave": {
        const promptMessage = this.chat.find((message) => message.id === command.messageId && message.type === "prompt");
        if (!promptMessage?.prompt || promptMessage.prompt.kind !== "death-save" || this.promptAnswered(command.messageId)) return refuse("그 죽음 내성은 더 이상 열려 있지 않습니다");
        const downed = this.resolveActor(promptMessage.prompt.reactor);
        if (!downed) return refuse("쓰러진 쪽을 찾을 수 없습니다");
        if (!isGm && !this.mayAct(userId, promptMessage.prompt.reactor, downed.entry)) return refuse("그 인물의 조종자만 죽음 내성을 굴립니다");
        if (!this.rollDeathSave(downed.entry.id, player.displayName)) return refuse("지금은 죽음 내성을 굴릴 상태가 아닙니다");
        this.say({ ...promptMessage, prompt: { ...promptMessage.prompt, outcome: { rolled: userId } }, supersedes: promptMessage.id, content: `${promptMessage.content} → ${player.displayName}이(가) 굴림` });
        return;
      }
      case "act.rescue": {
        // R35 (D174): the contract's own `roll.modify` runs here — the die it names is rerolled, the dice it adds
        // are rolled, and the whole target row is resolved again from the new total. The damage that the failed save
        // caused is taken back first, exactly as Legendary Resistance does it (R12).
        const promptMessage = this.chat.find((message) => message.id === command.messageId && message.type === "prompt");
        if (!promptMessage?.prompt || promptMessage.prompt.kind !== "rescue" || !promptMessage.prompt.rescue || this.promptAnswered(command.messageId)) return refuse("그 판정은 더 이상 다시 굴릴 수 없습니다");
        const reactor = this.resolveActor(promptMessage.prompt.reactor);
        if (!reactor || reactor.entry.kind !== "character") return refuse("다시 굴릴 인물을 찾을 수 없습니다");
        if (!isGm && !this.mayAct(userId, promptMessage.prompt.reactor, reactor.entry)) return refuse("그 인물의 조종자만 답할 수 있습니다");
        const cardId = promptMessage.prompt.rescue.cardId;
        // R37 (D177): the same command answers three kinds of card. An official action's is the simplest — the
        // marks it left come off, the action is resolved again from the new roll, and the new marks go on.
        const act = this.acts.get(cardId);
        if (act) {
          const isSave = act.command.kind === "grapple" || act.command.kind === "shove";
          const family: RollFamily = isSave ? "saving-throw" : "ability-check";
          const pick = (this.options.pcRescues?.(reactor.entry, family, "failure") ?? []).find((item) => item.feature === command.feature);
          if (!pick) return refuse("그 특성으로는 다시 굴릴 수 없습니다");
          const actActor = this.resolveActor(act.command.actor);
          if (!actActor) return refuse("행동한 쪽을 찾을 수 없습니다");
          const actTarget = act.command.target ? this.resolveActor(act.command.target) : null;
          const actorStats = this.statsOf(actActor);
          if (!actorStats) return refuse("능력치를 알 수 없습니다");
          const targetStats = actTarget ? this.statsOf(actTarget) : null;
          if (actTarget && !targetStats) return refuse("대상의 능력치를 알 수 없습니다");
          const dice = diceFrom(this.options.random ?? Math.random);
          const plan = planRollModify(pick.interceptor.operations, pick.scope, dice);
          if (plan.d20 === undefined && !plan.delta) return refuse("이 특성이 이 판정에 더할 것이 없습니다");
          // Take the old result off before rolling again, so a grapple that now fails leaves no 붙잡힘 behind.
          this.mark(actActor, act.result.actorMarks, false);
          if (actTarget) this.mark(actTarget, act.result.targetMarks, false);
          const redone = resolveAction({
            kind: act.command.kind, skill: act.command.skill, dc: act.command.dc, note: act.command.note, choice: act.command.choice, bonus: act.command.bonus,
            random: this.options.random ?? Math.random, forceD20: plan.d20, rollDelta: plan.delta, rescue: command.feature,
            actor: { name: actActor.token?.name ?? actActor.entry.name, stats: actorStats, conditions: this.conditionsOf(actActor) },
            target: actTarget && targetStats ? { name: actTarget.token?.name ?? actTarget.entry.name, stats: targetStats, conditions: this.conditionsOf(actTarget) } : undefined,
          });
          this.mark(actActor, redone.actorMarks, true);
          this.mark(actActor, redone.actorUnmarks, false);
          if (actTarget) this.mark(actTarget, redone.targetMarks, true, actActor.token?.id);
          const worked = redone.check?.success === true;
          // Read the sheet *after* the marks moved: paying from the runtime captured before the unmark would write
          // the 붙잡힘 straight back on.
          const owner = this.journalEntries.get(reactor.entry.id);
          const paidAct = owner?.kind === "character" ? this.options.pcPayContract?.(owner, pick.payments, worked ? "success" : "failure") : undefined;
          if (paidAct === null) return refuse("남은 횟수가 없습니다");
          if (paidAct && owner?.kind === "character") this.storeEntry({ ...owner, runtime: { ...paidAct, updatedAt: this.now() }, updatedAt: this.now() });
          this.acts.set(cardId, { ...act, result: redone });
          this.sayWithId(cardId, { type: "act", who: act.who, playerId: act.by, content: describeAct(redone), act: redone });
          this.say({ ...promptMessage, prompt: { ...promptMessage.prompt, outcome: { rolled: userId } }, supersedes: promptMessage.id, content: `${promptMessage.content} → ${command.feature}: ${plan.parts.join(", ")} → ${redone.check?.total}${redone.check?.dc === undefined ? "" : ` vs DC ${redone.check.dc}`} — ${worked ? "성공" : "여전히 실패"}` });
          return;
        }
        // R37 (D177): a missed attack. The palette's own re-resolve path (act.adjust) does exactly this already —
        // restore the card, resolve again, supersede — so the rescue borrows it and only supplies the new numbers.
        const attackRecord = this.actions.get(cardId);
        if (attackRecord) {
          const pick = (this.options.pcRescues?.(reactor.entry, "attack-roll", "failure") ?? []).find((item) => item.feature === command.feature);
          if (!pick) return refuse("그 특성으로는 다시 굴릴 수 없습니다");
          if (!sameActor(attackRecord.inputs.attacker, promptMessage.prompt.reactor)) return refuse("그 공격을 한 쪽만 다시 굴립니다");
          if (!this.resolveActor(attackRecord.inputs.attacker) || !this.resolveActor(attackRecord.inputs.targets[attackRecord.inputs.targetIndex])) return refuse("공격자나 대상이 더 없습니다 (카드는 그대로 둡니다)");
          const dice = diceFrom(this.options.random ?? Math.random);
          const plan = planRollModify(pick.interceptor.operations, pick.scope, dice);
          if (plan.d20 === undefined && !plan.delta) return refuse("이 특성이 이 판정에 더할 것이 없습니다");
          attackRecord.restore();
          this.actions.delete(cardId);
          const shooter = this.resolveActor(attackRecord.inputs.attacker);
          const victim = this.resolveActor(attackRecord.inputs.targets[attackRecord.inputs.targetIndex]);
          const ready = shooter ? this.prepareAttack(shooter, attackRecord.inputs.attack, attackRecord.inputs.riders ?? {}) : null;
          if (!shooter || !victim || !ready) return refuse("공격자나 대상이 더 없습니다");
          const overrides: AttackOverrides = { ...(attackRecord.resolution.overrides ?? {}), rollDelta: (attackRecord.resolution.overrides?.rollDelta ?? 0) + plan.delta, note: command.feature };
          // Like the palette's own edit, the re-resolved card is a new message that supersedes the old one.
          const newCardId = this.runAttack(attackRecord.inputs, shooter, victim, ready, overrides, { d20s: plan.d20 === undefined ? attackRecord.resolution.d20s : [plan.d20], bonusDice: attackRecord.resolution.bonusDice?.map((item) => item.total), ...(attackRecord.resolution.damage.length ? { damage: attackRecord.resolution.damage.map((item) => item.dice) } : {}) }, cardId);
          const landed = newCardId ? this.actions.get(newCardId)?.resolution.outcome : undefined;
          const hit = landed === "hit" || landed === "crit";
          const sheetNow = this.journalEntries.get(reactor.entry.id);
          const paidAttack = sheetNow?.kind === "character" ? this.options.pcPayContract?.(sheetNow, pick.payments, hit ? "success" : "failure") : undefined;
          if (paidAttack === null) return refuse("남은 횟수가 없습니다");
          if (paidAttack && sheetNow?.kind === "character") this.storeEntry({ ...sheetNow, runtime: { ...paidAttack, updatedAt: this.now() }, updatedAt: this.now() });
          this.say({ ...promptMessage, prompt: { ...promptMessage.prompt, outcome: { rolled: userId } }, supersedes: promptMessage.id, content: `${promptMessage.content} → ${command.feature}: ${plan.parts.join(", ")} — ${hit ? "적중" : "여전히 빗나감"}` });
          return;
        }
        const card = this.spells.get(cardId);
        if (!card || !card.resolution.applied || !card.rows || !card.context) return refuse("적용된 주문 카드가 아닙니다");
        const at = card.resolution.targets.findIndex((row) => row.target.id === reactor.entry.id && (!reactor.token || row.target.tokenId === reactor.token.id));
        const before = at >= 0 ? card.resolution.targets[at] : undefined;
        if (!before?.save || before.save.success || before.save.rescue) return refuse("다시 굴릴 내성이 없습니다");
        const offer = (this.options.pcRescues?.(reactor.entry, "saving-throw", "failure") ?? []).find((item) => item.feature === command.feature);
        if (!offer) return refuse("그 특성으로는 다시 굴릴 수 없습니다");
        const casterActor = this.resolveActor({ entryId: card.resolution.caster.id });
        const casterCombatant = casterActor ? this.combatantOf(casterActor) : null;
        if (!casterCombatant) return refuse("시전자를 찾을 수 없습니다");
        const dice = diceFrom(this.options.random ?? Math.random);
        const plan = planRollModify(offer.interceptor.operations, offer.scope, dice);
        if (plan.d20 === undefined && !plan.delta) return refuse("이 특성이 이 판정에 더할 것이 없습니다");
        card.rows[at]?.();
        const undone = this.resolveActor(promptMessage.prompt.reactor) ?? reactor;
        const combatant = this.combatantOf(undone);
        const stats = this.statsOf(undone);
        if (!combatant || !stats) return refuse("능력치를 알 수 없습니다");
        const again = resolveSpell({ caster: casterCombatant, casterStats: card.context.casterStats, spec: card.context.spec, targets: [{ combatant, stats }], dice, fixedDamage: before.damage?.damage.map((part) => part.dice), saveAdjust: { d20: plan.d20, delta: plan.delta, label: command.feature }, apply: true });
        const after = again.targets[0];
        const worked = Boolean(after.save?.success);
        // 전술적 사고 and 탁월한 기술 charge nothing for a rescue that did not work; the contract's `onlyOn` says so.
        const paid = this.options.pcPayContract?.(undone.entry as JournalCharacter, offer.payments, worked ? "success" : "failure");
        if (paid === null) return refuse("남은 횟수가 없습니다");
        if (paid) this.storeEntry({ ...(undone.entry as JournalCharacter), runtime: { ...paid, updatedAt: this.now() }, updatedAt: this.now() });
        const live = this.resolveActor(promptMessage.prompt.reactor) ?? undone;
        const who = live.token?.name ?? live.entry.name;
        const resolution: SpellResolution = { ...card.resolution, targets: card.resolution.targets.map((row, index) => (index === at ? after : row)), note: [card.resolution.note, `${who}: ${command.feature}`].filter(Boolean).join(" · ") };
        card.rows[at] = this.applySpellRow(after, live, resolution);
        const rows = card.rows;
        const restoreCaster = card.restoreCaster ?? (() => undefined);
        this.spells.set(cardId, { ...card, resolution, restore: () => { for (const restore of [...rows].reverse()) restore?.(); restoreCaster(); } });
        this.sayWithId(cardId, { type: "spell", who: card.context.who, playerId: card.context.playerId, content: describeSpell(resolution), spell: resolution });
        this.say({ ...promptMessage, prompt: { ...promptMessage.prompt, outcome: { rolled: userId } }, supersedes: promptMessage.id, content: `${promptMessage.content} → ${command.feature}: ${plan.parts.join(", ")} → ${after.save?.total} vs DC ${after.save?.dc} — ${worked ? "성공" : "여전히 실패"}` });
        return;
      }
      case "act.react": {
        // R29 (D155): out of turn a player had exactly three reactions and all three had to be offered to them.
        // Uncanny Dodge, Absorb Elements, Hellish Rebuke, Protection — none had a button, a prompt or a command.
        const actor = this.resolveActor(command.actor);
        if (!actor) return refuse("반응하는 쪽을 찾을 수 없습니다");
        if (!isGm && !this.mayAct(userId, command.actor, actor.entry)) return refuse("자기 캐릭터로만 반응할 수 있습니다");
        const stopped = cannotAct(this.conditionsOf(actor));
        if (stopped) return refuse(`${stopped} 상태라 반응할 수 없습니다`);
        if (this.reactionUsed(command.actor)) return refuse("이번 라운드의 반응을 이미 썼습니다");
        const name = String(command.name ?? "").trim().slice(0, LIMITS.name);
        if (!name) return refuse("무슨 반응인지 적으세요");
        const who = actor.token?.name ?? actor.entry.name;
        this.markReactionUsed(command.actor);
        if (command.formula) {
          const wrong = parseFormula(command.formula) ? null : "읽을 수 없는 주사위 식입니다";
          if (wrong) return refuse(wrong);
          const rolled = rollFormula({ label: `${who} · ${name}`, formula: command.formula }, this.options.random);
          this.say({ type: "rollresult", who: player.displayName, playerId: userId, content: `${who} · 반응: ${name}`, roll: { formula: command.formula, total: rolled.total, dice: rolled.dice.map((die) => ({ sides: die.sides, value: die.value })), modifier: rolled.modifier, label: `${who} · 반응: ${name}` } });
        } else {
          this.say({ type: "emote", who: player.displayName, playerId: userId, content: `${who}: 반응 — ${name}${command.note ? ` (${String(command.note).slice(0, LIMITS.name)})` : ""}` });
        }
        return;
      }
      /**
       * R54 (D189): the reactor takes a reaction their own contract declared. The held attack is resolved again with
       * the AC the reaction adds — the same dice, so only the AC moved — and whatever damage it takes off comes off
       * the card. The pool the contract names is spent, the reaction is marked used, and the prompt closes.
       */
      case "act.guard": {
        const promptMessage = this.chat.find((message) => message.id === command.messageId && message.type === "prompt");
        if (!promptMessage?.prompt || this.promptAnswered(command.messageId)) return refuse("그 프롬프트는 더 이상 열려 있지 않습니다");
        const reactor = this.resolveActor(promptMessage.prompt.reactor);
        if (!reactor || reactor.entry.kind !== "character") return refuse("반응자를 찾을 수 없습니다");
        if (!isGm && !this.mayAct(userId, promptMessage.prompt.reactor, reactor.entry)) return refuse("반응자의 조종자만 답할 수 있습니다");
        if (this.reactionUsed(promptMessage.prompt.reactor)) return refuse("이번 라운드의 반응을 이미 썼습니다");
        const trigger = (promptMessage.prompt.guard?.trigger as ReactionTrigger | undefined) ?? "attack.hit-self";
        const offer = (this.options.pcGuards?.(reactor.entry, trigger) ?? []).find((item) => item.feature === command.feature);
        if (!offer) return refuse("그 반응은 지금 쓸 수 없습니다");
        // R57 (D192): a number the contract gated on a fact only counts when the reactor confirmed it.
        const confirmed = new Set(command.facts ?? []);
        const acBonus = offer.acBonusFact && !confirmed.has(offer.acBonusFact) ? undefined : offer.acBonus;
        const reduceFormula = offer.reduceFact && !confirmed.has(offer.reduceFact) ? undefined : offer.reduce;
        if (offer.facts.length && !offer.facts.every((fact) => confirmed.has(fact.id)) && acBonus === undefined && !reduceFormula) return refuse("확인해야 할 조건이 남아 있습니다");
        const paid = this.options.pcPayContract?.(reactor.entry, offer.payments, "success");
        if (paid === null) return refuse("남은 횟수가 없습니다");
        if (paid) this.storeEntry({ ...reactor.entry, runtime: { ...paid, updatedAt: this.now() }, updatedAt: this.now() });
        this.markReactionUsed(promptMessage.prompt.reactor);
        const rolled = reduceFormula ? rollGuard(reduceFormula, this.options.random ?? Math.random) : 0;
        this.say({ ...promptMessage, prompt: { ...promptMessage.prompt, outcome: { rolled: userId } }, supersedes: promptMessage.id, content: `${promptMessage.content} → ${command.feature}${acBonus ? ` (AC +${acBonus})` : ""}${reduceFormula ? ` (피해 −${rolled})` : ""}` });
        this.releaseHeld(command.messageId, false, { acBonus, reduce: rolled, label: command.feature, ...(offer.halve ? { halve: true } : {}) });
        return;
      }
      /**
       * R63 (D198): the attacker takes what the hit window offered. The offers are asked for again rather than trusted,
       * the swing is resolved again with the same d20 and the same dice (new parts roll fresh, a reroll chosen now
       * happens once), and only what was chosen now is paid for — whatever was declared before the roll already was.
       */
      case "act.onhit": {
        const promptMessage = this.chat.find((message) => message.id === command.messageId && message.type === "prompt");
        const held = this.held.get(command.messageId);
        if (!promptMessage?.prompt || promptMessage.prompt.kind !== "on-hit" || !held || this.promptAnswered(command.messageId)) return refuse("그 창은 더 이상 열려 있지 않습니다");
        const attacker = this.resolveActor(held.inputs.attacker);
        const target = this.resolveActor(held.inputs.targets[held.inputs.targetIndex]);
        if (!attacker || attacker.entry.kind !== "character" || !target || held.inputs.attack.source !== "weapon") return refuse("공격자나 대상이 더 없습니다");
        if (!isGm && !this.mayAct(userId, held.inputs.attacker, attacker.entry)) return refuse("공격자의 조종자만 답할 수 있습니다");
        // R64 (D199): the window only ever offered the "ask" ones; the "always" ones ride along without a checkbox.
        const { ask, auto } = splitHitOffers(attacker.entry.runtime, this.hitOffersFor(attacker.entry, held.inputs.attack.attackId, held.inputs.riders ?? {}, target));
        const offered = new Map(ask.map((offer) => [offer.key, offer]));
        // R82 (D218): a smite spell counts only with a slot its offer listed, and only one on a hit.
        const spellSmite = command.spellSmite && offered.get(`spell:${command.spellSmite.spellId}`)?.slots?.some((slot) => slot.level === command.spellSmite!.slot) ? { spellId: String(command.spellSmite.spellId), slot: command.spellSmite.slot } : undefined;
        const picked = [...new Set(command.choices)].filter((key) => offered.has(key) && (!key.startsWith("spell:") || key === `spell:${spellSmite?.spellId}`));
        const confirmable = new Set(picked.flatMap((key) => (offered.get(key)!.facts ?? []).map((fact) => fact.id)));
        const facts = (command.facts ?? []).filter((id) => confirmable.has(id));
        const labels = picked.map((key) => `${offered.get(key)!.label}${key.startsWith("spell:") ? ` (${spellSmite!.slot}레벨 슬롯)` : ""}`);
        this.held.delete(command.messageId);
        this.say({ ...promptMessage, prompt: { ...promptMessage.prompt, outcome: picked.length ? { chosen: labels } : { declined: true } }, supersedes: promptMessage.id, content: `${promptMessage.content} → ${labels.length ? labels.join(", ") : "안 함"}` });
        this.takeHitChoices({ ...held, attacker, target }, { choices: picked, facts, spellSmite }, auto);
        return;
      }
      case "act.zone": {
        const caster = this.journalEntries.get(command.casterEntryId);
        // R103 (D238): a monster aura is a zone too — being inside only counts at the end of the monster's turn.
        const aura = command.spellId.startsWith("aura:") && caster?.kind === "npc" && monsterAuras(caster.statBlock).some((item) => `aura:${item.name}` === command.spellId);
        const exec = aura ? undefined : spellExec(command.spellId);
        const sustain = aura ? { economy: "none" as const } : exec ? sustainOf(exec) : null;
        if (!caster || caster.kind === "handout" || !sustain || (!aura && !(caster.runtime.effects ?? []).some((effect) => effect.key === `spell:${command.spellId}`))) return refuse("그 구역은 더 없습니다");
        const target = this.resolveActor(command.target);
        if (!target || target.entry.kind === "handout") return refuse("대상을 찾을 수 없습니다");
        if (!isGm && !this.mayAct(userId, command.target, target.entry) && !this.mayAct(userId, { entryId: caster.id }, caster)) return refuse("자기 크리처나 자기 주문 구역만 조작합니다");
        this.zoneAction(caster, command.spellId, sustain, target, command.action, command.feet);
        return;
      }
      case "act.trigger": {
        const promptMessage = this.chat.find((message) => message.id === command.messageId && message.type === "prompt");
        const trigger = promptMessage?.prompt?.kind === "trigger" ? promptMessage.prompt.trigger : undefined;
        if (!promptMessage?.prompt || !trigger || this.promptAnswered(command.messageId)) return refuse("그 창은 더 이상 열려 있지 않습니다");
        const entry = this.journalEntries.get(promptMessage.prompt.reactor.entryId ?? "");
        if (entry?.kind !== "character") return refuse("캐릭터를 찾을 수 없습니다");
        if (!isGm && !canEdit(entry, this.viewer(userId))) return refuse("그 캐릭터의 주인만 답할 수 있습니다");
        const offered = new Set(trigger.offers.map((offer) => offer.featureId));
        const choices = (Array.isArray(command.choices) ? command.choices : []).filter((choice) => offered.has(choice?.featureId)).slice(0, trigger.offers.length);
        const used = this.applyTriggers(entry.id, trigger.event, choices, trigger.offers);
        this.say({ ...promptMessage, prompt: { ...promptMessage.prompt, outcome: used.length ? { chosen: used } : { declined: true } }, supersedes: promptMessage.id, content: `${promptMessage.content} → ${used.length ? used.join(", ") : "안 함"}` });
        return;
      }
      case "act.decline": {
        const promptMessage = this.chat.find((message) => message.id === command.messageId && message.type === "prompt");
        if (!promptMessage?.prompt || this.promptAnswered(command.messageId)) return refuse("그 프롬프트는 더 이상 열려 있지 않습니다");
        const reactor = this.resolveActor(promptMessage.prompt.reactor);
        if (!reactor) return refuse("반응자를 찾을 수 없습니다");
        if (!isGm && !this.mayAct(userId, promptMessage.prompt.reactor, reactor.entry)) return refuse("반응자의 조종자만 답할 수 있습니다");
        this.say({ ...promptMessage, prompt: { ...promptMessage.prompt, outcome: { declined: true } }, supersedes: promptMessage.id, content: `${promptMessage.content} → 안 함` });
        if (this.held.has(command.messageId)) this.releaseHeld(command.messageId, false);
        if (this.heldCasts.has(command.messageId)) this.releaseCast(command.messageId, false);
        return;
      }
      case "act.adjust": {
        if (!isGm) return refuse("DM 팔레트는 GM만 씁니다");
        const record = this.actions.get(command.messageId);
        if (!record) return refuse("그 카드를 더 고칠 수 없습니다");
        // R26 (D137): this used to restore and drop the record *first* and only then look for the creatures. When
        // one of them was gone the palette refused — with the damage already reverted, the record discarded, the
        // card still reading "applied", and undo then refusing too. Nothing is touched until it can be re-resolved.
        if (!this.resolveActor(record.inputs.attacker) || !this.resolveActor(record.inputs.targets[record.inputs.targetIndex])) return refuse("공격자나 대상이 더 없습니다 (카드는 그대로 둡니다)");
        record.restore();
        this.actions.delete(command.messageId);
        // Resolve again *after* the restore: the creatures must be read as they are once this card is off them.
        const attackerEntry = this.resolveActor(record.inputs.attacker);
        const targetEntry = this.resolveActor(record.inputs.targets[record.inputs.targetIndex]);
        const prepared = attackerEntry ? this.prepareAttack(attackerEntry, record.inputs.attack, record.inputs.riders ?? {}) : null;
        if (!attackerEntry || !targetEntry || !prepared) return refuse("공격자나 대상이 더 없습니다");
        const overrides = { ...(record.resolution.overrides ?? {}), ...command.overrides };
        this.runAttack(record.inputs, attackerEntry, targetEntry, prepared, overrides, command.reroll ? undefined : { d20s: record.resolution.d20s, bonusDice: record.resolution.bonusDice?.map((item) => item.total), damage: record.resolution.damage.map((item) => item.dice) }, command.messageId);
        return;
      }
      case "act.undo": {
        if (!isGm) return refuse("되돌리기는 GM만 씁니다");
        if (!this.undoCard(command.messageId, player.displayName, userId)) return refuse("그 카드는 더 되돌릴 수 없습니다");
        return;
      }
      case "act.confirm": {
        if (!isGm) return refuse("적용은 GM만 합니다");
        const spellRecord = this.spells.get(command.messageId);
        if (spellRecord) {
          if (spellRecord.resolution.applied || !spellRecord.apply) return refuse("적용할 카드가 없습니다");
          spellRecord.apply();
          return;
        }
        const record = this.actions.get(command.messageId);
        if (!record || record.resolution.applied) return refuse("적용할 카드가 없습니다");
        const attackerEntry = this.resolveActor(record.inputs.attacker);
        const targetEntry = this.resolveActor(record.inputs.targets[record.inputs.targetIndex]);
        if (!attackerEntry || !targetEntry) return refuse("대상이 더 없습니다");
        this.actions.delete(command.messageId);
        this.applyResolution(record.resolution, targetEntry, attackerEntry, command.messageId, true);
        return;
      }
      default: return;
    }
  }

  /* ---------- attacks (§12.2) ---------- */

  /**
   * R25 (D128): the entry id, page and token of an `ActorRef` must describe one creature. They never used to be
   * cross-checked — the wire's `entryId` won outright while `mayAct` looked only at the token — so pairing your own
   * token with someone else's sheet id let you cast with their slots, drink their potions and drive a GM-only NPC.
   */
  private actorToken(ref: ActorRef, entryId?: string): { token?: Token; page?: Page; ok: boolean } {
    const page = ref.pageId ? this.pages.get(ref.pageId) : undefined;
    const token = page?.tokens.find((item) => item.id === ref.tokenId);
    if (!token) return { page, ok: true };
    if (!entryId) return { token, page, ok: true };
    // A token that represents nobody cannot stand in for a sheet: fall back to the sheet's own permissions.
    if (!token.represents) return { page, ok: true };
    return { token, page, ok: token.represents === entryId };
  }

  private resolveActor(ref: ActorRef): { entry: JournalEntry; token?: Token; page?: Page } | null {
    const page = ref.pageId ? this.pages.get(ref.pageId) : undefined;
    const onPage = page?.tokens.find((item) => item.id === ref.tokenId);
    const entryId = ref.entryId ?? onPage?.represents;
    const entry = entryId ? this.journalEntries.get(entryId) : undefined;
    if (!entry || entry.kind === "handout") return null;
    const { token, ok } = this.actorToken(ref, entry.id);
    if (!ok) return null;
    return { entry, token, page };
  }

  private mayAct(userId: string, ref: ActorRef, entry: JournalEntry) {
    const viewer = this.viewer(userId);
    const { token, ok } = this.actorToken(ref, entry.id);
    if (!ok) return false;
    return token ? controlsToken(token, viewer, this.journal) : canEdit(entry, viewer);
  }

  private combatantOf(actor: { entry: JournalEntry; token?: Token }): Combatant | null {
    if (actor.entry.kind === "npc") return { ...npcCombatant(actor.entry, actor.token), tokenId: actor.token?.id, grappledBy: actor.token?.markers.find((marker) => marker.name === "붙잡힘")?.from, vexedBy: actor.token?.markers.find((marker) => marker.name === "교란")?.from };
    if (actor.entry.kind === "character" && this.options.pcCombatant) { const base = this.options.pcCombatant(actor.entry); return { ...base, name: actor.token?.name ?? actor.entry.name, conditions: [...new Set([...base.conditions, ...(actor.token?.markers.map((marker) => marker.name) ?? [])])], tokenId: actor.token?.id, grappledBy: actor.token?.markers.find((marker) => marker.name === "붙잡힘")?.from, vexedBy: actor.token?.markers.find((marker) => marker.name === "교란")?.from }; }
    return null;
  }

  private prepareAttack(actor: { entry: JournalEntry; token?: Token }, ref: AttackRef, riders: AttackRiders): { spec: AttackSpec; spend?: (runtime: CharacterRuntime) => CharacterRuntime } | null {
    if (ref.source === "npc" && actor.entry.kind === "npc") { const spec = npcAttackSpec(actor.entry, ref.actionName); return spec ? { spec } : null; }
    if (ref.source === "weapon" && actor.entry.kind === "character" && this.options.pcAttackSpec) return this.options.pcAttackSpec(actor.entry, ref.attackId, riders);
    return null;
  }

  /**
   * Damage that depends on who was hit, added per target: a spec's creature-type parts (H5b: 신성한 강타 against a Fiend), and
   * R90 (D225) 사냥꾼의 표식 and 주술, whose dice land only when their caster hits the creature they marked.
   */
  private perTargetRiders(spec: AttackSpec, attacker: { entry: JournalEntry }, target: { entry: JournalEntry }, targetCombatant: Combatant, attackerCombatant?: Combatant): AttackSpec {
    const versus = target.entry.kind === "npc" ? versusParts(spec, target.entry.statBlock.creatureType) : [];
    const mine = (targetCombatant.markedBy ?? []).filter((mark) => mark.from === attacker.entry.id);
    // H2 (D239): the attacker's sheet may change the mark's die (적 학살자) or give advantage against it (정밀한 사냥꾼), per marking spell.
    const marks = mine.map((mark): DamagePart => { const die = attackerCombatant?.markedSpellDice?.[mark.spellId]; return { formula: die ? mark.formula.replace(/d[0-9]+/, `d${die}`) : mark.formula, type: mark.type, label: mark.label }; });
    const precise = mine.filter((mark) => attackerCombatant?.markedSpellAdvantage?.includes(mark.spellId)).map((mark) => `${mark.label} 대상`);
    // R99 (D234): 연구된 공격 — the attack after a miss against this creature has advantage.
    if (attackerCombatant?.studiedAttacks && this.studied.get(attacker.entry.id) === target.entry.id) precise.push("연구된 공격");
    return versus.length || marks.length || precise.length ? { ...spec, riders: [...(spec.riders ?? []), ...versus, ...marks], ...(precise.length ? { advantageOn: [...(spec.advantageOn ?? []), ...precise] } : {}) } : spec;
  }

  /**
   * R91 (D226): the sheet's on-hit offers, less the once-per-turn ones this creature already took this turn — 암습 on
   * the rogue's own turn, and again on someone else's turn (an opportunity attack), but never twice in one. With no
   * tracker running there is no turn to count, so nothing is held back. ponytail: in memory, a host restart forgets.
   */
  private hitOffersFor(entry: JournalCharacter, attackId: string, riders: AttackRiders, target: { entry: JournalEntry; token?: Token }): HitOffer[] {
    const used = this.turnUses.get(entry.id);
    const spent = used && used.mark === this.turnMark() ? used.keys : [];
    // H2 (D239): a fact the table computes (`auto`) is never asked — the offer drops when it is false, and shows
    // without the checkbox when it is true (거상 학살자 only against a wounded creature).
    return (this.options.pcHitOffers?.(entry, attackId, riders) ?? [])
      .filter((offer) => !(offer.oncePerTurn && spent.includes(offer.key)))
      .filter((offer) => (offer.facts ?? []).every((fact) => !fact.auto || this.targetFact(fact.auto, target)))
      .map((offer) => { const facts = offer.facts?.filter((fact) => !fact.auto); return facts?.length === offer.facts?.length ? offer : { ...offer, facts: facts?.length ? facts : undefined }; });
  }

  /** H2 (D239): the facts about a target the table computes, by their scope name. An unknown name is never true. */
  private targetFact(ref: string, actor: { entry: JournalEntry; token?: Token }): boolean {
    const combatant = this.combatantOf(actor);
    if (!combatant) return false;
    if (ref === "target.hp.below-max") return combatant.hp.current < combatant.hp.max;
    return false;
  }

  private turnMark() { return this.tracker.turns.length ? `${this.tracker.round}:${this.tracker.current}` : undefined; }

  /** R91 (D226): remember what this creature took this turn. */
  private useThisTurn(entryId: string, keys: string[]) {
    const mark = this.turnMark();
    if (!mark) return;
    const used = this.turnUses.get(entryId);
    this.turnUses.set(entryId, { mark, keys: [...(used?.mark === mark ? used.keys : []), ...keys] });
  }

  /** R90 (D225): take off the effects that end once used — 유도 화살 by the attack against it, 잔혹한 조롱 by the attack it hindered. */
  private consumeOnUse(entryId: string, on: "attack" | "attacked") {
    const live = this.journalEntries.get(entryId);
    if (!live || live.kind === "handout") return;
    const keys = [...(bearerRolls(live.runtime.effects, false).consumable ?? []).filter((item) => item.on === on).map((item) => item.key), ...(live.runtime.effects ?? []).filter((effect) => effect.consumeOn === on).map((effect) => effect.key)];
    if (keys.length) this.shedEffects(live, (live.runtime.effects ?? []).filter((effect) => keys.includes(effect.key)), "사용함");
  }

  private runAttack(inputs: { attacker: ActorRef; targets: ActorRef[]; attack: AttackRef; riders?: AttackRiders; by: string; targetIndex: number }, attacker: { entry: JournalEntry; token?: Token; page?: Page }, target: { entry: JournalEntry; token?: Token; page?: Page }, prepared: { spec: AttackSpec; spend?: (runtime: CharacterRuntime) => CharacterRuntime }, overrides?: AttackOverrides, fixed?: { d20s: number[]; damage?: number[][]; bonusDice?: number[] }, supersedes?: string, spend?: (runtime: CharacterRuntime) => CharacterRuntime): string | undefined {
    const attackerCombatant = this.combatantOf(attacker);
    const targetCombatant = this.combatantOf(target);
    if (!attackerCombatant || !targetCombatant) return undefined;
    // R15: Divine Smite's +1d8 against a Fiend or an Undead depends on who was hit, so it is added here, per target.
    prepared = { ...prepared, spec: this.perTargetRiders(prepared.spec, attacker, target, targetCombatant, attackerCombatant) };
    // D95: a scene (Theatre of the Mind) tracks no positions, so range never decides; the DM adjusts by hand.
    const waits = Boolean(this.campaign.settings.dmConfirmsResults) && this.roleOf(inputs.by) !== "gm";
    const resolution: AttackResolution = { ...resolveAttack(attackerCombatant, targetCombatant, prepared.spec, { dice: diceFrom(this.options.random ?? Math.random), overrides, fixed, apply: !waits }), attackRef: inputs.attack, attackerRef: inputs.attacker };
    // Riders with a cost (a smite slot) are paid once per attack, by the first target's card.
    if (spend && attacker.entry.kind === "character") { const before = attacker.entry; this.storeEntry({ ...before, runtime: spend(before.runtime), updatedAt: this.now() }); }
    const player = this.campaign.players.find((item) => item.userId === inputs.by);
    // R11: a hit on a caster who can still cast Shield is held until they answer (their reaction, +5 AC, maybe a miss).
    const targetRef = inputs.targets[inputs.targetIndex];
    // R54 (D189): the same window now carries whatever the target's own contracts declared for "an attack hit me",
    // so 공격 비껴내기 and the Shield spell are one question rather than one question and a house rule.
    // H6b (D249): the first reaction spell for "an attack hit me" the target can cast, from the spell data.
    const targetCharacter = target.entry.kind === "character" ? target.entry : undefined;
    const shieldSpell = targetCharacter && !waits && resolution.outcome === "hit" && !fixed && !this.reactionUsed(targetRef) ? reactionSpellIds("attack.hit-self").find((spellId) => Boolean(this.options.pcReactionSpell?.(targetCharacter, spellId))) : undefined;
    const canShield = Boolean(shieldSpell);
    const guards = !waits && resolution.outcome === "hit" && target.entry.kind === "character" && !fixed && !this.reactionUsed(targetRef)
      ? (this.options.pcGuards?.(target.entry, "attack.hit-self") ?? []).filter((guard) => !guard.damageTypes?.length || prepared.spec.damage.some((part) => guard.damageTypes!.map(damageTypeKey).includes(damageTypeKey(part.type)))) : [];
    // R57 (D192): if the creature that was hit has nothing to answer with, a bystander whose contract declares
    // `attack.hit-ally` is asked instead. The target is always asked first — it is their skin — and only one window
    // opens per swing, because the card is held once and a second holder would fight the first over it.
    const bystander = !waits && resolution.outcome === "hit" && !fixed && !canShield && !guards.length ? this.bystanderGuard(target) : undefined;
    if (canShield || guards.length || bystander) {
      const promptId = newMessageId();
      const attackerName = attacker.token?.name ?? attacker.entry.name;
      const targetName = target.token?.name ?? target.entry.name;
      this.held.set(promptId, { inputs, attacker, target, spec: prepared.spec, overrides, resolution, supersedes, stage: "reaction" });
      const offers = bystander ? bystander.offers : guards;
      const reactorRef = bystander ? this.refOf(bystander.actor) : targetRef;
      const reactorName = bystander ? bystander.actor.token?.name ?? bystander.actor.entry.name : targetName;
      const offered = [...(shieldSpell ? [this.prepareSpell(target, shieldSpell)?.spec.name ?? shieldSpell] : []), ...offers.map((guard) => guard.feature)];
      this.sayWithId(promptId, { type: "prompt", who: player?.displayName ?? "", playerId: inputs.by, content: `${attackerName}의 ${prepared.spec.name}이(가) ${targetName}에게 적중 (${resolution.attackTotal} vs AC ${resolution.targetAc}) — ${bystander ? `${reactorName}의 ` : ""}${offered.join(" / ")} 반응?`, prompt: { kind: canShield ? "shield" : "guard", mover: { name: attackerName, ...inputs.attacker }, reactor: { name: reactorName, ...reactorRef }, attack: { name: prepared.spec.name, total: resolution.attackTotal, ac: resolution.targetAc }, ...(shieldSpell ? { spellId: shieldSpell } : {}), ...(offers.length ? { guard: { features: offers.map((guard) => ({ name: guard.feature, hint: guardHint(guard), ...(guard.facts.length ? { facts: guard.facts } : {}) })), shield: canShield, trigger: bystander ? "attack.hit-ally" : "attack.hit-self" } } : {}) } });
      return promptId;
    }
    // R63 (D198): a palette edit or a rescue re-resolves a card the attacker already answered, so it never asks again.
    return this.afterReactions({ inputs, attacker, target, spec: prepared.spec, overrides, resolution, supersedes, waits }, !fixed);
  }

  /**
   * R63 (D198): the target has had its say. If the swing still landed and the attacker has something to add after a
   * hit (암습, 신성한 강타, an on-hit contract), the card is held and the attacker asked — with the hit and a critical
   * already known, which is when 2024 has them decide. Otherwise the card is posted.
   */
  private afterReactions(held: { inputs: { attacker: ActorRef; targets: ActorRef[]; attack: AttackRef; riders?: AttackRiders; by: string; targetIndex: number }; attacker: { entry: JournalEntry; token?: Token; page?: Page }; target: { entry: JournalEntry; token?: Token; page?: Page }; spec: AttackSpec; overrides?: AttackOverrides; resolution: AttackResolution; supersedes?: string; waits?: boolean }, allowOnHit: boolean): string {
    const { inputs, attacker, target, resolution } = held;
    const landed = resolution.outcome === "hit" || resolution.outcome === "crit";
    if (allowOnHit && landed && attacker.entry.kind === "character" && inputs.attack.source === "weapon" && this.options.pcHitOffers) {
      // R64 (D199): what the player set to "always" is taken without a window; "never" is not offered at all.
      const { ask: offers, auto } = splitHitOffers(attacker.entry.runtime, this.hitOffersFor(attacker.entry, inputs.attack.attackId, inputs.riders ?? {}, target));
      if (!offers.length && auto.length) return this.takeHitChoices(held, { choices: [] }, auto);
      if (offers.length) {
        const promptId = newMessageId();
        this.held.set(promptId, { ...held, stage: "on-hit" });
        const player = this.campaign.players.find((item) => item.userId === inputs.by);
        const attackerName = attacker.token?.name ?? attacker.entry.name;
        const targetName = target.token?.name ?? target.entry.name;
        const crit = resolution.outcome === "crit";
        this.sayWithId(promptId, { type: "prompt", who: player?.displayName ?? "", playerId: inputs.by, content: `${attackerName}의 ${held.spec.name}이(가) ${targetName}에게 ${crit ? "치명타" : "명중"} — ${offers.map((offer) => offer.label).join(" / ")}?`, prompt: { kind: "on-hit", mover: { name: targetName, ...inputs.targets[inputs.targetIndex] }, reactor: { name: attackerName, ...inputs.attacker }, attack: { name: held.spec.name, total: resolution.attackTotal, ac: resolution.targetAc }, onHit: { outcome: crit ? "crit" : "hit", offers, ...(auto.length ? { auto: auto.map((offer) => offer.label) } : {}) } } });
        return promptId;
      }
    }
    return this.finishAttack(held);
  }

  /**
   * R63 (D198), R64 (D199): the held swing with what the attacker chose, plus what their sheet takes without asking,
   * resolved again on the same d20 and the same dice (new parts roll fresh, a reroll chosen now happens once). Only
   * these choices are paid for now; whatever was declared before the roll already was.
   */
  private takeHitChoices(held: { inputs: { attacker: ActorRef; targets: ActorRef[]; attack: AttackRef; riders?: AttackRiders; by: string; targetIndex: number }; attacker: { entry: JournalEntry; token?: Token; page?: Page }; target: { entry: JournalEntry; token?: Token; page?: Page }; spec: AttackSpec; overrides?: AttackOverrides; resolution: AttackResolution; supersedes?: string; waits?: boolean }, answer: { choices: string[]; facts?: string[]; spellSmite?: { spellId: string; slot: number } }, auto: HitOffer[]): string {
    const all = { choices: [...answer.choices, ...auto.map((offer) => offer.key)], facts: [...(answer.facts ?? []), ...auto.flatMap((offer) => (offer.facts ?? []).map((fact) => fact.id))], spellSmite: answer.spellSmite };
    if (!all.choices.length) return this.finishAttack(held);
    this.useThisTurn(held.attacker.entry.id, all.choices);
    // H2 (D239): the computed facts of what was chosen count as confirmed.
    if (held.attacker.entry.kind === "character" && held.inputs.attack.source === "weapon") {
      for (const offer of this.options.pcHitOffers?.(held.attacker.entry, held.inputs.attack.attackId, held.inputs.riders ?? {}) ?? []) {
        if (!all.choices.includes(offer.key)) continue;
        for (const fact of offer.facts ?? []) if (fact.auto && this.targetFact(fact.auto, held.target)) all.facts.push(fact.id);
      }
    }
    const attacker = this.resolveActor(held.inputs.attacker) ?? held.attacker;
    const target = this.resolveActor(held.inputs.targets[held.inputs.targetIndex]) ?? held.target;
    const riders = withHitChoices(held.inputs.riders ?? {}, all);
    let prepared = this.prepareAttack(attacker, held.inputs.attack, riders);
    const fresh = this.prepareAttack(attacker, held.inputs.attack, withHitChoices({ cleave: riders.cleave, offHand: riders.offHand }, all));
    const attackerCombatant = this.combatantOf(attacker);
    const targetCombatant = this.combatantOf(target);
    if (!prepared || !attackerCombatant || !targetCombatant) return this.finishAttack({ ...held, attacker, target });
    prepared = { ...prepared, spec: this.perTargetRiders(prepared.spec, attacker, target, targetCombatant, attackerCombatant) };
    // A reaction that raised the AC (방패, 공격 흘리기) already had its say; keep the AC the card was decided against.
    const decidedAc = held.resolution.targetAc - held.resolution.cover;
    if (targetCombatant.ac < decidedAc) targetCombatant.ac = decidedAc;
    const crit = held.resolution.outcome === "crit";
    const parts = [...prepared.spec.damage, ...(prepared.spec.riders ?? []), ...(crit ? prepared.spec.critRiders ?? [] : [])];
    const resolution = resolveAttack(attackerCombatant, targetCombatant, prepared.spec, { dice: diceFrom(this.options.random ?? Math.random), overrides: held.overrides, fixed: { d20s: held.resolution.d20s, bonusDice: held.resolution.bonusDice?.map((item) => item.total), damage: carryDice(held.resolution.damage, parts), ...(held.resolution.mastery?.save ? { masteryD20: held.resolution.mastery.save.d20 } : {}) }, apply: !held.waits, rerollOnce: true });
    if (fresh?.spend && attacker.entry.kind === "character") { const before = attacker.entry; this.storeEntry({ ...before, runtime: fresh.spend(before.runtime), updatedAt: this.now() }); }
    // R82 (D218): a smite spell is cast as a bonus action.
    if (riders.spellSmite) this.markUsed(held.inputs.attacker, "bonus");
    const card = this.finishAttack({ ...held, inputs: { ...held.inputs, riders }, attacker: this.resolveActor(held.inputs.attacker) ?? attacker, target, resolution });
    // R94 (D229): a rider that forces a save (기절 타격) posts it as its own card, undone with the swing.
    for (const rule of prepared.spec.hitSaves ?? []) {
      const save = this.riderSave(attacker, target, rule, Boolean(held.waits), held.inputs.by);
      if (save) this.childOf(() => { if (this.spells.has(save)) this.undoCard(save, "", held.inputs.by); }, card);
    }
    if (riders.spellSmite && attacker.entry.kind === "character") {
      const save = this.smiteSave(attacker, target, riders.spellSmite, Boolean(held.waits), held.inputs.by);
      // R86 (D221): undoing the swing takes the smite save card back with it.
      if (save) this.childOf(() => { if (this.spells.has(save)) this.undoCard(save, "", held.inputs.by); }, card);
    }
    return card;
  }

  /**
   * R82 (D218): the save a smite spell asks of the creature it hit (분노의 강타's 지혜, 휘감는 일격's 근력), rolled against
   * the caster's spell DC and posted as its own card — the same card, conditions, effects and undo a cast save gets.
   */
  /** R94 (D229): the save a feature rider forces, as a card: the condition lands on a failure until the start of the attacker's next turn. */
  private riderSave(attacker: { entry: JournalEntry; token?: Token; page?: Page }, target: { entry: JournalEntry; token?: Token; page?: Page }, rule: { label: string; ability: string; dc: number; condition: string }, waits: boolean, by: string) {
    const live = this.resolveActor(this.refOf(target)) ?? target;
    const combatant = this.combatantOf(live);
    const stats = this.statsOf(live);
    const caster = this.combatantOf(this.resolveActor(this.refOf(attacker)) ?? attacker);
    if (!combatant || !stats || !caster) return;
    const duration = { kind: "rounds" as const, amount: 1, anchorActorId: "$source", boundary: "start" as const };
    const exec: SpellExec = { spellId: `feature:${rule.label}`, baseLevel: 0, castingEconomy: "action", targeting: { kind: "creature", minTargets: 1, maxTargets: 1 }, primary: { kind: "save-effect", saveAbility: rule.ability, duration }, effects: [{ conditionId: rule.condition, trigger: "failed-save", duration }] };
    const spec = { spellId: exec.spellId, name: rule.label, level: 0, exec };
    const casterStats = { attackBonus: 0, saveDc: rule.dc, modifier: 0, level: 1 };
    const resolution = resolveSpell({ caster, casterStats, spec, targets: [{ combatant, stats }], dice: diceFrom(this.options.random ?? Math.random), apply: !waits });
    const player = this.campaign.players.find((item) => item.userId === by);
    return this.postSpell(resolution, [live], () => undefined, waits, player?.displayName ?? "", by, { spec, casterStats });
  }

  private smiteSave(attacker: { entry: JournalEntry; token?: Token; page?: Page }, target: { entry: JournalEntry; token?: Token; page?: Page }, smite: { spellId: string; slot: number }, waits: boolean, by: string) {
    const rule = onHitOf(spellExec(smite.spellId))?.save;
    if (!rule || attacker.entry.kind !== "character") return;
    const cast = this.options.pcSpell?.(attacker.entry, smite.spellId, { kind: "slot", level: smite.slot });
    const live = this.resolveActor(this.refOf(target)) ?? target;
    const combatant = this.combatantOf(live);
    const stats = this.statsOf(live);
    const caster = this.combatantOf(this.resolveActor(this.refOf(attacker)) ?? attacker);
    if (!cast || !combatant || !stats || !caster) return;
    const base = cast.spec.exec;
    const above = Math.max(0, smite.slot - base.baseLevel);
    const primary: SpellExec["primary"] = rule.damage
      ? { kind: "save-damage", saveAbility: rule.ability, damageType: rule.damage.type, dice: { count: rule.damage.count + (rule.damage.perSlot ?? 0) * above, sides: rule.damage.sides }, successDamage: rule.successDamage ?? "half" }
      : { kind: "save-effect", saveAbility: rule.ability, ...(rule.note ? { summary: rule.note } : {}), ...(base.concentration ? { duration: { kind: "concentration" as const } } : {}) };
    const exec: SpellExec = { ...base, primary, effects: (rule.conditions ?? []).map((conditionId) => ({ conditionId, trigger: "failed-save" as const, ...(base.concentration ? { duration: { kind: "concentration" as const } } : {}) })), trackedEffects: undefined, concentration: false, repeat: { economy: "none" } };
    const spec = { ...cast.spec, exec };
    const resolution = resolveSpell({ caster, casterStats: cast.casterStats, spec, targets: [{ combatant, stats }], dice: diceFrom(this.options.random ?? Math.random), apply: !waits });
    const player = this.campaign.players.find((item) => item.userId === by);
    return this.postSpell(resolution, [live], () => undefined, waits, player?.displayName ?? "", by, { spec, casterStats: cast.casterStats });
  }

  /**
   * R86 (D221): take a card back — its own changes (D136) and, newest first, everything that happened automatically
   * because of it: effects a lost concentration shed, the save card a smite spell posted.
   */
  private undoCard(messageId: string, displayName: string, userId: string): boolean {
    const spellRecord = this.spells.get(messageId);
    const record = spellRecord ? undefined : this.actions.get(messageId);
    if (!spellRecord && !record) return false;
    const children = this.childUndos.get(messageId) ?? [];
    this.childUndos.delete(messageId);
    for (const undo of [...children].reverse()) undo();
    if (spellRecord) {
      spellRecord.restore();
      this.spells.delete(messageId);
      this.say({ type: "spell", who: displayName, playerId: userId, content: `되돌림: ${describeSpell(spellRecord.resolution)}`, spell: { ...spellRecord.resolution, applied: false }, supersedes: messageId, undone: true });
    } else if (record) {
      record.restore();
      this.actions.delete(messageId);
      this.say({ type: "action", who: displayName, playerId: userId, content: `되돌림: ${describeResolution(record.resolution)}`, action: { ...record.resolution, applied: false }, supersedes: messageId, undone: true });
    }
    return true;
  }

  /** R86 (D221): remember how to take back an automatic consequence of the card being applied now. */
  private childOf(undo: () => void, card = this.causeCard) {
    if (!card) return;
    this.childUndos.set(card, [...(this.childUndos.get(card) ?? []), undo]);
  }

  /** R86 (D221): run `work` as the application of `card`, so what it sets off is filed under that card. */
  private asCause<T>(card: string, work: () => T): T {
    const previous = this.causeCard;
    this.causeCard = card;
    try { return work(); } finally { this.causeCard = previous; }
  }

  /** The card, applied now or (D90) waiting for the DM. */
  private finishAttack(held: { inputs: { attacker: ActorRef; targets: ActorRef[]; attack: AttackRef; riders?: AttackRiders; by: string; targetIndex: number }; attacker: { entry: JournalEntry; token?: Token; page?: Page }; target: { entry: JournalEntry; token?: Token; page?: Page }; resolution: AttackResolution; supersedes?: string; waits?: boolean }): string {
    const { inputs, attacker, target, resolution, supersedes } = held;
    const player = this.campaign.players.find((item) => item.userId === inputs.by);
    const messageId = newMessageId();
    if (held.waits) {
      this.actions.set(messageId, { inputs, resolution, restore: () => undefined });
      this.sayWithId(messageId, { type: "action", who: player?.displayName ?? "", playerId: inputs.by, content: `${describeResolution(resolution)} (DM 확인 대기)`, action: resolution, supersedes });
      return messageId;
    }
    this.applyResolution(resolution, target, attacker, messageId, false, inputs, supersedes, player?.displayName);
    return messageId;
  }

  /** A prompt is answered once a later message supersedes it. */
  private promptAnswered(promptId: string) { return this.chat.some((message) => message.supersedes === promptId); }

  private turnOf(ref: ActorRef) { return this.tracker.turns.find((turn) => (ref.tokenId ? turn.tokenId === ref.tokenId && turn.pageId === ref.pageId : Boolean(ref.entryId) && turn.entryId === ref.entryId)); }
  private needsDeathSave(entry: JournalCharacter) {
    const runtime = entry.runtime;
    return runtime.hp.current <= 0 && runtime.deathSaves.success < 3 && runtime.deathSaves.failure < 3;
  }

  /** Who the death-save card is addressed to: a connected player who controls the character, else nobody (the host rolls). */
  private deathSaveOwner(entry: JournalCharacter, ref: ActorRef) {
    return this.campaign.players.find((player) => player.role !== "gm" && !player.kicked && this.connected.has(player.userId) && this.mayAct(player.userId, ref, entry))?.userId ?? null;
  }

  /** R29 (D154): the host rolls the d20 — the player owns the moment, not the dice. */
  private rollDeathSave(entryId: string, who: string) {
    const entry = this.journalEntries.get(entryId);
    if (entry?.kind !== "character" || !this.needsDeathSave(entry)) return false;
    const runtime = entry.runtime;
    // V3c (D257): a contract may give advantage on death saves (생존자, 튼튼함): two dice, the better kept.
    const lucky = this.options.pcStats ? advantageFor(this.options.pcStats(entry), "death-save") : undefined;
    const rolls = Array.from({ length: lucky ? 2 : 1 }, () => 1 + Math.floor((this.options.random ?? Math.random)() * 20));
    const die = Math.max(...rolls);
    let next = runtime;
    let note: string;
    // R28 (D149): "깨어남" now takes 무의식 off too — it used to stay on, handing every attacker advantage and
    // turning every melee hit into a critical against a character who had just stood up.
    if (die === 20) { next = wakeUp({ ...runtime, hp: { ...runtime.hp, current: 1 } }); note = "20! HP 1로 깨어남"; }
    else if (die === 1) { next = recordDeathSave(recordDeathSave(runtime, false), false); note = "1! 실패 2회"; }
    else { next = recordDeathSave(runtime, die >= 10); note = die >= 10 ? "성공" : "실패"; }
    this.say({ type: "rollresult", who, content: `${entry.name} · 죽음 내성 (${note})`, roll: { formula: "1d20", total: die, dice: [{ sides: 20, value: die }], modifier: 0, label: `${entry.name} · 죽음 내성 — ${note} (${next.deathSaves.success}/${next.deathSaves.failure})` } });
    this.storeEntry({ ...entry, runtime: { ...next, updatedAt: this.now() }, updatedAt: this.now() });
    return true;
  }

  private reactionUsed(ref: ActorRef) { return Boolean(this.turnOf(ref)?.reactionUsed); }
  private markReactionUsed(ref: ActorRef) {
    const turn = this.turnOf(ref);
    if (!turn) return;
    this.setTracker({ ...this.tracker, turns: this.tracker.turns.map((item) => (item.id === turn.id ? { ...item, reactionUsed: true } : item)) });
  }
  /** Action economy (D97): noted on the current turn's row only, never enforced. */
  /**
   * R28 (D151): 2024 Rage. At the end of the barbarian's turn the rage keeps going only if, since their last turn,
   * they attacked, forced a saving throw, or took damage; otherwise it ends there (pressing 격노 again — a bonus
   * action — is the extension). Being Incapacitated ends it immediately. Nothing evaluated the rule before: the
   * activation carried it as a sentence of prose and the effect simply ran its hundred rounds.
   */
  private refOf(actor: { entry: JournalEntry; token?: Token; page?: Page }): ActorRef { return { entryId: actor.entry.id, pageId: actor.page?.id, tokenId: actor.token?.id }; }

  /** R58 (D193): temporary hit points do not stack — the larger pool wins, as 2024 says. */
  private grantTempHp(target: { entry: JournalEntry; token?: Token; page?: Page }, amount: number) {
    const entry = target.entry;
    if (entry.kind === "handout" || amount <= 0 || entry.runtime.hp.temp >= amount) return;
    if (entry.kind === "character") this.storeEntry({ ...entry, runtime: { ...entry.runtime, hp: { ...entry.runtime.hp, temp: amount }, updatedAt: this.now() }, updatedAt: this.now() });
    else this.storeEntry({ ...entry, runtime: { ...entry.runtime, hp: { ...entry.runtime.hp, temp: amount }, updatedAt: this.now() }, updatedAt: this.now() });
  }

  /** R58 (D193): healing, capped at the maximum the sheet or the stat block carries. */
  private healActor(target: { entry: JournalEntry; token?: Token; page?: Page }, amount: number) {
    const entry = target.entry;
    if (entry.kind === "handout" || amount <= 0) return;
    if (entry.kind === "character") {
      const hp = entry.runtime.hp;
      this.storeEntry({ ...entry, runtime: { ...entry.runtime, hp: { ...hp, current: Math.min(hp.maxSeen, hp.current + amount) }, updatedAt: this.now() }, updatedAt: this.now() });
    } else {
      const hp = entry.runtime.hp;
      this.storeEntry({ ...entry, runtime: { ...entry.runtime, hp: { ...hp, current: Math.min(hp.max, hp.current + amount) }, updatedAt: this.now() }, updatedAt: this.now() });
    }
  }

  /**
   * R58 (D193): an item the use put in somebody's bag (요리사's snack, 독 제조자's dose). The host owns no catalog,
   * so an id it cannot name is carried as a line rather than dropped — the name is the app's only claim here.
   */
  private grantContent(target: { entry: JournalEntry; token?: Token; page?: Page }, contentId: string, label: string) {
    const name = this.options.contentName?.(contentId) ?? contentId;
    if (target.entry.kind !== "character") return `${name} (표에서 처리)`;
    const runtime = target.entry.runtime;
    const extra = [...runtime.inventory.extra, { instanceId: `${contentId}:${this.now()}:${runtime.inventory.extra.length}`, itemId: contentId, name, quantity: 1 }];
    this.storeEntry({ ...target.entry, runtime: { ...runtime, inventory: { ...runtime.inventory, extra }, updatedAt: this.now() }, updatedAt: this.now() });
    void label;
    return name;
  }

  /**
   * R30 (D156/D157): let this much time pass for one creature's timed effects — a character's sheet through
   * `advanceRound` (which keeps its log), a monster through the same arithmetic, and the conditions an effect
   * carried come off with it (on the sheet and on its token).
   */
  private ageEffectsOf(entry: JournalEntry, rounds: number) {
    if (entry.kind === "character") {
      const runtime = advanceRound(entry.runtime, rounds);
      if (runtime !== entry.runtime) this.storeEntry({ ...entry, runtime: { ...runtime, updatedAt: this.now() }, updatedAt: this.now() });
      return;
    }
    if (entry.kind !== "npc" || !entry.runtime.effects?.length) return;
    const aged = ageEffects(entry.runtime, rounds);
    if (!aged.ended.length) { if (aged.runtime !== entry.runtime) this.storeEntry({ ...entry, runtime: { ...aged.runtime, updatedAt: this.now() }, updatedAt: this.now() }); return; }
    const keys = aged.ended.map((effect) => effect.key);
    const names = aged.ended.map((effect) => effect.name);
    const shed = [...names, ...aged.ended.flatMap((effect) => effect.endSave?.conditions ?? [])];
    this.storeEntry({ ...entry, runtime: {
      ...aged.runtime,
      conditions: entry.runtime.conditions.filter((name) => !shed.includes(name)),
      endSaves: (entry.runtime.endSaves ?? []).filter((item) => !keys.includes(item.key)),
      updatedAt: this.now(),
    }, updatedAt: this.now() });
    for (const page of this.pages.values()) {
      for (const token of page.tokens) {
        if (token.represents !== entry.id) continue;
        const kept = token.markers.filter((marker) => !shed.includes(marker.name));
        if (kept.length !== token.markers.length) this.storeToken(page, { ...token, markers: kept });
      }
    }
    this.say({ type: "system", who: "", content: `${entry.name}: ${names.join(", ")} 지속 시간 끝` });
  }

  /** R28 (D151): whoever attacked, forced a save or took damage keeps their rage alive this round. */
  private ragingDeeds(actors: Array<{ entry: JournalEntry; token?: Token; page?: Page } | undefined>) {
    for (const actor of actors) {
      if (!actor) continue;
      if (this.rageOf(actor.entry)) this.markRagingDeed(this.refOf(actor));
      const stopped = cannotAct(this.conditionsOf(actor));
      if (stopped) this.endRage(this.journalEntries.get(actor.entry.id) ?? actor.entry, `${stopped} 상태`);
    }
  }

  private markRagingDeed(ref: ActorRef) {
    const turn = this.turnOf(ref);
    if (!turn || turn.ragingDeed) return;
    this.setTracker({ ...this.tracker, turns: this.tracker.turns.map((item) => (item.id === turn.id ? { ...item, ragingDeed: true } : item)) });
  }

  private rageOf(entry: JournalEntry) {
    if (entry.kind !== "character") return undefined;
    return (entry.runtime.effects ?? []).find((effect) => effect.key === RAGE_KEY);
  }

  /** End a rage that the rules say is over, and say so once. */
  private endRage(entry: JournalEntry, reason: string) {
    const rage = this.rageOf(entry);
    if (!rage || entry.kind !== "character") return;
    this.storeEntry({ ...entry, runtime: { ...endEffect(entry.runtime, RAGE_KEY, reason), updatedAt: this.now() }, updatedAt: this.now() });
    this.say({ type: "system", who: "", content: `${entry.name}의 격노가 끝났습니다 (${reason})` });
  }

  /** R34 (D171): the other direction — a contract handed this turn its action back. */
  private markUnused(ref: ActorRef, which: "action" | "bonus") {
    const turn = this.turnOf(ref);
    if (!turn || this.tracker.turns[this.tracker.current]?.id !== turn.id) return;
    this.setTracker({ ...this.tracker, turns: this.tracker.turns.map((item) => (item.id === turn.id ? { ...item, [which === "action" ? "actionUsed" : "bonusUsed"]: false } : item)) });
  }
  /** R72 (D207): one more attack in the current turn's Attack action; the action is spent when they reach `perAction`. */
  private countAttack(ref: ActorRef, perAction: number) {
    const turn = this.turnOf(ref);
    if (!turn || this.tracker.turns[this.tracker.current]?.id !== turn.id) return;
    const made = (turn.attacksMade ?? 0) + 1;
    this.setTracker({ ...this.tracker, turns: this.tracker.turns.map((item) => (item.id === turn.id ? { ...item, attacksMade: made, ...(made >= perAction ? { actionUsed: true } : {}) } : item)) });
  }
  private markUsed(ref: ActorRef, which: "action" | "bonus") {
    const turn = this.turnOf(ref);
    if (!turn || this.tracker.turns[this.tracker.current]?.id !== turn.id) return;
    this.setTracker({ ...this.tracker, turns: this.tracker.turns.map((item) => (item.id === turn.id ? { ...item, [which === "action" ? "actionUsed" : "bonusUsed"]: true } : item)) });
  }
  private statsOf(actor: { entry: JournalEntry }): ActorStats | null {
    if (actor.entry.kind === "npc") return npcStats(actor.entry.statBlock);
    if (actor.entry.kind === "character") return this.options.pcStats?.(actor.entry) ?? null;
    return null;
  }
  /** Sheet conditions plus token markers (turn-scoped marks such as 회피 live on the token). */
  private conditionsOf(actor: { entry: JournalEntry; token?: Token }): string[] {
    const own = actor.entry.kind === "character" || actor.entry.kind === "npc" ? actor.entry.runtime.conditions : [];
    return [...new Set([...own, ...(actor.token?.markers.map((marker) => marker.name) ?? [])])];
  }
  /** Real conditions go to a PC's sheet (D84 mirrors them to the token) or an NPC's token; turn-scoped marks to the token. */
  private mark(actor: { entry: JournalEntry; token?: Token; page?: Page }, names: string[], on: boolean, from?: string) {
    if (!names.length) return;
    const now = this.now();
    const toggle = (list: string[]) => { let next = list; for (const name of names) next = on ? (next.includes(name) ? next : [...next, name]) : next.filter((item) => item !== name); return next; };
    const sheetNames = actor.entry.kind === "character" ? names.filter((name) => isConditionMarker(name)) : actor.token ? [] : names;
    // A grapple is remembered on the token as well (who holds whom), even for a PC whose sheet carries the condition.
    const tokenNames = actor.entry.kind === "character" ? names.filter((name) => !isConditionMarker(name) || name === "붙잡힘") : actor.token ? names : [];
    if (sheetNames.length) {
      const current = this.journalEntries.get(actor.entry.id);
      if (current?.kind === "character" || current?.kind === "npc") { const conditions = toggle(current.runtime.conditions); if (conditions !== current.runtime.conditions) this.storeEntry({ ...current, runtime: { ...current.runtime, conditions, updatedAt: now }, updatedAt: now } as JournalEntry); }
    }
    if (tokenNames.length && actor.token && actor.page) {
      const page = this.pages.get(actor.page.id);
      const token = page?.tokens.find((item) => item.id === actor.token!.id);
      if (page && token) { let markers = token.markers; for (const name of tokenNames) markers = on ? (markers.some((marker) => marker.name === name) ? markers : [...markers, from ? { name, from } : { name }]) : markers.filter((marker) => marker.name !== name); if (markers !== token.markers) this.storeToken(page, { ...token, markers }); }
    }
  }
  /** A PC's spell through the app's catalog callback; an NPC's from its stat block's spellcasting lists (DC and, 2024-style, attack bonus = DC − 8). */
  private prepareSpell(caster: { entry: JournalEntry; token?: Token }, spellId: string, method?: CastMethod): { spec: SpellCastSpec; casterStats: CasterStats; spend: (runtime: CharacterRuntime) => CharacterRuntime | null; /** R10 (NPC per-day list): spend one use, get the undo back. */ npcSpend?: () => () => void } | null {
    if (caster.entry.kind === "character") return this.options.pcSpell?.(caster.entry, spellId, method) ?? null;
    if (caster.entry.kind !== "npc") return null;
    const block = caster.entry.statBlock;
    const casting = block.actions.find((action) => action.kind === "spellcasting" && action.spellcasting)?.spellcasting;
    const entry = casting?.lists.flatMap((list) => list.entries).find((item) => item.spellId === spellId);
    // R80 (D214): a monster's concentration spell still going is used again the way a character's is — no use spent.
    const going = method?.kind === "sustain" ? (caster.entry.runtime.effects ?? []).find((effect) => effect.key === `spell:${spellId}`) : undefined;
    const base = spellExec(spellId);
    const exec = method?.kind === "sustain" ? (going && base ? sustainedExec(base) : null) : base;
    if (!casting || !entry || !exec) return null;
    const level = going?.level ?? (method?.kind === "slot" ? method.level : entry.slotLevel ?? exec.baseLevel);
    const cr = block.cr;
    // R10: per-day lists count their uses on the NPC's runtime (the sheet's 초기화 clears them).
    const list = casting.lists.find((item) => item.entries.some((candidate) => candidate.spellId === spellId));
    const perDay = list?.frequency === "per-day" ? (list.uses ?? 1) : undefined;
    const used = caster.entry.runtime.uses?.[spellId] ?? 0;
    if (perDay !== undefined && used >= perDay && !going) return null;
    const entryId = caster.entry.id;
    const setUses = (count: number) => { const current = this.journalEntries.get(entryId); if (current?.kind === "npc") this.storeEntry({ ...current, runtime: { ...current.runtime, uses: { ...(current.runtime.uses ?? {}), [spellId]: count }, updatedAt: this.now() }, updatedAt: this.now() }); };
    return { spec: { spellId, name: entry.name, level, exec }, casterStats: { attackBonus: casting.dc - 8, saveDc: casting.dc, modifier: Math.floor((block.abilities[casting.ability] - 10) / 2), level: cr >= 17 ? 17 : cr >= 11 ? 11 : cr >= 5 ? 5 : 1 }, spend: (runtime) => runtime, npcSpend: perDay !== undefined && !going ? () => { setUses(used + 1); return () => setUses(used); } : undefined };
  }

  /**
   * R16: the first creature on the caster's scene that still has its reaction, can act, and can cast 주문 차단 —
   * skipping anyone already asked about this cast, so a round of declines ends instead of looping.
   */
  private findCounterspeller(casterRef: ActorRef, caster: { entry: JournalEntry; token?: Token; page?: Page }, asked: string[]) {
    const page = caster.page ?? (casterRef.pageId ? this.pages.get(casterRef.pageId) : undefined);
    if (!page) return null;
    for (const token of page.tokens) {
      if (token.id === caster.token?.id || asked.includes(token.id)) continue;
      const entry = token.represents ? this.journalEntries.get(token.represents) : undefined;
      if (!entry || entry.kind === "handout" || entry.id === caster.entry.id) continue;
      // The table convention: the other side answers. A party member is never asked to counter their own party.
      if (entry.kind === caster.entry.kind) continue;
      const ref: ActorRef = { entryId: entry.id, pageId: page.id, tokenId: token.id };
      if (this.reactionUsed(ref) || cannotAct(this.conditionsOf({ entry, token }))) continue;
      // H6b (D249): the first counter spell this creature can cast, from the spell data.
      const spellId = reactionSpellIds("spell.cast-seen").find((id) => (entry.kind === "character" ? Boolean(this.options.pcReactionSpell?.(entry, id)) : Boolean(this.prepareSpell({ entry, token }, id))));
      if (!spellId) continue;
      return { ref, key: token.id, name: token.name || entry.name, spellId, spellName: this.prepareSpell({ entry, token }, spellId)?.spec.name ?? spellId };
    }
    return null;
  }

  /**
   * R16: the held cast goes off (nobody countered, or the counter failed) or fades. 2024: a countered spell has no
   * effect and the action is wasted, but the slot is not spent — which is why the cast was held before paying.
   */
  private releaseCast(promptId: string, countered: boolean) {
    const held = this.heldCasts.get(promptId);
    if (!held) return;
    this.heldCasts.delete(promptId);
    if (!countered) {
      this.counterAsked = held.asked;
      try { this.apply(held.userId, held.command, held.peerId); } finally { this.counterAsked = null; }
      return;
    }
    const actor = this.resolveActor(held.command.caster);
    const name = actor ? actor.token?.name ?? actor.entry.name : "시전자";
    this.markUsed(held.command.caster, held.economy);
    this.say({ type: "system", who: "", content: `${name}의 ${held.name}이(가) 주문 차단으로 사라집니다 — 슬롯은 소모되지 않고 ${held.economy === "bonus" ? "추가 행동" : "행동"}만 낭비됩니다` });
  }

  /** R11: finish an attack held for a Shield answer — re-resolved against the raised AC (same dice) when the shield went up, else as rolled. */
  /**
   * R57 (D192): the first character on this page, other than the one that was hit, whose contract wants to answer an
   * attack on somebody else (가로막기 and its kin). Whether they are close enough is the fact they confirm.
   */
  private bystanderGuard(target: { entry: JournalEntry; token?: Token; page?: Page }) {
    if (!target.page || !this.options.pcGuards) return undefined;
    for (const token of target.page.tokens) {
      if (token.id === target.token?.id || !token.represents) continue;
      const entry = this.journalEntries.get(token.represents);
      if (entry?.kind !== "character") continue;
      const actor = { entry, token, page: target.page };
      if (this.reactionUsed(this.refOf(actor))) continue;
      const offers = this.options.pcGuards(entry, "attack.hit-ally");
      if (offers.length) return { actor, offers };
    }
    return undefined;
  }

  private releaseHeld(promptId: string, shielded: boolean, guard?: { acBonus?: number; reduce: number; label: string; halve?: boolean }) {
    const held = this.held.get(promptId);
    if (!held) return;
    this.held.delete(promptId);
    const attacker = this.resolveActor(held.inputs.attacker) ?? held.attacker;
    const target = this.resolveActor(held.inputs.targets[held.inputs.targetIndex]) ?? held.target;
    // R63 (D198): the attacker let the on-hit window go ("안 함") — the card lands as it was rolled.
    // R64 (D199): "안 함" answers the checkboxes; what the sheet takes without asking still lands.
    if (held.stage === "on-hit") {
      const auto = attacker.entry.kind === "character" && held.inputs.attack.source === "weapon" ? splitHitOffers(attacker.entry.runtime, this.hitOffersFor(attacker.entry, held.inputs.attack.attackId, held.inputs.riders ?? {}, target)).auto : [];
      this.takeHitChoices({ ...held, attacker, target }, { choices: [] }, auto);
      return;
    }
    let resolution = held.resolution;
    let overrides = held.overrides;
    // R54 (D189): Shield's +5 and a contract reaction's own bonus take the same road — re-resolve with the same dice
    // and a higher AC, so a hit that is now a miss really misses. `damageDelta` is how a reaction that soaks damage
    // instead of raising AC reaches the card.
    // H6b (D249): a reaction spell raised the AC through its own effect contract (방패: +5), which the target's
    // combatant already carries; the re-resolution below reads it rather than a number written here.
    const acBonus = guard?.acBonus ?? 0;
    const note = guard ? `${guard.label}${guard.acBonus ? `: AC +${guard.acBonus}` : ""}${guard.reduce ? `: 피해 −${guard.reduce}` : ""}${guard.halve ? ": 피해 절반" : ""}` : "";
    if (shielded || acBonus || guard?.reduce || guard?.halve) {
      const attackerCombatant = this.combatantOf(attacker);
      const targetCombatant = this.combatantOf(target);
      if (attackerCombatant && targetCombatant) {
        if (acBonus && targetCombatant.ac < held.resolution.targetAc + acBonus) targetCombatant.ac = held.resolution.targetAc + acBonus;
        overrides = { ...(held.overrides ?? {}), ...(guard?.reduce ? { damageDelta: (held.overrides?.damageDelta ?? 0) - guard.reduce } : {}), ...(guard?.halve ? { damageScale: (held.overrides?.damageScale ?? 1) * 0.5 } : {}), note: [held.overrides?.note, note].filter(Boolean).join(" · ") };
        resolution = resolveAttack(attackerCombatant, targetCombatant, held.spec, { dice: diceFrom(this.options.random ?? Math.random), overrides, fixed: { d20s: held.resolution.d20s, bonusDice: held.resolution.bonusDice?.map((item) => item.total), damage: held.resolution.damage.map((part) => part.dice) }, apply: true });
      }
    }
    // R63 (D198): the target's answer is in; if the swing still landed, the attacker is asked next.
    this.afterReactions({ ...held, attacker, target, resolution, overrides }, true);
  }

  /** A resolved spell (or an NPC save action) becomes a card: applied now, or held for the DM (D90) with its restores. */
  private postSpell(resolution: SpellResolution, targets: Array<{ entry: JournalEntry; token?: Token; page?: Page }>, restoreCaster: () => void, waits: boolean, displayName: string, userId: string, context?: { spec: SpellCastSpec; casterStats: CasterStats }) {
    const messageId = newMessageId();
    const apply = () => this.asCause(messageId, () => {
      const rows = resolution.targets.map((row, index) => this.applySpellRow(row, targets[index], resolution));
      // R99 (D234): a spell that dropped a monster is the moment 어둠의 존재의 축복 waits for.
      const killer = this.journalEntries.get(resolution.caster.id);
      if (killer?.kind === "character" && resolution.targets.some((row, index) => targets[index]?.entry.kind === "npc" && (row.attack?.downed ?? row.damage?.downed))) this.offerTriggers(killer, "kill");
      // R28 (D151): forcing a save and taking damage both keep a rage going.
      this.ragingDeeds([this.resolveActor({ entryId: resolution.caster.id }) ?? undefined, ...targets.filter((_, index) => (resolution.targets[index]?.damage?.damageTotal ?? 0) > 0)]);
      // H1 (D238): damage of a type a creature's regeneration names stops it next turn.
      resolution.targets.forEach((row, index) => { const target = targets[index]; if (target) this.suppressRegeneration(target.entry.id, (row.attack?.damage ?? row.damage?.damage ?? []).filter((part) => part.adjusted > 0).map((part) => part.part.type)); });
      const applied = { ...resolution, applied: true };
      this.spells.set(messageId, { resolution: applied, rows, restoreCaster, context: context ? { ...context, who: displayName, playerId: userId } : undefined, restore: () => { for (const restore of [...rows].reverse()) restore?.(); restoreCaster(); } });
      this.sayWithId(messageId, { type: "spell", who: displayName, playerId: userId, content: describeSpell(applied), spell: applied });
      this.offerRescues(messageId, applied, targets);
      if (this.spells.size > 100) this.spells.delete(this.spells.keys().next().value as string);
    });
    if (waits) {
      this.spells.set(messageId, { resolution, restore: restoreCaster, apply: () => { this.spells.delete(messageId); apply(); } });
      this.sayWithId(messageId, { type: "spell", who: displayName, playerId: userId, content: `${describeSpell(resolution)} (DM 확인 대기)`, spell: resolution });
      return messageId;
    }
    apply();
    return messageId;
  }

  /**
   * R35 (D174): the `d20.roll` slot, opened on a player character's failed saving throw. The contracts say what may
   * happen next (불굴 rerolls, 어둠의 존재의 행운 adds a d10); the host only asks whoever owns the sheet, and asks
   * nothing at all when no contract could be paid for.
   */
  /** R42 (D182): put `count` of a monster on the actor's page as their summons; returns the names placed. */
  private summonInto(summoner: { entry: JournalEntry; token?: Token; page?: Page }, monsterId: string, count: number, why: string): string[] {
    const page = summoner.page;
    const monster = monsterById(monsterId);
    if (!page || !monster) return [];
    const controller = summoner.entry.kind === "character" ? summoner.entry.canEdit : [];
    const placed: string[] = [];
    for (let at = 0; at < count; at += 1) {
      const name = count > 1 ? `${monster.name} ${at + 1}` : monster.name;
      const entry: JournalNpc = { ...newJournalNpc(this.campaign.id, this.options.hostUserId, monster, { name, now: this.now() }), folder: "소환", canView: controller, canEdit: controller, summonedBy: { entryId: summoner.entry.id, name: why } };
      this.storeEntry(entry);
      const token = { ...tokenForNpc(entry), controlledBy: controller.length ? controller : ("inherit" as const), z: page.tokens.length + at };
      this.storeToken(this.pages.get(page.id) ?? page, token);
      placed.push(name);
    }
    return placed;
  }

  /** R42 (D182): send every creature this one summoned away; returns the names. */
  private dismissSummonsOf(entryId: string): string[] {
    const gone: string[] = [];
    for (const entry of [...this.journalEntries.values()]) {
      if (entry.kind !== "npc" || entry.summonedBy?.entryId !== entryId) continue;
      for (const page of [...this.pages.values()]) for (const token of [...page.tokens]) if (token.represents === entry.id) this.dropToken(page.id, token.id);
      this.dropEntry(entry.id);
      gone.push(entry.name);
    }
    return gone;
  }

  private offerRescue(cardId: string, actor: { entry: JournalEntry; token?: Token; page?: Page }, family: RollFamily, roll: string, what: string) {
    if (!this.options.pcRescues || actor.entry.kind !== "character") return;
    const offers = this.options.pcRescues(actor.entry, family, "failure");
    if (!offers.length) return;
    const name = actor.token?.name ?? actor.entry.name;
    this.say({ type: "prompt", who: "", content: `${name}: ${what} 실패 (${roll}) — ${offers.map((offer) => offer.feature).join(" / ")}로 다시 굴릴까요?`, prompt: {
      kind: "rescue",
      mover: { name: what },
      reactor: { name, entryId: actor.entry.id, pageId: actor.page?.id, tokenId: actor.token?.id },
      rescue: { cardId, features: offers.map((offer) => offer.feature), roll },
    } });
  }

  private offerRescues(cardId: string, resolution: SpellResolution, targets: Array<{ entry: JournalEntry; token?: Token; page?: Page }>) {
    if (!this.options.pcRescues) return;
    resolution.targets.forEach((row, index) => {
      const save = row.save;
      if (!save || save.success || save.rescue) return;
      const actor = targets[index];
      if (!actor || actor.entry.kind !== "character") return;
      const offers = this.options.pcRescues!(actor.entry, "saving-throw", "failure");
      if (!offers.length) return;
      const name = actor.token?.name ?? actor.entry.name;
      const roll = `${save.d20}${save.bonus >= 0 ? "+" : "-"}${Math.abs(save.bonus)} = ${save.total} vs DC ${save.dc}`;
      this.say({ type: "prompt", who: "", content: `${name}: ${resolution.name}의 ${ABILITY_KO[save.ability]} 내성 실패 (${roll}) — ${offers.map((offer) => offer.feature).join(" / ")}로 다시 굴릴까요?`, prompt: {
        kind: "rescue",
        mover: { name: resolution.caster.name, entryId: resolution.caster.id },
        reactor: { name, entryId: actor.entry.id, pageId: actor.page?.id, tokenId: actor.token?.id },
        rescue: { cardId, features: offers.map((offer) => offer.feature), roll },
      } });
    });
  }

  /** R9 (D103): an NPC's save action at its targets through the spell resolver; recharge is spent and comes back on undo. Returns the card id. */
  private runNpcSave(actor: { entry: JournalEntry; token?: Token; page?: Page }, actionName: string, targetRefs: ActorRef[], options: { by: string; isGm: boolean; displayName: string; refuse: (reason: string) => void; legendary?: string }): string | undefined {
    const { refuse } = options;
    if (actor.entry.kind !== "npc") { refuse("스탯 블록이 있는 NPC만 쓸 수 있는 행동입니다"); return undefined; }
    const prepared = npcSaveExec(actor.entry, actionName);
    if (!prepared) { refuse("그 행동을 찾을 수 없습니다"); return undefined; }
    const blocked = cannotAct(this.conditionsOf(actor));
    if (blocked) { refuse(`${blocked} 상태라 행동할 수 없습니다`); return undefined; }
    const recharge = Boolean(prepared.action.timing?.recharge);
    if (recharge && actor.entry.runtime.spent[actionName]) { refuse(`${actionName}은(는) 재충전을 기다리는 중입니다`); return undefined; }
    if (!targetRefs.length) { refuse("대상이 없습니다"); return undefined; }
    const targets = targetRefs.map((ref) => this.resolveActor(ref)).filter((item): item is NonNullable<typeof item> => Boolean(item));
    if (targets.length !== targetRefs.length) { refuse("대상을 찾을 수 없습니다"); return undefined; }
    const casterCombatant = this.combatantOf(actor);
    if (!casterCombatant) { refuse("행동하는 쪽의 능력치를 알 수 없습니다"); return undefined; }
    const rows = targets.map((target) => ({ target, combatant: this.combatantOf(target), stats: this.statsOf(target) }));
    if (rows.some((row) => !row.combatant || !row.stats)) { refuse("대상의 능력치를 알 수 없습니다"); return undefined; }
    const waits = Boolean(this.campaign.settings.dmConfirmsResults) && !options.isGm;
    const spec = options.legendary ? { ...prepared.spec, name: `${prepared.spec.name} · 전설 행동 ${options.legendary}` } : prepared.spec;
    const resolution: SpellResolution = { ...resolveSpell({ caster: casterCombatant, casterStats: prepared.casterStats, spec, targets: rows.map((row) => ({ combatant: row.combatant!, stats: row.stats! })), dice: diceFrom(this.options.random ?? Math.random), apply: !waits }), source: "action" };
    const entryId = actor.entry.id;
    const setSpent = (spent: boolean) => { const current = this.journalEntries.get(entryId); if (current?.kind === "npc") this.storeEntry({ ...current, runtime: { ...current.runtime, spent: { ...current.runtime.spent, [actionName]: spent }, updatedAt: this.now() }, updatedAt: this.now() }); };
    if (recharge) setSpent(true);
    if (!options.legendary) this.markUsed({ entryId, pageId: actor.page?.id, tokenId: actor.token?.id }, "action");
    return this.postSpell(resolution, rows.map((row) => row.target), () => { if (recharge) setSpent(false); }, waits, options.displayName, options.by, { spec, casterStats: prepared.casterStats });
  }

  /**
   * R79 (D216), R81 (D215): the features a character's contracts tie to this moment. Each follows its sheet setting
   * (`hitPolicy["trigger:<feature>"]`): taken at once, never offered, or — the default — asked in a window the
   * character's owner answers. Nothing waits on the answer; the rest of the table carries on.
   */
  private offerTriggers(entry: JournalCharacter, event: "short-rest" | "initiative" | "kill", where: { pageId?: string; tokenId?: string } = {}) {
    const offers = this.options.pcTriggers?.(entry, event) ?? [];
    const policy = (offer: TriggerOffer) => entry.runtime.hitPolicy?.[triggerPolicyKey(offer.featureId)] ?? "ask";
    const auto = offers.filter((offer) => policy(offer) === "always");
    const ask = offers.filter((offer) => policy(offer) === "ask");
    const moment = event === "initiative" ? "이니셔티브" : event === "kill" ? "적을 쓰러뜨림" : "짧은 휴식";
    if (auto.length) { const used = this.applyTriggers(entry.id, event, auto.map((offer) => ({ featureId: offer.featureId })), auto); if (used.length) this.say({ type: "system", who: "", content: `${entry.name}: ${moment} — ${used.join(", ")} (자동)` }); }
    if (!ask.length) return;
    this.say({ type: "prompt", who: "", content: `${entry.name}: ${moment} — ${ask.map((offer) => offer.name).join(", ")}`, prompt: { kind: "trigger", mover: { name: entry.name }, reactor: { name: entry.name, entryId: entry.id, ...where }, trigger: { event, offers: ask } } });
  }

  /** Use the chosen trigger features one after another on the live sheet; returns what was used, by name. */
  private applyTriggers(entryId: string, event: "short-rest" | "initiative" | "kill", choices: Array<{ featureId: string; slots?: number[] }>, offers: TriggerOffer[]) {
    const roll = (formula: string) => rollFormula({ label: "", formula }, this.options.random ?? Math.random).total;
    const used: string[] = [];
    for (const choice of choices) {
      const live = this.journalEntries.get(entryId);
      if (live?.kind !== "character") break;
      const slots = Array.isArray(choice.slots) ? choice.slots.filter((level) => Number.isInteger(level)).slice(0, 20) : undefined;
      const next = this.options.pcTriggerApply?.(live, event, { featureId: choice.featureId, ...(slots ? { slots } : {}) }, roll);
      if (!next) continue;
      this.storeEntry({ ...live, runtime: { ...next, updatedAt: this.now() }, updatedAt: this.now() });
      used.push(offers.find((offer) => offer.featureId === choice.featureId)?.name ?? choice.featureId);
    }
    return used;
  }

  /** R80 (D214): a monster concentrating on a spell carries it as an effect, so it can repeat it and lose it. */
  private startNpcConcentration(entryId: string, spellId: string, name: string, level: number) {
    const current = this.journalEntries.get(entryId);
    if (current?.kind !== "npc") return;
    const effect: ActiveEffect = { key: `spell:${spellId}`, name, source: "spell", duration: "집중", concentration: true, elapsed: 0, startedAt: this.now(), level };
    this.storeEntry({ ...current, runtime: { ...current.runtime, effects: [...(current.runtime.effects ?? []).filter((item) => !item.concentration), effect], updatedAt: this.now() }, updatedAt: this.now() });
  }

  /**
   * R80 (D214): a monster that failed its concentration save lets go — the effect and the 집중 marker come off.
   * ponytail: undoing the damage does not give the concentration back; the DM re-marks it if that matters.
   */
  private dropNpcConcentration(target: { entry: JournalEntry; token?: Token; page?: Page }) {
    const current = this.journalEntries.get(target.entry.id);
    if (current?.kind === "npc" && (current.runtime.effects ?? []).some((effect) => effect.concentration)) this.storeEntry({ ...current, runtime: { ...current.runtime, effects: (current.runtime.effects ?? []).filter((effect) => !effect.concentration), updatedAt: this.now() }, updatedAt: this.now() });
    if (target.page) this.mark({ entry: target.entry, token: this.pages.get(target.page.id)?.tokens.find((item) => item.id === target.token?.id), page: target.page }, ["집중"], false);
  }

  /** Write one target's part of a spell (damage, healing, temp HP, conditions, a lasting effect); returns the undo. */
  private applySpellRow(row: SpellTargetResult, target: { entry: JournalEntry; token?: Token; page?: Page }, resolution: SpellResolution): (() => void) | null {
    const now = this.now();
    const downed = row.attack?.downed ?? row.damage?.downed;
    const concentrationFailed = (row.attack?.concentration ?? row.damage?.concentration)?.success === false;
    const line = `${resolution.caster.name}의 ${resolution.name}: ${row.healed !== undefined ? `회복 ${row.healed}` : row.tempHp !== undefined ? `임시 HP ${row.tempHp}` : row.attack ? `${row.attack.outcome === "hit" || row.attack.outcome === "crit" ? `피해 ${row.attack.damageTotal}` : "빗나감"}` : row.damage ? `피해 ${row.damage.damageTotal}${row.save ? ` (내성 ${row.save.success ? "성공" : "실패"})` : ""}` : row.effect ? `${row.effect.name} (${row.effect.duration})` : row.marks.join(", ") || "효과"} → HP ${row.hpAfter}`;
    if (target.entry.kind === "character") {
      // The live entry, not the one captured before the cast: a self-target spell already paid its slot on this sheet.
      const live = this.journalEntries.get(target.entry.id);
      const before = live?.kind === "character" ? live : target.entry;
      let runtime: CharacterRuntime = { ...before.runtime, hp: { ...before.runtime.hp, current: row.hpAfter, temp: row.tempHp !== undefined ? row.tempHp : row.tempAfter } };
      // R28 (D149): healed off 0 HP → awake, death saves cleared. (D152) and a spell may name what it ends.
      if (before.runtime.hp.current === 0 && row.hpAfter > 0) runtime = wakeUp(runtime);
      const cleared = (row.clears ?? []).filter((name) => runtime.conditions.includes(name));
      if (cleared.length) runtime = { ...runtime, conditions: runtime.conditions.filter((name) => !cleared.includes(name)), deathSaves: { success: 0, failure: 0 } };
      runtime = noteLog(runtime, line);
      let dropped: ActiveEffect | undefined;
      if (concentrationFailed) { const key = this.options.pcConcentrationKey?.(before); if (key) { dropped = (before.runtime.effects ?? []).find((effect) => effect.key === key); runtime = endEffect(runtime, key, "집중 실패"); } }
      for (const condition of row.marks) if (!runtime.conditions.includes(condition)) runtime = { ...runtime, conditions: [...runtime.conditions, condition] };
      if (downed === "unconscious") for (const condition of ["무의식", "넘어짐"]) if (!runtime.conditions.includes(condition)) runtime = { ...runtime, conditions: [...runtime.conditions, condition] };
      runtime = this.takeDeathFailures(runtime, row.attack?.deathFailures ?? row.damage?.deathFailures, row.target.name, resolution.name);
      // A lasting effect on a target: on the caster's own sheet castSpell already started it (with concentration); others get it without.
      // R90 (D225): the creature is now under the spell — a caster who targeted themselves too, whose effect castSpell started.
      if (row.effect && (runtime.effects ?? []).some((effect) => effect.key === row.effect!.key)) runtime = { ...runtime, effects: runtime.effects.map((effect) => (effect.key === row.effect!.key ? { ...effect, bearer: true } : effect)) };
      else if (row.effect) runtime = startEffect(runtime, { key: row.effect.key, name: row.effect.name, source: "spell", bearer: true, duration: row.effect.duration, concentration: resolution.caster.id === before.id && row.effect.concentration, rounds: row.effect.rounds, ...(resolution.caster.id !== before.id ? { from: resolution.caster.id, ...(row.effect.concentration ? { fromConcentration: true } : {}), ...(row.effect.anchor ? { anchor: row.effect.anchor } : {}), ...(row.marks.length ? { conditions: row.marks } : {}), ...(this.castOnOwnTurn(row.effect, resolution.caster.id) ? { rounds: (row.effect.rounds ?? 0) + 1 } : {}) } : row.effect.anchor ? { anchor: row.effect.anchor } : {}), ...(row.effect.endSave ? { endSave: { ...row.effect.endSave, conditions: row.marks } } : {}) });
      this.storeEntry({ ...before, runtime: { ...runtime, updatedAt: now }, updatedAt: now });
      if (downed) this.releaseGrapples(target.page, target.token?.id);
      // R26 (D136): reverse this row, not the sheet as it was — healing, damage, marks and the effect it started.
      const delta = {
        hp: before.runtime.hp.current - row.hpAfter,
        temp: before.runtime.hp.temp - (row.tempHp !== undefined ? row.tempHp : row.tempAfter),
        conditions: runtime.conditions.filter((name) => !before.runtime.conditions.includes(name)),
        deathFailures: row.attack?.deathFailures ?? row.damage?.deathFailures,
        restore: dropped ? [dropped] : [],
        remove: (runtime.effects ?? []).filter((effect) => !(before.runtime.effects ?? []).some((item) => item.key === effect.key)).map((effect) => effect.key),
        note: `되돌림: ${resolution.caster.name}의 ${resolution.name}`,
      };
      return () => this.undoOnCharacter(before.id, delta);
    }
    if (target.entry.kind !== "npc") return null;
    if (concentrationFailed) this.dropNpcConcentration(target);
    const marks = [...row.marks, ...(row.effect ? [row.effect.name] : []), ...(downed ? ["사망"] : [])];
    const clears = row.clears ?? [];
    // R10: an effect the NPC may shake off at the end of its turns is remembered on its runtime.
    const npcBefore = target.entry;
    let restoreEndSaves: () => void = () => undefined;
    // R30 (D157): a monster carries its timed effects now — a Hold Person on an ogre has a duration that runs out
    // instead of being a marker nobody was counting. The end-save row (R10) is written in the same breath.
    if (row.effect) {
      const key = row.effect.key;
      const already = (npcBefore.runtime.effects ?? []).some((effect) => effect.key === key);
      const started: ActiveEffect = { key, name: row.effect.name, source: "spell", bearer: true, duration: row.effect.duration, concentration: false, rounds: row.effect.rounds, elapsed: 0, startedAt: now, ...(resolution.caster.id !== npcBefore.id ? { from: resolution.caster.id, ...(row.effect.concentration ? { fromConcentration: true } : {}), ...(row.effect.anchor ? { anchor: row.effect.anchor } : {}), ...(row.marks.length ? { conditions: row.marks } : {}), ...(this.castOnOwnTurn(row.effect, resolution.caster.id) ? { rounds: (row.effect.rounds ?? 0) + 1 } : {}) } : row.effect.anchor ? { anchor: row.effect.anchor } : {}), ...(row.effect.endSave ? { endSave: { ...row.effect.endSave, conditions: row.marks } } : {}) };
      const endSaves = row.effect.endSave
        ? [...(npcBefore.runtime.endSaves ?? []).filter((item) => item.key !== key), { key, name: row.effect.name, ability: row.effect.endSave.ability, dc: row.effect.endSave.dc, conditions: row.marks }]
        : npcBefore.runtime.endSaves;
      this.storeEntry({ ...npcBefore, runtime: { ...npcBefore.runtime, effects: already ? (npcBefore.runtime.effects ?? []).map((effect) => (effect.key === key ? { ...effect, bearer: true } : effect)) : [...(npcBefore.runtime.effects ?? []), started], endSaves, updatedAt: now }, updatedAt: now });
      restoreEndSaves = () => { const current = this.journalEntries.get(npcBefore.id); if (current?.kind === "npc") this.storeEntry({ ...current, runtime: { ...current.runtime, endSaves: (current.runtime.endSaves ?? []).filter((item) => item.key !== key), effects: already ? current.runtime.effects : (current.runtime.effects ?? []).filter((effect) => effect.key !== key), updatedAt: this.now() }, updatedAt: this.now() }); };
    }
    const token = target.token;
    const bar = token?.bars[0];
    if (token && target.page && !bar?.link) {
      const page = this.pages.get(target.page.id);
      const live = page?.tokens.find((item) => item.id === token.id);
      if (!page || !live) return null;
      const before = live;
      const added = marks.filter((name) => !live.markers.some((marker) => marker.name === name));
      const markers = [...live.markers.filter((marker) => !clears.includes(marker.name)), ...added.map((name) => ({ name }))];
      this.storeToken(page, { ...live, bars: [{ ...bar!, value: row.hpAfter }, live.bars[1], live.bars[2]], markers });
      if (downed) this.releaseGrapples(page, token.id);
      const delta = { bar: (bar!.value ?? 0) - row.hpAfter, markers: added };
      return () => { restoreEndSaves(); this.undoOnToken(page.id, before.id, delta); };
    }
    const before = this.journalEntries.get(npcBefore.id) as typeof npcBefore;
    const added = marks.filter((name) => !before.runtime.conditions.includes(name));
    const conditions = [...before.runtime.conditions.filter((name) => !clears.includes(name)), ...added];
    this.storeEntry({ ...before, runtime: { ...before.runtime, hp: { ...before.runtime.hp, current: row.hpAfter, temp: row.tempHp ?? row.tempAfter }, conditions, updatedAt: now }, updatedAt: now });
    const delta = { hp: before.runtime.hp.current - row.hpAfter, temp: before.runtime.hp.temp - (row.tempHp ?? row.tempAfter), conditions: added, endSaveKeys: row.effect?.endSave ? [row.effect.key] : [], effectKeys: row.effect ? [row.effect.key] : [] };
    return () => this.undoOnNpc(before.id, delta);
  }

  /** R10: at the end of a creature's turn it repeats the saves its effects allow; a success ends the effect and its conditions. */
  private rollEndSaves(actor: { entry: JournalEntry; token?: Token; page?: Page }) {
    const stats = this.statsOf(actor);
    if (!stats) return;
    const random = this.options.random ?? Math.random;
    const name = actor.token?.name ?? actor.entry.name;
    const report = (effect: string, ability: AbilityKey, dc: number, die: number, bonus: number, success: boolean) => this.say({ type: "rollresult", who: "", content: `${name} · ${effect} 종료 내성 (${ABILITY_KO[ability]}) ${die}${bonus >= 0 ? "+" : ""}${bonus} = ${die + bonus} vs DC ${dc} — ${success ? "성공, 효과 끝" : "실패"}`, roll: { formula: `1d20${bonus >= 0 ? "+" : "-"}${Math.abs(bonus)}`, total: die + bonus, dice: [{ sides: 20, value: die }], modifier: bonus, label: `${name} · ${effect} 종료 내성 — ${success ? "성공, 효과 끝" : "실패"} (DC ${dc})` } });
    if (actor.entry.kind === "character") {
      let runtime = actor.entry.runtime;
      let changed = false;
      for (const effect of runtime.effects ?? []) {
        if (!effect.endSave) continue;
        const die = 1 + Math.floor(random() * 20);
        const bonus = stats.saves[effect.endSave.ability] ?? 0;
        const success = die + bonus >= effect.endSave.dc;
        report(effect.name, effect.endSave.ability, effect.endSave.dc, die, bonus, success);
        if (!success) continue;
        runtime = endEffect(runtime, effect.key, "내성 성공");
        runtime = { ...runtime, conditions: runtime.conditions.filter((condition) => !effect.endSave!.conditions.includes(condition)) };
        changed = true;
      }
      if (changed) this.storeEntry({ ...actor.entry, runtime: { ...runtime, updatedAt: this.now() }, updatedAt: this.now() });
      return;
    }
    if (actor.entry.kind !== "npc" || !actor.entry.runtime.endSaves?.length) return;
    const kept: NonNullable<typeof actor.entry.runtime.endSaves> = [];
    const shed: string[] = [];
    for (const item of actor.entry.runtime.endSaves) {
      const die = 1 + Math.floor(random() * 20);
      const bonus = stats.saves[item.ability] ?? 0;
      const success = die + bonus >= item.dc;
      report(item.name, item.ability, item.dc, die, bonus, success);
      if (success) shed.push(item.name, ...item.conditions); else kept.push(item);
    }
    const current = this.journalEntries.get(actor.entry.id);
    // R30 (D157): shaking an effect off takes it out of the monster's effect list too, not only its end-save row.
    const shedKeys = actor.entry.runtime.endSaves.filter((item) => shed.includes(item.name)).map((item) => item.key);
    if (current?.kind === "npc") this.storeEntry({ ...current, runtime: { ...current.runtime, endSaves: kept, effects: (current.runtime.effects ?? []).filter((effect) => !shedKeys.includes(effect.key)), conditions: current.runtime.conditions.filter((condition) => !shed.includes(condition)), updatedAt: this.now() }, updatedAt: this.now() });
    if (shed.length && actor.token && actor.page) { const page = this.pages.get(actor.page.id); const token = page?.tokens.find((item) => item.id === actor.token!.id); if (page && token) this.storeToken(page, { ...token, markers: token.markers.filter((marker) => !shed.includes(marker.name)) }); }
  }
  private actorOfTurn(turn: TrackerTurn | undefined) { return turn ? this.resolveActor({ entryId: turn.entryId, pageId: turn.pageId, tokenId: turn.tokenId }) : null; }
  /** A grappler that is incapacitated (or dead) lets go: every 붙잡힘 it holds on this page ends (2024). */
  private releaseGrapples(page: Page | undefined, grapplerTokenId: string | undefined) {
    if (!page || !grapplerTokenId) return;
    const live = this.pages.get(page.id);
    if (!live) return;
    for (const token of live.tokens) {
      if (!token.markers.some((marker) => marker.name === "붙잡힘" && marker.from === grapplerTokenId)) continue;
      const entry = token.represents ? this.journalEntries.get(token.represents) : undefined;
      this.mark({ entry: entry ?? ({ kind: "npc" } as JournalEntry), token, page: live }, ["붙잡힘"], false);
      this.say({ type: "system", who: "", content: `${token.name}: 붙잡은 쪽이 쓰러져 붙잡힘이 풀립니다` });
    }
  }

  /**
   * R15: damage on a PC already at 0 HP is a death-save failure (two from a critical hit); three end the character.
   * The table hears about it, because nothing else on the card says so.
   */

  /**
   * R26 (D136): reverse exactly what one card wrote, on top of whatever the world is now.
   *
   * Every restore closure used to capture the value from before the card and write it back absolutely. So undoing
   * an older card out of order wrote a stale world over a newer one: a goblin hit twice, the first card undone,
   * came back at full HP with the second hit's damage gone — and undoing the second card then killed it again.
   * A delta undoes only this card's own change, so the order no longer matters and later work is left alone.
   */
  private undoOnCharacter(entryId: string, delta: { hp: number; temp: number; conditions: string[]; deathFailures?: number; restore?: ActiveEffect[]; remove?: string[]; note: string }) {
    const current = this.journalEntries.get(entryId);
    if (current?.kind !== "character") return;
    const runtime = current.runtime;
    const effects = (runtime.effects ?? []).filter((effect) => !(delta.remove ?? []).includes(effect.key));
    for (const effect of delta.restore ?? []) if (!effects.some((item) => item.key === effect.key)) effects.push(effect);
    const next: CharacterRuntime = {
      ...runtime,
      hp: { ...runtime.hp, current: Math.max(0, Math.min(runtime.hp.maxSeen, runtime.hp.current + delta.hp)), temp: Math.max(0, runtime.hp.temp + delta.temp) },
      conditions: runtime.conditions.filter((name) => !delta.conditions.includes(name)),
      deathSaves: { ...runtime.deathSaves, failure: Math.max(0, runtime.deathSaves.failure - (delta.deathFailures ?? 0)) },
      effects,
    };
    this.storeEntry({ ...current, runtime: { ...noteLog(next, delta.note), updatedAt: this.now() }, updatedAt: this.now() });
  }

  private undoOnNpc(entryId: string, delta: { hp: number; temp: number; conditions: string[]; endSaveKeys?: string[]; effectKeys?: string[] }) {
    const current = this.journalEntries.get(entryId);
    if (current?.kind !== "npc") return;
    const runtime = current.runtime;
    this.storeEntry({ ...current, runtime: {
      ...runtime,
      effects: (runtime.effects ?? []).filter((effect) => !(delta.effectKeys ?? []).includes(effect.key)),
      hp: { ...runtime.hp, current: Math.max(0, Math.min(runtime.hp.max, runtime.hp.current + delta.hp)), temp: Math.max(0, runtime.hp.temp + delta.temp) },
      conditions: runtime.conditions.filter((name) => !delta.conditions.includes(name)),
      endSaves: (runtime.endSaves ?? []).filter((item) => !(delta.endSaveKeys ?? []).includes(item.key)),
      updatedAt: this.now(),
    }, updatedAt: this.now() });
  }

  private undoOnToken(pageId: string, tokenId: string, delta: { bar: number; markers: string[] }) {
    const page = this.pages.get(pageId);
    const token = page?.tokens.find((item) => item.id === tokenId);
    if (!page || !token) return;
    const bar = token.bars[0];
    const value = bar.value === undefined ? undefined : Math.max(0, Math.min(bar.max ?? Number.MAX_SAFE_INTEGER, bar.value + delta.bar));
    this.storeToken(page, { ...token, bars: [{ ...bar, value }, token.bars[1], token.bars[2]], markers: token.markers.filter((marker) => !delta.markers.includes(marker.name)) });
  }

  /** R26: what a cast took off the caster's sheet, so undoing it refunds that and not every slot spent since. */
  private undoOnCaster(entryId: string, before: CharacterRuntime, after: CharacterRuntime) {
    const current = this.journalEntries.get(entryId);
    if (current?.kind !== "character") return;
    const runtime = current.runtime;
    const slotsUsed = { ...runtime.slotsUsed };
    for (const level of new Set([...Object.keys(before.slotsUsed), ...Object.keys(after.slotsUsed)])) {
      const spent = (after.slotsUsed[Number(level)] ?? 0) - (before.slotsUsed[Number(level)] ?? 0);
      if (spent) slotsUsed[Number(level)] = Math.max(0, (slotsUsed[Number(level)] ?? 0) - spent);
    }
    const resourcesUsed = { ...runtime.resourcesUsed };
    for (const key of new Set([...Object.keys(before.resourcesUsed), ...Object.keys(after.resourcesUsed)])) {
      const spent = (after.resourcesUsed[key] ?? 0) - (before.resourcesUsed[key] ?? 0);
      if (spent) resourcesUsed[key] = Math.max(0, (resourcesUsed[key] ?? 0) - spent);
    }
    const started = (after.effects ?? []).filter((effect) => !(before.effects ?? []).some((item) => item.key === effect.key)).map((effect) => effect.key);
    this.storeEntry({ ...current, runtime: {
      ...runtime, slotsUsed, resourcesUsed,
      pactSlotsUsed: Math.max(0, runtime.pactSlotsUsed - (after.pactSlotsUsed - before.pactSlotsUsed)),
      effects: (runtime.effects ?? []).filter((effect) => !started.includes(effect.key)),
      updatedAt: this.now(),
    }, updatedAt: this.now() });
  }

  private takeDeathFailures(runtime: CharacterRuntime, failures: number | undefined, name: string, source: string): CharacterRuntime {
    if (!failures) return runtime;
    let next = runtime;
    for (let at = 0; at < failures; at += 1) next = recordDeathSave(next, false);
    const dead = next.deathSaves.failure >= 3;
    this.say({ type: "system", who: "", content: `${name}: 0 HP에서 ${source}의 피해 — 죽음 내성 실패 ${failures}회 (${next.deathSaves.success}/${next.deathSaves.failure})${dead ? " — 사망" : ""}` });
    return next;
  }

  /** Write the result into the target (PC sheet or NPC token/sheet) and post the card; remember how to undo it. */
  private applyResolution(...args: Parameters<TableHost["applyResolutionNow"]>) {
    return this.asCause(args[3], () => {
      const out = this.applyResolutionNow(...args);
      this.suppressRegeneration(args[1].entry.id, args[0].damage.filter((part) => part.adjusted > 0).map((part) => part.part.type));
      // R99 (D234): a swing that dropped a monster is the moment 어둠의 존재의 축복 waits for.
      const killer = this.journalEntries.get(args[2].entry.id);
      // R99 (D234): 연구된 공격 remembers the miss; any other attack by the same creature settles the last one.
      if (!args[6] && this.combatantOf(args[2])?.studiedAttacks) { if (args[0].outcome === "miss" || args[0].outcome === "fumble") this.studied.set(args[2].entry.id, args[1].entry.id); else this.studied.delete(args[2].entry.id); }
      if (args[0].downed && args[1].entry.kind === "npc" && killer?.kind === "character" && !args[6]) this.offerTriggers(killer, "kill");
      // R90 (D225): after the card has written its own changes, so they do not put the spent effect back.
      this.consumeOnUse(args[2].entry.id, "attack");
      this.consumeOnUse(args[1].entry.id, "attacked");
      return out;
    });
  }

  private applyResolutionNow(resolution: AttackResolution, target: { entry: JournalEntry; token?: Token; page?: Page }, attacker: { entry: JournalEntry; token?: Token }, messageId: string, confirming: boolean, inputs?: { attacker: ActorRef; targets: ActorRef[]; attack: AttackRef; riders?: AttackRiders; by: string; targetIndex: number }, supersedes?: string, who?: string) {
    const restores: Array<() => void> = [];
    const hit = resolution.outcome === "hit" || resolution.outcome === "crit" || Boolean(resolution.mastery?.grazed);
    if (hit && target.entry.kind === "character") {
      const before = target.entry;
      let runtime: CharacterRuntime = { ...before.runtime, hp: { ...before.runtime.hp, current: resolution.hpAfter, temp: resolution.tempAfter } };
      runtime = noteLog(runtime, `${resolution.attacker.name}의 ${resolution.attack.name}: 피해 ${resolution.damageTotal}${resolution.absorbed ? ` (임시 HP ${resolution.absorbed} 흡수)` : ""} → HP ${resolution.hpAfter}/${before.runtime.hp.maxSeen}`);
      let dropped: ActiveEffect | undefined;
      if (resolution.concentration && !resolution.concentration.success) { const key = this.options.pcConcentrationKey?.(before); if (key) { dropped = (before.runtime.effects ?? []).find((effect) => effect.key === key); runtime = endEffect(runtime, key, "집중 실패"); } }
      for (const condition of resolution.inflicted) if (!runtime.conditions.includes(condition)) runtime = { ...runtime, conditions: [...runtime.conditions, condition] };
      if (resolution.downed === "unconscious") for (const condition of ["무의식", "넘어짐"]) if (!runtime.conditions.includes(condition)) runtime = { ...runtime, conditions: [...runtime.conditions, condition] };
      if (resolution.downed === "instant-death") runtime = noteLog(runtime, "대량 피해: 즉사");
      runtime = this.takeDeathFailures(runtime, resolution.deathFailures, resolution.target.name, resolution.attack.name);
      this.storeEntry({ ...before, runtime: { ...runtime, updatedAt: this.now() }, updatedAt: this.now() });
      // R26 (D136): the undo is this card's own change, not a photograph of the sheet before it.
      const delta = { hp: before.runtime.hp.current - resolution.hpAfter, temp: before.runtime.hp.temp - resolution.tempAfter, conditions: runtime.conditions.filter((name) => !before.runtime.conditions.includes(name)), deathFailures: resolution.deathFailures, restore: dropped ? [dropped] : [], note: `되돌림: ${resolution.attacker.name}의 ${resolution.attack.name}` };
      restores.push(() => this.undoOnCharacter(before.id, delta));
    } else if (hit && target.entry.kind === "npc") {
      const token = target.token;
      const bar = token?.bars[0];
      if (token && target.page && !bar?.link) {
        const beforeToken = token;
        const page = this.pages.get(target.page.id)!;
        const markers = resolution.downed ? [...token.markers.filter((marker) => marker.name !== "사망"), { name: "사망" }] : token.markers;
        const inflicted = resolution.inflicted.filter((name) => !markers.some((marker) => marker.name === name)).map((name) => ({ name }));
        this.storeToken(page, { ...token, bars: [{ ...bar!, value: resolution.hpAfter }, token.bars[1], token.bars[2]], markers: [...markers, ...inflicted] });
        const added = [...(resolution.downed && !beforeToken.markers.some((marker) => marker.name === "사망") ? ["사망"] : []), ...inflicted.map((marker) => marker.name)];
        const delta = { bar: (bar!.value ?? 0) - resolution.hpAfter, markers: added };
        restores.push(() => this.undoOnToken(page.id, beforeToken.id, delta));
      } else {
        const before = target.entry;
        const added = resolution.inflicted.filter((name) => !before.runtime.conditions.includes(name));
        const conditions = [...before.runtime.conditions, ...added];
        this.storeEntry({ ...before, runtime: { ...before.runtime, hp: { ...before.runtime.hp, current: resolution.hpAfter, temp: resolution.tempAfter }, conditions, updatedAt: this.now() }, updatedAt: this.now() });
        const delta = { hp: before.runtime.hp.current - resolution.hpAfter, temp: before.runtime.hp.temp - resolution.tempAfter, conditions: added };
        restores.push(() => this.undoOnNpc(before.id, delta));
      }
    }
    if (hit && target.entry.kind === "npc" && resolution.concentration && !resolution.concentration.success) this.dropNpcConcentration(target);
    // R28 (D151): the attacker attacked and the target took damage — both count for a rage; a rage whose bearer has
    // just been knocked out or stunned ends there.
    this.ragingDeeds([attacker as { entry: JournalEntry; token?: Token; page?: Page }, hit ? target : undefined]);
    if (hit && resolution.downed) this.releaseGrapples(target.page, target.token?.id);
    // R12: a Vex mark the wielder already had on this target is spent by this attack unless the hit renews it.
    const hadVex = target.token?.markers.some((marker) => marker.name === "교란" && marker.from === attacker.token?.id);
    if (hadVex && !resolution.mastery?.marks.includes("교란") && target.page) this.mark({ entry: target.entry, token: target.token, page: target.page }, ["교란"], false);
    // R53 (D188): what the attacker's contracts do now the outcome is known — 강화된 치명타's mark, 저지's stop,
    // 베어 넘기기's bonus action. The marks land the same way a mastery's do, so undo takes them back the same way.
    if (hit && inputs && attacker.entry.kind === "character" && this.options.pcAftermath && inputs.attack.source === "weapon") {
      const outcomes: AttackOutcomeKind[] = ["hit", ...(resolution.outcome === "crit" ? ["crit" as const] : []), ...(resolution.downed ? ["downed" as const] : [])];
      const after = this.options.pcAftermath(attacker.entry, inputs.attack.attackId, outcomes);
      if (after.marks.length && target.page) {
        const targetActor = { entry: target.entry, token: target.token, page: target.page };
        this.mark(targetActor, after.marks, true, attacker.token?.id);
        restores.push(() => this.mark({ ...targetActor, token: this.pages.get(target.page!.id)?.tokens.find((item) => item.id === target.token?.id) }, after.marks, false));
      }
      for (const grant of after.economy) {
        const which = economyBucketOf(grant.bucket);
        if (which !== "action" && which !== "bonus") continue;
        this.markUnused(this.refOf(attacker as { entry: JournalEntry; token?: Token; page?: Page }), which);
        this.say({ type: "system", who: "", content: `${attacker.entry.name}: ${grant.source} — 이번 턴에 ${which === "bonus" ? "추가 행동" : "행동"} 하나를 더 씁니다` });
      }
      for (const note of after.notes) this.say({ type: "system", who: "", content: `${attacker.entry.name} — ${note}` });
    }
    // Mastery marks (교란·약화·둔화) sit on the target with the wielder as `from`; the wielder's next turn start clears them.
    if (resolution.mastery?.marks.length && target.page) { const marks = resolution.mastery.marks; const targetActor = { entry: target.entry, token: target.token, page: target.page }; this.mark(targetActor, marks, true, attacker.token?.id); restores.push(() => this.mark({ ...targetActor, token: this.pages.get(target.page!.id)?.tokens.find((item) => item.id === target.token?.id) }, marks, false)); }
    const applied = { ...resolution, applied: true };
    const undo = () => { for (const restore of [...restores].reverse()) restore(); };
    if (inputs) this.actions.set(messageId, { inputs, resolution: applied, restore: undo });
    else { const existing = this.actions.get(messageId); if (existing) this.actions.set(messageId, { ...existing, resolution: applied, restore: undo }); }
    this.sayWithId(messageId, { type: "action", who: who ?? "", playerId: inputs?.by, content: describeResolution(applied), action: applied, supersedes: confirming ? undefined : supersedes });
    if (this.actions.size > 200) this.actions.delete(this.actions.keys().next().value as string);
  }

  /**
   * R18 (D115): move the in-world clock and let time do its work — a timed effect whose rounds have run out ends
   * (one minute is ten rounds), and the table hears about the new time.
   */
  private passTime(minutes: number) {
    const clock = advanceClock(this.clock, minutes);
    this.setCampaign({ ...this.campaign, clock, updatedAt: this.now() });
    this.emit({ type: "clock", clock });
    // R30 (D156): one step of however many rounds, instead of a loop capped at six thousand — an eight-hour effect
    // is 4,800 rounds and it now really runs out when the party takes a long rest.
    const rounds = minutes * 10;
    for (const entry of [...this.journalEntries.values()]) {
      if (entry.kind === "handout" || !entry.runtime.effects?.length) continue;
      this.ageEffectsOf(entry, rounds);
    }
  }

  private setTracker(tracker: Tracker) {
    this.setCampaign({ ...this.campaign, tracker, updatedAt: this.now() });
    this.emit({ type: "tracker", tracker });
  }

  /**
   * "다음 턴" as a rules step (D87): the actor whose turn ends advances its effect rounds; the actor whose turn
   * starts rolls recharges (NPC), resets legendary actions, and a PC at 0 HP rolls a death save (D92, automatic).
   */
  private nextTurn() {
    const endedMark = `${this.tracker.round}:${this.tracker.current}`;
    const result = advanceTurn(this.tracker);
    const random = this.options.random ?? Math.random;
    const ended = result.ended?.entryId ? this.journalEntries.get(result.ended.entryId) : undefined;
    if (ended && ended.kind !== "handout" && ended.runtime.effects?.length) this.ageEffectsOf(ended, 1);
    if (result.roundWrapped) this.say({ type: "system", who: "", content: `라운드 ${result.tracker.round}` });
    if (result.started) this.say({ type: "system", who: "", content: `${result.started.name}의 턴` });
    const started = result.started?.entryId ? this.journalEntries.get(result.started.entryId) : undefined;
    if (started?.kind === "character") {
      // V3c (D257): what the sheet's contracts do by themselves at the start of the turn (생존자's healing).
      for (const heal of this.options.pcTurnStart?.(started) ?? []) {
        const live = this.journalEntries.get(started.id);
        if (live?.kind !== "character" || heal.amount <= 0) continue;
        const current = live.runtime.hp.current;
        const next = Math.min(heal.max, current + heal.amount);
        if (next <= current) continue;
        this.storeEntry({ ...live, runtime: { ...live.runtime, hp: { ...live.runtime.hp, current: next }, updatedAt: this.now() }, updatedAt: this.now() });
        this.say({ type: "system", who: "", content: `${live.name}: ${heal.label} +${next - current} → HP ${next}/${heal.max}` });
      }
      // R29 (D154): the save belongs to the player. When someone is there to make it, the turn opens with their
      // card instead of an anonymous line nobody rolled; the DM can always take it over or the setting can be off.
      if (this.needsDeathSave(started)) {
        const ref: ActorRef = { entryId: started.id, pageId: result.started?.pageId, tokenId: result.started?.tokenId };
        const owner = this.campaign.settings.playersRollDeathSaves === false ? null : this.deathSaveOwner(started, ref);
        if (owner) this.say({ type: "prompt", who: "", content: `${started.name}은(는) 쓰러져 있습니다 — 죽음 내성`, prompt: { kind: "death-save", mover: { name: started.name, ...ref }, reactor: { name: started.name, ...ref } } });
        else this.rollDeathSave(started.id, "");
      }
    } else if (started?.kind === "npc") {
      let runtime = { ...started.runtime, legendaryUsed: 0, spent: { ...started.runtime.spent } };
      // H1 (D238): regeneration — hit points back at the start of its turn while it has any, unless a suppressing
      // damage type hit it since its last turn (suppressRegeneration marked that).
      const regen = traitRule(started.statBlock, "regeneration");
      const suppressed = (runtime.effects ?? []).some((effect) => effect.key === REGEN_SUPPRESSED);
      if (regen && suppressed) this.say({ type: "system", who: "", content: `${started.name}: ${regen.trait.name} 멈춤 (막는 피해를 받음)` });
      else if (regen) {
        // An unlinked token keeps its own hit points on its bar (D78); a linked one or no token uses the sheet.
        const actor = this.actorOfTurn(result.started);
        const bar = actor?.token?.bars[0];
        const onToken = Boolean(actor?.token && actor.page && !bar?.link && bar?.value !== undefined);
        const hp = onToken ? { current: bar!.value ?? 0, max: bar!.max ?? runtime.hp.max } : runtime.hp;
        if (hp.current > 0 && hp.current < hp.max) {
          const healed = Math.min(regen.rule.amount, hp.max - hp.current);
          if (onToken) this.storeToken(actor!.page!, { ...actor!.token!, bars: [{ ...bar!, value: hp.current + healed }, actor!.token!.bars[1], actor!.token!.bars[2]] });
          else runtime = { ...runtime, hp: { ...runtime.hp, current: runtime.hp.current + healed } };
          this.say({ type: "system", who: "", content: `${started.name}: ${regen.trait.name} +${healed} → HP ${hp.current + healed}/${hp.max}` });
        }
      }
      if (suppressed) runtime = { ...runtime, effects: (runtime.effects ?? []).filter((effect) => effect.key !== REGEN_SUPPRESSED) };
      for (const action of [...started.statBlock.actions, ...started.statBlock.bonusActions, ...started.statBlock.legendaryActions]) {
        const recharge = action.timing?.recharge;
        if (!recharge || !runtime.spent[action.name]) continue;
        const die = 1 + Math.floor(random() * recharge.sides);
        if (die >= recharge.min) { runtime.spent[action.name] = false; this.say({ type: "system", who: "", content: `${started.name}: ${action.name} 재충전 (d${recharge.sides}=${die})` }); }
        else this.say({ type: "system", who: "", content: `${started.name}: ${action.name} 재충전 실패 (d${recharge.sides}=${die}, ${recharge.min}+ 필요)` });
      }
      runtime = { ...runtime, updatedAt: this.now() };
      this.storeEntry({ ...started, runtime, updatedAt: this.now() });
    }
    // Turn-scoped marks (D97): 이탈·질주 end with the turn; 회피·도움·준비 last until the bearer's next turn starts.
    // R85 (D220): effects counted on a turn boundary — the caster (유도 화살, 잔혹한 모욕) or the bearer.
    if (result.ended?.entryId) this.tickAnchored(result.ended.entryId, "end");
    // R89 (D224): a creature ending its turn inside an area takes the area once, unless entering already hit it this turn.
    const endedEntry = result.ended?.entryId ? this.journalEntries.get(result.ended.entryId) : undefined;
    const endedAt = this.actorOfTurn(result.ended);
    if (endedEntry && endedEntry.kind !== "handout" && endedAt) for (const effect of (endedEntry.runtime.effects ?? []).filter((item) => item.key.startsWith("zone:"))) {
      const [, casterId, ...spell] = effect.key.split(":");
      const spellId = spell.join(":");
      const caster = this.journalEntries.get(casterId);
      const exec = spellExec(spellId);
      const sustain = exec ? sustainOf(exec) : null;
      if (!caster || !sustain || sustain.move || this.zoneHits.get(`${effect.key}|${endedEntry.id}`) === endedMark) continue;
      this.zoneHit(caster, spellId, endedAt, effect.key, endedMark);
    }
    // R103 (D238): a monster ending its turn burns everyone marked inside its aura, one roll for all.
    if (endedEntry?.kind === "npc") for (const aura of monsterAuras(endedEntry.statBlock)) {
      const key = `zone:${endedEntry.id}:aura:${aura.name}`;
      const victims = [...this.journalEntries.values()].filter((item) => item.kind !== "handout" && (item.runtime.effects ?? []).some((effect) => effect.key === key)).map((item) => this.resolveActor({ entryId: item.id }) ?? { entry: item });
      if (victims.length) this.auraCard(endedEntry, aura, victims);
    }
    if (result.started?.entryId) this.tickAnchored(result.started.entryId, "start");
    const endedActor = this.actorOfTurn(result.ended);
    if (endedActor) { this.rollEndSaves(endedActor); this.mark(endedActor, [...TURN_MARKS.endOfTurn], false); }
    // R28 (D151): the rage is judged at the end of its bearer's turn, on what happened since their last one.
    if (endedActor && this.rageOf(endedActor.entry) && !result.ended?.ragingDeed) this.endRage(this.journalEntries.get(endedActor.entry.id) ?? endedActor.entry, "그 사이 공격도 피해도 없었음");
    const startedActor = this.actorOfTurn(result.started);
    if (startedActor) this.mark(startedActor, [...TURN_MARKS.startOfTurn], false);
    // 도움 the starting creature granted ends now (until the start of the helper's next turn).
    if (startedActor?.token && startedActor.page) {
      const page = this.pages.get(startedActor.page.id);
      if (page) for (const token of page.tokens) { const kept = token.markers.filter((marker) => !(["도움", "교란", "약화", "둔화"].includes(marker.name) && marker.from === startedActor.token!.id)); if (kept.length !== token.markers.length) this.storeToken(page, { ...token, markers: kept }); }
    }
    // The reaction and the action economy come back at the start of the creature's turn.
    // R28 (D151): `ragingDeed` is the same kind of per-turn flag, and is cleared with them.
    const startedId = result.started?.id;
    this.setTracker(startedId ? { ...result.tracker, turns: result.tracker.turns.map((turn) => (turn.id === startedId ? { ...turn, reactionUsed: false, actionUsed: false, bonusUsed: false, attacksMade: 0, ragingDeed: false } : turn)) } : result.tracker);
  }

  /** The ribbon or a bookmark moved: every mirror learns it, then every page is resent so each player ends up with exactly their page. */
  private emitRibbon() {
    this.emit({ type: "ribbon", playerPageId: this.campaign.playerPageId, pageBookmarks: this.campaign.pageBookmarks ?? {} });
    for (const page of this.pages.values()) this.emit({ type: "page", page });
  }

  private storePage(page: Page) {
    this.pages.set(page.id, page);
    this.options.onPage?.({ page });
    this.emit({ type: "page", page });
  }

  private storeToken(page: Page, token: Token) {
    this.tokenRev += 1;
    token = { ...token, rev: this.tokenRev };
    const index = page.tokens.findIndex((item) => item.id === token.id);
    const next: Page = { ...page, tokens: index >= 0 ? page.tokens.map((item, at) => (at === index ? token : item)) : [...page.tokens, token], updatedAt: this.now() };
    this.pages.set(page.id, next);
    this.options.onPage?.({ page: next });
    this.emit({ type: "token", pageId: page.id, token });
  }

  /** Bars linked to a character attribute mirror the sheet (D78). */
  private withLinkedBars(token: Token): Token {
    const entry = token.represents ? this.journalEntries.get(token.represents) : undefined;
    if (!entry || entry.kind !== "character" || !this.options.attributeOf) return token;
    return { ...token, bars: token.bars.map((bar) => { if (!bar.link) return bar; const attribute = this.options.attributeOf!(entry, bar.link); return attribute ? { ...bar, value: attribute.value, max: attribute.max } : bar; }) as Token["bars"] };
  }

  /** A controller changed a linked, editable bar (bar 1 = hp): the character's sheet takes the value. */
  private applyBarEditsToCharacter(before: Token, after: Token, userId: string) {
    const entry = after.represents ? this.journalEntries.get(after.represents) : undefined;
    if (!entry || entry.kind !== "character") return;
    for (let index = 0; index < 3; index += 1) {
      const bar = after.bars[index];
      if (bar.link !== "hp" || !bar.editable || bar.value === undefined || bar.value === before.bars[index].value) continue;
      // R25 (D129): the only clamp used to be `Math.max(0, …)`, so a wire value of 999999 (or NaN) went to the sheet.
      if (!Number.isFinite(bar.value)) continue;
      const healed = Math.max(0, Math.min(Math.round(bar.value), entry.runtime.hp.maxSeen));
      const base = { ...entry.runtime, hp: { ...entry.runtime.hp, current: healed } };
      const runtime = { ...(entry.runtime.hp.current === 0 && healed > 0 ? wakeUp(base) : base), updatedAt: this.now() };
      const player = this.campaign.players.find((item) => item.userId === userId);
      this.storeEntry({ ...entry, runtime, updatedAt: this.now() });
      this.say({ type: "system", who: "", content: `${player?.displayName ?? "?"}: ${entry.name} HP ${before.bars[index].value ?? "?"} → ${bar.value}` });
    }
  }

  /** Tokens representing a changed character refresh their linked bars. */
  private refreshTokensOf(entry: JournalEntry) {
    if (entry.kind !== "character") return;
    for (const page of this.pages.values()) {
      for (const token of page.tokens) {
        if (token.represents !== entry.id) continue;
        const next = this.withLinkedBars({ ...token, name: token.name === entry.name ? token.name : token.name, image: token.image ?? entry.avatar });
        if (JSON.stringify(next.bars) !== JSON.stringify(token.bars)) this.storeToken(this.pages.get(page.id)!, next);
      }
    }
  }

  private async finishUpload(id: string, dataUrl: string) {
    const upload = this.uploads.get(id);
    if (!upload) return;
    this.uploads.delete(id);
    await this.options.artData?.put(upload.asset.hash, dataUrl);
    this.artAssets.set(id, upload.asset);
    this.options.onArt?.({ asset: upload.asset });
    this.emit({ type: "art", asset: upload.asset });
  }

  private async sendArt(peerId: string, asset: ArtAsset) {
    const dataUrl = await this.options.artData?.get(asset.hash);
    if (dataUrl === undefined) return this.reply(peerId, { type: "refused", reason: "호스트에 이 아트의 파일이 없습니다", commandType: "art.fetch", id: asset.id });
    const chunks = chunkText(dataUrl);
    chunks.forEach((data, index) => this.reply(peerId, { type: "art.data", id: asset.id, hash: asset.hash, index, total: chunks.length, data }));
  }

  private storeEntry(entry: JournalEntry) {
    const before = this.journalEntries.get(entry.id);
    this.journalEntries.set(entry.id, entry);
    // R85 (D220): a caster who stops concentrating takes the spell off everyone it was holding.
    const held = (item: JournalEntry | undefined) => (item && item.kind !== "handout" ? (item.runtime.effects ?? []).filter((effect) => effect.concentration).map((effect) => effect.key) : []);
    const kept = held(entry);
    const lost = held(before).filter((key) => !kept.includes(key));
    if (lost.length) for (const other of [...this.journalEntries.values()]) {
      if (other.kind === "handout" || other.id === entry.id) continue;
      this.shedEffects(other, (other.runtime.effects ?? []).filter((effect) => effect.fromConcentration && effect.from === entry.id && (lost.includes(effect.key) || lost.some((spellKey) => effect.key === `zone:${entry.id}:${spellKey.slice("spell:".length)}`))), `${entry.name}의 집중이 끝남`);
    }
    this.options.onJournal?.({ entry });
    this.emit({ type: "journal", entry });
    // The entry's avatar may now be visible to more (or fewer) viewers: resend that asset so mirrors converge.
    const ref = entry.avatar;
    if (ref?.startsWith("art:")) { const asset = this.artAssets.get(ref.slice(4)); if (asset) this.emit({ type: "art", asset }); }
    this.refreshTokensOf(entry);
  }

  /**
   * R89 (D224): a creature and a caster area. Entering (or ending a turn inside, see `nextTurn`) runs the spell repeat on
   * it once per tracker turn; a move-based area (가시 성장) runs once per `move` feet instead. Membership is an effect
   * held by the caster concentration (D220), so it disappears when the spell does.
   */
  private zoneAction(caster: JournalEntry, spellId: string, sustain: { move?: number }, target: { entry: JournalEntry; token?: Token; page?: Page }, action: "enter" | "leave" | "move", feet?: number) {
    if (caster.kind === "handout" || target.entry.kind === "handout") return;
    const key = `zone:${caster.id}:${spellId}`;
    const live = this.journalEntries.get(target.entry.id) as JournalCharacter | JournalNpc;
    const inside = (live.runtime.effects ?? []).find((effect) => effect.key === key);
    const aura = spellId.startsWith("aura:");
    const name = aura ? spellId.slice("aura:".length) : caster.runtime.effects?.find((effect) => effect.key === `spell:${spellId}`)?.name ?? spellId;
    const now = this.now();
    const store = (effects: ActiveEffect[]) => this.storeEntry({ ...live, runtime: { ...live.runtime, effects, updatedAt: now }, updatedAt: now } as JournalEntry);
    if (action === "leave") { if (inside) store((live.runtime.effects ?? []).filter((effect) => effect.key !== key)); this.say({ type: "system", who: "", content: `${target.token?.name ?? live.name}: ${name} 밖으로` }); return; }
    const turnMark = this.tracker.turns.length ? `${this.tracker.round}:${this.tracker.current}` : undefined;
    const member: ActiveEffect = inside ?? { key, name: `${name} 안`, source: "spell", duration: "구역", concentration: false, elapsed: 0, startedAt: now, from: caster.id, ...(aura ? {} : { fromConcentration: true }) };
    if (!inside) store([...(live.runtime.effects ?? []), member]);
    if (aura) return;
    const hits = action === "move" ? (sustain.move ? Math.max(1, Math.floor((feet ?? sustain.move) / sustain.move)) : 0) : sustain.move || (turnMark && this.zoneHits.get(`${key}|${live.id}`) === turnMark) ? 0 : 1;
    for (let n = 0; n < hits; n += 1) this.zoneHit(caster, spellId, target, key, turnMark);
  }

  /** H1 (D238): mark a regenerating creature that took a suppressing damage type; its next turn start reads and clears the mark. */
  private suppressRegeneration(entryId: string, damageTypes: string[]) {
    const live = this.journalEntries.get(entryId);
    if (live?.kind !== "npc" || !damageTypes.length) return;
    const stops = traitRule(live.statBlock, "regeneration")?.rule.suppressedByDamageTypes ?? [];
    if (!stops.some((type) => damageTypes.some((taken) => damageTypeKey(taken) === damageTypeKey(type)))) return;
    if ((live.runtime.effects ?? []).some((effect) => effect.key === REGEN_SUPPRESSED)) return;
    const now = this.now();
    this.storeEntry({ ...live, runtime: { ...live.runtime, effects: [...(live.runtime.effects ?? []), { key: REGEN_SUPPRESSED, name: "재생 멈춤", source: "feature", duration: "다음 턴 시작까지", concentration: false, elapsed: 0, startedAt: now }], updatedAt: now }, updatedAt: now });
  }

  /** R103 (D238): one aura card — the same damage roll for every creature marked inside. */
  private auraCard(owner: JournalNpc, aura: { name: string; rule: Extract<TraitRule, { pattern: "aura-damage" }> }, victims: Array<{ entry: JournalEntry; token?: Token; page?: Page }>) {
    const dice = diceParts(aura.rule.dice);
    if (!dice) return;
    const caster = this.combatantOf(this.resolveActor({ entryId: owner.id }) ?? { entry: owner });
    const rows = victims.map((victim) => ({ victim, combatant: this.combatantOf(victim), stats: this.statsOf(victim) })).filter((row): row is { victim: typeof row.victim; combatant: Combatant; stats: ActorStats } => Boolean(row.combatant && row.stats));
    if (!caster || !rows.length) return;
    const exec: SpellExec = { spellId: `npc:${aura.name}`, baseLevel: 0, castingEconomy: "action", targeting: { kind: "creature", minTargets: 1, maxTargets: rows.length }, primary: { kind: "area-damage", damageType: aura.rule.damageType, dice: { count: dice.count, sides: dice.sides, ...(dice.flat ? { flat: dice.flat } : {}) } } };
    const spec = { spellId: exec.spellId, name: aura.name, level: 0, exec };
    const casterStats = { attackBonus: 0, saveDc: 0, modifier: 0, level: 1 };
    const resolution = { ...resolveSpell({ caster, casterStats, spec, targets: rows.map((row) => ({ combatant: row.combatant, stats: row.stats })), dice: diceFrom(this.options.random ?? Math.random), apply: true }), source: "action" as const };
    this.postSpell(resolution, rows.map((row) => row.victim), () => undefined, false, "", this.options.hostUserId, { spec, casterStats });
  }

  /** R89 (D224): the area repeat on one creature, cast by the caster at no cost, remembered for this turn. */
  private zoneHit(caster: JournalEntry, spellId: string, target: { entry: JournalEntry; token?: Token; page?: Page }, key: string, turnMark?: string) {
    const casterToken = [...this.pages.values()].flatMap((page) => page.tokens.filter((token) => token.represents === caster.id).map((token) => ({ pageId: page.id, tokenId: token.id })))[0];
    const targetRef = this.refOf(target);
    this.apply(this.options.hostUserId, { type: "act.cast", caster: { entryId: caster.id, ...(casterToken ?? {}) }, spellId, targets: [targetRef], method: { kind: "sustain" } }, "");
    if (turnMark) this.zoneHits.set(`${key}|${target.entry.id}`, turnMark);
  }

  /** R85 (D220): "until the end of your next turn" cast on your own turn: the end of this turn does not count. */
  private castOnOwnTurn(effect: { anchor?: { who: string; boundary: string }; rounds?: number }, casterId: string) {
    return effect.anchor?.who === "source" && effect.anchor.boundary === "end" && effect.rounds !== undefined && this.tracker.turns[this.tracker.current]?.entryId === casterId;
  }

  /** R85 (D220): one round passes for every effect anchored to this creature turn boundary; the finished ones end. */
  private tickAnchored(entityId: string, boundary: "start" | "end") {
    for (const entry of [...this.journalEntries.values()]) {
      if (entry.kind === "handout") continue;
      const counts = (effect: ActiveEffect) => effect.anchor?.boundary === boundary && effect.rounds !== undefined && (effect.anchor.who === "source" ? (effect.from ?? entry.id) : entry.id) === entityId;
      if (!(entry.runtime.effects ?? []).some(counts)) continue;
      const effects = (entry.runtime.effects ?? []).map((effect) => (counts(effect) ? { ...effect, elapsed: effect.elapsed + 1 } : effect));
      const done = effects.filter((effect) => counts(effect) && effect.elapsed >= effect.rounds!);
      const now = this.now();
      const aged = { ...entry, runtime: { ...entry.runtime, effects, updatedAt: now }, updatedAt: now } as JournalEntry;
      this.storeEntry(aged);
      this.shedEffects(aged, done, "지속 시간 끝");
    }
  }

  /**
   * R85 (D220): take effects off a creature with what they carried — the conditions on the sheet or the stat block,
   * the markers on its tokens, the end-of-turn saves. A condition another remaining effect also carries stays.
   */
  private shedEffects(entry: JournalEntry, gone: ActiveEffect[], why: string) {
    if (!gone.length || entry.kind === "handout") return;
    const keys = gone.map((effect) => effect.key);
    const names = gone.map((effect) => effect.name);
    const live = this.journalEntries.get(entry.id) ?? entry;
    // A condition another effect still on this creature carries stays (two 포박 sources, one ends).
    const carried = (effect: ActiveEffect) => [effect.name, ...(effect.conditions ?? []), ...(effect.endSave?.conditions ?? [])];
    const still = live.kind === "handout" ? [] : (live.runtime.effects ?? []).filter((effect) => !keys.includes(effect.key)).flatMap(carried);
    const shed = gone.flatMap(carried).filter((name) => !still.includes(name));
    const now = this.now();
    // R86 (D221): if a card set this off, undoing that card puts the effects, conditions and markers back.
    if (live.kind !== "handout") {
      const takenConditions = live.runtime.conditions.filter((name) => shed.includes(name));
      const takenMarkers = [...this.pages.values()].flatMap((page) => page.tokens.filter((token) => token.represents === entry.id).map((token) => ({ pageId: page.id, tokenId: token.id, names: token.markers.filter((marker) => shed.includes(marker.name)) })));
      this.childOf(() => {
        const back = this.journalEntries.get(entry.id);
        if (back && back.kind !== "handout") {
          const effects = [...(back.runtime.effects ?? []), ...gone.filter((effect) => !(back.runtime.effects ?? []).some((item) => item.key === effect.key))];
          const conditions = [...back.runtime.conditions, ...takenConditions.filter((name) => !back.runtime.conditions.includes(name))];
          this.storeEntry({ ...back, runtime: { ...back.runtime, effects, conditions, updatedAt: this.now() }, updatedAt: this.now() } as JournalEntry);
        }
        for (const taken of takenMarkers) {
          const page = this.pages.get(taken.pageId);
          const token = page?.tokens.find((item) => item.id === taken.tokenId);
          if (page && token && taken.names.length) this.storeToken(page, { ...token, markers: [...token.markers, ...taken.names.filter((marker) => !token.markers.some((item) => item.name === marker.name))] });
        }
      });
    }
    if (live.kind === "character") {
      const runtime = noteLog({ ...live.runtime, effects: (live.runtime.effects ?? []).filter((effect) => !keys.includes(effect.key)), conditions: live.runtime.conditions.filter((name) => !shed.includes(name)) }, `종료: ${names.join(", ")} (${why})`);
      this.storeEntry({ ...live, runtime: { ...runtime, updatedAt: now }, updatedAt: now });
    } else if (live.kind === "npc") {
      this.storeEntry({ ...live, runtime: { ...live.runtime, effects: (live.runtime.effects ?? []).filter((effect) => !keys.includes(effect.key)), conditions: live.runtime.conditions.filter((name) => !shed.includes(name)), endSaves: (live.runtime.endSaves ?? []).filter((item) => !keys.includes(item.key)), updatedAt: now }, updatedAt: now });
    }
    for (const page of this.pages.values()) for (const token of page.tokens) {
      if (token.represents !== entry.id) continue;
      const markers = token.markers.filter((marker) => !shed.includes(marker.name));
      if (markers.length !== token.markers.length) this.storeToken(page, { ...token, markers });
    }
    this.say({ type: "system", who: "", content: `${entry.name}: ${names.join(", ")} 끝남 (${why})` });
  }

  /** R16: take a token off a page (a summon going away); the tracker forgets its turn too. */
  private dropToken(pageId: string, tokenId: string) {
    const page = this.pages.get(pageId);
    if (!page || !page.tokens.some((token) => token.id === tokenId)) return;
    const next = { ...page, tokens: page.tokens.filter((token) => token.id !== tokenId), updatedAt: this.now() };
    this.pages.set(page.id, next);
    this.options.onPage?.({ page: next });
    this.emit({ type: "token.removed", pageId: page.id, id: tokenId });
    const tracker = withoutToken(this.tracker, page.id, tokenId);
    if (tracker !== this.tracker && tracker.turns.length !== this.tracker.turns.length) this.setTracker(tracker);
  }

  private dropEntry(id: string) {
    if (!this.journalEntries.delete(id)) return;
    this.options.onJournal?.({ removed: id });
    this.emit({ type: "journal.removed", id });
  }

  private say(body: Omit<ChatMessage, "id" | "at">) { this.sayWithId(newMessageId(), body); }

  /** Says a card under a fixed id; saying it again under the same id (D90 확인, a held spell applied) replaces the earlier version. */
  private sayWithId(id: string, body: Omit<ChatMessage, "id" | "at">) {
    const message: ChatMessage = { ...body, id, at: this.now() };
    // R24: the in-process log is bounded like the saved archive; the persisted one (campaigns.tsx) keeps the tail.
    this.chat = this.chat.some((item) => item.id === id) ? this.chat.map((item) => (item.id === id ? message : item)) : [...this.chat, message].slice(-CHAT_BUFFER);
    this.options.onChat?.(message);
    this.emit({ type: "chat", message });
    // R87 (D222): a window nobody answers takes its default answer, so one absent player does not stop the table.
    const seconds = this.campaign.settings.promptTimeoutSeconds ?? 90;
    if (message.type === "prompt" && message.prompt && !message.prompt.outcome && !message.supersedes && seconds > 0) {
      const run = () => this.timeoutPrompt(id);
      if (this.options.setTimer) this.options.setTimer(seconds * 1000, run);
      else { const handle = setTimeout(run, seconds * 1000) as unknown as { unref?: () => void }; handle.unref?.(); }
    }
  }

  /** R87 (D222): the default answer — a death save is rolled, every other window is declined (its standing policies still apply). */
  private timeoutPrompt(id: string) {
    const message = this.chat.find((item) => item.id === id);
    if (!message?.prompt || message.prompt.outcome || this.promptAnswered(id)) return;
    if (message.prompt.kind === "death-save" && message.prompt.reactor.entryId) { this.rollDeathSave(message.prompt.reactor.entryId, ""); this.say({ ...message, prompt: { ...message.prompt, outcome: { rolled: "시간 초과" } }, supersedes: id, content: `${message.content} → 시간 초과로 자동 굴림` }); return; }
    this.apply(this.options.hostUserId, { type: "act.decline", messageId: id }, "");
  }

  private peerLeft(peerId: string) {
    const userId = this.peerUsers.get(peerId);
    this.peerUsers.delete(peerId);
    if (!userId || [...this.peerUsers.values()].includes(userId)) return;
    // R25 (D132): a half-finished upload used to sit in the host's process for the rest of the night, once per try.
    for (const [id, upload] of [...this.uploads]) if (upload.by === userId) { this.uploads.delete(id); this.assembler.drop(id); }
    if (!this.connected.delete(userId)) return;
    const player = this.campaign.players.find((item) => item.userId === userId);
    if (!player || player.kicked) return;
    this.emit({ type: "presence", player: this.presence(userId) });
    this.say({ type: "system", who: "", content: `${player.displayName} 연결 끊김` });
  }

  /**
   * The event as one viewer receives it: chat by Roll20 visibility; a journal entry projected (GM notes stripped),
   * or turned into a removal when this viewer may not see it (so a mirror that had it drops it); a "show" only to
   * those who can see the entry.
   */
  private project(event: TableEvent, viewer: Viewer): TableEvent | null {
    switch (event.type) {
      case "chat": return visibleTo(event.message, viewer) ? event : null;
      // R17: a player gets only the shared macros, and a table's name without its rows.
      case "clock": return event;
      case "macros": return viewer.role === "gm" ? event : { ...event, macros: event.macros.filter((macro) => macro.shared) };
      case "tables": return viewer.role === "gm" ? event : { ...event, tables: event.tables.filter((table) => table.shared).map((table) => ({ ...table, rows: [] })) };
      case "journal": { const entry = projectEntry(event.entry, viewer); return entry ? { ...event, entry } : { n: event.n, type: "journal.removed", id: event.entry.id }; }
      case "journal.show": { const entry = this.journalEntries.get(event.id); return entry && canView(entry, viewer) ? event : null; }
      case "art": return artVisible(event.asset, viewer, this.journal) ? event : { n: event.n, type: "art.removed", id: event.asset.id };
      case "page": { const page = projectPage(event.page, viewer, this.campaign); return page ? { ...event, page } : { n: event.n, type: "page.removed", id: event.page.id }; }
      case "token": { if (viewer.role === "gm") return event; const page = this.pages.get(event.pageId); if (!page || page.archived || page.id !== playerPageId(this.campaign, viewer)) return null; const token = projectToken(event.token, viewer); return token ? { ...event, token } : { n: event.n, type: "token.removed", pageId: event.pageId, id: event.token.id }; }
      case "token.removed": { if (viewer.role === "gm") return event; return event.pageId === playerPageId(this.campaign, viewer) ? event : null; }
      case "ribbon": {
        if (viewer.role === "gm") return event;
        // A player's page changed: they get their new page whole (the mirror replaces what it had).
        return event;
      }
      default: return event;
    }
  }

  private emit(body: DistributiveOmit<TableEvent, "n">) {
    this.n += 1;
    const event = { ...body, n: this.n } as TableEvent;
    this.events = [...this.events, event].slice(-EVENT_BUFFER);
    for (const [peerId, userId] of this.peerUsers) { const projected = this.project(event, this.viewer(userId)); if (projected) this.reply(peerId, { type: "events", events: [projected] }); }
    for (const listener of [...this.listeners]) listener(event);
  }

  private reply(peerId: string, message: HostMessage) { (this.peerTransports.get(peerId) ?? this.transports[0]).send(peerId, message); }
}

const sameActor = (a: ActorRef, b: ActorRef) => (a.tokenId && b.tokenId ? a.tokenId === b.tokenId && (a.pageId ?? "") === (b.pageId ?? "") : Boolean(a.entryId) && a.entryId === b.entryId);
