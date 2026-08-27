import type { ActivityEntry, ResolutionView } from "./contracts";
import type { ResolutionEvent } from "../domain/resolutionTypes";
import type { RuntimeStateChange } from "../domain/runtimeStateChange";
import { recordCommittedResolutionEvents } from "./resolutionEventCommitRegistry";

function concentrationLabel(state:Extract<RuntimeStateChange,{kind:"concentration"}>["before"]) {
  return state ? `${state.groupId} (${state.sourceId})` : "—";
}

function spellcastingTurnLabel(state:Extract<RuntimeStateChange,{kind:"spellcasting-turn"}>["before"]) {
  return state ? `${state.turnId} [${state.slottedCasterIds.join(", ") || "—"}]` : "—";
}

function stateChangeLabel(change:RuntimeStateChange) {
  if (change.kind === "hp") {
    const field = change.field === "current" ? "HP" : change.field === "maximum" ? "최대 HP" : "임시 HP";
    return `${change.targetId} ${field} ${change.before} → ${change.after}`;
  }
  if (change.kind === "economy") {
    if (change.field==="extraActions"||change.field==="extraAttacks") return `${change.targetId} ${change.field==="extraActions"?"추가 행동":"추가 공격"} ${change.before.length} → ${change.after.length}`;
    return `${change.targetId} economy.${change.field} ${String(change.before)} → ${String(change.after)}`;
  }
  if (change.kind === "resource") {
    return `${change.targetId} resource.${change.resourceId} ${change.before} → ${change.after}`;
  }
  if (change.kind === "effect") {
    return `${change.targetId} effect.${change.effectId} ${change.operation}`;
  }
  if (change.kind === "artifact") {
    return `${change.targetId} artifact.${change.artifactId} ${change.operation}`;
  }
  if (change.kind === "zone-membership") {
    return `${change.targetId} zone-membership.${change.artifactId} ${change.operation}`;
  }
  if (change.kind === "concentration") {
    return `${change.targetId} concentration ${concentrationLabel(change.before)} → ${concentrationLabel(change.after)}`;
  }
  if (change.kind === "spellcasting-turn") {
    return `${change.targetId} spellcasting-turn ${spellcastingTurnLabel(change.before)} → ${spellcastingTurnLabel(change.after)}`;
  }
  if (change.kind==="death-save") return `${change.targetId} death-save.${change.field} ${change.before} → ${change.after}`;
  return `${change.targetId} life.${change.field} ${String(change.before)} → ${String(change.after)}`;
}

export function projectRuntimeEventsToActivity(input:{
  id:string;
  actorName:string;
  title:string;
  summary:string;
  events:ResolutionEvent[];
}):ActivityEntry {
  recordCommittedResolutionEvents(input.id,input.events);
  const detail = input.events.flatMap((event,index) => [
    `ResolutionEvent ${index + 1}/${input.events.length} · ${event.kind} · ${event.operationId}`,
    event.summary,
    ...event.provenance.map((entry) => `출처: ${entry.source} · ${entry.status} · ${entry.reason}`),
  ]);
  const stateChanges = input.events.flatMap((event) => event.stateChanges.map(stateChangeLabel));
  return {
    id:input.id,
    time:"지금",
    actor:input.actorName,
    title:input.title,
    summary:input.summary,
    detail,
    stateChanges,
  };
}

export function projectResolutionEventsToActivity(input:{
  resolution:ResolutionView;
  events:ResolutionEvent[];
  actorName:string;
  targetNames:string[];
}):ActivityEntry {
  const { resolution } = input;
  return projectRuntimeEventsToActivity({
    id:resolution.id,
    actorName:input.actorName,
    title:`${resolution.actionName} → ${input.targetNames.join(", ") || "—"}`,
    summary:resolution.compact,
    events:input.events,
  });
}
