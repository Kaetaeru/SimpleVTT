import type { ProgressionCharacterState } from "./progression";
import { DomainEvaluationError } from "./profileEngine";
import {
  allClassCantripIds,
  allClassLevelOneRitualSpellIds,
} from "./spellRuleCatalog";
import { invocationBaseId } from "./warlockProgressionChoices";

export const WARLOCK_PACT_TOME_INVOCATION_ID = "invocation:pact-of-the-tome";
export const WARLOCK_PACT_TOME_SOURCE = "feature:warlock.pact-of-the-tome.book-of-shadows";

declare module "./progression" {
  interface ProgressionCharacterState {
    pactTomeCantripIds?: string[];
    pactTomeRitualSpellIds?: string[];
    pactTomeSpellSources?: Record<string,string>;
  }
}

export interface PactTomeRestRequest {
  expectedRevision:number;
  rest:"short"|"long";
  cantripIds:string[];
  ritualSpellIds:string[];
}

export type PactTomeRestResolution =
  | { status:"committed"; state:ProgressionCharacterState }
  | { status:"rejected"; state:ProgressionCharacterState; error:string };

function normalizedSpellId(id:string) {
  return id.replace(/^always:/,"");
}

export function hasPactOfTheTome(state:ProgressionCharacterState) {
  return (state.eldritchInvocationIds ?? []).some((id) => invocationBaseId(id) === WARLOCK_PACT_TOME_INVOCATION_ID);
}

function currentTomeSpellIds(state:ProgressionCharacterState) {
  return new Set([
    ...(state.pactTomeCantripIds ?? []),
    ...(state.pactTomeRitualSpellIds ?? []),
  ]);
}

function alreadyPreparedOutsideCurrentTome(state:ProgressionCharacterState) {
  const tome = currentTomeSpellIds(state);
  return new Set([
    ...(state.cantripIds ?? []),
    ...(state.preparedSpellIds ?? []).map(normalizedSpellId),
  ].filter((spellId) => !tome.has(spellId)));
}

function requireExactUnique(ids:string[],count:number,label:string) {
  if (ids.length !== count) throw new DomainEvaluationError(`${label} requires exactly ${count} spells`);
  if (new Set(ids).size !== ids.length) throw new DomainEvaluationError(`${label} cannot contain duplicate spells`);
}

export function pactTomeCandidateIds(state:ProgressionCharacterState) {
  const alreadyPrepared = alreadyPreparedOutsideCurrentTome(state);
  return {
    cantripIds:allClassCantripIds().filter((spellId) => !alreadyPrepared.has(spellId)),
    ritualSpellIds:allClassLevelOneRitualSpellIds().filter((spellId) => !alreadyPrepared.has(spellId)),
  };
}

export function pactTomePreparedView(state:ProgressionCharacterState) {
  if (!hasPactOfTheTome(state)) {
    return {
      cantripIds:[...(state.cantripIds ?? [])],
      preparedSpellIds:[...(state.preparedSpellIds ?? [])],
      warlockSpellIds:[] as string[],
    };
  }
  const tomeCantrips = state.pactTomeCantripIds ?? [];
  const tomeRituals = state.pactTomeRitualSpellIds ?? [];
  return {
    cantripIds:[...new Set([...(state.cantripIds ?? []),...tomeCantrips])],
    preparedSpellIds:[...new Set([...(state.preparedSpellIds ?? []),...tomeRituals])],
    warlockSpellIds:[...new Set([...tomeCantrips,...tomeRituals])],
  };
}

export function resolvePactTomeRest(
  inputState:ProgressionCharacterState,
  request:PactTomeRestRequest,
):PactTomeRestResolution {
  try {
    if (request.expectedRevision !== inputState.revision) {
      throw new DomainEvaluationError(`revision mismatch: expected ${request.expectedRevision}, current ${inputState.revision}`);
    }
    if (!hasPactOfTheTome(inputState)) {
      throw new DomainEvaluationError("Pact of the Tome rest selection requires the Pact of the Tome invocation");
    }
    requireExactUnique(request.cantripIds,3,"Pact of the Tome cantrip selection");
    requireExactUnique(request.ritualSpellIds,2,"Pact of the Tome ritual selection");
    const allSelected = [...request.cantripIds,...request.ritualSpellIds];
    if (new Set(allSelected).size !== allSelected.length) {
      throw new DomainEvaluationError("Pact of the Tome Book of Shadows cannot select the same spell twice");
    }

    const eligibleCantrips = new Set(allClassCantripIds());
    const eligibleRituals = new Set(allClassLevelOneRitualSpellIds());
    const alreadyPrepared = alreadyPreparedOutsideCurrentTome(inputState);
    for (const spellId of request.cantripIds) {
      if (!eligibleCantrips.has(spellId)) {
        throw new DomainEvaluationError(`Pact of the Tome cantrip must appear on at least one class spell list: ${spellId}`);
      }
      if (alreadyPrepared.has(spellId)) {
        throw new DomainEvaluationError(`Pact of the Tome spell is already prepared outside the current Book of Shadows: ${spellId}`);
      }
    }
    for (const spellId of request.ritualSpellIds) {
      if (!eligibleRituals.has(spellId)) {
        throw new DomainEvaluationError(`Pact of the Tome ritual must be a level-1 Ritual spell on a class spell list: ${spellId}`);
      }
      if (alreadyPrepared.has(spellId)) {
        throw new DomainEvaluationError(`Pact of the Tome spell is already prepared outside the current Book of Shadows: ${spellId}`);
      }
    }

    const next:ProgressionCharacterState = structuredClone(inputState);
    next.revision += 1;
    next.pactTomeCantripIds = [...request.cantripIds];
    next.pactTomeRitualSpellIds = [...request.ritualSpellIds];
    next.pactTomeSpellSources = Object.fromEntries(
      allSelected.map((spellId) => [spellId,`${WARLOCK_PACT_TOME_SOURCE} · ${request.rest} rest · functions as a Warlock spell`]),
    );
    return { status:"committed", state:next };
  } catch (error) {
    return {
      status:"rejected",
      state:inputState,
      error:error instanceof Error ? error.message : String(error),
    };
  }
}
