import { DomainEvaluationError } from "./profileEngine";

export interface ReactionOption {
  id: string;
  trigger: string;
  source: string;
}

export interface ReactionWindow {
  trigger: string;
  optionIds: string[];
  choiceRequired: boolean;
}

export function openReactionWindow(
  reactionAvailable: boolean,
  trigger: string,
  options: ReactionOption[],
): ReactionWindow {
  if (!trigger) throw new DomainEvaluationError("reaction trigger is required");
  if (!reactionAvailable) return { trigger, optionIds: [], choiceRequired: false };
  const optionIds = options.filter((option) => option.trigger === trigger).map((option) => option.id);
  return { trigger, optionIds, choiceRequired: optionIds.length > 0 };
}

export function chooseReaction(window: ReactionWindow, optionId: string): string {
  if (!window.choiceRequired) throw new DomainEvaluationError("no reaction choice is available");
  if (!window.optionIds.includes(optionId)) throw new DomainEvaluationError("reaction option is not eligible");
  return optionId;
}
