import type { LocalImageAssetV1 } from "./localImageAsset";
import { isLocalImageAssetV1, PORTRAIT_IMAGE_MAX_BYTES } from "./localImageAsset";

export interface CharacterPortraitV1 {
  asset:LocalImageAssetV1;
  focalX:number;
  focalY:number;
}

function focal(value:unknown):value is number {
  return typeof value==="number"&&Number.isFinite(value)&&value>=0&&value<=1;
}

export function sanitizeCharacterPortrait(value:unknown):CharacterPortraitV1|undefined {
  if (!value||typeof value!=="object"||Array.isArray(value)) return undefined;
  const raw=value as Record<string,unknown>;
  if (!isLocalImageAssetV1(raw.asset,PORTRAIT_IMAGE_MAX_BYTES)||!focal(raw.focalX)||!focal(raw.focalY)) return undefined;
  return {asset:structuredClone(raw.asset),focalX:raw.focalX,focalY:raw.focalY};
}

declare module "./contracts" {
  interface CharacterSheet {
    /** Presentation-only Character portrait, durable through the owning Client Character Library materialized record. */
    portrait?:CharacterPortraitV1;
  }
}

export {};
