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

let handler:CharacterResolutionWriteBackHandler|undefined;

export function installCharacterResolutionWriteBackHandler(next:CharacterResolutionWriteBackHandler) {
  handler=next;
}

export async function persistCharacterResolutionEvents(
  adapter:MockAdapter,
  events:ResolutionEvent[],
  direction:CharacterWriteBackDirection,
):Promise<CharacterResolutionWriteBackResult> {
  if (!handler) return { status:"committed",changed:false };
  return handler(adapter,events,direction);
}
