import { chooseReaction, openReactionWindow, type ReactionOption } from "./reactionWindow";
import { useTurnSlot, type TurnEconomyState } from "./turnEconomy";
import { economyStateChanges, type StateChange } from "./stateChange";
import type { ProvenanceRecord } from "./profileEngine";

export interface ReactorOption extends ReactionOption {
  actorId: string;
  eligible?: boolean;
  ineligibleReason?: string;
}

export interface ReactorWindow {
  actorId: string;
  trigger: string;
  optionIds: string[];
  choiceRequired: boolean;
  blockedReasons: string[];
}

export interface ReactionResolution {
  optionId: string;
  nextEconomy: TurnEconomyState;
  stateChanges: StateChange[];
  provenance: ProvenanceRecord[];
}

export function openReactorWindow(
  actorId: string,
  economy: TurnEconomyState,
  trigger: string,
  options: ReactorOption[],
): ReactorWindow {
  const actorOptions = options.filter((option) => option.actorId === actorId);
  const blockedReasons = actorOptions.filter((option) => option.eligible === false).map((option) => option.ineligibleReason ?? `${option.id} is not eligible`);
  const eligible = actorOptions.filter((option) => option.eligible !== false);
  const opened = openReactionWindow(economy.reaction, trigger, eligible);
  return { actorId, trigger, optionIds:opened.optionIds, choiceRequired:opened.choiceRequired, blockedReasons };
}

export function resolveReactionChoice(
  actorId: string,
  economy: TurnEconomyState,
  window: ReactorWindow,
  optionId: string,
): ReactionResolution {
  const chosen = chooseReaction({ trigger:window.trigger, optionIds:window.optionIds, choiceRequired:window.choiceRequired }, optionId);
  const nextEconomy = useTurnSlot(economy, "reaction");
  const provenance: ProvenanceRecord[] = [{
    source:`reaction:${chosen}`,
    status:"applied",
    reason:`${actorId} spends Reaction on ${chosen} after trigger ${window.trigger}`,
  }];
  return {
    optionId:chosen,
    nextEconomy,
    stateChanges:economyStateChanges(actorId, economy, nextEconomy, provenance),
    provenance,
  };
}
