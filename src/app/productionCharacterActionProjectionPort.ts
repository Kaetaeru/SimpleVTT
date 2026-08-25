import type { ActionVm, CharacterSheet } from "./contracts";

type CharacterActionProjector=(character:CharacterSheet)=>ActionVm[];

let projector:CharacterActionProjector|null=null;

export function installProductionCharacterActionProjector(next:CharacterActionProjector) {
  projector=next;
}

export function projectProductionCharacterActions(character:CharacterSheet,fallback:ActionVm[]) {
  return (projector?.(character)??fallback).map((action)=>structuredClone(action));
}
