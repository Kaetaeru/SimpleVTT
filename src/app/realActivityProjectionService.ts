import type { ActivityEntry, ResolutionView } from "./contracts";
import type { ResolutionEvent } from "../domain/resolutionTypes";
import type { RuntimeStateChange } from "../domain/runtimeStateChange";

function stateChangeLabel(change:RuntimeStateChange) {
  if (change.kind === "hp") {
    const field = change.field === "current" ? "HP" : change.field === "maximum" ? "최대 HP" : "임시 HP";
    return `${change.targetId} ${field} ${change.before} → ${change.after}`;
  }
  if (change.kind === "economy") {
    return `${change.targetId} economy.${change.field} ${String(change.before)} → ${String(change.after)}`;
  }
  if (change.kind === "resource") {
    return `${change.targetId} resource.${change.resourceId} ${change.before} → ${change.after}`;
  }
  if (change.kind === "effect") {
    return `${change.targetId} effect.${change.effectId} ${change.operation}`;
  }
  if (change.kind === "concentration") {
    return `${change.targetId} concentration ${change.before ?? "—"} → ${change.after ?? "—"}`;
  }
  return `${change.targetId} life.${change.field} ${String(change.before)} → ${String(change.after)}`;
}

export function projectResolutionEventsToActivity(input:{
  resolution:ResolutionView;
  events:ResolutionEvent[];
  actorName:string;
  targetNames:string[];
}):ActivityEntry {
  const { resolution, events } = input;
  const detail = events.flatMap((event,index) => [
    `ResolutionEvent ${index + 1}/${events.length} · ${event.kind} · ${event.operationId}`,
    event.summary,
    ...event.provenance.map((entry) => `출처: ${entry.source} · ${entry.status} · ${entry.reason}`),
  ]);
  const stateChanges = events.flatMap((event) => event.stateChanges.map(stateChangeLabel));
  return {
    id:resolution.id,
    time:"지금",
    actor:input.actorName,
    title:`${resolution.actionName} → ${input.targetNames.join(", ") || "—"}`,
    summary:resolution.compact,
    detail,
    stateChanges,
  };
}
