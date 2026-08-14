import type { ResourcePool } from "./resources";

export const HEROIC_INSPIRATION_RESOURCE_ID = "resource:heroic-inspiration";

export function heroicInspirationPool(current = 0):ResourcePool {
  if (!Number.isInteger(current) || current < 0 || current > 1) {
    throw new Error("Heroic Inspiration current value must be 0 or 1");
  }
  return {
    id:HEROIC_INSPIRATION_RESOURCE_ID,
    label:"Heroic Inspiration",
    current,
    maximum:1,
  };
}
