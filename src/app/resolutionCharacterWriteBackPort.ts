import type { MockAdapter } from "./mockAdapter";
import type { ResolutionEvent } from "../domain/resolutionTypes";
import type { CharacterWriteBackDirection } from "./resolutionCharacterDurableProjection";

export type CharacterResolutionWriteBackResult =
  | { status:"committed"; changed:boolean }
  | { status:"rejected"; error:string };

type CharacterResolutionWriteBackHandler = (
  adapter:MockAdapter,
  events:ResolutionEvent[],
  direction:CharacterWriteBackDirection,
) => Promise<CharacterResolutionWriteBackResult>;

type CharacterResolutionWriteBackGuard = (
  adapter:MockAdapter,
  events:ResolutionEvent[],
  direction:CharacterWriteBackDirection,
) => Promise<CharacterResolutionWriteBackResult|undefined>;

let handler:CharacterResolutionWriteBackHandler|undefined;
let guard:CharacterResolutionWriteBackGuard|undefined;

export function installCharacterResolutionWriteBackHandler(next:CharacterResolutionWriteBackHandler) {
  handler=next;
}

export function installCharacterResolutionWriteBackGuard(next:CharacterResolutionWriteBackGuard) {
  guard=next;
}

export async function persistCharacterResolutionEvents(
  adapter:MockAdapter,
  events:ResolutionEvent[],
  direction:CharacterWriteBackDirection,
):Promise<CharacterResolutionWriteBackResult> {
  const guarded=await guard?.(adapter,events,direction);
  if (guarded) return guarded;
  if (!handler) return { status:"committed",changed:false };
  return handler(adapter,events,direction);
}
