import type { DragEvent } from "react";

/** What a sidebar row carries when dragged (DM_WORKSPACE.md §2: drop on the table = the item's default verb). */
export type DragPayload=
  |{kind:"monster";monsterId:string;count?:number}
  |{kind:"npc";entryId:string;count?:number}
  |{kind:"preset";entryId:string}
  |{kind:"bundle";entryId:string}
  |{kind:"item";entryId?:string;definitionId:string;name:string;itemKind:"equipment"|"consumable"|"magic";quantity:number}
  |{kind:"condition";conditionId:string};
export const DRAG_MIME="application/x-simplevtt";
export function startDrag(event:DragEvent,payload:DragPayload) { event.dataTransfer.setData(DRAG_MIME,JSON.stringify(payload)); event.dataTransfer.effectAllowed="copy"; }
export function readDrag(event:DragEvent):DragPayload|null { try { const raw=event.dataTransfer.getData(DRAG_MIME); return raw?JSON.parse(raw) as DragPayload:null; } catch { return null; } }
export function acceptsDrag(event:DragEvent):boolean { return Array.from(event.dataTransfer.types).includes(DRAG_MIME); }
