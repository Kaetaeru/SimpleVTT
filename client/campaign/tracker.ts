/**
 * The turn tracker (ROLL20_TABLE_SPEC.md §6): a list of turns (tokens, or custom rows like a round counter with a
 * "+1" formula), the current turn, and the round. Unlike Roll20, "다음 턴" is a rules step (D87): the host runs
 * turn-end processing for the actor whose turn ends (effect rounds) and turn-start processing for the next one
 * (recharge rolls, death saves for a PC at 0 HP, legendary actions reset). This module holds the pure parts.
 */
export interface TrackerTurn {
  id: string;
  name: string;
  initiative: number;
  /** The token on the page, when the turn belongs to one. */
  tokenId?: string;
  pageId?: string;
  /** The journal entry behind the token (character or npc) for turn processing. */
  entryId?: string;
  image?: string;
  /** The creature spent its reaction (an opportunity attack) since its last turn started; cleared at its turn start. */
  reactionUsed?: boolean;
  /** Action economy for the current turn (D97): shown, never enforced — extra attacks and features still go. */
  actionUsed?: boolean;
  bonusUsed?: boolean;
  /** A custom row; `formula` like "+1" changes its value every time it comes around (Roll20's round counter idiom). */
  custom?: boolean;
  formula?: string;
}

export interface Tracker {
  /** Open on every screen while the GM keeps it open. */
  open: boolean;
  round: number;
  /** Index into `turns` of the current turn; -1 before the first advance. */
  current: number;
  turns: TrackerTurn[];
  /** Whether the list is kept sorted by initiative (descending) as rows are added. */
  sorted: boolean;
}

const randomId = () => `turn_${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 12) : Math.random().toString(36).slice(2, 14)}`;

export const emptyTracker = (): Tracker => ({ open: false, round: 1, current: -1, turns: [], sorted: true });

export const newTurn = (partial: Omit<TrackerTurn, "id"> & { id?: string }): TrackerTurn => ({ id: partial.id ?? randomId(), ...partial });

export const sortTurns = (turns: TrackerTurn[]) => [...turns].sort((a, b) => b.initiative - a.initiative || a.name.localeCompare(b.name, "ko"));

/** Add or replace the turn of a token (same token → same row, new initiative). Sorted lists stay sorted; the current turn keeps pointing at the same row. */
export function withTurn(tracker: Tracker, turn: TrackerTurn): Tracker {
  const currentId = tracker.turns[tracker.current]?.id;
  const existing = turn.tokenId ? tracker.turns.find((item) => item.tokenId === turn.tokenId && item.pageId === turn.pageId) : tracker.turns.find((item) => item.id === turn.id);
  const next = existing ? tracker.turns.map((item) => (item === existing ? { ...existing, ...turn, id: existing.id } : item)) : [...tracker.turns, turn];
  const turns = tracker.sorted ? sortTurns(next) : next;
  return { ...tracker, turns, current: currentId ? turns.findIndex((item) => item.id === currentId) : tracker.current };
}

export function withoutTurn(tracker: Tracker, id: string): Tracker {
  const currentId = tracker.turns[tracker.current]?.id;
  const turns = tracker.turns.filter((item) => item.id !== id);
  const current = currentId && currentId !== id ? turns.findIndex((item) => item.id === currentId) : Math.min(tracker.current, turns.length - 1);
  return { ...tracker, turns, current };
}

export const withoutToken = (tracker: Tracker, pageId: string, tokenId: string) => tracker.turns.filter((turn) => turn.pageId === pageId && turn.tokenId === tokenId).reduce((acc, turn) => withoutTurn(acc, turn.id), tracker);

export interface AdvanceResult {
  tracker: Tracker;
  /** The turn that just ended (undefined before the first turn). */
  ended?: TrackerTurn;
  /** The turn that now starts. */
  started?: TrackerTurn;
  roundWrapped: boolean;
}

/** Move to the next turn; wrapping to the top starts a new round and applies custom formulas ("+1"). */
export function advanceTurn(tracker: Tracker): AdvanceResult {
  if (tracker.turns.length === 0) return { tracker, roundWrapped: false };
  const ended = tracker.turns[tracker.current];
  let next = tracker.current + 1;
  let roundWrapped = false;
  let turns = tracker.turns;
  if (next >= turns.length) {
    next = 0;
    roundWrapped = true;
    turns = turns.map((turn) => (turn.custom && turn.formula ? { ...turn, initiative: applyFormula(turn.initiative, turn.formula) } : turn));
  }
  const started = turns[next];
  return { tracker: { ...tracker, turns, current: next, round: roundWrapped ? tracker.round + 1 : tracker.round }, ended, started, roundWrapped };
}

function applyFormula(value: number, formula: string) {
  const match = /^([+-])\s*(\d+)$/.exec(formula.trim());
  if (!match) return value;
  return match[1] === "+" ? value + Number(match[2]) : value - Number(match[2]);
}

/** The round counter row every tracker starts with (§6.3). */
export const roundCounterTurn = (round: number): TrackerTurn => newTurn({ id: "turn_round", name: "라운드", initiative: round, custom: true, formula: "+1" });
